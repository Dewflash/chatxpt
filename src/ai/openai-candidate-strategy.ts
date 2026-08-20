import { z } from "zod";

import type {
  CandidateInput,
  NamedSignal,
  QuestCandidate,
} from "../core";
import { buildGenericGameStateContext } from "../extraction/game-state-context";
import {
  knownMinecraftFact,
  minecraftSupportedFacts,
  minecraftUnknownFacts,
  unknownMinecraftFact,
  type MinecraftAwareContext,
  type MinecraftFact,
  type MinecraftFactStatus,
} from "../extraction/minecraft-state";
import { ProviderGenerationError } from "./provider-fallback";
import type { CandidateGenerationStrategy } from "./providers";

const candidateDraftSchema = z
  .object({
    title: z.string().trim().min(3).max(80),
    instruction: z.string().trim().min(8).max(240),
    durationSeconds: z.number().int().min(10).max(900),
    difficulty: z.enum(["easy", "medium", "hard"]),
    rewardPoints: z.number().int().nonnegative().max(100_000),
    rationale: z.string().trim().min(8).max(320),
    sourceSignalIds: z.array(z.string().trim().min(1).max(80)).max(8),
  })
  .strict();

const candidateDraftBundleSchema = z
  .object({ candidates: z.array(candidateDraftSchema).length(3) })
  .strict();

export const candidateDraftJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["candidates"],
  properties: {
    candidates: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "title",
          "instruction",
          "durationSeconds",
          "difficulty",
          "rewardPoints",
          "rationale",
          "sourceSignalIds",
        ],
        properties: {
          title: { type: "string", minLength: 3, maxLength: 80 },
          instruction: { type: "string", minLength: 8, maxLength: 240 },
          durationSeconds: { type: "integer", minimum: 10, maximum: 900 },
          difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
          rewardPoints: { type: "integer", minimum: 0, maximum: 100000 },
          rationale: { type: "string", minLength: 8, maxLength: 320 },
          sourceSignalIds: {
            type: "array",
            maxItems: 8,
            items: { type: "string", minLength: 1, maxLength: 80 },
          },
        },
      },
    },
  },
} as const;

export interface StructuredCandidateTransportRequest {
  readonly model: string;
  readonly instructions: string;
  readonly input: string;
  readonly schemaName: "chatxpt_candidate_batch";
  readonly jsonSchema: typeof candidateDraftJsonSchema;
  readonly signal?: AbortSignal;
}

export interface StructuredCandidateTransportResponse {
  readonly outputText: string | null;
  readonly refused?: boolean;
}

export interface StructuredCandidateTransport {
  generate(
    request: StructuredCandidateTransportRequest,
  ): Promise<StructuredCandidateTransportResponse>;
}

export interface OpenAICandidateStrategyOptions {
  readonly providerId: string;
  readonly model: string;
  readonly transport: StructuredCandidateTransport;
}

interface ProviderSignalContext {
  readonly signalId: string;
  readonly kind: string;
  readonly status: NamedSignal["observation"]["status"];
  readonly value?: string | number | boolean;
  readonly confidence: number;
  readonly ageMs: number;
}

const MINECRAFT_CONTEXT_SIGNAL_MAP = {
  hudLayout: "minecraft-hud-layout",
  healthHearts: "minecraft-health-hearts",
  hungerShanks: "minecraft-hunger-shanks",
  armorPoints: "minecraft-armor-points",
  hotbarVisible: "minecraft-hotbar-visible",
  selectedHotbarCategory: "minecraft-selected-hotbar-category",
  menuState: "minecraft-menu-state",
  activity: "minecraft-activity",
  danger: "minecraft-danger",
  recentDamage: "minecraft-recent-damage",
  likelyDamageCause: "minecraft-likely-damage-cause",
  visibleHostile: "minecraft-visible-hostile",
  biomeOrEnvironment: "minecraft-biome-environment",
} as const;

const MINECRAFT_CONTEXT_FRESHNESS_MS = 3_000;

