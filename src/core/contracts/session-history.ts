import { z } from "zod";

import {
  CONTRACT_VERSION,
  contractVersionSchema,
  evidenceClassSchema,
  identifierSchema,
  messageSourceSchema,
  revisionSchema,
  timestampSchema,
} from "./common";
import { voteTallySchema } from "./quests";

export const sessionHistoryOutcomeSchema = z.enum([
  "succeeded",
  "failed",
  "cancelled",
  "skipped",
  "expired",
]);

export const sessionHistoryEntrySchema = z
  .object({
    sessionId: identifierSchema,
    questCycleId: identifierSchema,
    sessionRevision: revisionSchema,
    title: z.string().trim().min(3).max(80).nullable(),
    activeCandidateId: identifierSchema.nullable(),
    outcome: sessionHistoryOutcomeSchema,
    reason: z.string().trim().min(1).max(240),
    startedAt: timestampSchema.nullable(),
    endedAt: timestampSchema,
    durationSeconds: z.number().int().nonnegative().max(24 * 60 * 60).nullable(),
    acceptedVoteCount: z.number().int().nonnegative(),
    voteTallies: z.array(voteTallySchema).max(3),
    rewardPointsAwarded: z.number().int().nonnegative().max(100_000),
    evidenceClass: evidenceClassSchema,
  })
  .strict()
  .superRefine((entry, context) => {
    if (entry.startedAt !== null && entry.endedAt < entry.startedAt) {
      context.addIssue({
        code: "custom",
        message: "History entry end time cannot precede its start time",
        path: ["endedAt"],
      });
    }
    const tallyTotal = entry.voteTallies.reduce((total, tally) => total + tally.votes, 0);
    if (entry.acceptedVoteCount !== tallyTotal) {
      context.addIssue({
        code: "custom",
        message: "History acceptedVoteCount must equal the published vote tallies",
        path: ["acceptedVoteCount"],
      });
    }
  });

export const sessionHistorySummarySchema = z
  .object({
    totalQuestCycles: z.number().int().nonnegative(),
    succeeded: z.number().int().nonnegative(),
    failed: z.number().int().nonnegative(),
    cancelled: z.number().int().nonnegative(),
    skipped: z.number().int().nonnegative(),
    expired: z.number().int().nonnegative(),
    totalAcceptedVotes: z.number().int().nonnegative(),
    totalRewardPointsAwarded: z.number().int().nonnegative().max(1_000_000_000),
    averageCompletionSeconds: z.number().nonnegative().nullable(),
  })
  .strict()
  .superRefine((summary, context) => {
    const outcomes =
      summary.succeeded +
      summary.failed +
      summary.cancelled +
      summary.skipped +
      summary.expired;
    if (summary.totalQuestCycles !== outcomes) {
      context.addIssue({
        code: "custom",
        message: "History totalQuestCycles must equal terminal outcome counts",
        path: ["totalQuestCycles"],
      });
    }
  });

export const sessionHistoryPrivacySchema = z
  .object({
    rawChatHistoryRetained: z.literal(false),
    viewerIdentifiersIncluded: z.literal(false),
    privateVoteReceiptsIncluded: z.literal(false),
    retentionNote: z.string().trim().min(1).max(240),
  })
  .strict();

export const sessionHistorySnapshotSchema = z
  .object({
    contractVersion: contractVersionSchema,
    broadcasterId: identifierSchema,
    generatedAt: timestampSchema,
    source: messageSourceSchema,
    evidenceClass: evidenceClassSchema,
    limit: z.number().int().min(1).max(100),
    entries: z.array(sessionHistoryEntrySchema).max(100),
    summary: sessionHistorySummarySchema,
    privacy: sessionHistoryPrivacySchema,
  })
  .strict()
  .superRefine((snapshot, context) => {
    if (snapshot.source === "test-fixture" && snapshot.evidenceClass === "live") {
      context.addIssue({
        code: "custom",
        message: "Test fixtures cannot be classified as live session history",
        path: ["evidenceClass"],
      });
    }
    if (snapshot.summary.totalQuestCycles !== snapshot.entries.length) {
      context.addIssue({
        code: "custom",
        message: "History summary must describe the returned entries",
        path: ["summary", "totalQuestCycles"],
      });
    }
  });

const historyPrivacy = {
  rawChatHistoryRetained: false,
  viewerIdentifiersIncluded: false,
  privateVoteReceiptsIncluded: false,
  retentionNote:
    "Session history stores terminal quest outcomes and aggregate engagement only; raw chat and viewer identifiers are not retained in this read model.",
} as const;

export const emptySessionHistorySnapshot = (input: {
  readonly broadcasterId: string;
  readonly generatedAt: number;
  readonly source: z.infer<typeof messageSourceSchema>;
  readonly evidenceClass: z.infer<typeof evidenceClassSchema>;
  readonly limit: number;
}) =>
  sessionHistorySnapshotSchema.parse({
    contractVersion: CONTRACT_VERSION,
    broadcasterId: input.broadcasterId,
    generatedAt: input.generatedAt,
    source: input.source,
    evidenceClass: input.evidenceClass,
    limit: input.limit,
    entries: [],
    summary: {
      totalQuestCycles: 0,
      succeeded: 0,
      failed: 0,
      cancelled: 0,
      skipped: 0,
      expired: 0,
      totalAcceptedVotes: 0,
      totalRewardPointsAwarded: 0,
      averageCompletionSeconds: null,
    },
    privacy: historyPrivacy,
  });

export type SessionHistoryOutcome = z.infer<typeof sessionHistoryOutcomeSchema>;
export type SessionHistoryEntry = z.infer<typeof sessionHistoryEntrySchema>;
export type SessionHistorySummary = z.infer<typeof sessionHistorySummarySchema>;
export type SessionHistoryPrivacy = z.infer<typeof sessionHistoryPrivacySchema>;
export type SessionHistorySnapshot = z.infer<typeof sessionHistorySnapshotSchema>;
