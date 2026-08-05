import { describe, expect, it, vi } from "vitest";

import {
  chatFallbackMessageSchema,
  type ChatFallbackMessage,
} from "../../src/core";
import { contractFixtureEnvelope } from "../../src/core/testing";
import {
  HelixTwitchChatTransport,
  MemoryChatDeliveryReceiptStore,
  TwitchChatFallbackDelivery,
  type ChatDeliveryIdFactory,
  type TwitchChatTransport,
} from "../../src/integrations/server";

function pollMessage(messageId = "chat-poll"): ChatFallbackMessage {
  return chatFallbackMessageSchema.parse({
    envelope: { ...contractFixtureEnvelope, messageId },
    kind: "poll-open",
    audience: "channel",
    text: "Vote 1, 2, or 3 for the next sidequest.",
    options: [
      { position: 1, candidateId: "candidate-1", title: "First quest" },
      { position: 2, candidateId: "candidate-2", title: "Second quest" },
      { position: 3, candidateId: "candidate-3", title: "Third quest" },
    ],
    voteClosesAt: contractFixtureEnvelope.occurredAt + 30_000,
    hostedBoardUrl: "https://chatxpt.example/viewer?room=ABCDEFGH",
  });
}

function acknowledgement(
  messageId: string,
  outcome: "counted" | "rejected" | "late",
): ChatFallbackMessage {
  return chatFallbackMessageSchema.parse({
    envelope: { ...contractFixtureEnvelope, messageId },
    kind: "vote-acknowledgement",
    audience: "viewer",
    viewerKey: "viewer-key",
    text: outcome === "counted" ? "Your vote counted." : "Your vote was not counted.",
    outcome,
    choicePosition: outcome === "counted" ? 2 : null,
  });
}

class SequenceIds implements ChatDeliveryIdFactory {
  private nextId = 0;
  next(): string {
    this.nextId += 1;
    return `delivery-${this.nextId}`;
  }
}

const destination = {
  resolve: vi.fn(() => ({
    broadcasterId: "broadcaster-id",
    senderId: "bot-id",
  })),
};

