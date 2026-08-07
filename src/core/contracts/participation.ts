import { z } from "zod";

import {
  actorSchema,
  contractEnvelopeSchema,
  identifierSchema,
  revisionSchema,
  timestampSchema,
} from "./common";
import { voteTallySchema } from "./quests";

export const participationSourceModeSchema = z.enum([
  "twitch-extension",
  "hosted-board",
  "twitch-chat",
]);

export const voteSchema = z
  .object({
    envelope: contractEnvelopeSchema,
    voter: actorSchema,
    voterKey: identifierSchema,
    candidateId: identifierSchema,
    acceptedAt: timestampSchema,
    sourceMode: participationSourceModeSchema,
  })
  .strict()
  .superRefine((vote, context) => {
    if (vote.voter.kind !== "viewer" && vote.voter.kind !== "anonymous") {
      context.addIssue({
        code: "custom",
        message: "Only viewers and anonymous participants can cast votes",
        path: ["voter", "kind"],
      });
    }
  });

export const acceptedVoteTallySnapshotSchema = z
  .object({
    sessionId: identifierSchema,
    questCycleId: identifierSchema,
    revision: revisionSchema,
    closedAt: timestampSchema,
    acceptedVoteCount: z.number().int().nonnegative(),
    tallies: z.array(voteTallySchema).length(3),
  })
  .strict()
  .superRefine((snapshot, context) => {
    const candidateIds = snapshot.tallies.map((tally) => tally.candidateId);
    if (new Set(candidateIds).size !== candidateIds.length) {
      context.addIssue({
        code: "custom",
        message: "Accepted vote tallies must use three distinct candidate IDs",
        path: ["tallies"],
      });
    }
    const total = snapshot.tallies.reduce((sum, tally) => sum + tally.votes, 0);
    if (total !== snapshot.acceptedVoteCount) {
      context.addIssue({
        code: "custom",
        message: "Accepted vote count must equal the sum of candidate tallies",
        path: ["acceptedVoteCount"],
      });
    }
  });

export const hostedBoardDiscoverySchema = z
  .object({
    status: z.enum(["available", "unavailable"]),
    sessionId: identifierSchema.nullable(),
    roomCode: z.string().regex(/^[A-HJ-NP-Z2-9]{8}$/u).nullable(),
    url: z.string().url().nullable(),
    qrImageUrl: z.string().url().nullable(),
    expiresAt: timestampSchema.nullable(),
    message: z.string().trim().min(1).max(240).optional(),
  })
  .strict()
  .superRefine((discovery, context) => {
    if (discovery.status === "available") {
      for (const field of ["sessionId", "roomCode", "url"] as const) {
        if (discovery[field] === null) {
          context.addIssue({
            code: "custom",
            message: "Available hosted boards require a session, room code, and URL",
            path: [field],
          });
        }
      }
      return;
    }

    for (const field of ["sessionId", "roomCode", "url", "qrImageUrl", "expiresAt"] as const) {
      if (discovery[field] !== null) {
        context.addIssue({
          code: "custom",
          message: "Unavailable hosted boards cannot expose join details",
          path: [field],
        });
      }
    }
  });

export const privateViewerRecoverySchema = z
  .object({
    status: z.enum(["identified", "anonymous", "unavailable"]),
    viewerId: identifierSchema.nullable(),
    acceptedCandidateId: identifierSchema.nullable(),
    acceptedAt: timestampSchema.nullable(),
    sourceMode: participationSourceModeSchema.nullable(),
    sessionPoints: z.number().int().nonnegative(),
    restoredAt: timestampSchema,
  })
  .strict()
  .superRefine((recovery, context) => {
    if (recovery.status === "anonymous" && recovery.viewerId !== null) {
      context.addIssue({
        code: "custom",
        message: "Anonymous viewer recovery cannot expose a viewer ID",
        path: ["viewerId"],
      });
    }
    if (recovery.status === "unavailable") {
      for (const field of ["viewerId", "acceptedCandidateId", "acceptedAt", "sourceMode"] as const) {
        if (recovery[field] !== null) {
          context.addIssue({
            code: "custom",
            message: "Unavailable viewer recovery cannot expose private participation",
            path: [field],
          });
        }
      }
      if (recovery.sessionPoints !== 0) {
        context.addIssue({
          code: "custom",
          message: "Unavailable viewer recovery cannot expose points",
          path: ["sessionPoints"],
        });
      }
      return;
    }
    if ((recovery.acceptedCandidateId === null) !== (recovery.acceptedAt === null)) {
      context.addIssue({
        code: "custom",
        message: "Recovered votes require both candidate and accepted timestamp",
        path: ["acceptedCandidateId"],
      });
    }
    if (recovery.acceptedCandidateId !== null && recovery.sourceMode === null) {
      context.addIssue({
        code: "custom",
        message: "Recovered votes require their accepted participation source",
        path: ["sourceMode"],
      });
    }
  });

export const twitchChatVoteAcknowledgementSchema = z
  .object({
    status: z.enum(["unavailable", "not-delivered", "pending", "counted", "duplicate", "late", "rejected"]),
    commandId: identifierSchema.nullable(),
    candidateId: identifierSchema.nullable(),
    receivedAt: timestampSchema.nullable(),
    message: z.string().trim().min(1).max(240),
    retryable: z.boolean(),
  })
  .strict()
  .superRefine((acknowledgement, context) => {
    if (acknowledgement.status === "counted" || acknowledgement.status === "duplicate") {
      for (const field of ["commandId", "candidateId", "receivedAt"] as const) {
        if (acknowledgement[field] === null) {
          context.addIssue({
            code: "custom",
            message: "Counted and duplicate chat acknowledgements require the accepted command details",
            path: [field],
          });
        }
      }
      return;
    }
    if (acknowledgement.status === "unavailable" || acknowledgement.status === "not-delivered") {
      for (const field of ["commandId", "candidateId", "receivedAt"] as const) {
        if (acknowledgement[field] !== null) {
          context.addIssue({
            code: "custom",
            message: "Undelivered chat acknowledgements cannot expose accepted vote details",
            path: [field],
          });
        }
      }
    }
  });

export type Vote = z.infer<typeof voteSchema>;
export type ParticipationSourceMode = z.infer<typeof participationSourceModeSchema>;
export type AcceptedVoteTallySnapshot = z.infer<typeof acceptedVoteTallySnapshotSchema>;
export type HostedBoardDiscovery = z.infer<typeof hostedBoardDiscoverySchema>;
export type PrivateViewerRecovery = z.infer<typeof privateViewerRecoverySchema>;
export type TwitchChatVoteAcknowledgement = z.infer<typeof twitchChatVoteAcknowledgementSchema>;
