import { describe, expect, it } from "vitest";

import {
  createFixtureUiGatewaySnapshot,
  gameplaySnapshotSchema,
  type SignalObservation,
} from "../core";
import { summarizeGameplayHealth } from "./gameplay-health";

const fixtureGameplay = createFixtureUiGatewaySnapshot().views.streamer.gameplay!;
const fixtureSignal = fixtureGameplay.signals[0]!;
const fixtureProvenance = fixtureSignal.observation.provenance;

function gameplayWith(observation: SignalObservation) {
  return gameplaySnapshotSchema.parse({
    ...fixtureGameplay,
    signals: [{ ...fixtureSignal, observation }],
  });
}

describe("summarizeGameplayHealth", () => {
  it("reports healthy known evidence only after the confidence threshold", () => {
    const gameplay = gameplayWith({
      status: "known",
      value: "active",
      provenance: { ...fixtureProvenance, confidence: 0.9 },
    });

    expect(summarizeGameplayHealth(gameplay)).toMatchObject({
      label: "Observed",
      tone: "success",
      knownCount: 1,
      averageKnownConfidence: 0.9,
    });
  });

  it("does not promote low-confidence known fixture evidence to healthy", () => {
    expect(summarizeGameplayHealth(fixtureGameplay)).toMatchObject({
      label: "Low confidence",
      tone: "warning",
      knownCount: 1,
    });
  });

  it("keeps absent gameplay evidence unknown", () => {
    expect(summarizeGameplayHealth(null)).toMatchObject({
      label: "Unknown",
      tone: "neutral",
      totalCount: 0,
    });
  });

  it.each([
    ["stale", { status: "stale", reason: "Capture is older than the current quest.", provenance: fixtureProvenance }, "Stale", "warning"],
    ["unavailable", { status: "unavailable", reason: "Gameplay capture is unavailable.", provenance: fixtureProvenance }, "Unavailable", "danger"],
    ["permission denied", { status: "unknown", reason: "permission-denied", provenance: fixtureProvenance }, "Permission denied", "danger"],
  ] as const)("surfaces %s observations without fallback certainty", (_name, observation, label, tone) => {
    expect(summarizeGameplayHealth(gameplayWith(observation))).toMatchObject({ label, tone });
  });
});
