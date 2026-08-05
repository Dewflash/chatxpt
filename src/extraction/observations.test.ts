import { describe, expect, it } from "vitest";

import { contractFixtureEnvelope } from "../core/testing";
import type { SignalProvenance } from "../core";
import { fuseObservation, type ObservationCandidate } from "./observations";

const NOW = contractFixtureEnvelope.occurredAt;

function provenance(confidence: number, observedAt = NOW): SignalProvenance {
  return {
    source: "test-fixture",
    method: "role-2-observation-test",
    confidence,
    observedAt,
    receivedAt: observedAt,
    evidenceClass: "fixture",
  };
}

function fuse(candidates: readonly ObservationCandidate[]) {
  return fuseObservation({
    now: NOW,
    minimumConfidence: 0.6,
    conflictConfidenceDelta: 0.05,
    fallbackProvenance: provenance(0),
    candidates,
  });
}

describe("fuseObservation", () => {
  it("selects the strongest fresh observation without inventing a value", () => {
    expect(
      fuse([
        { state: "observed", value: 0.4, expiresAt: NOW + 1_000, provenance: provenance(0.7) },
        { state: "observed", value: 0.8, expiresAt: NOW + 1_000, provenance: provenance(0.9) },
      ]),
    ).toMatchObject({ status: "known", value: 0.8 });
  });

  it("maps weak evidence to unknown instead of exposing the tentative value", () => {
    expect(
      fuse([{ state: "observed", value: 0.4, expiresAt: NOW + 1_000, provenance: provenance(0.5) }]),
    ).toMatchObject({ status: "unknown", reason: "low-confidence" });
  });

  it("marks similarly confident contradictory readings as conflicting", () => {
    expect(
      fuse([
        { state: "observed", value: "quiet", expiresAt: NOW + 1_000, provenance: provenance(0.8) },
        { state: "observed", value: "active", expiresAt: NOW + 1_000, provenance: provenance(0.76) },
      ]),
    ).toMatchObject({ status: "unknown", reason: "conflicting" });
  });

  it("preserves the previous value only when the evidence is stale", () => {
    expect(
      fuse([{ state: "observed", value: 0.7, expiresAt: NOW - 1, provenance: provenance(0.9) }]),
    ).toMatchObject({ status: "stale", previousValue: 0.7 });
  });

  it.each([
    ["unsupported", { status: "unknown", reason: "unsupported" }],
    ["permission-denied", { status: "unknown", reason: "permission-denied" }],
  ] as const)("maps %s evidence to an honest unknown state", (state, expected) => {
    expect(fuse([{ state, provenance: provenance(0) }])).toMatchObject(expected);
  });

  it("distinguishes an unavailable analyzer from an unknown fact", () => {
    expect(
      fuse([{ state: "unavailable", reason: "Frame decoder is unavailable.", provenance: provenance(0) }]),
    ).toMatchObject({ status: "unavailable", reason: "Frame decoder is unavailable." });
  });

  it("lets a newer permission failure supersede older observations", () => {
    expect(
      fuse([
        {
          state: "observed",
          value: 0.8,
          expiresAt: NOW + 1_000,
          provenance: provenance(0.9, NOW - 10),
        },
        { state: "permission-denied", provenance: provenance(0, NOW) },
      ]),
    ).toMatchObject({ status: "unknown", reason: "permission-denied" });
  });

  it("does not let one unsupported analyzer hide fresh evidence from another analyzer", () => {
    expect(
      fuse([
        {
          state: "observed",
          value: 0.8,
          expiresAt: NOW + 1_000,
          provenance: provenance(0.9),
        },
        { state: "unsupported", provenance: provenance(0) },
      ]),
    ).toMatchObject({ status: "known", value: 0.8 });
  });
});
