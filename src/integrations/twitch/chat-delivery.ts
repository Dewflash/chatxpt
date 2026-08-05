import "server-only";

import { z } from "zod";

import {
  chatDeliveryReceiptSchema,
  chatFallbackMessageSchema,
  domainErrorSchema,
  type ChatDeliveryReceipt,
  type ChatFallbackMessage,
  type DomainError,
} from "../../core";

export interface TwitchChatDestination {
  readonly broadcasterId: string;
  readonly senderId: string;
  readonly replyParentMessageId?: string;
}

const twitchChatDestinationSchema = z
  .object({
    broadcasterId: z.string().trim().min(1).max(128),
    senderId: z.string().trim().min(1).max(128),
    replyParentMessageId: z.string().trim().min(1).max(128).optional(),
  })
  .strict();

const twitchChatTextSchema = z.string().trim().min(1).max(500);

export interface TwitchChatDestinationResolver {
  resolve(
    message: ChatFallbackMessage,
  ): Promise<TwitchChatDestination | null> | TwitchChatDestination | null;
}

export type TwitchChatTransportResult =
  | { readonly status: "delivered"; readonly providerMessageId: string }
  | { readonly status: "dropped"; readonly code: string; readonly message: string }
  | { readonly status: "rate-limited"; readonly message: string }
  | { readonly status: "unavailable"; readonly message: string; readonly retryable: boolean };

export interface TwitchChatTransport {
  send(
    destination: TwitchChatDestination,
    text: string,
  ): Promise<TwitchChatTransportResult>;
}

export interface ChatDeliveryReceiptStore {
  read(deliveryKey: string): Promise<ChatDeliveryReceipt | null>;
  write(deliveryKey: string, receipt: ChatDeliveryReceipt): Promise<void>;
}

export interface ChatDeliveryIdFactory {
  next(): string;
}

export class SecureChatDeliveryIds implements ChatDeliveryIdFactory {
  next(): string {
    return `chat-delivery-${crypto.randomUUID()}`;
  }
}

export class MemoryChatDeliveryReceiptStore implements ChatDeliveryReceiptStore {
  private readonly receipts = new Map<string, ChatDeliveryReceipt>();

  async read(deliveryKey: string): Promise<ChatDeliveryReceipt | null> {
    const receipt = this.receipts.get(deliveryKey);
    return receipt === undefined ? null : structuredClone(receipt);
  }

  async write(deliveryKey: string, receipt: ChatDeliveryReceipt): Promise<void> {
    const parsed = chatDeliveryReceiptSchema.parse(receipt);
    const existing = this.receipts.get(deliveryKey);
    if (existing !== undefined && existing.messageId !== parsed.messageId) {
      throw new Error("Chat delivery key was reused for a different message");
    }
    this.receipts.set(deliveryKey, structuredClone(parsed));
  }
}

const twitchResponseSchema = z
  .object({
    data: z.array(
      z
        .object({
          message_id: z.string().trim(),
          is_sent: z.boolean(),
          drop_reason: z
            .object({
              code: z.string().trim().min(1),
              message: z.string().trim().min(1),
            })
            .nullable(),
        })
        .passthrough(),
    ),
  })
  .passthrough();

export class HelixTwitchChatTransport implements TwitchChatTransport {
  constructor(
    private readonly credentials: {
      readonly clientId: string;
      readonly accessToken: string;
    },
    private readonly request: typeof fetch = fetch,
  ) {
    if (credentials.clientId.trim().length === 0 || credentials.accessToken.trim().length === 0) {
      throw new Error("Twitch chat credentials are incomplete");
    }
  }

