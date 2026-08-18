import type { NormalizedVisualRegion } from "./game-profiles";
import type { SampledPixelFrame } from "./visual-measurements";

export interface SpatialMotionCell {
  readonly column: number;
  readonly row: number;
  readonly sampledPixels: number;
  readonly changedPixelRatio: number;
  readonly colorChangedPixelRatio: number;
  readonly residualChangedPixelRatio: number;
  readonly meanLumaDelta: number;
}

export interface TranslationEstimate {
  readonly dx: number;
  readonly dy: number;
  readonly magnitude: number;
  readonly zeroShiftError: number;
  readonly compensatedError: number;
  readonly improvement: number;
  readonly confidence: number;
  readonly comparedPixels: number;
}

export interface SpatialMotionMeasurement {
  readonly width: number;
  readonly height: number;
  readonly changedPixelRatio: number;
  readonly colorChangedPixelRatio: number;
  readonly residualChangedPixelRatio: number;
  readonly meanLumaDelta: number;
  readonly colorHistogramDistance: number;
  readonly activeCellRatio: number;
  readonly spatialDispersion: number;
  readonly globalMotionShare: number;
  readonly translation: TranslationEstimate;
  readonly cells: readonly SpatialMotionCell[];
}

export interface SpatialMotionOptions {
  readonly columns?: number;
  readonly rows?: number;
  readonly changedLumaThreshold?: number;
  readonly changedColorThreshold?: number;
  readonly maxTranslationPixels?: number;
  readonly activeCellThreshold?: number;
  readonly excludedRegions?: readonly NormalizedVisualRegion[];
}

const DEFAULT_COLUMNS = 4;
const DEFAULT_ROWS = 3;
const DEFAULT_CHANGED_LUMA_THRESHOLD = 0.12;
const DEFAULT_CHANGED_COLOR_THRESHOLD = 0.18;
const DEFAULT_MAX_TRANSLATION = 4;
const DEFAULT_ACTIVE_CELL_THRESHOLD = 0.12;
const EPSILON = 1e-9;

function assertFrame(frame: SampledPixelFrame): void {
  if (!Number.isInteger(frame.width) || frame.width <= 0 || !Number.isInteger(frame.height) || frame.height <= 0) {
    throw new RangeError("motion input dimensions must be positive integers");
  }
  if (!(frame.rgba instanceof Uint8ClampedArray) || frame.rgba.length !== frame.width * frame.height * 4) {
    throw new RangeError("motion input must contain one RGBA tuple per pixel");
  }
}

function assertUnit(name: string, value: number): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError(`${name} must be between 0 and 1`);
  }
}

