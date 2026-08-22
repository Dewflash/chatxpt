import { describe, expect, it } from "vitest";

import {
  measureMinecraftDaylight,
  MinecraftDaylightTracker,
  type MinecraftDaylightMeasurement,
} from "./minecraft-daylight";
import type { SampledPixelFrame } from "./visual-measurements";

function frame(value: number): SampledPixelFrame {
  const rgba = new Uint8ClampedArray(100 * 60 * 4);
  for (let offset = 0; offset < rgba.length; offset += 4) {
    rgba[offset] = value;
    rgba[offset + 1] = value;
    rgba[offset + 2] = value;
    rgba[offset + 3] = 255;
  }
  return { width: 100, height: 60, rgba };
}

function measurement(meanLuma: number): MinecraftDaylightMeasurement {
  return {
    meanLuma,
    darkPixelRatio: meanLuma <= 0.3 ? 0.8 : 0.05,
    brightPixelRatio: meanLuma >= 0.48 ? 0.75 : 0.05,
    sourceRegionIds: ["minecraft-daylight-upper", "minecraft-daylight-center"],
  };
}

function observe(
  tracker: MinecraftDaylightTracker,
  observedAt: number,
  meanLuma: number,
) {
  return tracker.observe({ observedAt, measurement: measurement(meanLuma) });
}

describe("Minecraft daylight tracking", () => {
  it("measures bright and dark pixel scenes separately", () => {
    expect(measureMinecraftDaylight(frame(210)).meanLuma).toBeGreaterThan(0.7);
    expect(measureMinecraftDaylight(frame(25)).meanLuma).toBeLessThan(0.15);
  });

  it("confirms day from a short sustained bright window", () => {
    const tracker = new MinecraftDaylightTracker();
    observe(tracker, 0, 0.65);
    observe(tracker, 1_000, 0.64);
    const state = observe(tracker, 2_000, 0.66);

    expect(state).toMatchObject({ status: "known", value: "day" });
  });

  it("requires a long uninterrupted dark window before confirming night", () => {
    const tracker = new MinecraftDaylightTracker();
    let state = observe(tracker, 0, 0.2);
    for (let second = 1; second <= 10; second += 1) {
      state = observe(tracker, second * 1_000, 0.19);
    }

    expect(state).toMatchObject({ status: "known", value: "night" });
  });

  it("does not turn day into night after a sudden indoor brightness drop", () => {
    const tracker = new MinecraftDaylightTracker();
    observe(tracker, 0, 0.66);
    observe(tracker, 1_000, 0.65);
    observe(tracker, 2_000, 0.64);

    let state = observe(tracker, 2_500, 0.2);
    for (let second = 3; second <= 25; second += 1) {
      state = observe(tracker, second * 1_000, 0.18);
    }

    expect(state).toMatchObject({ status: "known", value: "day" });
    expect(state.reason).toContain("indoor");
  });

  it("allows a gradual sustained sunset to become night", () => {
    const tracker = new MinecraftDaylightTracker();
    let state = observe(tracker, 0, 0.66);
    for (let second = 1; second <= 42; second += 1) {
      state = observe(tracker, second * 1_000, 0.66 - second * 0.012);
    }

    expect(state).toMatchObject({ status: "known", value: "night" });
  });

  it("clears indoor occlusion when the earlier daylight brightness returns", () => {
    const tracker = new MinecraftDaylightTracker();
    observe(tracker, 0, 0.66);
    observe(tracker, 1_000, 0.66);
    observe(tracker, 2_000, 0.66);
    observe(tracker, 2_500, 0.18);
    const state = observe(tracker, 3_000, 0.63);

    expect(state).toMatchObject({ status: "known", value: "day" });
    expect(state.reason).toContain("continues to support");
  });

  it("retains a stable state while menus or submersion block daylight pixels", () => {
    const tracker = new MinecraftDaylightTracker();
    observe(tracker, 0, 0.66);
    observe(tracker, 1_000, 0.66);
    observe(tracker, 2_000, 0.66);
    const state = tracker.observe({
      observedAt: 3_000,
      measurement: null,
      blockedReason: "The pause screen hides the gameplay illumination.",
    });

    expect(state).toMatchObject({ status: "known", value: "day" });
    expect(state.reason).toContain("retained");
  });
});