const providerInstructions = `You propose livestream sidequests for ChatXPT.
Return exactly three meaningfully different options: one lower-risk stabilising option, one skill or tactical option, and one audience/personality option.
Use only the supplied normalized facts. Never invent HUD values, items, maps, modes, objectives, scores, team states, game rules, emotions, or player intent.
If evidence is unknown, stale, unsupported, or low-confidence, use a broadly measurable game-neutral quest.
Treat gameState.facts as the cross-game vocabulary. Use it for general game claims such as health, resource, defense, loadout, menu, activity, combat risk, objective, timer, score, or environment only when the relevant fact is known.
For Minecraft, treat the minecraft.gameFacts block as the game-specific layer on top of gameState: use a Minecraft fact only when its status is known, and do not infer sleep, biome, hostile mob, item, damage cause, danger, menu, quest intent, or player objective from other fields.
Every sourceSignalIds entry must exactly match an available known signal ID supplied in the input. Use an empty list when a quest does not rely on one.
Respect every restriction, forbidden quest type, and accessibility need. Avoid team sabotage, throwing, griefing, wagering, humiliation, sexual content, discrimination, illegal activity, dangerous activity, and real-world physical dares.
Keep each option understandable at a glance, measurable, and achievable during the current match. Titles must be concise. Rationale is producer-only.
Do not include provider names, lifecycle decisions, voting instructions, success claims, or fields outside the requested schema. Role 3 remains the deterministic safety and feasibility authority.`;

function normalizedSignalValue(signal: NamedSignal): string | number | boolean | undefined {
  if (signal.observation.status !== "known") return undefined;
  const value = signal.observation.value;
  if (typeof value !== "string") return value;
  return value.trim().slice(0, 80);
}

function signalContext(signal: NamedSignal, now: number): ProviderSignalContext {
  return {
    signalId: signal.signalId,
    kind: signal.kind,
    status: signal.observation.status,
    value: normalizedSignalValue(signal),
    confidence: signal.observation.provenance.confidence,
    ageMs: Math.max(0, now - signal.observation.provenance.observedAt),
  };
}

function observationStatusToMinecraftStatus(status: NamedSignal["observation"]["status"]): Exclude<MinecraftFactStatus, "known"> {
  if (status === "stale") return "stale";
  if (status === "unavailable") return "unsupported";
  return "unknown";
}

function minecraftFactFromSignal(input: {
  readonly signal: NamedSignal | undefined;
  readonly now: number;
  readonly method: string;
  readonly reason: string;
}): MinecraftFact {
  const { signal, now, method, reason } = input;
  if (signal === undefined) {
    return unknownMinecraftFact(reason, {
      observedAt: now,
      method,
      reason,
    });
  }
  const observedAt = signal.observation.provenance.observedAt;
  const ageMs = Math.max(0, now - observedAt);
  const base = {
    observedAt,
    expiresAt: observedAt + MINECRAFT_CONTEXT_FRESHNESS_MS,
    method: signal.observation.provenance.method,
    sourceSignalIds: [signal.signalId],
    confidence: signal.observation.provenance.confidence,
  };
  if (
    signal.observation.status === "known" &&
    ageMs <= MINECRAFT_CONTEXT_FRESHNESS_MS
  ) {
    return knownMinecraftFact(signal.observation.value, base);
  }
  return unknownMinecraftFact(
    signal.observation.status === "known"
      ? "The Minecraft fact is stale for the current AI request."
      : signal.observation.reason,
    base,
    signal.observation.status === "known"
      ? "stale"
      : observationStatusToMinecraftStatus(signal.observation.status),
  );
}

