import { describe, expect, it } from "vitest";

import { measureMinecraftCameraMotion } from "./minecraft-camera-motion";
import type { SampledPixelFrame } from "./visual-measurements";

const WIDTH = 160;
const HEIGHT = 90;

function texturedFrame(): SampledPixelFrame {
  const rgba = new Uint8ClampedArray(WIDTH * HEIGHT * 4);
  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      const offset = (y * WIDTH + x) * 4;
      const value = (x * 37 + y * 61 + ((x * y * 17) % 127)) % 256;
      rgba[offset] = value;
      rgba[offset + 1] = (value * 3 + 19) % 256;
      rgba[offset + 2] = (value * 5 + 31) % 256;
      rgba[offset + 3] = 255;
    }
  }
  return { width: WIDTH, height: HEIGHT, rgba };
}

function shifted(source: SampledPixelFrame, dx: number, dy: number): SampledPixelFrame {
  const rgba = new Uint8ClampedArray(source.rgba.length);
  for (let y = 0; y < source.height; y += 1) {
    for (let x = 0; x < source.width; x += 1) {
      const sourceX = Math.max(0, Math.min(source.width - 1, x - dx));
      const sourceY = Math.max(0, Math.min(source.height - 1, y - dy));
      const sourceOffset = (sourceY * source.width + sourceX) * 4;
      const targetOffset = (y * source.width + x) * 4;
      rgba[targetOffset] = source.rgba[sourceOffset];
      rgba[targetOffset + 1] = source.rgba[sourceOffset + 1];
      rgba[targetOffset + 2] = source.rgba[sourceOffset + 2];
      rgba[targetOffset + 3] = 255;
    }
  }
  return { width: source.width, height: source.height, rgba };
}

describe("Minecraft camera motion field", () => {
  it("keeps an unchanged scene stationary", () => {
    const frame = texturedFrame();
    expect(measureMinecraftCameraMotion(frame, frame)).toEqual({
      reliableVectorCount: 0,
      meanDx: 0,
      meanDy: 0,
      meanMagnitude: 0,
      yawCoherence: 0,
      yawStrength: 0,
      radialMotion: 0,
      radialCoherence: 0,
      confidence: 0,
    });
  });

  it("recognises a coherent horizontal scene shift as camera rotation evidence", () => {
    const previous = texturedFrame();
    const measurement = measureMinecraftCameraMotion(previous, shifted(previous, 6, 0));

    expect(measurement.reliableVectorCount).toBeGreaterThanOrEqual(10);
    expect(Math.abs(measurement.meanDx)).toBeGreaterThan(4);
    expect(measurement.yawCoherence).toBeGreaterThan(0.75);
    expect(measurement.yawStrength).toBeGreaterThan(3);
    expect(Math.abs(measurement.meanDy)).toBeLessThan(0.5);
  });

  it("rejects mismatched frame dimensions", () => {
    const frame = texturedFrame();
    expect(() => measureMinecraftCameraMotion(frame, { ...frame, width: WIDTH - 1 })).toThrow(
      "one RGBA tuple per pixel",
    );
  });
});
