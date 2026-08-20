import { z } from "zod";

import {
  signalValueSchema,
  type CandidateInput,
  type NamedSignal,
} from "../core";

export const GENERIC_GAME_STATE_CONTEXT_FRESHNESS_MS = 3_000;

export const genericGameFactStatusSchema = z.enum(["known", "unknown", "stale", "unsupported"]);

export const genericGameFactSchema = z
  .object({
    status: genericGameFactStatusSchema,
    value: signalValueSchema.nullable(),
    confidence: z.number().min(0).max(1),
    sourceSignalIds: z.array(z.string().trim().min(1).max(80)).max(8),
    reason: z.string().trim().min(1).max(160).optional(),
  })
  .strict()
  .superRefine((fact, context) => {
    if (fact.status === "known" && fact.value === null) {
      context.addIssue({
        code: "custom",
        message: "Known generic game facts require a value",
        path: ["value"],
      });
    }
    if (fact.status !== "known" && fact.value !== null) {
      context.addIssue({
        code: "custom",
        message: "Only known generic game facts can carry a value",
        path: ["value"],
      });
    }
    if (fact.status !== "known" && fact.reason === undefined) {
      context.addIssue({
        code: "custom",
        message: "Unknown, stale, and unsupported generic game facts require a reason",
        path: ["reason"],
      });
    }
    if (new Set(fact.sourceSignalIds).size !== fact.sourceSignalIds.length) {
      context.addIssue({
        code: "custom",
        message: "Generic game fact sourceSignalIds must be distinct",
        path: ["sourceSignalIds"],
      });
    }
  });

const genericGameFactsSchema = z
  .object({
    hudLayout: genericGameFactSchema,
    playerHealth: genericGameFactSchema,
    playerResource: genericGameFactSchema,
    playerDefense: genericGameFactSchema,
    loadoutState: genericGameFactSchema,
    menuState: genericGameFactSchema,
    activity: genericGameFactSchema,
    combatRisk: genericGameFactSchema,
    recentDamage: genericGameFactSchema,
    objectiveState: genericGameFactSchema,
    matchTimer: genericGameFactSchema,
    scoreState: genericGameFactSchema,
    environment: genericGameFactSchema,
  })
  .strict();

export const genericGameStateContextSchema = z
  .object({
    schemaVersion: z.literal("generic-game-state-v1"),
    selectedGameId: z.string().trim().min(1).max(80).nullable(),
    selectedGameName: z.string().trim().min(1).max(100),
    supportTier: z.enum(["universal-visual", "calibrated-hud", "native-telemetry"]),
    facts: genericGameFactsSchema,
    gameSpecificContext: z.enum(["minecraft", "brawl-stars"]).nullable(),
    supportedGenericFacts: z.array(z.string().trim().min(1).max(80)).max(32),
    unknownGenericFacts: z.array(z.string().trim().min(1).max(80)).max(32),
  })
  .strict()
  .superRefine((contextValue, context) => {
    for (const [path, values] of [
      ["supportedGenericFacts", contextValue.supportedGenericFacts],
      ["unknownGenericFacts", contextValue.unknownGenericFacts],
    ] as const) {
      if (new Set(values).size !== values.length) {
        context.addIssue({
          code: "custom",
          message: `${path} must be distinct`,
          path: [path],
        });
      }
    }
  });

export type GenericGameFactStatus = z.infer<typeof genericGameFactStatusSchema>;
export type GenericGameFact = z.infer<typeof genericGameFactSchema>;
export type GenericGameStateContext = z.infer<typeof genericGameStateContextSchema>;

function genericFactFromSignal(
  signal: NamedSignal | undefined,
  reason: string,
  now: number,
): GenericGameFact {
  if (signal === undefined) {
    return genericGameFactSchema.parse({
      status: "unsupported",
      value: null,
      confidence: 0,
      sourceSignalIds: [],
      reason,
    });
  }
  const confidence = signal.observation.provenance.confidence;
  if (signal.observation.status === "known") {
    const ageMs = Math.max(0, now - signal.observation.provenance.observedAt);
    if (ageMs > GENERIC_GAME_STATE_CONTEXT_FRESHNESS_MS) {
      return genericGameFactSchema.parse({
        status: "stale",
        value: null,
        confidence,
        sourceSignalIds: [signal.signalId],
        reason: "The fact is stale for the current AI request.",
      });
    }
    return genericGameFactSchema.parse({
      status: "known",
      value: signal.observation.value,
      confidence,
      sourceSignalIds: [signal.signalId],
    });
  }
  return genericGameFactSchema.parse({
    status: signal.observation.status === "stale"
      ? "stale"
      : signal.observation.status === "unavailable"
        ? "unsupported"
        : "unknown",
    value: null,
    confidence,
    sourceSignalIds: [signal.signalId],
    reason: signal.observation.reason,
  });
}