function buildMinecraftContext(input: CandidateInput, now: number): MinecraftAwareContext | null {
  if (
    input.profile.gameId !== "minecraft" &&
    input.intelligence.gameplay.capabilities.gameId !== "minecraft"
  ) {
    return null;
  }
  const bySignalId = new Map(
    input.intelligence.gameplay.signals.map((signal) => [signal.signalId, signal]),
  );
  const method = "minecraft-provider-context-v1";
  const gameFacts = {
    edition: knownMinecraftFact("java", {
      observedAt: now,
      method: "streamer-game-profile",
      sourceSignalIds: [],
      confidence: input.profile.gameId === "minecraft" ? 0.9 : 0.7,
    }),
    mode: unknownMinecraftFact("Minecraft mode is not confirmed by the current detector.", {
      observedAt: now,
      method,
      reason: "Minecraft mode is not confirmed by the current detector.",
    }),
    hudLayout: minecraftFactFromSignal({
      signal: bySignalId.get(MINECRAFT_CONTEXT_SIGNAL_MAP.hudLayout),
      now,
      method,
      reason: "Minecraft HUD layout is not confirmed.",
    }),
    healthHearts: minecraftFactFromSignal({
      signal: bySignalId.get(MINECRAFT_CONTEXT_SIGNAL_MAP.healthHearts),
      now,
      method,
      reason: "Minecraft health hearts are not confirmed.",
    }),
    hungerShanks: minecraftFactFromSignal({
      signal: bySignalId.get(MINECRAFT_CONTEXT_SIGNAL_MAP.hungerShanks),
      now,
      method,
      reason: "Minecraft hunger shanks are not confirmed.",
    }),
    armorPoints: minecraftFactFromSignal({
      signal: bySignalId.get(MINECRAFT_CONTEXT_SIGNAL_MAP.armorPoints),
      now,
      method,
      reason: "Minecraft armor points are not parsed by the current detector.",
    }),
    hotbarVisible: minecraftFactFromSignal({
      signal: bySignalId.get(MINECRAFT_CONTEXT_SIGNAL_MAP.hotbarVisible),
      now,
      method,
      reason: "Minecraft hotbar visibility is not confirmed.",
    }),
    selectedHotbarCategory: minecraftFactFromSignal({
      signal: bySignalId.get(MINECRAFT_CONTEXT_SIGNAL_MAP.selectedHotbarCategory),
      now,
      method,
      reason: "Minecraft selected hotbar item category is not parsed by the current detector.",
    }),
    menuState: minecraftFactFromSignal({
      signal: bySignalId.get(MINECRAFT_CONTEXT_SIGNAL_MAP.menuState),
      now,
      method,
      reason: "Minecraft menu, inventory, sleep, and death screens are not parsed by the current detector.",
    }),
    activity: minecraftFactFromSignal({
      signal: bySignalId.get(MINECRAFT_CONTEXT_SIGNAL_MAP.activity),
      now,
      method,
      reason: "Minecraft-specific activity such as mining, building, or fighting is not classified by the current detector.",
    }),
    danger: minecraftFactFromSignal({
      signal: bySignalId.get(MINECRAFT_CONTEXT_SIGNAL_MAP.danger),
      now,
      method,
      reason: "Minecraft danger state is not classified by the current detector.",
    }),
    recentDamage: minecraftFactFromSignal({
      signal: bySignalId.get(MINECRAFT_CONTEXT_SIGNAL_MAP.recentDamage),
      now,
      method,
      reason: "Recent Minecraft damage is not detected by the current detector.",
    }),
    likelyDamageCause: minecraftFactFromSignal({
      signal: bySignalId.get(MINECRAFT_CONTEXT_SIGNAL_MAP.likelyDamageCause),
      now,
      method,
      reason: "Minecraft damage cause is not classified by the current detector.",
    }),
    visibleHostile: minecraftFactFromSignal({
      signal: bySignalId.get(MINECRAFT_CONTEXT_SIGNAL_MAP.visibleHostile),
      now,
      method,
      reason: "Visible Minecraft hostile mobs are not detected by the current detector.",
    }),
    biomeOrEnvironment: minecraftFactFromSignal({
      signal: bySignalId.get(MINECRAFT_CONTEXT_SIGNAL_MAP.biomeOrEnvironment),
      now,
      method,
      reason: "Minecraft biome or environment is not classified by the current detector.",
    }),
  };
  return {
    gameId: "minecraft",
    gameFacts,
    streamerIntent: {
      streamerGoal: null,
    },
    activeChatXptQuest: input.activeChatXptQuest,
    supportedFacts: [...minecraftSupportedFacts(gameFacts)],
    unknownFacts: [...minecraftUnknownFacts(gameFacts)],
  };
}

