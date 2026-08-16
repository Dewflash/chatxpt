import { describe, expect, it } from "vitest";

import { contractFixtureGameplaySnapshot } from "../testing";
import {
  deriveGameplayServiceHealth,
  upsertGameplayServiceHealth,
} from "./gameplay-health";

describe("gameplay extraction service health", () => {
  it("reports fresh confident gameplay as ready and stale gameplay as degraded", () => {
    const observedAt = contractFixtureGameplaySnapshot.envelope.occurredAt;
    const confident = {
      ...structuredClone(contractFixtureGameplaySnapshot),
      signals: [
        {
          ...structuredClone(contractFixtureGameplaySnapshot.signals[0]),
          observation: {
            status: "known" as const,
            value: "stable",
            provenance: {
              ...structuredClone(contractFixtureGameplaySnapshot.signals[0].observation.provenance),
              confidence: 0.9,
            },
          },
        },
      ],
    };
    expect(deriveGameplayServiceHealth(confident, observedAt + 100)).toMatchObject({
      service: "gameplay-extraction",
      status: "ready",
      retryable: false,
    });
    expect(deriveGameplayServiceHealth(confident, observedAt + 6_000)).toMatchObject({
      status: "degraded",
      retryable: true,
    });
  });

  it("replaces only the previous gameplay health entry", () => {
    const health = deriveGameplayServiceHealth(null, 123);
    expect(
      upsertGameplayServiceHealth(
        [
          { service: "twitch", status: "ready", checkedAt: 100, retryable: false },
          { service: "gameplay-extraction", status: "ready", checkedAt: 100, retryable: false },
        ],
        health,
      ),
    ).toEqual([
      { service: "twitch", status: "ready", checkedAt: 100, retryable: false },
      health,
    ]);
  });
});
