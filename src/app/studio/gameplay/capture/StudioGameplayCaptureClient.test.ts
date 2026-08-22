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
      known("minecraft-biome-environment", "grassy-overworld"),
      known("brawl-hud-layout", "standard-like"),
      known("brawl-match-active", true),
      known("game-vision-state", "stable"),
      known("game-vision-activity", 0.42),
      known("game-global-motion-pattern", "coherent-global-motion"),
      known("game-scene-transition", false),
    ],
  });

  it("shows Minecraft-specific health, food, and environment readings", () => {
    const readings = captureReadingsForSnapshot("minecraft", snapshot);

    expect(readings).toContainEqual(expect.objectContaining({ label: "Health hearts", value: "8" }));
    expect(readings).toContainEqual(expect.objectContaining({ label: "Food", value: "7" }));
    expect(readings).toContainEqual(expect.objectContaining({ label: "Scene / environment", value: "grassy-overworld" }));
    expect(readings.some(({ label }) => label === "Match active")).toBe(false);
  });

  it("shows only Brawl and universal readings for Brawl Stars", () => {
    const readings = captureReadingsForSnapshot("brawl-stars", snapshot);

    expect(readings).toContainEqual(expect.objectContaining({ label: "HUD layout", value: "standard-like" }));
    expect(readings).toContainEqual(expect.objectContaining({ label: "Match active", value: "true" }));
    expect(readings.some(({ label }) => label === "Health hearts")).toBe(false);
  });

  it("keeps Generic analysis to universal visual readings", () => {
    const readings = captureReadingsForSnapshot("generic", snapshot);

    expect(readings.map(({ label }) => label)).toEqual([
      "Visual state",
      "Activity intensity",
      "Global motion",
      "Scene transition",
    ]);
  });
});
