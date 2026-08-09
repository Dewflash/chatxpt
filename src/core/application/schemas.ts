import { z } from "zod";

import {
  audienceSnapshotSchema,
  commandEnvelopeSchema,
  gameplaySnapshotSchema,
  identifierSchema,
  questCycleStateSchema,
  questEngineEventSchema,
  serviceHealthSchema,
  streamSessionSchema,
  streamerProfileSchema,
  timestampSchema,
} from "../contracts";
import { commandFingerprint } from "./fingerprint";

export const recentQuestSummarySchema = z
  .object({
    title: z.string().trim().min(3).max(80),
    occurredAt: timestampSchema,
  })
  .strict();

export const authoritativeSessionStateSchema = z
  .object({
    session: streamSessionSchema,
    profile: streamerProfileSchema,
    services: z.array(serviceHealthSchema),
    gameplay: gameplaySnapshotSchema.nullable(),
    audience: audienceSnapshotSchema.nullable(),
    questCycle: questCycleStateSchema,
    emergencyPaused: z.boolean(),
    communityHype: z.number().int().nonnegative(),
    recentQuests: z.array(recentQuestSummarySchema).max(20).optional(),
  })
  .strict()
  .superRefine((state, context) => {
    if (state.session.sessionId !== state.questCycle.envelope.sessionId) {
      context.addIssue({
        code: "custom",
        message: "Session and quest-cycle identities must match",
        path: ["questCycle", "envelope", "sessionId"],
      });
    }
    if (state.session.revision !== state.questCycle.envelope.revision) {
      context.addIssue({
        code: "custom",
        message: "Session and quest-cycle revisions must match",
        path: ["questCycle", "envelope", "revision"],
      });
    }
    if (state.profile.streamerId !== state.session.broadcasterId) {
      context.addIssue({
        code: "custom",
        message: "Streamer profile must own the session",
        path: ["profile", "streamerId"],
      });
    }
    for (const [key, snapshot] of [
      ["gameplay", state.gameplay],
      ["audience", state.audience],
    ] as const) {
      if (snapshot !== null && snapshot.envelope.sessionId !== state.session.sessionId) {
        context.addIssue({
          code: "custom",
          message: "Intelligence snapshot must belong to the session",
          path: [key, "envelope", "sessionId"],
        });
      }
      if (
        snapshot !== null &&
        snapshot.envelope.evidenceClass !== state.questCycle.envelope.evidenceClass
      ) {
        context.addIssue({
          code: "custom",
          message: "Intelligence and quest-cycle evidence classes must match",
          path: [key, "envelope", "evidenceClass"],
        });
      }
    }
  });

export const acceptedCommandReceiptSchema = z
  .object({
    command: commandEnvelopeSchema,
    commandFingerprint: z.string().min(1),
    state: authoritativeSessionStateSchema,
    events: z.array(questEngineEventSchema).max(128),
    acceptedAt: timestampSchema,
  })
  .strict()
  .superRefine((receipt, context) => {
    if (receipt.commandFingerprint !== commandFingerprint(receipt.command)) {
      context.addIssue({
        code: "custom",
        message: "Command fingerprint must match the canonical parsed command",
        path: ["commandFingerprint"],
      });
    }
    if (receipt.command.sessionId !== receipt.state.session.sessionId) {
      context.addIssue({
        code: "custom",
        message: "Receipt command and state must belong to the same session",
        path: ["state", "session", "sessionId"],
      });
    }
  });

export const viewerRecoveryStateSchema = z
  .object({
    sessionId: identifierSchema,
    questCycleId: identifierSchema,
    acceptedCandidateId: identifierSchema.nullable(),
    acceptedAt: timestampSchema.nullable(),
    sessionPoints: z.number().int().nonnegative().max(100_000),
    sourceMode: z.enum(["twitch-extension", "hosted-board", "twitch-chat"]).nullable(),
  })
  .strict()
  .superRefine((state, context) => {
    const hasAcceptedVote = state.acceptedCandidateId !== null;
    if (hasAcceptedVote !== (state.acceptedAt !== null) || hasAcceptedVote !== (state.sourceMode !== null)) {
      context.addIssue({
        code: "custom",
        message: "Accepted vote fields must appear together",
        path: ["acceptedCandidateId"],
      });
    }
  });
