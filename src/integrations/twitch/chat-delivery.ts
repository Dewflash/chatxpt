import {
  twitchChatAcknowledgementDeliverySchema,
  twitchChatFallbackDeliverySchema,
  twitchChatVoteAcknowledgementSchema,
  type TwitchChatAcknowledgementDelivery,
  type TwitchChatFallbackAnnouncementKind,
  type TwitchChatFallbackDelivery,
  type TwitchChatFallbackDeliveryStatus,
  type TwitchChatVoteAcknowledgement,
  type TwitchChatVoteAcknowledgementStatus,
} from "../../core";

export type TwitchChatVoteProcessingStatus = Extract<
  TwitchChatVoteAcknowledgementStatus,
  "counted" | "duplicate" | "rejected" | "late"
>;

type TwitchChatOutboundAttemptStatus = Extract<
  TwitchChatFallbackDeliveryStatus,
  "delivered" | "rate-limited" | "failed"
>;

export interface TwitchChatOutboundMessage {
  readonly channelId: string;
  readonly messageText: string;
  readonly correlationId: string;
  readonly sentAt: number;
}

export interface TwitchChatOutboundAttempt {
  readonly status: TwitchChatOutboundAttemptStatus;
  readonly deliveredAt?: number;
  readonly retryable?: boolean;
}

export interface TwitchChatOutboundSender {
  sendMessage(message: TwitchChatOutboundMessage): Promise<TwitchChatOutboundAttempt>;
}

export interface TwitchChatRateLimitDecision {
  readonly allowed: boolean;
  readonly retryAt: number | null;
}

export interface TwitchChatRateLimiter {
  check(input: {
    readonly channelId: string;
    readonly at: number;
  }): TwitchChatRateLimitDecision;
}

export interface TwitchChatDeliveryContext {
  readonly channelId: string | null;
  readonly sender: TwitchChatOutboundSender | null;
  readonly rateLimiter?: TwitchChatRateLimiter | null;
  readonly now: () => number;
  readonly correlationId: string;
}

export interface DeliverTwitchChatFallbackAnnouncementInput extends TwitchChatDeliveryContext {
  readonly kind: TwitchChatFallbackAnnouncementKind;
  readonly messageText: string;
  readonly attemptDelivery?: boolean;
}

export interface DeliverTwitchChatVoteAcknowledgementInput extends TwitchChatDeliveryContext {
  readonly processingStatus: TwitchChatVoteProcessingStatus;
  readonly candidateId: string | null;
}

export interface DeliveredTwitchChatVoteAcknowledgement {
  readonly delivery: TwitchChatAcknowledgementDelivery;
  readonly acknowledgement: TwitchChatVoteAcknowledgement;
}

const acknowledgementMessages: Record<TwitchChatVoteProcessingStatus, string> = {
  counted: "ChatXPT counted your vote.",
  duplicate: "ChatXPT already counted your first vote.",
  rejected: "ChatXPT could not count that vote.",
  late: "ChatXPT could not count that vote because voting has closed.",
};

function retryableForStatus(status: TwitchChatFallbackDeliveryStatus): boolean {
  return status === "failed" || status === "rate-limited" || status === "unavailable";
}

function deliveredAtForAttempt(attempt: TwitchChatOutboundAttempt, fallbackNow: number): number | null {
  return attempt.status === "delivered" ? attempt.deliveredAt ?? fallbackNow : null;
}

function recordFallbackDelivery(input: {
  readonly kind: TwitchChatFallbackAnnouncementKind;
  readonly messageText: string;
  readonly status: TwitchChatFallbackDeliveryStatus;
  readonly deliveredAt: number | null;
  readonly retryable: boolean;
}): TwitchChatFallbackDelivery {
  return twitchChatFallbackDeliverySchema.parse(input);
}

function recordAcknowledgementDelivery(input: {
  readonly messageText: string;
  readonly status: TwitchChatFallbackDeliveryStatus;
  readonly deliveredAt: number | null;
  readonly retryable: boolean;
}): TwitchChatAcknowledgementDelivery {
  return twitchChatAcknowledgementDeliverySchema.parse(input);
}

