import {
  signalObservationSchema,
  signalProvenanceSchema,
  type SignalObservation,
  type SignalProvenance,
} from "../core";

export type SignalValue = Extract<SignalObservation, { status: "known" }>["value"];

export type ObservationCandidate =
  | {
      readonly state: "observed";
      readonly value: SignalValue;
      readonly expiresAt: number;
      readonly provenance: SignalProvenance;
    }
  | {
      readonly state: "unsupported" | "permission-denied";
      readonly provenance: SignalProvenance;
    }
  | {
      readonly state: "unavailable";
      readonly reason: string;
      readonly provenance: SignalProvenance;
    };

export interface ObservationFusionInput {
  readonly now: number;
  readonly minimumConfidence: number;
  readonly conflictConfidenceDelta: number;
  readonly fallbackProvenance: SignalProvenance;
  readonly candidates: readonly ObservationCandidate[];
}

function assertUnitInterval(name: string, value: number) {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError(`${name} must be between 0 and 1`);
  }
}

function compareCandidates(left: ObservationCandidate, right: ObservationCandidate) {
  return (
    right.provenance.observedAt - left.provenance.observedAt ||
    right.provenance.confidence - left.provenance.confidence
  );
}

function unavailableObservation(
  candidate: Exclude<ObservationCandidate, { state: "observed" }>,
): SignalObservation {
  if (candidate.state === "unavailable") {
    return signalObservationSchema.parse({
      status: "unavailable",
      reason: candidate.reason,
      provenance: candidate.provenance,
    });
  }

  return signalObservationSchema.parse({
    status: "unknown",
    reason: candidate.state,
    provenance: candidate.provenance,
  });
}

/**
 * Fuses Role 2's private evidence candidates into one canonical observation.
 * Numeric thresholds remain injected so Phase 3 can settle D2-10 without
 * changing this boundary.
 */
export function fuseObservation(input: ObservationFusionInput): SignalObservation {
  if (!Number.isInteger(input.now) || input.now < 0) {
    throw new RangeError("now must be a non-negative integer timestamp");
  }
  assertUnitInterval("minimumConfidence", input.minimumConfidence);
  assertUnitInterval("conflictConfidenceDelta", input.conflictConfidenceDelta);

  const fallbackProvenance = signalProvenanceSchema.parse(input.fallbackProvenance);
  const candidates = input.candidates.map((candidate) => {
    const provenance = signalProvenanceSchema.parse(candidate.provenance);
    if (candidate.state === "observed") {
      if (!Number.isInteger(candidate.expiresAt) || candidate.expiresAt < 0) {
        throw new RangeError("expiresAt must be a non-negative integer timestamp");
      }
      return { ...candidate, provenance };
    }
    return { ...candidate, provenance };
  });

  const observed = candidates
    .filter((candidate): candidate is Extract<ObservationCandidate, { state: "observed" }> =>
      candidate.state === "observed",
    )
    .sort(compareCandidates);
  const blockers = candidates
    .filter((candidate): candidate is Exclude<ObservationCandidate, { state: "observed" }> =>
      candidate.state !== "observed",
    )
    .sort(compareCandidates);

  const newestObserved = observed[0];
  const newestBlocker = blockers[0];
  if (
    newestBlocker?.state === "permission-denied" &&
    (newestObserved === undefined ||
      newestBlocker.provenance.observedAt > newestObserved.provenance.observedAt)
  ) {
    return unavailableObservation(newestBlocker);
  }

  if (observed.length === 0) {
    if (newestBlocker !== undefined) return unavailableObservation(newestBlocker);
    return signalObservationSchema.parse({
      status: "unknown",
      reason: "not-observed",
      provenance: fallbackProvenance,
    });
  }

  const fresh = observed
    .filter((candidate) => candidate.expiresAt >= input.now)
    .sort(
      (left, right) =>
        right.provenance.confidence - left.provenance.confidence ||
        right.provenance.observedAt - left.provenance.observedAt,
    );

  if (fresh.length === 0) {
    return signalObservationSchema.parse({
      status: "stale",
      reason: "The most recent observation exceeded its configured freshness window.",
      previousValue: newestObserved.value,
      provenance: newestObserved.provenance,
    });
  }

  const strongest = fresh[0];
  if (strongest.provenance.confidence < input.minimumConfidence) {
    return signalObservationSchema.parse({
      status: "unknown",
      reason: "low-confidence",
      provenance: strongest.provenance,
    });
  }

  const conflicting = fresh.find(
    (candidate, index) =>
      index > 0 &&
      !Object.is(candidate.value, strongest.value) &&
      strongest.provenance.confidence - candidate.provenance.confidence <=
        input.conflictConfidenceDelta,
  );
  if (conflicting !== undefined) {
    return signalObservationSchema.parse({
      status: "unknown",
      reason: "conflicting",
      provenance: strongest.provenance,
    });
  }

  return signalObservationSchema.parse({
    status: "known",
    value: strongest.value,
    provenance: strongest.provenance,
  });
}
