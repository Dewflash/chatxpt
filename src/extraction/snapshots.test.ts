import { describe, expect, it } from "vitest";

import {
  contractFixtureEnvelope,
  contractFixtureGameplaySnapshot,
} from "../core/testing";
import { buildAudienceSnapshot, buildGameplaySnapshot } from "./snapshots";

const provenance = {
  source: "test-fixture" as const,
  method: "role-2-snapshot-test",
  confidence: 0.9,
  observedAt: contractFixtureEnvelope.occurredAt,
  receivedAt: contractFixtureEnvelope.receivedAt,
  evidenceClass: "fixture" as const,
};

const fusion = {
  now: contractFixtureEnvelope.occurredAt,
  minimumConfidence: 0.6,
  conflictConfidenceDelta: 0.05,
};

describe("Role 2 snapshot builders", () => {
  it("builds independently classified known and unknown gameplay signals", () => {
    const snapshot = buildGameplaySnapshot({
      envelope: contractFixtureGameplaySnapshot.envelope,
      capabilities: contractFixtureGameplaySnapshot.capabilities,
      fusion,
      signals: [
        {
          signalId: "activity",
          kind: "activity-intensity",
          fallbackProvenance: provenance,
          candidates: [
            {
              state: "observed",
              value: 0.8,
              expiresAt: contractFixtureEnvelope.occurredAt + 1_000,
              provenance,
            },
          ],
        },
        {
          signalId: "health",
          kind: "player-health",
          fallbackProvenance: provenance,
          candidates: [{ state: "unsupported", provenance }],
        },
      ],
    });

    expect(snapshot.signals[0].observation).toMatchObject({ status: "known", value: 0.8 });
    expect(snapshot.signals[1].observation).toMatchObject({
      status: "unknown",
      reason: "unsupported",
    });
  });

  it("builds an audience snapshot without merging audience and gameplay inputs", () => {
    const snapshot = buildAudienceSnapshot({
      envelope: { ...contractFixtureEnvelope, messageId: "role-2-audience-snapshot" },
      sampleSize: 4,
      fusion,
      signals: [
        {
          signalId: "audience-energy",
          kind: "audience-energy",
          fallbackProvenance: provenance,
          candidates: [
            {
              state: "observed",
              value: 0.75,
              expiresAt: contractFixtureEnvelope.occurredAt + 1_000,
              provenance,
            },
          ],
        },
      ],
    });

    expect(snapshot.sampleSize).toBe(4);
    expect(snapshot.signals[0].observation).toMatchObject({ status: "known", value: 0.75 });
  });
});
