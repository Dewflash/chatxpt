import type { SampledPixelFrame } from "./visual-measurements";

const ANALYSIS_WIDTH = 160;
const ANALYSIS_HEIGHT = 90;
const COLUMNS = 5;
const ROWS = 3;
const MINIMUM_VECTOR_CONFIDENCE = 0.08;

export interface MinecraftCameraMotionMeasurement {
  readonly reliableVectorCount: number;
  readonly meanDx: number;
  readonly meanDy: number;
  readonly meanMagnitude: number;
  readonly yawCoherence: number;
  readonly yawStrength: number;
  readonly radialMotion: number;
  readonly radialCoherence: number;
  readonly confidence: number;
}

interface MotionVector {
  readonly dx: number;
  readonly dy: number;
  readonly confidence: number;
  readonly positionX: number;
  readonly positionY: number;
}

function validate(frame: SampledPixelFrame): void {
  if (!Number.isInteger(frame.width) || frame.width <= 0 || !Number.isInteger(frame.height) || frame.height <= 0) {
    throw new RangeError("Minecraft camera frames require positive integer dimensions");
  }
  if (!(frame.rgba instanceof Uint8ClampedArray) || frame.rgba.length !== frame.width * frame.height * 4) {
    throw new RangeError("Minecraft camera frames require one RGBA tuple per pixel");
  }
}

function luma(frame: SampledPixelFrame, x: number, y: number): number {
  const offset = (y * frame.width + x) * 4;
  return (
    frame.rgba[offset] * 0.2126 +
    frame.rgba[offset + 1] * 0.7152 +
    frame.rgba[offset + 2] * 0.0722
  ) / 255;
}

function downsample(frame: SampledPixelFrame): SampledPixelFrame {
  if (frame.width <= ANALYSIS_WIDTH && frame.height <= ANALYSIS_HEIGHT) return frame;
  const width = Math.min(ANALYSIS_WIDTH, frame.width);
  const height = Math.min(ANALYSIS_HEIGHT, frame.height);
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    const sourceY = Math.min(frame.height - 1, Math.floor((y + 0.5) * frame.height / height));
    for (let x = 0; x < width; x += 1) {
      const sourceX = Math.min(frame.width - 1, Math.floor((x + 0.5) * frame.width / width));
      const sourceOffset = (sourceY * frame.width + sourceX) * 4;
      const targetOffset = (y * width + x) * 4;
      rgba[targetOffset] = frame.rgba[sourceOffset];
      rgba[targetOffset + 1] = frame.rgba[sourceOffset + 1];
      rgba[targetOffset + 2] = frame.rgba[sourceOffset + 2];
      rgba[targetOffset + 3] = 255;
    }
  }
  return { width, height, rgba };
}

function emptyMeasurement(): MinecraftCameraMotionMeasurement {
  return {
    reliableVectorCount: 0,
    meanDx: 0,
    meanDy: 0,
    meanMagnitude: 0,
    yawCoherence: 0,
    yawStrength: 0,
    radialMotion: 0,
    radialCoherence: 0,
    confidence: 0,
  };
}

/**
 * Measures a small field of scene motion rather than treating every changed
 * pixel as the same activity. Horizontal coherence supports turning, while
 * vertical/radial motion across time supports player travel. HUD pixels below
 * 74% of the frame are intentionally excluded from this camera measurement.
 */
export function measureMinecraftCameraMotion(
  previousInput: SampledPixelFrame,
  currentInput: SampledPixelFrame,
): MinecraftCameraMotionMeasurement {
  validate(previousInput);
  validate(currentInput);
  if (previousInput.width !== currentInput.width || previousInput.height !== currentInput.height) {
    throw new RangeError("Minecraft camera motion frames must have matching dimensions");
  }
  const previous = downsample(previousInput);
  const current = downsample(currentInput);
  const left = Math.max(2, Math.round(previous.width * 0.05));
  const right = previous.width - left;
  const top = Math.max(2, Math.round(previous.height * 0.055));
  const bottom = Math.floor(previous.height * 0.74);
  const cellWidth = (right - left) / COLUMNS;
  const cellHeight = (bottom - top) / ROWS;
  const searchX = Math.max(3, Math.round(previous.width / 16));
  const searchY = Math.max(2, Math.round(previous.height / 15));
  const vectors: MotionVector[] = [];

  for (let row = 0; row < ROWS; row += 1) {
    for (let column = 0; column < COLUMNS; column += 1) {
      const x0 = Math.ceil(left + column * cellWidth + 3);
      const x1 = Math.floor(left + (column + 1) * cellWidth - 3);
      const y0 = Math.ceil(top + row * cellHeight + 3);
      const y1 = Math.floor(top + (row + 1) * cellHeight - 3);
      const error = (dx: number, dy: number): number => {
        let total = 0;
        let count = 0;
        for (let y = y0; y <= y1; y += 2) {
          for (let x = x0; x <= x1; x += 2) {
            const targetX = x + dx;
            const targetY = y + dy;
            if (targetX < 0 || targetX >= current.width || targetY < 0 || targetY >= current.height) continue;
            total += Math.abs(luma(previous, x, y) - luma(current, targetX, targetY));
            count += 1;
          }
        }
        return total / Math.max(1, count);
      };
      const zeroError = error(0, 0);
      let best = { dx: 0, dy: 0, error: zeroError };
      if (zeroError > 0.004) {
        for (let dy = -searchY; dy <= searchY; dy += 1) {
          for (let dx = -searchX; dx <= searchX; dx += 1) {
            const candidateError = error(dx, dy);
            if (candidateError < best.error) best = { dx, dy, error: candidateError };
          }
        }
      }
      vectors.push({
        dx: best.dx,
        dy: best.dy,
        confidence: zeroError <= 0.01
          ? 0
          : Math.max(0, Math.min(1, (zeroError - best.error) / zeroError)),
        positionX: (column + 0.5) / COLUMNS - 0.5,
        positionY: (row + 0.5) / ROWS - 0.5,
      });
    }
  }

  const reliable = vectors.filter(({ confidence }) => confidence >= MINIMUM_VECTOR_CONFIDENCE);
  if (reliable.length === 0) return emptyMeasurement();
  const totalWeight = reliable.reduce((total, vector) => total + vector.confidence, 0);
  const weighted = (value: (vector: MotionVector) => number): number =>
    reliable.reduce((total, vector) => total + value(vector) * vector.confidence, 0) /
    Math.max(0.001, totalWeight);
  const meanDx = weighted(({ dx }) => dx);
  const meanDy = weighted(({ dy }) => dy);
  const absoluteDx = weighted(({ dx }) => Math.abs(dx));
  const yawCoherence = Math.abs(meanDx) / Math.max(0.001, absoluteDx);
  const radialMotion = weighted(({ dx, dy, positionX, positionY }) =>
    dx * positionX + dy * positionY,
  );
  const radialCoherence = weighted(({ dx, dy, positionX, positionY }) => {
    const vectorMagnitude = Math.hypot(dx, dy);
    const positionMagnitude = Math.hypot(positionX, positionY);
    return vectorMagnitude === 0 || positionMagnitude === 0
      ? 0
      : (dx * positionX + dy * positionY) / (vectorMagnitude * positionMagnitude);
  });

  return {
    reliableVectorCount: reliable.length,
    meanDx,
    meanDy,
    meanMagnitude: weighted(({ dx, dy }) => Math.hypot(dx, dy)),
    yawCoherence,
    yawStrength: Math.abs(meanDx) * yawCoherence,
    radialMotion,
    radialCoherence,
    confidence: Math.max(0, Math.min(1, totalWeight / vectors.length)),
  };
}