function firstSignalByIds(
  bySignalId: ReadonlyMap<string, NamedSignal>,
  signalIds: readonly string[],
): NamedSignal | undefined {
  return signalIds.map((signalId) => bySignalId.get(signalId)).find((signal) => signal !== undefined);
}

export function buildGenericGameStateContext(
  input: CandidateInput,
  now = input.envelope.occurredAt,
): GenericGameStateContext {
  const bySignalId = new Map(input.intelligence.gameplay.signals.map((signal) => [signal.signalId, signal]));
  const gameId = input.intelligence.gameplay.capabilities.gameId ?? input.profile.gameId;
  const facts = {
    hudLayout: genericFactFromSignal(
      firstSignalByIds(bySignalId, ["minecraft-hud-layout", "brawl-hud-layout"]),
      "No calibrated HUD layout is confirmed.",
      now,
    ),
    playerHealth: genericFactFromSignal(
      firstSignalByIds(bySignalId, ["minecraft-health-hearts", "player-health"]),
      "Player health is not confirmed.",
      now,
    ),
    playerResource: genericFactFromSignal(
      firstSignalByIds(bySignalId, ["minecraft-hunger-shanks"]),
      "Player resource state is not confirmed.",
      now,
    ),
    playerDefense: genericFactFromSignal(
      firstSignalByIds(bySignalId, ["minecraft-armor-points"]),
      "Player defense or armor state is not confirmed.",
      now,
    ),
    loadoutState: genericFactFromSignal(
      firstSignalByIds(bySignalId, ["minecraft-selected-hotbar-category", "minecraft-hotbar-visible"]),
      "Loadout or selected item state is not confirmed.",
      now,
    ),
    menuState: genericFactFromSignal(
      firstSignalByIds(bySignalId, ["minecraft-menu-state"]),
      "Menu, inventory, shop, or sleep state is not confirmed.",
      now,
    ),
    activity: genericFactFromSignal(
      firstSignalByIds(bySignalId, ["minecraft-activity", "game-vision-state"]),
      "Specific gameplay activity is not confirmed.",
      now,
    ),
    combatRisk: genericFactFromSignal(
      firstSignalByIds(bySignalId, ["minecraft-danger"]),
      "Combat risk is not confirmed.",
      now,
    ),
    recentDamage: genericFactFromSignal(
      firstSignalByIds(bySignalId, ["minecraft-recent-damage"]),
      "Recent damage or pressure is not confirmed.",
      now,
    ),
    objectiveState: genericFactFromSignal(
      firstSignalByIds(bySignalId, ["match-active", "match-outcome"]),
      "Objective state is not confirmed.",
      now,
    ),
    matchTimer: genericFactFromSignal(
      firstSignalByIds(bySignalId, ["match-timer"]),
      "Match timer is not confirmed.",
      now,
    ),
    scoreState: genericFactFromSignal(
      firstSignalByIds(bySignalId, ["match-score"]),
      "Score state is not confirmed.",
      now,
    ),
    environment: genericFactFromSignal(
      firstSignalByIds(bySignalId, ["minecraft-biome-environment"]),
      "Environment or biome state is not confirmed.",
      now,
    ),
  };
  return genericGameStateContextSchema.parse({
    schemaVersion: "generic-game-state-v1",
    selectedGameId: gameId,
    selectedGameName: input.profile.gameName ?? "Unknown game",
    supportTier: input.intelligence.gameplay.capabilities.tier,
    facts,
    gameSpecificContext: gameId === "minecraft" || gameId === "brawl-stars" ? gameId : null,
    supportedGenericFacts: Object.entries(facts)
      .filter(([, fact]) => fact.status === "known")
      .map(([key]) => key),
    unknownGenericFacts: Object.entries(facts)
      .filter(([, fact]) => fact.status !== "known")
      .map(([key]) => key),
  });
}
