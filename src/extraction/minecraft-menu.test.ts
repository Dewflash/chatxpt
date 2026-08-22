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

function pauseFrame(): SampledPixelFrame {
  const frame = frameFromPixel((x, y) => {
    const value = 42 + ((x * 5 + y * 3) % 25);
    return [value, value + 4, value + 2];
  });
  paintBox(frame, { x: 0.3, y: 0.2, width: 0.4, height: 0.42 }, (x, y) => {
    if (y % 8 === 0 || x % 31 === 0) return [140, 140, 140];
    return [48, 48, 48];
  });
  paintBox(frame, { x: 0.2, y: 0.68, width: 0.6, height: 0.22 }, () => [42, 46, 43]);
  return frame;
}

function highDetailPauseFrame(): SampledPixelFrame {
  const frame = inventoryFrame();
  paintBox(frame, { x: 0.2, y: 0.68, width: 0.6, height: 0.22 }, () => [18, 18, 18]);
  return frame;
}

function deathFrame(): SampledPixelFrame {
  const frame = frameFromPixel((x, y) => {
    const red = 80 + ((x + y) % 30);
    return [red + 80, 60, 40];
  });
  paintBox(frame, { x: 0.28, y: 0.2, width: 0.44, height: 0.22 }, (x, y) =>
    x % 7 === 0 || y % 5 === 0 ? [245, 245, 245] : [65, 28, 25],
  );
  paintBox(frame, { x: 0.3, y: 0.49, width: 0.4, height: 0.18 }, (x, y) =>
    x % 18 === 0 || y % 7 === 0 ? [190, 190, 190] : [22, 18, 18],
  );
  paintBox(frame, { x: 0.2, y: 0.68, width: 0.6, height: 0.22 }, () => [83, 37, 30]);
  return frame;
}

function brightSnowGameplayFrame(): SampledPixelFrame {
  const frame = frameFromPixel((x, y) => {
    if (y < 14) return [165, 205, 245];
    const snow = 232 + ((x * 3 + y * 5) % 23);
    return [snow, Math.min(255, snow + 3), Math.min(255, snow + 5)];
  });
  // A dark horizon and normal lower HUD add real gameplay structure without a
  // centered grey container panel.
  paintBox(frame, { x: 0, y: 0.25, width: 1, height: 0.04 }, (x) =>
    x % 7 === 0 ? [55, 75, 45] : [105, 90, 70],
  );
  paintBox(frame, { x: 0.28, y: 0.78, width: 0.44, height: 0.12 }, (x, y) =>
    x % 6 === 0 || y % 6 === 0 ? [35, 35, 35] : [120, 120, 110],
  );
  return frame;
}

describe("Minecraft menu-state detector", () => {
  it("detects a generic container without inventing its exact inventory/crafting/furnace subtype", () => {
    expect(detectMinecraftMenuState(inventoryFrame())).toMatchObject({
      status: "known",
      value: "container",
      reason: expect.stringContaining("exact inventory, crafting, or furnace subtype remains unknown"),
    });
  });

  it("detects a dark sleep overlay with lower controls", () => {
    expect(detectMinecraftMenuState(sleepingFrame())).toMatchObject({
      status: "known",
      value: "sleeping",
    });
  });

  it("detects the vanilla dark-button pause layout without requiring a bright panel", () => {
    expect(detectMinecraftMenuState(pauseFrame())).toMatchObject({
      status: "known",
      value: "pause",
    });
  });

  it("prefers a pause layout over a generic centered panel when both scores are high", () => {
    expect(detectMinecraftMenuState(highDetailPauseFrame())).toMatchObject({
      status: "known",
      value: "pause",
    });
  });

  it("detects the red-tinted death title and respawn controls", () => {
    expect(detectMinecraftMenuState(deathFrame())).toMatchObject({
      status: "known",
      value: "death",
    });
  });

  it("keeps arbitrary high-detail gameplay unknown", () => {
    const noisy = frameFromPixel((x, y) => {
      const value = (x * 37 + y * 61 + ((x * y * 13) % 97)) % 256;
      return [value, (value * 3 + 17) % 256, (value * 5 + 31) % 256];
    });
    expect(detectMinecraftMenuState(noisy)).toMatchObject({ status: "unknown" });
  });

  it("does not classify a bright snowy gameplay scene as a container", () => {
    expect(detectMinecraftMenuState(brightSnowGameplayFrame())).toMatchObject({ status: "unknown" });
  });
});
