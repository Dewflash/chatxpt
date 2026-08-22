import { describe, expect, it } from "vitest";

import type { MinecraftHudFact, MinecraftHudFingerprint } from "./minecraft-hud";
import { MinecraftObservationTracker } from "./minecraft-observation-tracker";

function known<T extends string | number | boolean>(value: T): MinecraftHudFact<T> {
  return {
    status: "known",
    value,
    confidence: 0.9,
    reason: "tracker fixture",
    sourceRegionIds: ["minecraft-fixture"],
  };
}

function unknown<T extends string | number | boolean>(reason = "tracker fixture unknown"): MinecraftHudFact<T> {
  return { status: "unknown", value: null, confidence: 0, reason, sourceRegionIds: [] };
}

function hud(health: number): MinecraftHudFingerprint {
  return {
    status: "vanilla-like",
    confidence: 0.9,
    detectedAnchors: ["health", "hunger", "hotbar"],
    missingAnchors: [],
    supportedSignals: ["minecraft-hud-layout"],
    reasons: ["tracker fixture"],
    features: [],
    facts: {
      healthHearts: known(health),
      hungerShanks: known(9),
      airBubbles: unknown(),
      submerged: unknown(),
      armorPoints: unknown(),
      hotbarVisible: known(true),
      selectedHotbarCategory: unknown(),
    },
  };
}

function missedHud(): MinecraftHudFingerprint {
  const raw = hud(10);
  return {
    ...raw,
    status: "hud-hidden",
    confidence: 0.8,
    supportedSignals: [],
    facts: {
      healthHearts: unknown(),
      hungerShanks: unknown(),
      airBubbles: unknown(),
      submerged: unknown(),
      armorPoints: unknown(),
      hotbarVisible: unknown(),
      selectedHotbarCategory: unknown(),
    },
  };
}

describe("Minecraft rolling observation tracker", () => {
  it("uses two-of-three agreement and does not flicker on one changed reading", () => {
    const tracker = new MinecraftObservationTracker();

    expect(tracker.observe(hud(10), 1_000)).toMatchObject({
      status: "candidate-unconfirmed",
      trackingStatus: "acquiring",
    });
    const stable = tracker.observe(hud(10), 1_200);
    expect(stable.facts.healthHearts).toMatchObject({
      status: "known",
      value: 10,
      observedAt: 1_200,
      expiresAt: 4_200,
    });

    const oneChangedReading = tracker.observe(hud(7), 1_400);
    expect(oneChangedReading.facts.healthHearts).toMatchObject({
      status: "known",
      value: 10,
      observedAt: 1_200,
    });

    const confirmedChange = tracker.observe(hud(7), 1_600);
    expect(confirmedChange.facts.healthHearts).toMatchObject({
      status: "known",
      value: 7,
      observedAt: 1_600,
      expiresAt: 4_600,
    });
  });

  it("carries the last pixel-confirmed fact briefly, marks it stale, then expires it", () => {
    const tracker = new MinecraftObservationTracker();
    tracker.observe(hud(10), 1_000);
    tracker.observe(hud(10), 1_200);

    expect(tracker.observe(missedHud(), 2_000)).toMatchObject({
      status: "vanilla-like",
      trackingStatus: "reconfirming",
      facts: { healthHearts: { status: "known", value: 10, observedAt: 1_200 } },
    });
    expect(tracker.observe(missedHud(), 2_900)).toMatchObject({
      status: "vanilla-like",
      trackingStatus: "stale",
      facts: { healthHearts: { status: "known", value: 10, expiresAt: 4_200 } },
    });
    expect(tracker.observe(missedHud(), 4_201)).toMatchObject({
      status: "hud-hidden",
      trackingStatus: "unknown",
      facts: { healthHearts: { status: "unknown", value: null } },
    });
  });
});
