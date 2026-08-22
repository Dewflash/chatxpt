import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { z } from "zod";

const eventSubMessageTypeSchema = z.enum([
  "webhook_callback_verification",
  "notification",
  "revocation",
]);

const challengeSchema = z
  .object({
    challenge: z.string().min(1).max(512),
    subscription: z.object({ type: z.string().min(1).max(128) }).passthrough(),
  })
  .passthrough();

const chatNotificationSchema = z
  .object({
    subscription: z.object({ type: z.literal("channel.chat.message") }).passthrough(),
    event: z
      .object({
        broadcaster_user_id: z.string().trim().min(1).max(128),
        chatter_user_id: z.string().trim().min(1).max(128),
        message_id: z.string().trim().min(1).max(128),
        message: z.object({ text: z.string().max(2_000) }).passthrough(),
      })
      .passthrough(),
  })
  .passthrough();

const streamOnlineNotificationSchema = z
  .object({
    subscription: z.object({ type: z.literal("stream.online") }).passthrough(),
    event: z
      .object({
        id: z.string().trim().min(1).max(128),
        broadcaster_user_id: z.string().trim().min(1).max(128),
        broadcaster_user_name: z.string().trim().min(1).max(128),
        started_at: z.iso.datetime({ offset: true }),
      })
      .passthrough(),
  })
  .passthrough();

const streamOfflineNotificationSchema = z
  .object({
    subscription: z.object({ type: z.literal("stream.offline") }).passthrough(),
    event: z
      .object({
        broadcaster_user_id: z.string().trim().min(1).max(128),
        broadcaster_user_name: z.string().trim().min(1).max(128),
      })
      .passthrough(),
  })
  .passthrough();

export type TwitchEventSubMessageType = z.infer<typeof eventSubMessageTypeSchema>;

export type TwitchEventSubPayload =
  | { readonly kind: "challenge"; readonly challenge: string; readonly subscriptionType: string }
  | {
      readonly kind: "chat-message";
      readonly broadcasterId: string;
      readonly chatterId: string;
      readonly messageId: string;
      readonly text: string;
    }
  | {
      readonly kind: "stream-online";
      readonly streamId: string;
      readonly broadcasterId: string;
      readonly displayName: string;
      readonly startedAt: number;
    }
  | {
      readonly kind: "stream-offline";
      readonly broadcasterId: string;
      readonly displayName: string;
    }
  | { readonly kind: "revocation" | "ignored"; readonly subscriptionType: string | null };

export class TwitchEventSubError extends Error {
  constructor(
    readonly code: "misconfigured" | "missing-header" | "stale-message" | "invalid-signature" | "invalid-payload",
    message: string,
  ) {
    super(message);
    this.name = "TwitchEventSubError";
  }
}

function secretBytes(secret: string): Buffer {
  const value = secret.trim();
  if (value.length < 32 || value.length > 100 || !/^[\x20-\x7E]+$/.test(value)) {
    throw new TwitchEventSubError(
      "misconfigured",
      "Twitch EventSub webhook secret must contain 32 to 100 printable ASCII characters",
    );
  }
  return Buffer.from(value, "utf8");
}

function equal(left: Buffer, right: Buffer): boolean {
  return left.length === right.length && timingSafeEqual(left, right);
}

export interface VerifyTwitchEventSubInput {
  readonly messageId: string | null;
  readonly messageTimestamp: string | null;
  readonly messageSignature: string | null;
  readonly rawBody: string;
  readonly secret: string;
  readonly now?: number;
  readonly maximumAgeMs?: number;
}

