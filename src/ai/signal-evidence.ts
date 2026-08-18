import type { CandidateInput, NamedSignal } from "../core";

export const ROLE3_COMPATIBLE_MINIMUM_SIGNAL_CONFIDENCE = 0.5;
export const ROLE3_COMPATIBLE_MAXIMUM_GAMEPLAY_SIGNAL_AGE_MS = 15_000;
export const ROLE3_COMPATIBLE_MAXIMUM_AUDIENCE_SIGNAL_AGE_MS = 30_000;

export interface AcceptedSignalEvidence {
  readonly signal: Pick<NamedSignal, "signalId" | "kind"> & {
    readonly observation: Extract<NamedSignal["observation"], { readonly status: "known" }>;
  };
  readonly channel: "gameplay" | "audience";
  readonly ageMs: number;
}

function acceptedFrom(
  signals: readonly NamedSignal[],
  channel: AcceptedSignalEvidence["channel"],
  now: number,
  maximumAgeMs: number,
): AcceptedSignalEvidence[] {
  const accepted: AcceptedSignalEvidence[] = [];
  for (const signal of signals) {
    const observation = signal.observation;
    if (observation.status !== "known") continue;
    const ageMs = now - observation.provenance.observedAt;
    if (
      ageMs < 0 ||
      ageMs > maximumAgeMs ||
      observation.provenance.confidence < ROLE3_COMPATIBLE_MINIMUM_SIGNAL_CONFIDENCE
    ) {
      continue;
    }
    accepted.push({
      signal: { signalId: signal.signalId, kind: signal.kind, observation },
      channel,
      ageMs,
    });
  }
  return accepted;
}

/**
 * Applies the same freshness and confidence gate to every candidate strategy.
 * Provider prompts and algorithmic candidates therefore cannot cite evidence
 * that Role 3 would immediately reject.
 */
export function acceptedSignalEvidence(input: CandidateInput): readonly AcceptedSignalEvidence[] {
  const now = input.envelope.occurredAt;
  return [
    ...acceptedFrom(
      input.intelligence.gameplay.signals,
      "gameplay",
      now,
      ROLE3_COMPATIBLE_MAXIMUM_GAMEPLAY_SIGNAL_AGE_MS,
    ),
    ...acceptedFrom(
      input.intelligence.audience.signals,
      "audience",
      now,
      ROLE3_COMPATIBLE_MAXIMUM_AUDIENCE_SIGNAL_AGE_MS,
    ),
  ];
}
