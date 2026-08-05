import {
  audienceSnapshotSchema,
  gameplaySnapshotSchema,
  type AudienceSnapshot,
  type ContractEnvelope,
  type GameplayCapabilities,
  type GameplaySnapshot,
  type SignalProvenance,
} from "../core";
import {
  fuseObservation,
  type ObservationCandidate,
  type ObservationFusionInput,
} from "./observations";

export interface SignalCandidateGroup {
  readonly signalId: string;
  readonly kind: string;
  readonly fallbackProvenance: SignalProvenance;
  readonly candidates: readonly ObservationCandidate[];
}

export type ObservationFusionPolicy = Pick<
  ObservationFusionInput,
  "now" | "minimumConfidence" | "conflictConfidenceDelta"
>;

function buildSignals(groups: readonly SignalCandidateGroup[], policy: ObservationFusionPolicy) {
  return groups.map((group) => ({
    signalId: group.signalId,
    kind: group.kind,
    observation: fuseObservation({
      ...policy,
      fallbackProvenance: group.fallbackProvenance,
      candidates: group.candidates,
    }),
  }));
}

export function buildGameplaySnapshot(input: {
  readonly envelope: ContractEnvelope;
  readonly capabilities: GameplayCapabilities;
  readonly signals: readonly SignalCandidateGroup[];
  readonly fusion: ObservationFusionPolicy;
}): GameplaySnapshot {
  return gameplaySnapshotSchema.parse({
    envelope: input.envelope,
    capabilities: input.capabilities,
    signals: buildSignals(input.signals, input.fusion),
  });
}

export function buildAudienceSnapshot(input: {
  readonly envelope: ContractEnvelope;
  readonly sampleSize: number;
  readonly signals: readonly SignalCandidateGroup[];
  readonly fusion: ObservationFusionPolicy;
}): AudienceSnapshot {
  return audienceSnapshotSchema.parse({
    envelope: input.envelope,
    sampleSize: input.sampleSize,
    signals: buildSignals(input.signals, input.fusion),
  });
}
