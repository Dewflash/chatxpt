import type {
  GameplayFrameObservation,
  GameplaySnapshot,
  SignalProvenance,
} from "../core";
import { buildGameplaySnapshot, type SignalCandidateGroup } from "./snapshots";
import type { MultiGameVisionAssessment } from "./multi-game-vision";

const MINIMUM_CONFIDENCE = 0.75;
const CONFLICT_CONFIDENCE_DELTA = 0.1;
const SIGNAL_FRESHNESS_MS = 3_000;

function provenance(
  frame: GameplayFrameObservation,
  assessment: MultiGameVisionAssessment,
  confidence: number,
  method: string,
): SignalProvenance {
  return {
    source: frame.envelope.source,
    method,
    confidence: Math.max(0, Math.min(1, confidence)),
    observedAt: assessment.observedAt,
    receivedAt: Math.max(frame.envelope.receivedAt, assessment.observedAt),
    evidenceClass: frame.envelope.evidenceClass,
  };
}

function group(
  signalId: string,
  kind: string,
  fallbackProvenance: SignalProvenance,
  observed: { readonly value: string | number | boolean; readonly confidence: number } | null,
): SignalCandidateGroup {
  return {
    signalId,
    kind,
    fallbackProvenance,
    candidates:
      observed === null
        ? []
        : [{
            state: "observed",
            value: observed.value,
            expiresAt: fallbackProvenance.observedAt + SIGNAL_FRESHNESS_MS,
            provenance: { ...fallbackProvenance, confidence: observed.confidence },
          }],
  };
}

/** Projects private multi-game analysis into the existing game-neutral contract. */
export function buildMultiGameGameplaySnapshot(input: {
  readonly frame: GameplayFrameObservation;
  readonly assessment: MultiGameVisionAssessment;
}): GameplaySnapshot {
  if (input.frame.status !== "ready") {
    throw new RangeError("a ready gameplay frame is required for a multi-game snapshot");
  }
  if (input.frame.capturedAt !== input.assessment.observedAt) {
    throw new RangeError("gameplay frame and multi-game assessment timestamps must match");
  }
  const method = `multi-game-vision-${input.assessment.profile.profileId}`;
  const fallback = provenance(input.frame, input.assessment, 0, method);
  const interpretation = input.assessment.interpretation;
  const interpretationKnown = interpretation.status === "known";
  const groups: SignalCandidateGroup[] = [
    group(
      "game-vision-state",
      "visual-state",
      fallback,
      interpretationKnown
        ? { value: interpretation.state, confidence: interpretation.confidence }
        : null,
    ),
    group(
      "game-vision-activity",
      "activity-intensity",
      fallback,
      input.assessment.motion === null
        ? null
        : {
            value: input.assessment.motion.changedPixelRatio,
            confidence: interpretationKnown ? interpretation.confidence : 0.5,
          },
    ),
    group(
      "game-global-motion-pattern",
      "global-motion-pattern",
      fallback,
      interpretationKnown && [
        "stable",
        "coherent-global-motion",
        "rapid-coherent-global-motion",
        "erratic-global-motion",
      ].includes(interpretation.state)
        ? { value: interpretation.state, confidence: interpretation.confidence }
        : null,
    ),
    group(
      "game-scene-transition",
      "scene-transition",
      fallback,
      interpretationKnown
        ? { value: interpretation.state === "scene-transition", confidence: interpretation.confidence }
        : null,
    ),
  ];

  if (input.assessment.profile.gameId === "minecraft") {
    groups.push(
      group(
        "minecraft-hud-layout",
        "minecraft-hud-layout",
        provenance(
          input.frame,
          input.assessment,
          input.assessment.minecraftHud?.confidence ?? 0,
          "minecraft-hud-fingerprint-v1",
        ),
        input.assessment.minecraftHud?.status === "vanilla-like"
          ? {
              value: "vanilla-like",
              confidence: input.assessment.minecraftHud.confidence,
            }
          : null,
      ),
    );
  }
  if (input.assessment.profile.gameId === "brawl-stars") {
    const confirmed = input.assessment.brawlHud?.status === "standard-like";
    groups.push(
      group(
        "brawl-hud-layout",
        "brawl-hud-layout",
        provenance(
          input.frame,
          input.assessment,
          input.assessment.brawlHud?.confidence ?? 0,
          "brawl-hud-fingerprint-v1",
        ),
        confirmed
          ? { value: "standard-like", confidence: input.assessment.brawlHud?.confidence ?? 0 }
          : null,
      ),
      group(
        "brawl-match-active",
        "match-active",
        provenance(
          input.frame,
          input.assessment,
          input.assessment.brawlHud?.confidence ?? 0,
          "brawl-hud-fingerprint-v1",
        ),
        confirmed
          ? { value: true, confidence: input.assessment.brawlHud?.confidence ?? 0 }
          : null,
      ),
    );
  }

  return buildGameplaySnapshot({
    envelope: {
      ...input.frame.envelope,
      messageId: `gameplay-snapshot-${input.frame.frameId}`,
      occurredAt: input.assessment.observedAt,
      receivedAt: Math.max(input.frame.envelope.receivedAt, input.assessment.observedAt),
    },
    capabilities: {
      tier: input.assessment.supportTier,
      gameId: input.assessment.profile.gameId,
      adapterId:
        input.assessment.supportTier === "calibrated-hud"
          ? input.assessment.profile.profileId
          : null,
      supportedSignals: [...input.assessment.supportedSignals],
    },
    signals: groups,
    fusion: {
      now: input.assessment.observedAt,
      minimumConfidence: MINIMUM_CONFIDENCE,
      conflictConfidenceDelta: CONFLICT_CONFIDENCE_DELTA,
    },
  });
}