describe("Twitch chat fallback delivery", () => {
  it("reports delivered only after Twitch returns a provider message ID", async () => {
    const send = vi.fn(async () => ({
      status: "delivered" as const,
      providerMessageId: "twitch-message-id",
    }));
    const delivery = new TwitchChatFallbackDelivery(
      destination,
      { send },
      new MemoryChatDeliveryReceiptStore(),
      () => 1_786_000_100_000,
      new SequenceIds(),
    );

    await expect(delivery.deliver(pollMessage())).resolves.toMatchObject({
      status: "delivered",
      providerMessageId: "twitch-message-id",
      error: null,
    });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("deduplicates channel messages and limits one acknowledgement per viewer per cycle", async () => {
    const send = vi.fn(async () => ({
      status: "delivered" as const,
      providerMessageId: "twitch-message-id",
    }));
    const delivery = new TwitchChatFallbackDelivery(
      destination,
      { send },
      new MemoryChatDeliveryReceiptStore(),
      () => 1_786_000_100_000,
      new SequenceIds(),
    );

    const firstPoll = await delivery.deliver(pollMessage("poll-one"));
    const duplicatePoll = await delivery.deliver(pollMessage("poll-two"));
    expect(duplicatePoll).toEqual(firstPoll);

    const firstAck = await delivery.deliver(acknowledgement("ack-one", "counted"));
    const secondAck = await delivery.deliver(acknowledgement("ack-two", "late"));
    expect(secondAck).toEqual(firstAck);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("shares one in-flight delivery across concurrent retries", async () => {
    let release: (() => void) | undefined;
    const send = vi.fn(
      () =>
        new Promise<Awaited<ReturnType<TwitchChatTransport["send"]>>>((resolve) => {
          release = () => resolve({ status: "delivered", providerMessageId: "provider-id" });
        }),
    );
    const delivery = new TwitchChatFallbackDelivery(
      destination,
      { send },
      new MemoryChatDeliveryReceiptStore(),
      () => 1_786_000_100_000,
      new SequenceIds(),
    );

    const first = delivery.deliver(pollMessage());
    const second = delivery.deliver(pollMessage());
    await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(1));
    release?.();
    await expect(Promise.all([first, second])).resolves.toEqual([
      expect.objectContaining({ status: "delivered" }),
      expect.objectContaining({ status: "delivered" }),
    ]);
  });

  it("preserves dropped and rate-limited outcomes without provider-delivery fields", async () => {
    const dropped = new TwitchChatFallbackDelivery(
      destination,
      {
        send: vi.fn(async () => ({
          status: "dropped" as const,
          code: "automod_held",
          message: "Message was held by Twitch",
        })),
      },
      new MemoryChatDeliveryReceiptStore(),
      () => 1_786_000_100_000,
      new SequenceIds(),
    );
    await expect(dropped.deliver(pollMessage())).resolves.toMatchObject({
      status: "dropped",
      deliveredAt: null,
      providerMessageId: null,
      error: { code: "forbidden", retryable: false },
    });

    const limited = new TwitchChatFallbackDelivery(
      destination,
      { send: vi.fn(async () => ({ status: "rate-limited" as const, message: "Slow down" })) },
      new MemoryChatDeliveryReceiptStore(),
      () => 1_786_000_100_000,
      new SequenceIds(),
    );
    await expect(limited.deliver(pollMessage("limited-poll"))).resolves.toMatchObject({
      status: "rate-limited",
      error: { code: "rate-limited", retryable: true },
    });
  });

  it("refuses to send when receipt lookup is unavailable", async () => {
    const send = vi.fn(async () => ({
      status: "delivered" as const,
      providerMessageId: "must-not-send",
    }));
    const delivery = new TwitchChatFallbackDelivery(
      destination,
      { send },
      {
        read: vi.fn(async () => {
          throw new Error("store unavailable");
        }),
        write: vi.fn(),
      },
      () => 1_786_000_100_000,
      new SequenceIds(),
    );

    await expect(delivery.deliver(pollMessage())).resolves.toMatchObject({
      status: "unavailable",
      error: { code: "dependency-unavailable", retryable: true },
    });
    expect(send).not.toHaveBeenCalled();
  });

  it("keeps provider-confirmed truth and local deduplication if receipt storage fails", async () => {
    const send = vi.fn(async () => ({
      status: "delivered" as const,
      providerMessageId: "provider-confirmed",
    }));
    const delivery = new TwitchChatFallbackDelivery(
      destination,
      { send },
      {
        read: vi.fn(async () => null),
        write: vi.fn(async () => {
          throw new Error("store unavailable");
        }),
      },
      () => 1_786_000_100_000,
      new SequenceIds(),
    );

    const first = await delivery.deliver(pollMessage("first-attempt"));
    const duplicate = await delivery.deliver(pollMessage("retry-attempt"));
    expect(first).toMatchObject({
      status: "delivered",
      providerMessageId: "provider-confirmed",
    });
    expect(duplicate).toEqual(first);
    expect(send).toHaveBeenCalledTimes(1);
  });
});

describe("Helix Twitch chat transport", () => {
  it("sends the official request shape and accepts is_sent plus message_id", async () => {
    const request = vi.fn(async () =>
      new Response(
        JSON.stringify({
          data: [{ message_id: "twitch-id", is_sent: true, drop_reason: null }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    const transport = new HelixTwitchChatTransport(
      { clientId: "client-id", accessToken: "secret-token" },
      request as unknown as typeof fetch,
    );

    await expect(
      transport.send(
        { broadcasterId: "broadcaster-id", senderId: "bot-id" },
        "Vote now",
      ),
    ).resolves.toEqual({ status: "delivered", providerMessageId: "twitch-id" });
    expect(request).toHaveBeenCalledWith(
      "https://api.twitch.tv/helix/chat/messages",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer secret-token",
          "Client-Id": "client-id",
        }),
        body: JSON.stringify({
          broadcaster_id: "broadcaster-id",
          sender_id: "bot-id",
          message: "Vote now",
        }),
      }),
    );
  });

  it("maps Twitch drops and HTTP rate limits without claiming delivery", async () => {
    const dropped = new HelixTwitchChatTransport(
      { clientId: "client-id", accessToken: "secret-token" },
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            data: [
              {
                message_id: "",
                is_sent: false,
                drop_reason: { code: "automod_held", message: "Held for review" },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ) as unknown as typeof fetch,
    );
    await expect(
      dropped.send({ broadcasterId: "broadcaster-id", senderId: "bot-id" }, "Vote now"),
    ).resolves.toEqual({
      status: "dropped",
      code: "automod_held",
      message: "Held for review",
    });

    const limited = new HelixTwitchChatTransport(
      { clientId: "client-id", accessToken: "secret-token" },
      vi.fn(async () => new Response("", { status: 429 })) as unknown as typeof fetch,
    );
    await expect(
      limited.send({ broadcasterId: "broadcaster-id", senderId: "bot-id" }, "Vote now"),
    ).resolves.toMatchObject({ status: "rate-limited" });
  });

  it("rejects invalid direct transport input before making a provider request", async () => {
    const request = vi.fn();
    const transport = new HelixTwitchChatTransport(
      { clientId: "client-id", accessToken: "secret-token" },
      request as unknown as typeof fetch,
    );

    await expect(
      transport.send({ broadcasterId: "", senderId: "bot-id" }, "Vote now"),
    ).resolves.toMatchObject({
      status: "unavailable",
      retryable: false,
    });
    await expect(
      transport.send({ broadcasterId: "broadcaster-id", senderId: "bot-id" }, " "),
    ).resolves.toMatchObject({
      status: "unavailable",
      retryable: false,
    });
    expect(request).not.toHaveBeenCalled();
  });
});
