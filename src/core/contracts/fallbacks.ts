import { z } from "zod";

import {
  contractEnvelopeSchema,
  domainErrorSchema,
  identifierSchema,
  revisionSchema,
  timestampSchema,
} from "./common";

export const fallbackRoomCodeSchema = z.string().regex(/^[A-HJ-NP-Z2-9]{8}$/);

const safeHostedBoardUrlSchema = z.url().max(2_048).superRefine((value, context) => {
  const url = new URL(value);
  const roomCodes = url.searchParams.getAll("room");
  const queryKeys = [...url.searchParams.keys()];
  if (
    (url.protocol !== "http:" && url.protocol !== "https:") ||
    url.username.length > 0 ||
    url.password.length > 0 ||
    url.hash.length > 0 ||
    roomCodes.length !== 1 ||
    !fallbackRoomCodeSchema.safeParse(roomCodes[0]).success ||
    queryKeys.some((key) => key !== "room")
  ) {
    context.addIssue({
      code: "custom",
      message: "Hosted-board URLs may contain only one canonical room-code query",
    });
  }
});

export const hostedBoardShareDataSchema = z
  .object({
    roomCode: fallbackRoomCodeSchema,
    shareUrl: safeHostedBoardUrlSchema,
    qrPayload: safeHostedBoardUrlSchema.nullable(),
  })
  .strict()
  .superRefine((share, context) => {
    const shareUrl = new URL(share.shareUrl);
    if (shareUrl.searchParams.get("room") !== share.roomCode) {
      context.addIssue({
        code: "custom",
        message: "Hosted-board share URLs must contain the canonical room code",
        path: ["shareUrl"],
      });
    }
    if (share.qrPayload !== null && share.qrPayload !== share.shareUrl) {
      context.addIssue({
        code: "custom",
        message: "The optional QR payload must use the same safe share URL",
        path: ["qrPayload"],
      });
    }
  });

export const hostedBoardAccessViewSchema = z
  .object({
    sessionId: identifierSchema,
    revision: revisionSchema,
    roomCode: fallbackRoomCodeSchema,
    participationMode: z.literal("hosted-board"),
    actorKind: z.enum(["viewer", "anonymous"]),
    expiresAt: timestampSchema,
    share: hostedBoardShareDataSchema,
  })
  .strict();

const chatFallbackBase = {
  envelope: contractEnvelopeSchema,
  text: z.string().trim().min(1).max(500),
};

const chatFallbackOptionSchema = z
  .object({
    position: z.number().int().min(1).max(3),
    candidateId: identifierSchema,
    title: z.string().trim().min(1).max(80),
  })
  .strict();

export const chatPollOpenMessageSchema = z
  .object({
    ...chatFallbackBase,
    kind: z.literal("poll-open"),
    audience: z.literal("channel"),
    options: z.tuple([
      chatFallbackOptionSchema,
      chatFallbackOptionSchema,
      chatFallbackOptionSchema,
    ]),
    voteClosesAt: timestampSchema,
    hostedBoardUrl: safeHostedBoardUrlSchema.nullable(),
  })
  .strict()
  .superRefine((message, context) => {
    if (message.envelope.questCycleId === null) {
      context.addIssue({
        code: "custom",
        message: "Poll-open chat messages require a quest cycle",
        path: ["envelope", "questCycleId"],
      });
    }
    const candidateIds = new Set(message.options.map((option) => option.candidateId));
    const positions = message.options.map((option) => option.position);
    if (candidateIds.size !== 3) {
      context.addIssue({
        code: "custom",
        message: "Poll-open chat messages require three distinct candidates",
        path: ["options"],
      });
    }
    if (positions.some((position, index) => position !== index + 1)) {
      context.addIssue({
        code: "custom",
        message: "Poll choices must be ordered as 1, 2, and 3",
        path: ["options"],
      });
    }
    if (message.voteClosesAt <= message.envelope.occurredAt) {
      context.addIssue({
        code: "custom",
        message: "Poll close time must follow the message occurrence time",
        path: ["voteClosesAt"],
      });
    }
  });

