import { z } from "zod";

import {
  confidenceSchema,
  contractEnvelopeSchema,
  identifierSchema,
  timestampSchema,
} from "./common";

export const candidateGenerationSchema = z
  .object({
    method: z.enum(["ai-provider", "algorithmic", "deterministic-fallback"]),
    provider: z.string().trim().min(1).max(80).nullable(),
    generatedAt: timestampSchema,
  })
  .strict()
  .superRefine((generation, context) => {
    if (generation.method === "ai-provider" && generation.provider === null) {
      context.addIssue({
        code: "custom",
        message: "AI-provider generation requires a provider identifier",
        path: ["provider"],
      });
    }
    if (generation.method !== "ai-provider" && generation.provider !== null) {
      context.addIssue({
        code: "custom",
        message: "Non-provider generation cannot claim a provider",
        path: ["provider"],
      });
    }
  });

export const questCandidateSchema = z
  .object({
    candidateId: identifierSchema,
    title: z.string().trim().min(3).max(80),
    instruction: z.string().trim().min(8).max(240),
    durationSeconds: z.number().int().min(10).max(900),
    difficulty: z.enum(["easy", "medium", "hard"]),
    rewardPoints: z.number().int().nonnegative().max(100_000),
    rationale: z.string().trim().min(8).max(320),
    sourceSignalIds: z.array(identifierSchema).max(32),
    confidence: confidenceSchema,
    generation: candidateGenerationSchema,
  })
  .strict()
  .superRefine((candidate, context) => {
    if (new Set(candidate.sourceSignalIds).size !== candidate.sourceSignalIds.length) {
      context.addIssue({
        code: "custom",
        message: "Candidate source signal IDs must be distinct",
        path: ["sourceSignalIds"],
      });
    }
  });

export const candidateBatchSchema = z
  .object({
    envelope: contractEnvelopeSchema,
    candidates: z.array(questCandidateSchema).length(3),
  })
  .strict()
  .superRefine((batch, context) => {
    const candidateIds = new Set(batch.candidates.map((candidate) => candidate.candidateId));
    if (candidateIds.size !== batch.candidates.length) {
      context.addIssue({
        code: "custom",
        message: "Candidate IDs must be distinct",
        path: ["candidates"],
      });
    }

    const normalisedTitles = new Set(
      batch.candidates.map((candidate) => candidate.title.trim().toLocaleLowerCase()),
    );
    if (normalisedTitles.size !== batch.candidates.length) {
      context.addIssue({
        code: "custom",
        message: "Candidate titles must be distinct",
        path: ["candidates"],
      });
    }
  });

export const questCycleStatusSchema = z.enum([
  "idle",
  "evaluating",
  "proposed",
  "voting",
  "active",
  "succeeded",
  "failed",
  "cancelled",
  "skipped",
  "expired",
  "cooldown",
]);

export const streamerQuestActionSchema = z.enum([
  "approve",
  "reject",
  "start",
  "pause",
  "cancel",
  "skip",
  "succeed",
  "fail",
  "emergency-pause",
]);

export const voteTallySchema = z
  .object({
    candidateId: identifierSchema,
    votes: z.number().int().nonnegative(),
  })
  .strict();

export const questProgressSchema = z
  .object({
    value: z.number().min(0).max(1),
    updatedAt: timestampSchema,
    method: z.enum(["automatic", "manual", "unknown"]),
    evidenceSignalIds: z.array(identifierSchema).max(32),
  })
  .strict();

export const questCompletionRuleSchema = z
  .object({
    mode: z.enum(["manual", "signal"]),
    allowedSignalKinds: z.array(z.string().trim().min(1).max(80)).max(24),
  })
  .strict()
  .superRefine((rule, context) => {
    if (rule.mode === "manual" && rule.allowedSignalKinds.length > 0) {
      context.addIssue({
        code: "custom",
        message: "Manual completion cannot allow automatic signal kinds",
        path: ["allowedSignalKinds"],
      });
    }
    if (new Set(rule.allowedSignalKinds).size !== rule.allowedSignalKinds.length) {
      context.addIssue({
        code: "custom",
        message: "Completion signal kinds must be distinct",
        path: ["allowedSignalKinds"],
      });
    }
  });