function providerContext(input: CandidateInput): string {
  const now = input.envelope.occurredAt;
  const gameState = buildGenericGameStateContext(input, now);
  const minecraft = buildMinecraftContext(input, now);
  return JSON.stringify({
    game: {
      gameId: input.profile.gameId,
      gameName: input.profile.gameName,
      supportTier: input.intelligence.gameplay.capabilities.tier,
      supportedSignals: input.intelligence.gameplay.capabilities.supportedSignals,
    },
    gameState,
    gameplaySignals: input.intelligence.gameplay.signals.map((signal) => signalContext(signal, now)),
    audience: {
      sampleSize: input.intelligence.audience.sampleSize,
      signals: input.intelligence.audience.signals.map((signal) => signalContext(signal, now)),
    },
    streamer: {
      experience: input.profile.experience,
      restrictions: input.profile.restrictions,
      preferredQuestTypes: input.profile.preferredQuestTypes,
      forbiddenQuestTypes: input.profile.forbiddenQuestTypes,
      accessibilityNeeds: input.profile.accessibilityNeeds,
    },
    ...(minecraft === null ? {} : { minecraft }),
    recentQuestTitles: input.recentQuestTitles,
  });
}

function knownSignalIds(input: CandidateInput): ReadonlySet<string> {
  return new Set(
    [...input.intelligence.gameplay.signals, ...input.intelligence.audience.signals]
      .filter(({ observation }) => observation.status === "known")
      .map(({ signalId }) => signalId),
  );
}

function candidateConfidence(sourceSignalIds: readonly string[]): number {
  return Math.min(0.82, 0.62 + sourceSignalIds.length * 0.06);
}

function classifyTransportError(error: unknown): ProviderGenerationError {
  if (error instanceof ProviderGenerationError) return error;
  const status =
    typeof error === "object" && error !== null && "status" in error
      ? Number((error as { status?: unknown }).status)
      : null;
  if (status === 429) return new ProviderGenerationError("rate-limited", "LLM provider rate limit reached", error);
  if (status !== null && status >= 500) {
    return new ProviderGenerationError("unavailable", "LLM provider is unavailable", error);
  }
  return new ProviderGenerationError("error", "LLM provider request failed", error);
}

function parseDrafts(outputText: string | null, refused: boolean): z.infer<typeof candidateDraftBundleSchema> {
  if (refused) throw new ProviderGenerationError("refusal", "LLM provider refused candidate generation");
  if (outputText === null || outputText.trim().length === 0) {
    throw new ProviderGenerationError("malformed", "LLM provider returned no structured candidate output");
  }
  try {
    return candidateDraftBundleSchema.parse(JSON.parse(outputText));
  } catch (error) {
    throw new ProviderGenerationError("malformed", "LLM provider returned malformed candidate output", error);
  }
}

/**
 * Creates a provider candidate strategy over normalized, privacy-safe context.
 * The model cannot choose provider metadata or authoritative lifecycle state.
 */
export function createOpenAICandidateStrategy(
  options: OpenAICandidateStrategyOptions,
): CandidateGenerationStrategy {
  if (options.providerId.trim().length === 0 || options.providerId.length > 80) {
    throw new RangeError("providerId must contain 1 to 80 characters");
  }
  if (options.model.trim().length === 0 || options.model.length > 80) {
    throw new RangeError("model must contain 1 to 80 characters");
  }
  return {
    async generate(input, signal) {
      let response: StructuredCandidateTransportResponse;
      try {
        response = await options.transport.generate({
          model: options.model,
          instructions: providerInstructions,
          input: providerContext(input),
          schemaName: "chatxpt_candidate_batch",
          jsonSchema: candidateDraftJsonSchema,
          signal,
        });
      } catch (error) {
        if (signal?.aborted) throw signal.reason;
        throw classifyTransportError(error);
      }
      const bundle = parseDrafts(response.outputText, response.refused === true);
      const allowedSignalIds = knownSignalIds(input);
      for (const draft of bundle.candidates) {
        if (draft.sourceSignalIds.some((signalId) => !allowedSignalIds.has(signalId))) {
          throw new ProviderGenerationError(
            "malformed",
            "LLM provider cited an unavailable or unknown source signal",
          );
        }
      }
      return bundle.candidates.map((draft, index): QuestCandidate => ({
        candidateId: `ai-candidate-${input.envelope.revision}-${index + 1}`,
        ...draft,
        sourceSignalIds: [...new Set(draft.sourceSignalIds)],
        confidence: candidateConfidence(draft.sourceSignalIds),
        generation: {
          method: "ai-provider",
          provider: options.providerId,
          generatedAt: input.envelope.occurredAt,
        },
      }));
    },
  };
}
