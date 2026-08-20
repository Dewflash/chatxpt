import { describe, expect, it } from "vitest";

import {
  contractFixtureAudienceSnapshot,
  contractFixtureCandidateBatch,
  contractFixtureGameplaySnapshot,
  contractFixtureProfile,
} from "../core/testing";
import {
  gameplaySnapshotSchema,
  streamerProfileSchema,
  type CandidateInput,
  type GameplaySnapshot,
  type SignalProvenance,
} from "../core";
import {
  buildGenericGameStateContext,
  genericGameFactSchema,
} from "./game-state-context";

const NOW = contractFixtureCandidateBatch.envelope.occurredAt;

function provenance(confidence = 0.9, observedAt = NOW): SignalProvenance {
  return {
    source: "test-fixture",
    method: "game-state-context-test",
    confidence,
    observedAt,
    receivedAt: observedAt,
    evidenceClass: "fixture",
  };
}

function input(gameplay: GameplaySnapshot, gameId: string | null, gameName: string | null): CandidateInput {
  return {
    envelope: contractFixtureCandidateBatch.envelope,
    intelligence: {
      envelope: contractFixtureCandidateBatch.envelope,
      gameplay,
      audience: contractFixtureAudienceSnapshot,
    },
    profile: streamerProfileSchema.parse({
      ...contractFixtureProfile,
      gameId,
      gameName,
    }),
    recentQuestTitles: [],
    activeChatXptQuest: null,
  };
}