function buildVoteAcknowledgement(input: {
  readonly delivery: TwitchChatAcknowledgementDelivery;
  readonly processingStatus: TwitchChatVoteProcessingStatus;
  readonly candidateId: string | null;
}): TwitchChatVoteAcknowledgement {
  if (input.delivery.status !== "delivered" || input.delivery.deliveredAt === null) {
    return twitchChatVoteAcknowledgementSchema.parse({
      status: input.delivery.status === "unavailable" ? "unavailable" : "not-delivered",
      candidateId: null,
      messageText: "ChatXPT did not deliver a Twitch-chat vote acknowledgement.",
      deliveredAt: null,
    });
  }

  return twitchChatVoteAcknowledgementSchema.parse({
    status: input.processingStatus,
    candidateId:
      input.processingStatus === "counted" || input.processingStatus === "duplicate"
        ? input.candidateId
        : null,
    messageText: acknowledgementMessages[input.processingStatus],
    deliveredAt: input.delivery.deliveredAt,
  });
}

async function attemptTwitchChatDelivery(input: {
  readonly channelId: string | null;
  readonly sender: TwitchChatOutboundSender | null;
  readonly rateLimiter?: TwitchChatRateLimiter | null;
  readonly messageText: string;
  readonly now: () => number;
  readonly correlationId: string;
  readonly attemptDelivery: boolean;
}): Promise<{
  readonly status: TwitchChatFallbackDeliveryStatus;
  readonly deliveredAt: number | null;
  readonly retryable: boolean;
}> {
  if (!input.attemptDelivery) {
    return { status: "not-attempted", deliveredAt: null, retryable: false };
  }

  if (input.channelId === null || input.sender === null) {
    return { status: "unavailable", deliveredAt: null, retryable: true };
  }

  const sentAt = input.now();
  const limit = input.rateLimiter?.check({ channelId: input.channelId, at: sentAt });
  if (limit !== undefined && !limit.allowed) {
    return { status: "rate-limited", deliveredAt: null, retryable: true };
  }

  try {
    const attempt = await input.sender.sendMessage({
      channelId: input.channelId,
      messageText: input.messageText,
      correlationId: input.correlationId,
      sentAt,
    });
    return {
      status: attempt.status,
      deliveredAt: deliveredAtForAttempt(attempt, input.now()),
      retryable: attempt.retryable ?? retryableForStatus(attempt.status),
    };
  } catch {
    return { status: "failed", deliveredAt: null, retryable: true };
  }
}

export async function deliverTwitchChatFallbackAnnouncement(
  input: DeliverTwitchChatFallbackAnnouncementInput,
): Promise<TwitchChatFallbackDelivery> {
  const delivery = await attemptTwitchChatDelivery({
    ...input,
    attemptDelivery: input.attemptDelivery ?? true,
  });
  return recordFallbackDelivery({
    kind: input.kind,
    messageText: input.messageText,
    ...delivery,
  });
}

export async function deliverTwitchChatVoteAcknowledgement(
  input: DeliverTwitchChatVoteAcknowledgementInput,
): Promise<DeliveredTwitchChatVoteAcknowledgement> {
  const messageText = acknowledgementMessages[input.processingStatus];
  const deliveryAttempt = await attemptTwitchChatDelivery({
    ...input,
    messageText,
    attemptDelivery: true,
  });
  const delivery = recordAcknowledgementDelivery({
    messageText,
    ...deliveryAttempt,
  });
  return {
    delivery,
    acknowledgement: buildVoteAcknowledgement({
      delivery,
      processingStatus: input.processingStatus,
      candidateId: input.candidateId,
    }),
  };
}

export class FixedWindowTwitchChatRateLimiter implements TwitchChatRateLimiter {
  private readonly sentAtByChannel = new Map<string, number[]>();

  constructor(
    private readonly maxMessages: number,
    private readonly windowMs: number,
  ) {}

  check(input: { readonly channelId: string; readonly at: number }): TwitchChatRateLimitDecision {
    const windowStart = input.at - this.windowMs;
    const sentAt = (this.sentAtByChannel.get(input.channelId) ?? []).filter(
      (timestamp) => timestamp > windowStart,
    );
    if (sentAt.length >= this.maxMessages) {
      this.sentAtByChannel.set(input.channelId, sentAt);
      return { allowed: false, retryAt: sentAt[0] + this.windowMs };
    }
    sentAt.push(input.at);
    this.sentAtByChannel.set(input.channelId, sentAt);
    return { allowed: true, retryAt: null };
  }
}
