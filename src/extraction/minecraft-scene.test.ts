import { describe, expect, it } from "vitest";

import { detectMinecraftSceneFacts } from "./minecraft-scene";
import type { SampledPixelFrame } from "./visual-measurements";

function frame(width: number, height: number, fill: readonly [number, number, number, number]): SampledPixelFrame {
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let offset = 0; offset < rgba.length; offset += 4) {
    rgba[offset] = fill[0];
    rgba[offset + 1] = fill[1];
    rgba[offset + 2] = fill[2];
    rgba[offset + 3] = fill[3];
  }
  return { width, height, rgba };
}

function paint(
  sample: SampledPixelFrame,
  bounds: { readonly left: number; readonly top: number; readonly right: number; readonly bottom: number },
  color: readonly [number, number, number, number],
): void {
  for (let y = bounds.top; y < bounds.bottom; y += 1) {
    for (let x = bounds.left; x < bounds.right; x += 1) {
      const offset = (y * sample.width + x) * 4;
      sample.rgba[offset] = color[0];
      sample.rgba[offset + 1] = color[1];
      sample.rgba[offset + 2] = color[2];
      sample.rgba[offset + 3] = color[3];
    }
  }
}

describe("Minecraft scene facts", () => {
  it("keeps a blue water-like scene unknown without independent HUD evidence", () => {
    const sample = frame(100, 60, [40, 130, 220, 255]);
    for (let stripe = 0; stripe < 25; stripe += 2) {
      paint(sample, { left: stripe * 4, top: 0, right: stripe * 4 + 2, bottom: 60 }, [20, 75, 165, 255]);
    }

    const facts = detectMinecraftSceneFacts(sample);

    expect(facts.biomeOrEnvironment).toMatchObject({ status: "unknown", value: null });
    expect(facts.damageCauseHint).toMatchObject({ status: "unknown", value: null });
    expect(facts.visibleHostile).toMatchObject({ status: "unknown", value: null });
  });

  it("keeps a flat blue night-like scene unknown without water texture", () => {
    const facts = detectMinecraftSceneFacts(frame(100, 60, [72, 82, 132, 255]));

    expect(facts.biomeOrEnvironment).toMatchObject({ status: "unknown", value: null });
  });

  it("detects lava-like environmental risk", () => {
    const sample = frame(100, 60, [30, 25, 20, 255]);
    paint(sample, { left: 0, top: 34, right: 100, bottom: 60 }, [240, 92, 18, 255]);

    const facts = detectMinecraftSceneFacts(sample);

    expect(facts.biomeOrEnvironment).toMatchObject({
      status: "known",
      value: "lava-or-fire-nearby",
    });
    expect(facts.damageCauseHint).toMatchObject({ status: "unknown", value: null });
  });

  it("does not mistake blue sky above green ground for water", () => {
    const sample = frame(100, 60, [55, 150, 45, 255]);
    paint(sample, { left: 0, top: 0, right: 100, bottom: 22 }, [50, 135, 225, 255]);

    const facts = detectMinecraftSceneFacts(sample);

    expect(facts.biomeOrEnvironment).toMatchObject({ status: "known", value: "field" });
  });

  it("separates bright fields from dark green forests", () => {
    const field = detectMinecraftSceneFacts(frame(100, 60, [55, 150, 45, 255]));
    const forestSample = frame(100, 60, [8, 14, 9, 255]);
    paint(forestSample, { left: 28, top: 19, right: 72, bottom: 29 }, [28, 120, 32, 255]);
    paint(forestSample, { left: 14, top: 36, right: 86, bottom: 44 }, [28, 120, 32, 255]);
    const forest = detectMinecraftSceneFacts(forestSample);

    expect(field.biomeOrEnvironment).toMatchObject({ status: "known", value: "field" });
    expect(forest.biomeOrEnvironment).toMatchObject({ status: "known", value: "forest" });
  });

  it("detects sandy scenes and keeps an unstructured neutral scene unknown", () => {
    const sand = detectMinecraftSceneFacts(frame(100, 60, [210, 180, 80, 255]));
    const neutral = detectMinecraftSceneFacts(frame(100, 60, [125, 125, 125, 255]));

    expect(sand.biomeOrEnvironment).toMatchObject({ status: "known", value: "sand" });
    expect(neutral.biomeOrEnvironment).toMatchObject({ status: "unknown", value: null });
  });

  it("detects a structured neutral building scene", () => {
    const sample = frame(100, 60, [120, 120, 120, 255]);
    for (let x = 0; x < 100; x += 8) {
      paint(sample, { left: x, top: 12, right: Math.min(100, x + 2), bottom: 52 }, [55, 55, 55, 255]);
    }

    expect(detectMinecraftSceneFacts(sample).biomeOrEnvironment)
      .toMatchObject({ status: "known", value: "building" });
  });

  it("requires a central high-contrast hostile-like shape before naming hostiles", () => {
    const sample = frame(100, 60, [30, 35, 34, 255]);
    for (let stripe = 0; stripe < 5; stripe += 1) {
      paint(sample, { left: 40 + stripe * 3, top: 16, right: 42 + stripe * 3, bottom: 38 }, [40, 210, 60, 255]);
      paint(sample, { left: 42 + stripe * 3, top: 16, right: 43 + stripe * 3, bottom: 38 }, [10, 35, 10, 255]);
    }

    const facts = detectMinecraftSceneFacts(sample);

    expect(facts.visibleHostile).toMatchObject({ status: "known", value: "unknown-hostile" });
    expect(facts.damageCauseHint).toMatchObject({ status: "known", value: "mob" });
  });
});
