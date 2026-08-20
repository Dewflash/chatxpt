import { describe, expect, it } from "vitest";

import { detectMinecraftMenuState } from "./minecraft-menu";
import type { SampledPixelFrame } from "./visual-measurements";

const WIDTH = 96;
const HEIGHT = 54;

function frameFromPixel(
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

function paintBox(
  frame: SampledPixelFrame,
  box: { readonly x: number; readonly y: number; readonly width: number; readonly height: number },
  pixel: (x: number, y: number) => readonly [number, number, number],
): void {
  const left = Math.floor(box.x * frame.width);
  const top = Math.floor(box.y * frame.height);
  const right = Math.min(frame.width, Math.ceil((box.x + box.width) * frame.width));
  const bottom = Math.min(frame.height, Math.ceil((box.y + box.height) * frame.height));
  for (let y = top; y < bottom; y += 1) {
    for (let x = left; x < right; x += 1) {
      const offset = (y * frame.width + x) * 4;
      const [red, green, blue] = pixel(x - left, y - top);
      frame.rgba[offset] = red;
      frame.rgba[offset + 1] = green;
      frame.rgba[offset + 2] = blue;
    }
  }
}

function inventoryFrame(): SampledPixelFrame {
  const frame = frameFromPixel(() => [35, 35, 35]);
  paintBox(frame, { x: 0.24, y: 0.16, width: 0.52, height: 0.58 }, (x, y) => {
    if (x % 6 === 0 || y % 6 === 0) return [232, 232, 232];
    return (x + y) % 2 === 0 ? [165, 165, 165] : [95, 95, 95];
  });
  return frame;
}

function sleepingFrame(): SampledPixelFrame {
  const frame = frameFromPixel((x, y) => {
    const value = (x + y) % 11 === 0 ? 35 : 8;
    return [value, value, value];
  });
  paintBox(frame, { x: 0.24, y: 0.72, width: 0.52, height: 0.12 }, (x, y) => {
    if (y < 2 || y > 4 || x % 9 === 0) return [220, 220, 220];
    return [55, 55, 55];
  });
  return frame;
}

describe("Minecraft menu-state detector", () => {
  it("detects a centered inventory-like panel", () => {
    expect(detectMinecraftMenuState(inventoryFrame())).toMatchObject({
      status: "known",
      value: "inventory",
    });
  });

  it("detects a dark sleep overlay with lower controls", () => {
    expect(detectMinecraftMenuState(sleepingFrame())).toMatchObject({
      status: "known",
      value: "sleeping",
    });
  });

  it("keeps arbitrary high-detail gameplay unknown", () => {
    const noisy = frameFromPixel((x, y) => {
      const value = (x * 37 + y * 61 + ((x * y * 13) % 97)) % 256;
      return [value, (value * 3 + 17) % 256, (value * 5 + 31) % 256];
    });
    expect(detectMinecraftMenuState(noisy)).toMatchObject({ status: "unknown" });
  });
});