export const chatFinalResultMessageSchema = z
  .object({
    ...chatFallbackBase,
    kind: z.literal("final-result"),
    audience: z.literal("channel"),
    candidateId: identifierSchema,
    winnerTitle: z.string().trim().min(1).max(80),
    acceptedVotes: z.number().int().nonnegative(),
  })
  .strict()
  .superRefine((message, context) => {
    if (message.envelope.questCycleId === null) {
      context.addIssue({
        code: "custom",
        message: "Final-result chat messages require a quest cycle",
        path: ["envelope", "questCycleId"],
      });
    }
  });

export const chatVoteAcknowledgementMessageSchema = z
  .object({
    ...chatFallbackBase,
    kind: z.literal("vote-acknowledgement"),
    audience: z.literal("viewer"),
    viewerKey: identifierSchema,
    outcome: z.enum(["counted", "rejected", "late"]),
    choicePosition: z.number().int().min(1).max(3).nullable(),
  })
  .strict()
  .superRefine((message, context) => {
    if (message.envelope.questCycleId === null) {
      context.addIssue({
        code: "custom",
        message: "Vote acknowledgements require a quest cycle",
        path: ["envelope", "questCycleId"],
      });
    }
    if (message.outcome === "counted" && message.choicePosition === null) {
      context.addIssue({
        code: "custom",
        message: "Counted acknowledgements require the accepted choice position",
        path: ["choicePosition"],
      });
    }
  });

export const chatFallbackMessageSchema = z.discriminatedUnion("kind", [
  chatPollOpenMessageSchema,
  chatFinalResultMessageSchema,
  chatVoteAcknowledgementMessageSchema,
]);

export const chatDeliveryStatusSchema = z.enum([
  "delivered",
  "dropped",
  "rate-limited",
  "unavailable",
]);

export const chatDeliveryReceiptSchema = z
  .object({
    deliveryId: identifierSchema,
    messageId: identifierSchema,
    status: chatDeliveryStatusSchema,
    attemptedAt: timestampSchema,
    deliveredAt: timestampSchema.nullable(),
    providerMessageId: identifierSchema.nullable(),
    error: domainErrorSchema.nullable(),
  })
  .strict()
  .superRefine((receipt, context) => {
    if (receipt.status === "delivered") {
      if (
        receipt.deliveredAt === null ||
        receipt.providerMessageId === null ||
        receipt.error !== null
      ) {
        context.addIssue({
          code: "custom",
          message: "Delivered chat receipts require provider confirmation and no error",
        });
      }
      if (receipt.deliveredAt !== null && receipt.deliveredAt < receipt.attemptedAt) {
        context.addIssue({
          code: "custom",
          message: "Chat delivery cannot precede its attempt",
          path: ["deliveredAt"],
        });
      }
      return;
    }
    if (
      receipt.deliveredAt !== null ||
      receipt.providerMessageId !== null ||
      receipt.error === null
    ) {
      context.addIssue({
        code: "custom",
        message: "Undelivered chat receipts require an error and cannot claim provider delivery",
      });
    }
  });

export type HostedBoardShareData = z.infer<typeof hostedBoardShareDataSchema>;
export type HostedBoardAccessView = z.infer<typeof hostedBoardAccessViewSchema>;
export type ChatPollOpenMessage = z.infer<typeof chatPollOpenMessageSchema>;
export type ChatFinalResultMessage = z.infer<typeof chatFinalResultMessageSchema>;
export type ChatVoteAcknowledgementMessage = z.infer<
  typeof chatVoteAcknowledgementMessageSchema
>;
export type ChatFallbackMessage = z.infer<typeof chatFallbackMessageSchema>;
export type ChatDeliveryReceipt = z.infer<typeof chatDeliveryReceiptSchema>;
