import type {
  GameplayFrameObservation,
  GameplaySnapshot,
  SignalProvenance,
} from "../core";
import { buildGameplaySnapshot, type SignalCandidateGroup } from "./snapshots";
import type { MultiGameVisionAssessment } from "./multi-game-vision";
import type { MinecraftHudFact, MinecraftHudFingerprint } from "./minecraft-hud";

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

function isConfirmedMinecraftHud(status: MinecraftHudFingerprint["status"] | undefined): boolean {
  return status === "vanilla-like" || status === "minecraft-like";
}

function minecraftHudFactObservation<T extends string | number | boolean>(
  fact: MinecraftHudFact<T> | undefined,
): { readonly value: T; readonly confidence: number } | null {
  return fact?.status === "known" && fact.value !== null
    ? { value: fact.value, confidence: fact.confidence }
    : null;
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
    const minecraftHud = input.assessment.minecraftHud;
    const hudProvenance = provenance(
      input.frame,
      input.assessment,
      minecraftHud?.confidence ?? 0,
      "minecraft-hud-fingerprint-v1",
    );
    const factProvenance = provenance(
      input.frame,
      input.assessment,
      minecraftHud?.confidence ?? 0,
      "minecraft-hud-pixel-facts-v1",
    );
    groups.push(
      group(
        "minecraft-hud-layout",
        "minecraft-hud-layout",
        hudProvenance,
        isConfirmedMinecraftHud(minecraftHud?.status)
          ? {
              value: minecraftHud?.status ?? "minecraft-like",
              confidence: minecraftHud?.confidence ?? 0,
            }
          : null,
      ),
      group(
        "minecraft-health-hearts",
        "minecraft-health-hearts",
        factProvenance,
        minecraftHudFactObservation(minecraftHud?.facts.healthHearts),
      ),
      group(
        "minecraft-hunger-shanks",
        "minecraft-hunger-shanks",
        factProvenance,
        minecraftHudFactObservation(minecraftHud?.facts.hungerShanks),
      ),
      group(
        "minecraft-armor-points",
        "minecraft-armor-points",
        factProvenance,
        minecraftHudFactObservation(minecraftHud?.facts.armorPoints),
      ),
      group(
        "minecraft-hotbar-visible",
        "minecraft-hotbar-visible",
        factProvenance,
        minecraftHudFactObservation(minecraftHud?.facts.hotbarVisible),
      ),
      group(
        "minecraft-selected-hotbar-category",
        "minecraft-selected-hotbar-category",
        factProvenance,
        minecraftHudFactObservation(minecraftHud?.facts.selectedHotbarCategory),
      ),
      group(
        "minecraft-menu-state",
        "minecraft-menu-state",
        factProvenance,
        minecraftHudFactObservation(input.assessment.minecraftRuntimeFacts?.menuState),
      ),
      group(
        "minecraft-activity",
        "minecraft-activity",
        factProvenance,
        minecraftHudFactObservation(input.assessment.minecraftRuntimeFacts?.activity),
      ),
      group(
        "minecraft-danger",
        "minecraft-danger",
        factProvenance,
        minecraftHudFactObservation(input.assessment.minecraftRuntimeFacts?.danger),
      ),
      group(
        "minecraft-recent-damage",
        "minecraft-recent-damage",
        factProvenance,
        minecraftHudFactObservation(input.assessment.minecraftRuntimeFacts?.recentDamage),
      ),
      group(
        "minecraft-likely-damage-cause",
        "minecraft-likely-damage-cause",
        factProvenance,
        minecraftHudFactObservation(input.assessment.minecraftRuntimeFacts?.likelyDamageCause),
      ),
      group(
        "minecraft-visible-hostile",
        "minecraft-visible-hostile",
        factProvenance,
        minecraftHudFactObservation(input.assessment.minecraftRuntimeFacts?.visibleHostile),
      ),
      group(
        "minecraft-biome-environment",
        "minecraft-biome-environment",
        factProvenance,
        minecraftHudFactObservation(input.assessment.minecraftRuntimeFacts?.biomeOrEnvironment),
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