export const questResultSchema = z
  .object({
    outcome: z.enum(["succeeded", "failed", "cancelled", "skipped", "expired"]),
    occurredAt: timestampSchema,
    reason: z.string().trim().min(1).max(240),
    rewardPointsAwarded: z.number().int().nonnegative().max(100_000),
  })
  .strict();

export const questEngineEventDraftSchema = z
  .object({
    eventType: z.string().trim().min(1).max(120),
    attributes: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])),
  })
  .strict();

export const questEngineEventSchema = z
  .object({
    envelope: contractEnvelopeSchema,
    event: questEngineEventDraftSchema,
  })
  .strict();

export const questCycleStateSchema = z
  .object({
    envelope: contractEnvelopeSchema,
    status: questCycleStatusSchema,
    options: z.array(questCandidateSchema).max(3),
    activeCandidateId: identifierSchema.nullable(),
    availableStreamerActions: z.array(streamerQuestActionSchema),
    voteTallies: z.array(voteTallySchema).max(3),
    startsAt: timestampSchema.nullable(),
    endsAt: timestampSchema.nullable(),
    progress: questProgressSchema.nullable(),
    completionRule: questCompletionRuleSchema.nullable().default(null),
    result: questResultSchema.nullable(),
  })
  .strict()
  .superRefine((state, context) => {
    if (state.endsAt !== null && state.startsAt !== null && state.endsAt < state.startsAt) {
      context.addIssue({ code: "custom", message: "endsAt cannot precede startsAt", path: ["endsAt"] });
    }
    if (state.status === "active" && state.activeCandidateId === null) {
      context.addIssue({
        code: "custom",
        message: "Active quest cycles require activeCandidateId",
        path: ["activeCandidateId"],
      });
    }
    if (["proposed", "voting", "active"].includes(state.status) && state.options.length !== 3) {
      context.addIssue({
        code: "custom",
        message: `${state.status} quest cycles require exactly three options`,
        path: ["options"],
      });
    }
    if (
      state.activeCandidateId !== null &&
      !state.options.some((candidate) => candidate.candidateId === state.activeCandidateId)
    ) {
      context.addIssue({
        code: "custom",
        message: "activeCandidateId must reference one of the cycle options",
        path: ["activeCandidateId"],
      });
    }

    const optionIds = state.options.map((candidate) => candidate.candidateId);
    if (new Set(optionIds).size !== optionIds.length) {
      context.addIssue({ code: "custom", message: "Quest-cycle option IDs must be distinct", path: ["options"] });
    }

    const tallyIds = state.voteTallies.map((tally) => tally.candidateId);
    if (new Set(tallyIds).size !== tallyIds.length) {
      context.addIssue({
        code: "custom",
        message: "Vote-tally candidate IDs must be distinct",
        path: ["voteTallies"],
      });
    }
    for (const [index, tally] of state.voteTallies.entries()) {
      if (!optionIds.includes(tally.candidateId)) {
        context.addIssue({
          code: "custom",
          message: "Vote tallies must reference a cycle option",
          path: ["voteTallies", index, "candidateId"],
        });
      }
    }
  });

export const rewardEventSchema = z
  .object({
    envelope: contractEnvelopeSchema,
    viewerId: identifierSchema.nullable(),
    points: z.number().int().nonnegative().max(100_000),
    hypeDelta: z.number().int().min(-100_000).max(100_000),
    reason: z.string().trim().min(1).max(160),
  })
  .strict();

export type QuestCandidate = z.infer<typeof questCandidateSchema>;
export type CandidateBatch = z.infer<typeof candidateBatchSchema>;
export type QuestCycleState = z.infer<typeof questCycleStateSchema>;
export type StreamerQuestAction = z.infer<typeof streamerQuestActionSchema>;
export type QuestProgress = z.infer<typeof questProgressSchema>;
export type QuestCompletionRule = z.infer<typeof questCompletionRuleSchema>;
export type QuestResult = z.infer<typeof questResultSchema>;
export type QuestEngineEventDraft = z.infer<typeof questEngineEventDraftSchema>;
export type QuestEngineEvent = z.infer<typeof questEngineEventSchema>;
export type RewardEvent = z.infer<typeof rewardEventSchema>;
