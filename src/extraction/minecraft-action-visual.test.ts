import { describe, expect, it } from "vitest";

import { measureMinecraftActionVisuals } from "./minecraft-action-visual";
import type { SampledPixelFrame } from "./visual-measurements";

const WIDTH = 160;
const HEIGHT = 90;

function frame(
  pixel: (x: number, y: number) => readonly [number, number, number],
): SampledPixelFrame {
  const rgba = new Uint8ClampedArray(WIDTH * HEIGHT * 4);
  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      const offset = (y * WIDTH + x) * 4;
      const [red, green, blue] = pixel(x, y);
      rgba[offset] = red;
      rgba[offset + 1] = green;
      rgba[offset + 2] = blue;
      rgba[offset + 3] = 255;
    }
  }
  return { width: WIDTH, height: HEIGHT, rgba };
}

const quiet = () => frame((x, y) => [28 + ((x + y) % 8), 90 + ((x * 3 + y) % 20), 30]);

describe("Minecraft vanilla action visuals", () => {
  it("detects a new red target flash near the crosshair", () => {
    const previous = quiet();
    const current = frame((x, y) =>
      x >= 40 && x < 120 && y >= 14 && y < 50
        ? [210, 35, 30]
        : [30, 95, 30],
    );

    expect(measureMinecraftActionVisuals(previous, current)).toMatchObject({
      hitFlash: true,
      eatingPose: false,
    });
  });

  it("detects an animated warm food pose without calling it a hit", () => {
    const previous = quiet();
    const current = frame((x, y) =>
      x >= 61 && x < 116 && y >= 52 && y < 71
        ? [170, 70, 45]
        : [30, 95, 30],
    );

    expect(measureMinecraftActionVisuals(previous, current)).toMatchObject({
      hitFlash: false,
      eatingPose: true,
    });
  });

  it("keeps an unchanged scene free of action claims", () => {
    const unchanged = quiet();
    expect(measureMinecraftActionVisuals(unchanged, unchanged)).toMatchObject({
      hitFlash: false,
      eatingPose: false,
    });
  });
});