function clampUnit(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function luma(frame: SampledPixelFrame, x: number, y: number): number {
  const offset = (y * frame.width + x) * 4;
  const alpha = frame.rgba[offset + 3] / 255;
  return (
    ((frame.rgba[offset] * 0.2126 +
      frame.rgba[offset + 1] * 0.7152 +
      frame.rgba[offset + 2] * 0.0722) /
      255) *
    alpha
  );
}

function colorDelta(
  previous: SampledPixelFrame,
  current: SampledPixelFrame,
  previousX: number,
  previousY: number,
  currentX: number,
  currentY: number,
): number {
  const previousOffset = (previousY * previous.width + previousX) * 4;
  const currentOffset = (currentY * current.width + currentX) * 4;
  return Math.max(
    Math.abs(previous.rgba[previousOffset] - current.rgba[currentOffset]),
    Math.abs(previous.rgba[previousOffset + 1] - current.rgba[currentOffset + 1]),
    Math.abs(previous.rgba[previousOffset + 2] - current.rgba[currentOffset + 2]),
  ) / 255;
}

function colorBin(frame: SampledPixelFrame, x: number, y: number): number {
  const offset = (y * frame.width + x) * 4;
  return (
    Math.floor(frame.rgba[offset] / 64) * 16 +
    Math.floor(frame.rgba[offset + 1] / 64) * 4 +
    Math.floor(frame.rgba[offset + 2] / 64)
  );
}

function excluded(
  x: number,
  y: number,
  width: number,
  height: number,
  regions: readonly NormalizedVisualRegion[],
): boolean {
  const normalizedX = (x + 0.5) / width;
  const normalizedY = (y + 0.5) / height;
  return regions.some(
    (region) =>
      region.purpose === "motion-exclusion" &&
      normalizedX >= region.x &&
      normalizedX < region.x + region.width &&
      normalizedY >= region.y &&
      normalizedY < region.y + region.height,
  );
}

function shiftedError(
  previous: SampledPixelFrame,
  current: SampledPixelFrame,
  dx: number,
  dy: number,
  excludedRegions: readonly NormalizedVisualRegion[],
): { readonly error: number; readonly comparedPixels: number } {
  let total = 0;
  let comparedPixels = 0;
  for (let y = 0; y < previous.height; y += 1) {
    const currentY = y + dy;
    if (currentY < 0 || currentY >= current.height) continue;
    for (let x = 0; x < previous.width; x += 1) {
      const currentX = x + dx;
      if (currentX < 0 || currentX >= current.width) continue;
      if (
        excluded(x, y, previous.width, previous.height, excludedRegions) ||
        excluded(currentX, currentY, current.width, current.height, excludedRegions)
      ) {
        continue;
      }
      total += Math.abs(luma(previous, x, y) - luma(current, currentX, currentY));
      comparedPixels += 1;
    }
  }
  return { error: comparedPixels === 0 ? 1 : total / comparedPixels, comparedPixels };
}

export function estimateGlobalTranslation(
  previous: SampledPixelFrame,
  current: SampledPixelFrame,
  options: Pick<SpatialMotionOptions, "maxTranslationPixels" | "excludedRegions"> = {},
): TranslationEstimate {
  assertFrame(previous);
  assertFrame(current);
  if (previous.width !== current.width || previous.height !== current.height) {
    throw new RangeError("motion frames must have matching dimensions");
  }
  const maxTranslation = options.maxTranslationPixels ?? DEFAULT_MAX_TRANSLATION;
  if (!Number.isInteger(maxTranslation) || maxTranslation < 0 || maxTranslation > 12) {
    throw new RangeError("maxTranslationPixels must be an integer from 0 to 12");
  }
  const excludedRegions = options.excludedRegions ?? [];
  const zero = shiftedError(previous, current, 0, 0, excludedRegions);
  let best = { dx: 0, dy: 0, ...zero };
  for (let dy = -maxTranslation; dy <= maxTranslation; dy += 1) {
    for (let dx = -maxTranslation; dx <= maxTranslation; dx += 1) {
      if (dx === 0 && dy === 0) continue;
      const candidate = shiftedError(previous, current, dx, dy, excludedRegions);
      if (
        candidate.error < best.error - EPSILON ||
        (Math.abs(candidate.error - best.error) <= EPSILON && Math.hypot(dx, dy) < Math.hypot(best.dx, best.dy))
      ) {
        best = { dx, dy, ...candidate };
      }
    }
  }
  const improvement = zero.error <= EPSILON ? 0 : clampUnit((zero.error - best.error) / zero.error);
  const overlap = best.comparedPixels / Math.max(1, previous.width * previous.height);
  const confidence = best.dx === 0 && best.dy === 0 ? 0 : clampUnit(improvement * Math.min(1, overlap / 0.6));
  return {
    dx: best.dx,
    dy: best.dy,
    magnitude: Math.hypot(best.dx, best.dy),
    zeroShiftError: zero.error,
    compensatedError: best.error,
    improvement,
    confidence,
    comparedPixels: best.comparedPixels,
  };
}

function standardDeviation(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((total, value) => total + value, 0) / values.length;
  const variance = values.reduce((total, value) => total + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

export function measureSpatialMotion(
  previous: SampledPixelFrame,
  current: SampledPixelFrame,
  options: SpatialMotionOptions = {},
): SpatialMotionMeasurement {
  assertFrame(previous);
  assertFrame(current);
  if (previous.width !== current.width || previous.height !== current.height) {
    throw new RangeError("motion frames must have matching dimensions");
  }
  const columns = options.columns ?? DEFAULT_COLUMNS;
  const rows = options.rows ?? DEFAULT_ROWS;
  const changedThreshold = options.changedLumaThreshold ?? DEFAULT_CHANGED_LUMA_THRESHOLD;
  const changedColorThreshold = options.changedColorThreshold ?? DEFAULT_CHANGED_COLOR_THRESHOLD;
  const activeCellThreshold = options.activeCellThreshold ?? DEFAULT_ACTIVE_CELL_THRESHOLD;
  if (!Number.isInteger(columns) || columns < 2 || columns > 12 || !Number.isInteger(rows) || rows < 2 || rows > 12) {
    throw new RangeError("motion grid rows and columns must be integers from 2 to 12");
  }
  assertUnit("changedLumaThreshold", changedThreshold);
  assertUnit("changedColorThreshold", changedColorThreshold);
  assertUnit("activeCellThreshold", activeCellThreshold);
  const excludedRegions = options.excludedRegions ?? [];
  const translation = estimateGlobalTranslation(previous, current, options);
  const cellAccumulators = Array.from({ length: columns * rows }, () => ({
    sampledPixels: 0,
    changedPixels: 0,
    colorChangedPixels: 0,
    residualChangedPixels: 0,
    totalDelta: 0,
  }));
  let totalPixels = 0;
  let changedPixels = 0;
  let colorChangedPixels = 0;
  let residualChangedPixels = 0;
  let totalDelta = 0;
  const previousColorHistogram = Array.from({ length: 64 }, () => 0);
  const currentColorHistogram = Array.from({ length: 64 }, () => 0);

  for (let y = 0; y < previous.height; y += 1) {
    for (let x = 0; x < previous.width; x += 1) {
      if (excluded(x, y, previous.width, previous.height, excludedRegions)) continue;
      const shiftedX = x + translation.dx;
      const shiftedY = y + translation.dy;
      if (shiftedX < 0 || shiftedX >= current.width || shiftedY < 0 || shiftedY >= current.height) continue;
      const directDelta = Math.abs(luma(previous, x, y) - luma(current, x, y));
      const directColorDelta = colorDelta(previous, current, x, y, x, y);
      const residualDelta = Math.abs(luma(previous, x, y) - luma(current, shiftedX, shiftedY));
      const column = Math.min(columns - 1, Math.floor((x / previous.width) * columns));
      const row = Math.min(rows - 1, Math.floor((y / previous.height) * rows));
      const accumulator = cellAccumulators[row * columns + column];
      accumulator.sampledPixels += 1;
      accumulator.totalDelta += directDelta;
      totalPixels += 1;
      totalDelta += directDelta;
      previousColorHistogram[colorBin(previous, x, y)] += 1;
      currentColorHistogram[colorBin(current, x, y)] += 1;
      if (directDelta >= changedThreshold) {
        accumulator.changedPixels += 1;
        changedPixels += 1;
      }
      if (directColorDelta >= changedColorThreshold) {
        accumulator.colorChangedPixels += 1;
        colorChangedPixels += 1;
      }
      if (residualDelta >= changedThreshold) {
        accumulator.residualChangedPixels += 1;
        residualChangedPixels += 1;
      }
    }
  }

  const cells = cellAccumulators.map((accumulator, index): SpatialMotionCell => ({
    column: index % columns,
    row: Math.floor(index / columns),
    sampledPixels: accumulator.sampledPixels,
    changedPixelRatio:
      accumulator.sampledPixels === 0 ? 0 : accumulator.changedPixels / accumulator.sampledPixels,
    colorChangedPixelRatio:
      accumulator.sampledPixels === 0 ? 0 : accumulator.colorChangedPixels / accumulator.sampledPixels,
    residualChangedPixelRatio:
      accumulator.sampledPixels === 0 ? 0 : accumulator.residualChangedPixels / accumulator.sampledPixels,
    meanLumaDelta:
      accumulator.sampledPixels === 0 ? 0 : accumulator.totalDelta / accumulator.sampledPixels,
  }));
  const changedPixelRatio = totalPixels === 0 ? 0 : changedPixels / totalPixels;
  const colorChangedPixelRatio = totalPixels === 0 ? 0 : colorChangedPixels / totalPixels;
  const residualChangedPixelRatio = totalPixels === 0 ? 0 : residualChangedPixels / totalPixels;
  const activeCells = cells.filter(
    (cell) =>
      cell.sampledPixels > 0 &&
      Math.max(cell.changedPixelRatio, cell.colorChangedPixelRatio) >= activeCellThreshold,
  );
  const colorHistogramDistance = totalPixels === 0
    ? 0
    : previousColorHistogram.reduce(
        (total, count, index) => total + Math.abs(count - currentColorHistogram[index]),
        0,
      ) / (2 * totalPixels);
  return {
    width: previous.width,
    height: previous.height,
    changedPixelRatio,
    colorChangedPixelRatio,
    residualChangedPixelRatio,
    meanLumaDelta: totalPixels === 0 ? 0 : totalDelta / totalPixels,
    colorHistogramDistance,
    activeCellRatio: activeCells.length / Math.max(1, cells.filter(({ sampledPixels }) => sampledPixels > 0).length),
    spatialDispersion: standardDeviation(cells.map(({ residualChangedPixelRatio: value }) => value)),
    globalMotionShare:
      changedPixelRatio <= EPSILON
        ? 0
        : clampUnit((changedPixelRatio - residualChangedPixelRatio) / changedPixelRatio),
    translation,
    cells,
  };
}