describe("generic game-state context", () => {
  it("rejects non-known facts that carry values", () => {
    expect(() =>
      genericGameFactSchema.parse({
        status: "unknown",
        value: 1,
        confidence: 0,
        sourceSignalIds: [],
        reason: "unsupported",
      }),
    ).toThrow("Only known generic game facts can carry a value");
  });

  it("maps Minecraft calibrated facts into generic facts while preserving unknowns", () => {
    const gameplay = gameplaySnapshotSchema.parse({
      ...contractFixtureGameplaySnapshot,
      capabilities: {
        tier: "calibrated-hud",
        gameId: "minecraft",
        adapterId: "minecraft-java-vanilla-v1",
        supportedSignals: [
          "minecraft-hud-layout",
          "minecraft-health-hearts",
          "minecraft-hunger-shanks",
          "minecraft-armor-points",
          "minecraft-selected-hotbar-category",
          "minecraft-recent-damage",
        ],
      },
      signals: [
        {
          signalId: "minecraft-hud-layout",
          kind: "minecraft-hud-layout",
          observation: { status: "known", value: "vanilla-like", provenance: provenance() },
        },
        {
          signalId: "minecraft-health-hearts",
          kind: "minecraft-health-hearts",
          observation: { status: "known", value: 8, provenance: provenance() },
        },
        {
          signalId: "minecraft-hunger-shanks",
          kind: "minecraft-hunger-shanks",
          observation: { status: "known", value: 6, provenance: provenance() },
        },
        {
          signalId: "minecraft-armor-points",
          kind: "minecraft-armor-points",
          observation: { status: "known", value: 5, provenance: provenance() },
        },
        {
          signalId: "minecraft-selected-hotbar-category",
          kind: "minecraft-selected-hotbar-category",
          observation: { status: "known", value: "block", provenance: provenance() },
        },
        {
          signalId: "minecraft-recent-damage",
          kind: "minecraft-recent-damage",
          observation: { status: "known", value: true, provenance: provenance() },
        },
      ],
    });

    const context = buildGenericGameStateContext(input(gameplay, "minecraft", "Minecraft Java Edition"));

    expect(context).toMatchObject({
      schemaVersion: "generic-game-state-v1",
      selectedGameId: "minecraft",
      gameSpecificContext: "minecraft",
    });
    expect(context.facts.playerHealth).toMatchObject({
      status: "known",
      value: 8,
      sourceSignalIds: ["minecraft-health-hearts"],
    });
    expect(context.facts.playerDefense).toMatchObject({
      status: "known",
      value: 5,
      sourceSignalIds: ["minecraft-armor-points"],
    });
    expect(context.facts.loadoutState).toMatchObject({
      status: "known",
      value: "block",
      sourceSignalIds: ["minecraft-selected-hotbar-category"],
    });
    expect(context.supportedGenericFacts).toEqual(
      expect.arrayContaining(["hudLayout", "playerHealth", "playerResource", "playerDefense", "loadoutState"]),
    );
    expect(context.unknownGenericFacts).toEqual(
      expect.arrayContaining(["objectiveState", "matchTimer", "scoreState", "environment"]),
    );
  });

  it("maps Brawl-shaped calibrated facts into generic objective, timer, and score facts only", () => {
    const gameplay = gameplaySnapshotSchema.parse({
      ...contractFixtureGameplaySnapshot,
      capabilities: {
        tier: "calibrated-hud",
        gameId: "brawl-stars",
        adapterId: "brawl-stars-standard-v1",
        supportedSignals: ["brawl-hud-layout", "match-active", "match-timer", "match-score"],
      },
      signals: [
        {
          signalId: "brawl-hud-layout",
          kind: "brawl-hud-layout",
          observation: { status: "known", value: "standard", provenance: provenance() },
        },
        {
          signalId: "match-active",
          kind: "match-active",
          observation: { status: "known", value: true, provenance: provenance() },
        },
        {
          signalId: "match-timer",
          kind: "match-timer",
          observation: { status: "known", value: 44, provenance: provenance() },
        },
        {
          signalId: "match-score",
          kind: "match-score",
          observation: { status: "known", value: "2-1", provenance: provenance() },
        },
      ],
    });

    const context = buildGenericGameStateContext(input(gameplay, "brawl-stars", "Brawl Stars"));

    expect(context.gameSpecificContext).toBe("brawl-stars");
    expect(context.facts.objectiveState).toMatchObject({ status: "known", value: true });
    expect(context.facts.matchTimer).toMatchObject({ status: "known", value: 44 });
    expect(context.facts.scoreState).toMatchObject({ status: "known", value: "2-1" });
    expect(context.facts.playerHealth).toMatchObject({ status: "unsupported", value: null });
    expect(context.unknownGenericFacts).toContain("playerHealth");
  });

  it("marks old or unavailable facts as unusable instead of promoting them", () => {
    const gameplay = gameplaySnapshotSchema.parse({
      ...contractFixtureGameplaySnapshot,
      capabilities: {
        tier: "universal-visual",
        gameId: null,
        adapterId: null,
        supportedSignals: ["visual-state"],
      },
      signals: [
        {
          signalId: "game-vision-state",
          kind: "visual-state",
          observation: { status: "known", value: "stable", provenance: provenance(0.8, NOW - 10_000) },
        },
        {
          signalId: "match-timer",
          kind: "match-timer",
          observation: {
            status: "unavailable",
            reason: "Timer OCR is unavailable for this game.",
            provenance: provenance(0),
          },
        },
      ],
    });

    const context = buildGenericGameStateContext(input(gameplay, null, null));

    expect(context.selectedGameName).toBe("Unknown game");
    expect(context.gameSpecificContext).toBeNull();
    expect(context.facts.activity).toMatchObject({
      status: "stale",
      value: null,
      sourceSignalIds: ["game-vision-state"],
    });
    expect(context.facts.matchTimer).toMatchObject({
      status: "unsupported",
      value: null,
      sourceSignalIds: ["match-timer"],
    });
  });

  it.each([
    { label: "future", confidence: 0.9, observedAt: NOW + 1, expectedReason: "future" },
    { label: "low-confidence", confidence: 0.74, observedAt: NOW, expectedReason: "minimum confidence" },
  ])("keeps $label known observations out of generic known facts", ({ confidence, observedAt, expectedReason }) => {
    const gameplay = gameplaySnapshotSchema.parse({
      ...contractFixtureGameplaySnapshot,
      signals: [{
        signalId: "game-vision-state",
        kind: "game-vision-state",
        observation: {
          status: "known",
          value: "active",
          provenance: provenance(confidence, observedAt),
        },
      }],
    });

    const context = buildGenericGameStateContext(input(gameplay, null, null));

    expect(context.facts.activity).toMatchObject({
      status: "unknown",
      value: null,
      reason: expect.stringContaining(expectedReason),
    });
    expect(context.supportedGenericFacts).not.toContain("activity");
  });
});
