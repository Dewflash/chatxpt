import { z } from "zod";

import type {
  CandidateInput,
  QuestCandidate,
} from "../core";
import { ProviderGenerationError } from "./provider-fallback";
import type { CandidateGenerationStrategy } from "./providers";
import {
  acceptedSignalEvidence,
  type AcceptedSignalEvidence,
} from "./signal-evidence";

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
  readonly channel: AcceptedSignalEvidence["channel"];
  readonly value: string | number | boolean;
  readonly confidence: number;
  readonly ageMs: number;
}

const providerInstructions = `You propose livestream sidequests for ChatXPT.
Return exactly three meaningfully different options: one lower-risk stabilising option, one skill or tactical option, and one audience/personality option.
Use only the supplied normalized facts. Never invent HUD values, items, maps, modes, objectives, scores, team states, game rules, emotions, or player intent.
If evidence is unknown, stale, unsupported, or low-confidence, use a broadly measurable game-neutral quest.
Every sourceSignalIds entry must exactly match an available known signal ID supplied in the input. Use an empty list when a quest does not rely on one.
Respect every restriction, forbidden quest type, and accessibility need. Avoid team sabotage, throwing, griefing, wagering, humiliation, sexual content, discrimination, illegal activity, dangerous activity, and real-world physical dares.
Keep each option understandable at a glance, measurable, and achievable during the current match. Titles must be concise. Rationale is producer-only.
Do not include provider names, lifecycle decisions, voting instructions, success claims, or fields outside the requested schema. Role 3 remains the deterministic safety and feasibility authority.`;

function normalizedSignalValue(
  evidence: AcceptedSignalEvidence,
): string | number | boolean {
  const value = evidence.signal.observation.value;
  if (typeof value !== "string") return value;
  return value.trim().slice(0, 80);
}

function signalContext(evidence: AcceptedSignalEvidence): ProviderSignalContext {
  return {
    signalId: evidence.signal.signalId,
    kind: evidence.signal.kind,
    channel: evidence.channel,
    value: normalizedSignalValue(evidence),
    confidence: evidence.signal.observation.provenance.confidence,
    ageMs: evidence.ageMs,
  };
}

function boundedStrings(values: readonly string[], maximumItems: number, maximumLength: number): string[] {
  return values.slice(0, maximumItems).map((value) => value.trim().slice(0, maximumLength));
}

function providerContext(
  input: CandidateInput,
  evidence: readonly AcceptedSignalEvidence[],
): string {
  return JSON.stringify({
    game: {
      gameId: input.profile.gameId,
      supportTier: input.intelligence.gameplay.capabilities.tier,
      supportedSignals: input.intelligence.gameplay.capabilities.supportedSignals.slice(0, 32),
    },
    acceptedSignals: evidence.map(signalContext),
    audience: {
      sampleSize: input.intelligence.audience.sampleSize,
    },
    streamer: {
      experience: Object.fromEntries(
        Object.entries(input.profile.experience).sort(([left], [right]) => left.localeCompare(right)).slice(0, 16),
      ),
      restrictions: boundedStrings(input.profile.restrictions, 16, 120),
      preferredQuestTypes: boundedStrings(input.profile.preferredQuestTypes, 16, 80),
      forbiddenQuestTypes: boundedStrings(input.profile.forbiddenQuestTypes, 16, 80),
      accessibilityNeeds: boundedStrings(input.profile.accessibilityNeeds, 16, 120),
    },
    recentQuestTitles: boundedStrings(input.recentQuestTitles, 12, 80),
  });
}

function acceptedSignalMap(
  evidence: readonly AcceptedSignalEvidence[],
): ReadonlyMap<string, AcceptedSignalEvidence> {
  return new Map(evidence.map((item) => [item.signal.signalId, item]));
}

function candidateConfidence(
  sourceSignalIds: readonly string[],
  evidence: ReadonlyMap<string, AcceptedSignalEvidence>,
): number {
  const cited = sourceSignalIds
    .map((signalId) => evidence.get(signalId))
    .filter((item): item is AcceptedSignalEvidence => item !== undefined);
  if (cited.length === 0) return 0.58;
  const averageEvidenceConfidence = cited.reduce(
    (total, item) => total + item.signal.observation.provenance.confidence,
    0,
  ) / cited.length;
  return Math.min(0.82, 0.58 + cited.length * 0.04 + averageEvidenceConfidence * 0.12);
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
      const acceptedEvidence = acceptedSignalEvidence(input);
      const allowedSignals = acceptedSignalMap(acceptedEvidence);
      let response: StructuredCandidateTransportResponse;
      try {
        response = await options.transport.generate({
          model: options.model,
          instructions: providerInstructions,
          input: providerContext(input, acceptedEvidence),
          schemaName: "chatxpt_candidate_batch",
          jsonSchema: candidateDraftJsonSchema,
          signal,
        });
      } catch (error) {
        if (signal?.aborted) throw signal.reason;
        throw classifyTransportError(error);
      }
      const bundle = parseDrafts(response.outputText, response.refused === true);
      for (const draft of bundle.candidates) {
        if (draft.sourceSignalIds.some((signalId) => !allowedSignals.has(signalId))) {
          throw new ProviderGenerationError(
            "malformed",
            "LLM provider cited an unavailable, stale, future-dated, or low-confidence source signal",
          );
        }
      }
      return bundle.candidates.map((draft, index): QuestCandidate => {
        const sourceSignalIds = [...new Set(draft.sourceSignalIds)];
        return {
          candidateId: `ai-candidate-${input.envelope.revision}-${index + 1}`,
          ...draft,
          sourceSignalIds,
          confidence: candidateConfidence(sourceSignalIds, allowedSignals),
          generation: {
            method: "ai-provider",
            provider: options.providerId,
            generatedAt: input.envelope.occurredAt,
          },
        };
      });
    },
  };
}