  async send(
    destination: TwitchChatDestination,
    text: string,
  ): Promise<TwitchChatTransportResult> {
    const parsedDestination = twitchChatDestinationSchema.safeParse(destination);
    const parsedText = twitchChatTextSchema.safeParse(text);
    if (!parsedDestination.success || !parsedText.success) {
      return {
        status: "unavailable",
        message: "Twitch chat delivery input is invalid",
        retryable: false,
      };
    }
    const body: Record<string, string> = {
      broadcaster_id: parsedDestination.data.broadcasterId,
      sender_id: parsedDestination.data.senderId,
      message: parsedText.data,
    };
    if (parsedDestination.data.replyParentMessageId !== undefined) {
      body.reply_parent_message_id = parsedDestination.data.replyParentMessageId;
    }

    let response: Response;
    try {
      response = await this.request("https://api.twitch.tv/helix/chat/messages", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.credentials.accessToken}`,
          "Client-Id": this.credentials.clientId,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
    } catch {
      return {
        status: "unavailable",
        message: "Twitch chat delivery could not reach the provider",
        retryable: true,
      };
    }

    if (response.status === 429) {
      return { status: "rate-limited", message: "Twitch chat rate limit was reached" };
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      return {
        status: "unavailable",
        message: "Twitch returned an unreadable chat response",
        retryable: response.status >= 500,
      };
    }

    if (!response.ok) {
      return {
        status: "unavailable",
        message:
          response.status === 401 || response.status === 403
            ? "Twitch chat authorisation is unavailable"
            : `Twitch chat delivery failed with status ${response.status}`,
        retryable: response.status >= 500,
      };
    }

    const parsed = twitchResponseSchema.safeParse(payload);
    const result = parsed.success ? parsed.data.data[0] : undefined;
    if (result === undefined) {
      return {
        status: "unavailable",
        message: "Twitch did not return a chat delivery result",
        retryable: true,
      };
    }
    if (result.is_sent && result.message_id.length > 0) {
      return { status: "delivered", providerMessageId: result.message_id };
    }
    return {
      status: "dropped",
      code: result.drop_reason?.code ?? "twitch-dropped",
      message: result.drop_reason?.message ?? "Twitch did not send the chat message",
    };
  }
}

function deliveryKey(message: ChatFallbackMessage): string {
  const cycleId = message.envelope.questCycleId ?? "no-cycle";
  return message.kind === "vote-acknowledgement"
    ? `${message.envelope.sessionId}:${cycleId}:viewer-ack:${message.viewerKey}`
    : `${message.envelope.sessionId}:${cycleId}:channel:${message.kind}`;
}

function deliveryError(
  result: Exclude<TwitchChatTransportResult, { readonly status: "delivered" }>,
): DomainError {
  if (result.status === "rate-limited") {
    return domainErrorSchema.parse({
      code: "rate-limited",
      message: result.message,
      retryable: true,
    });
  }
  if (result.status === "dropped") {
    return domainErrorSchema.parse({
      code: "forbidden",
      message: result.message,
      retryable: false,
      details: { providerCode: result.code },
    });
  }
  return domainErrorSchema.parse({
    code: "dependency-unavailable",
    message: result.message,
    retryable: result.retryable,
  });
}

export class TwitchChatFallbackDelivery {
  private readonly inFlight = new Map<string, Promise<ChatDeliveryReceipt>>();
  /** Keeps this process truthful and idempotent if durable receipt persistence degrades. */
  private readonly volatileReceipts = new Map<string, ChatDeliveryReceipt>();

  constructor(
    private readonly destinations: TwitchChatDestinationResolver,
    private readonly transport: TwitchChatTransport,
    private readonly receipts: ChatDeliveryReceiptStore,
    private readonly now: () => number = Date.now,
    private readonly ids: ChatDeliveryIdFactory = new SecureChatDeliveryIds(),
  ) {}

  async deliver(input: ChatFallbackMessage): Promise<ChatDeliveryReceipt> {
    const message = chatFallbackMessageSchema.parse(input);
    const key = deliveryKey(message);
    const volatile = this.volatileReceipts.get(key);
    if (volatile !== undefined) return structuredClone(volatile);
    let existing: ChatDeliveryReceipt | null;
    try {
      existing = await this.receipts.read(key);
    } catch {
      const unavailable = this.unavailableReceipt(
        message,
        "Chat delivery receipt storage is unavailable; no message was sent",
      );
      this.volatileReceipts.set(key, unavailable);
      return structuredClone(unavailable);
    }
    if (existing !== null) return existing;
    const pending = this.inFlight.get(key);
    if (pending !== undefined) return pending;
    const operation = this.deliverOnce(message, key).finally(() => this.inFlight.delete(key));
    this.inFlight.set(key, operation);
    return operation;
  }

  private async deliverOnce(
    message: ChatFallbackMessage,
    key: string,
  ): Promise<ChatDeliveryReceipt> {
    const attemptedAt = this.now();
    let destination: TwitchChatDestination | null;
    try {
      destination = await this.destinations.resolve(message);
    } catch {
      destination = null;
    }

    let result: TwitchChatTransportResult;
    if (destination === null) {
      result = {
        status: "unavailable",
        message: "Twitch chat destination is unavailable",
        retryable: true,
      };
    } else {
      try {
        result = await this.transport.send(destination, message.text);
      } catch {
        result = {
          status: "unavailable",
          message: "Twitch chat delivery failed before provider confirmation",
          retryable: true,
        };
      }
    }

    const receipt = chatDeliveryReceiptSchema.parse(
      result.status === "delivered"
        ? {
            deliveryId: this.ids.next(),
            messageId: message.envelope.messageId,
            status: "delivered",
            attemptedAt,
            deliveredAt: this.now(),
            providerMessageId: result.providerMessageId,
            error: null,
          }
        : {
            deliveryId: this.ids.next(),
            messageId: message.envelope.messageId,
            status: result.status,
            attemptedAt,
            deliveredAt: null,
            providerMessageId: null,
            error: deliveryError(result),
          },
    );
    this.volatileReceipts.set(key, receipt);
    try {
      await this.receipts.write(key, receipt);
    } catch {
      // Provider confirmation remains authoritative. The process-local copy prevents
      // duplicate retries here; cross-instance durability is surfaced as a known gap.
    }
    return receipt;
  }

  private unavailableReceipt(
    message: ChatFallbackMessage,
    reason: string,
  ): ChatDeliveryReceipt {
    const attemptedAt = this.now();
    return chatDeliveryReceiptSchema.parse({
      deliveryId: this.ids.next(),
      messageId: message.envelope.messageId,
      status: "unavailable",
      attemptedAt,
      deliveredAt: null,
      providerMessageId: null,
      error: domainErrorSchema.parse({
        code: "dependency-unavailable",
        message: reason,
        retryable: true,
      }),
    });
  }
}
