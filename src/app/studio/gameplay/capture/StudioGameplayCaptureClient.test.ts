import { describe, expect, it } from "vitest";

import { gameplaySnapshotSchema } from "@/core";
import { contractFixtureGameplaySnapshot, contractFixtureStreamerView } from "@/core/testing";

import { captureGameFromView, captureReadingsForSnapshot } from "./StudioGameplayCaptureClient";

describe("captureGameFromView", () => {
  it("uses the authoritative current-stream game ahead of the saved default", () => {
    expect(captureGameFromView({
      ...contractFixtureStreamerView,
      profile: {
        ...contractFixtureStreamerView.profile,
        gameId: "minecraft",
        gameName: "Minecraft",
      },
      session: {
        ...contractFixtureStreamerView.session,
        currentGame: {
          gameId: "generic",
          gameName: "Current Game",
          source: "streamer",
        },
      },
    })).toBe("generic");
  });

  it("falls back to the saved calibrated default when no live override exists", () => {
    expect(captureGameFromView({
      ...contractFixtureStreamerView,
      profile: {
        ...contractFixtureStreamerView.profile,
        gameId: "brawl-stars",
        gameName: "Brawl Stars",
      },
      session: {
        ...contractFixtureStreamerView.session,
        currentGame: null,
      },
    })).toBe("brawl-stars");
  });
});

describe("captureReadingsForSnapshot", () => {
  const known = (signalId: string, value: string | number | boolean) => ({
    signalId,
    kind: signalId,
    observation: {
      status: "known" as const,
      value,
      provenance: {
        source: "test-fixture" as const,
        method: "capture-reading-test",
        confidence: 0.9,
        observedAt: contractFixtureGameplaySnapshot.envelope.occurredAt,
        receivedAt: contractFixtureGameplaySnapshot.envelope.receivedAt,
        evidenceClass: "fixture" as const,
      },
    },
  });
  const snapshot = gameplaySnapshotSchema.parse({
    ...contractFixtureGameplaySnapshot,
    signals: [
      known("minecraft-health-hearts", 8),
      known("minecraft-hunger-shanks", 7),
      known("minecraft-environment", "field"),
      known("minecraft-day-night", "day"),
      known("minecraft-movement", "walking"),
      known("brawl-hud-layout", "standard-like"),
      known("brawl-match-active", true),
      known("game-vision-state", "stable"),
      known("game-vision-activity", 0.42),
      known("game-global-motion-pattern", "coherent-global-motion"),
      known("game-scene-transition", false),
    ],
  });

  it("groups Minecraft player condition, activity, environment, and other readings", () => {
    const readings = captureReadingsForSnapshot("minecraft", snapshot);

    expect(readings).toContainEqual(expect.objectContaining({ label: "Health", value: "8", category: "condition" }));
    expect(readings).toContainEqual(expect.objectContaining({ label: "Hunger", value: "7", category: "condition" }));
    expect(readings).toContainEqual(expect.objectContaining({ label: "Day / night", value: "day", category: "environment" }));
    expect(readings).toContainEqual(expect.objectContaining({ label: "Scene / environment", category: "environment" }));
    expect(readings).toContainEqual(expect.objectContaining({ label: "Scene / environment", value: "field", category: "environment" }));
    expect(readings).toContainEqual(expect.objectContaining({ label: "Movement", value: "walking", category: "activity" }));
    expect(readings.some(({ label }) => label === "Visual activity")).toBe(false);
    expect(readings).toContainEqual(expect.objectContaining({ label: "Scene transition", value: "false", category: "environment" }));
    expect(readings).toContainEqual(expect.objectContaining({ label: "Screen state", category: "others" }));
    expect(readings.some(({ label }) => label === "Match active")).toBe(false);
  });

  it("shows only Brawl and universal readings for Brawl Stars", () => {
    const readings = captureReadingsForSnapshot("brawl-stars", snapshot);

    expect(readings).toContainEqual(expect.objectContaining({ label: "HUD layout", value: "standard-like", category: "others" }));
    expect(readings).toContainEqual(expect.objectContaining({ label: "Match active", value: "true", category: "condition" }));
    expect(readings.some(({ label }) => label === "Player health")).toBe(false);
    expect(readings.some(({ label }) => label === "Arena / map")).toBe(false);
    expect(readings.some(({ label }) => label === "Health")).toBe(false);
  });

  it("keeps Generic analysis honest without planned detector reads", () => {
    const readings = captureReadingsForSnapshot("generic", snapshot);

    expect(new Set(readings.map(({ category }) => category))).toEqual(new Set([
      "activity",
      "environment",
      "others",
    ]));
    expect(readings.some(({ label }) => label === "Player condition")).toBe(false);
    expect(readings).toContainEqual(expect.objectContaining({ label: "Activity intensity", value: "0.42" }));
    expect(readings).toContainEqual(expect.objectContaining({ label: "Visual state", value: "stable" }));
    expect(readings.some(({ value }) => value === "Coming soon")).toBe(false);
  });

  it("shows a neutral dash for every supported read before a feed is captured", () => {
    const readings = captureReadingsForSnapshot("minecraft", null);

    expect(readings.length).toBeGreaterThan(0);
    expect(readings.every(({ value }) => value === "—")).toBe(true);
  });

  it("keeps the last confirmed value through later unknown frames until a new value is confirmed", () => {
    const lastKnown = new Map<string, string>();
    const armorEight = gameplaySnapshotSchema.parse({
      ...contractFixtureGameplaySnapshot,
      signals: [known("minecraft-armor-points", 8)],
    });
    const unknownFrame = gameplaySnapshotSchema.parse({
      ...contractFixtureGameplaySnapshot,
      signals: [],
    });
    const armorSix = gameplaySnapshotSchema.parse({
      ...contractFixtureGameplaySnapshot,
      signals: [known("minecraft-armor-points", 6)],
    });

    expect(captureReadingsForSnapshot("minecraft", armorEight, lastKnown))
      .toContainEqual(expect.objectContaining({ label: "Armor", value: "8" }));
    expect(captureReadingsForSnapshot("minecraft", unknownFrame, lastKnown))
      .toContainEqual(expect.objectContaining({ label: "Armor", value: "8" }));
    expect(captureReadingsForSnapshot("minecraft", armorSix, lastKnown))
      .toContainEqual(expect.objectContaining({ label: "Armor", value: "6" }));
  });

  it("keeps a never-observed value unknown", () => {
    const unknownFrame = gameplaySnapshotSchema.parse({
      ...contractFixtureGameplaySnapshot,
      signals: [],
    });

    expect(captureReadingsForSnapshot("minecraft", unknownFrame, new Map()))
      .toContainEqual(expect.objectContaining({ label: "Armor", value: "Unknown" }));
  });
});
