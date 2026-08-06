import { z } from "zod";

import {
  actorSchema,
  contractEnvelopeSchema,
  domainErrorSchema,
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

export const privateViewerIdentityKindSchema = z.enum(["authenticated", "anonymous-token"]);

export const viewerParticipationReceiptSchema = z
  .object({
    envelope: contractEnvelopeSchema,
    principalId: identifierSchema,
    voterKey: identifierSchema,
    identityKind: privateViewerIdentityKindSchema,
    sourceMode: participationSourceModeSchema.nullable(),
    acceptedCandidateId: identifierSchema.nullable(),
    acceptedAt: timestampSchema.nullable(),
    sessionPoints: z.number().int().nonnegative(),
    reconnectExpiresAt: timestampSchema,
  })
  .strict()
  .superRefine((receipt, context) => {
    if ((receipt.acceptedCandidateId === null) !== (receipt.acceptedAt === null)) {
      context.addIssue({
        code: "custom",
        message: "Accepted candidate and accepted timestamp must be present together",
        path: ["acceptedCandidateId"],
      });
    }
    if (receipt.reconnectExpiresAt <= receipt.envelope.receivedAt) {
      context.addIssue({
        code: "custom",
        message: "Reconnect expiry must be in the future for a readable private receipt",
        path: ["reconnectExpiresAt"],
      });
    }
  });

export const viewerParticipationReceiptReadResultSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("available"), receipt: viewerParticipationReceiptSchema }).strict(),
  z.object({ status: z.literal("not-found"), receipt: z.null() }).strict(),
  z.object({ status: z.literal("forbidden"), error: domainErrorSchema }).strict(),
  z.object({ status: z.literal("expired"), error: domainErrorSchema }).strict(),
]);

export const hostedBoardAccessSchema = z
  .object({
    sessionId: identifierSchema,
    roomCode: z.string().trim().regex(/^[A-HJ-NP-Z2-9]{8}$/),
    principalId: identifierSchema,
    directUrl: z.url(),
    shareUrl: z.url(),
    shareText: z.string().trim().min(1).max(240),
    qrPayload: z.url().nullable(),
    grantExpiresAt: timestampSchema,
  })
  .strict();

export const hostedBoardAccessResultSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("available"), access: hostedBoardAccessSchema }).strict(),
  z.object({ status: z.literal("invalid-room"), error: domainErrorSchema }).strict(),
  z.object({ status: z.literal("expired-session"), error: domainErrorSchema }).strict(),
  z.object({ status: z.literal("unavailable"), error: domainErrorSchema }).strict(),
]);

export const twitchChatFallbackAnnouncementKindSchema = z.enum(["poll-open", "final-result"]);

export const twitchChatFallbackDeliveryStatusSchema = z.enum([
  "not-attempted",
  "delivered",
  "rate-limited",
  "failed",
  "unavailable",
]);

export const twitchChatFallbackDeliverySchema = z
  .object({
    kind: twitchChatFallbackAnnouncementKindSchema,
    status: twitchChatFallbackDeliveryStatusSchema,
    messageText: z.string().trim().min(1).max(480),
    deliveredAt: timestampSchema.nullable(),
    retryable: z.boolean(),
  })
  .strict()
  .superRefine((delivery, context) => {
    if ((delivery.status === "delivered") !== (delivery.deliveredAt !== null)) {
      context.addIssue({
        code: "custom",
        message: "Only delivered Twitch-chat fallback messages may carry deliveredAt",
        path: ["deliveredAt"],
      });
    }
  });

export const twitchChatAcknowledgementDeliverySchema = z
  .object({
    status: twitchChatFallbackDeliveryStatusSchema,
    messageText: z.string().trim().min(1).max(240),
    deliveredAt: timestampSchema.nullable(),
    retryable: z.boolean(),
  })
  .strict()
  .superRefine((delivery, context) => {
    if ((delivery.status === "delivered") !== (delivery.deliveredAt !== null)) {
      context.addIssue({
        code: "custom",
        message: "Only delivered Twitch-chat acknowledgements may carry deliveredAt",
        path: ["deliveredAt"],
      });
    }
  });

export const twitchChatVoteAcknowledgementStatusSchema = z.enum([
  "counted",
  "duplicate",
  "rejected",
  "late",
  "not-delivered",
  "unavailable",
]);

export const twitchChatVoteAcknowledgementSchema = z
  .object({
    status: twitchChatVoteAcknowledgementStatusSchema,
    candidateId: identifierSchema.nullable(),
    messageText: z.string().trim().min(1).max(240),
    deliveredAt: timestampSchema.nullable(),
  })
  .strict()
  .superRefine((acknowledgement, context) => {
    if (
      ["counted", "duplicate"].includes(acknowledgement.status) &&
      acknowledgement.candidateId === null
    ) {
      context.addIssue({
        code: "custom",
        message: "Counted and duplicate chat acknowledgements must name the accepted candidate",
        path: ["candidateId"],
      });
    }
    if (
      ["rejected", "late", "not-delivered", "unavailable"].includes(acknowledgement.status) &&
      acknowledgement.candidateId !== null
    ) {
      context.addIssue({
        code: "custom",
        message: "Only counted or duplicate chat acknowledgements may name a candidate",
        path: ["candidateId"],
      });
    }
    if (
      ["counted", "duplicate", "rejected", "late"].includes(acknowledgement.status) &&
      acknowledgement.deliveredAt === null
    ) {
      context.addIssue({
        code: "custom",
        message: "Chat acknowledgements cannot claim a vote status unless Twitch delivery succeeded",
        path: ["deliveredAt"],
      });
    }
  });

export type Vote = z.infer<typeof voteSchema>;
export type ParticipationSourceMode = z.infer<typeof participationSourceModeSchema>;
export type AcceptedVoteTallySnapshot = z.infer<typeof acceptedVoteTallySnapshotSchema>;
export type PrivateViewerIdentityKind = z.infer<typeof privateViewerIdentityKindSchema>;
export type ViewerParticipationReceipt = z.infer<typeof viewerParticipationReceiptSchema>;
export type ViewerParticipationReceiptReadResult = z.infer<
  typeof viewerParticipationReceiptReadResultSchema
>;
export type HostedBoardAccess = z.infer<typeof hostedBoardAccessSchema>;
export type HostedBoardAccessResult = z.infer<typeof hostedBoardAccessResultSchema>;
export type TwitchChatFallbackAnnouncementKind = z.infer<
  typeof twitchChatFallbackAnnouncementKindSchema
>;
export type TwitchChatFallbackDeliveryStatus = z.infer<
  typeof twitchChatFallbackDeliveryStatusSchema
>;
export type TwitchChatFallbackDelivery = z.infer<typeof twitchChatFallbackDeliverySchema>;
export type TwitchChatAcknowledgementDelivery = z.infer<
  typeof twitchChatAcknowledgementDeliverySchema
>;
export type TwitchChatVoteAcknowledgementStatus = z.infer<
  typeof twitchChatVoteAcknowledgementStatusSchema
>;
export type TwitchChatVoteAcknowledgement = z.infer<
  typeof twitchChatVoteAcknowledgementSchema
>;