/** Verifies the Twitch HMAC over message-id + timestamp + exact raw request body. */
export function verifyTwitchEventSubMessage(input: VerifyTwitchEventSubInput): number {
  const messageId = input.messageId?.trim();
  const timestamp = input.messageTimestamp?.trim();
  const signature = input.messageSignature?.trim();
  if (!messageId || !timestamp || !signature) {
    throw new TwitchEventSubError("missing-header", "Twitch EventSub signature headers are required");
  }
  const occurredAt = Date.parse(timestamp);
  const now = input.now ?? Date.now();
  const maximumAgeMs = input.maximumAgeMs ?? 10 * 60 * 1_000;
  if (!Number.isFinite(occurredAt) || Math.abs(now - occurredAt) > maximumAgeMs) {
    throw new TwitchEventSubError("stale-message", "Twitch EventSub message timestamp is stale");
  }
  if (!/^sha256=[a-f0-9]{64}$/i.test(signature)) {
    throw new TwitchEventSubError("invalid-signature", "Twitch EventSub signature is invalid");
  }
  const expected = createHmac("sha256", secretBytes(input.secret))
    .update(messageId)
    .update(timestamp)
    .update(input.rawBody)
    .digest();
  const supplied = Buffer.from(signature.slice("sha256=".length), "hex");
  if (!equal(supplied, expected)) {
    throw new TwitchEventSubError("invalid-signature", "Twitch EventSub signature is invalid");
  }
  return occurredAt;
}

export function parseTwitchEventSubMessage(
  rawBody: string,
  messageTypeHeader: string | null,
): TwitchEventSubPayload {
  const messageType = eventSubMessageTypeSchema.safeParse(messageTypeHeader);
  if (!messageType.success) {
    throw new TwitchEventSubError("invalid-payload", "Twitch EventSub message type is invalid");
  }
  let body: unknown;
  try {
    body = JSON.parse(rawBody) as unknown;
  } catch {
    throw new TwitchEventSubError("invalid-payload", "Twitch EventSub body is invalid JSON");
  }
  if (messageType.data === "webhook_callback_verification") {
    const parsed = challengeSchema.safeParse(body);
    if (!parsed.success) {
      throw new TwitchEventSubError("invalid-payload", "Twitch EventSub challenge is invalid");
    }
    return {
      kind: "challenge",
      challenge: parsed.data.challenge,
      subscriptionType: parsed.data.subscription.type,
    };
  }
  const subscriptionType =
    typeof body === "object" && body !== null && "subscription" in body &&
    typeof body.subscription === "object" && body.subscription !== null && "type" in body.subscription &&
    typeof body.subscription.type === "string"
      ? body.subscription.type
      : null;
  if (messageType.data === "revocation") {
    return { kind: "revocation", subscriptionType };
  }
  if (subscriptionType === "channel.chat.message") {
    const parsed = chatNotificationSchema.safeParse(body);
    if (!parsed.success) return { kind: "ignored", subscriptionType };
    return {
      kind: "chat-message",
      broadcasterId: parsed.data.event.broadcaster_user_id,
      chatterId: parsed.data.event.chatter_user_id,
      messageId: parsed.data.event.message_id,
      text: parsed.data.event.message.text,
    };
  }
  if (subscriptionType === "stream.online") {
    const parsed = streamOnlineNotificationSchema.safeParse(body);
    if (!parsed.success) return { kind: "ignored", subscriptionType };
    return {
      kind: "stream-online",
      streamId: parsed.data.event.id,
      broadcasterId: parsed.data.event.broadcaster_user_id,
      displayName: parsed.data.event.broadcaster_user_name,
      startedAt: Date.parse(parsed.data.event.started_at),
    };
  }
  if (subscriptionType === "stream.offline") {
    const parsed = streamOfflineNotificationSchema.safeParse(body);
    if (!parsed.success) return { kind: "ignored", subscriptionType };
    return {
      kind: "stream-offline",
      broadcasterId: parsed.data.event.broadcaster_user_id,
      displayName: parsed.data.event.broadcaster_user_name,
    };
  }
  return { kind: "ignored", subscriptionType };
}

export function pseudonymizeTwitchChatViewer(
  secret: string,
  sessionId: string,
  chatterId: string,
): string {
  return `twitch-chat-viewer-${createHmac("sha256", secretBytes(secret))
    .update("chatxpt:twitch-chat-viewer:v1:")
    .update(sessionId)
    .update(":")
    .update(chatterId)
    .digest("base64url")}`;
}
