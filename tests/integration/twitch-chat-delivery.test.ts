import { describe, expect, it } from "vitest";

import {
  FixedWindowTwitchChatRateLimiter,
  deliverTwitchChatFallbackAnnouncement,
  deliverTwitchChatVoteAcknowledgement,
  type TwitchChatOutboundSender,
} from "../../src/integrations";

const FIXTURE_NOW = 1_900_000_000_000;

describe("Twitch chat outbound delivery boundary", () => {
  it("reports chat fallback as unavailable when no Twitch sender is configured", async () => {
    const delivery = await deliverTwitchChatFallbackAnnouncement({
      kind: "poll-open",
      messageText: "ChatXPT vote is open: 1) Hold. 2) Push. 3) Rotate. Reply 1, 2, or 3.",
      channelId: null,
      sender: null,
      now: () => FIXTURE_NOW,
      correlationId: "chat-delivery-unavailable",
    });

    expect(delivery).toMatchObject({
      kind: "poll-open",
      status: "unavailable",
      deliveredAt: null,
      retryable: true,
    });
  });

  it("records a delivered fallback announcement only when the injected sender succeeds", async () => {
    const sentMessages: string[] = [];
    const sender: TwitchChatOutboundSender = {
      async sendMessage(message) {
        sentMessages.push(message.messageText);
        return { status: "delivered", deliveredAt: message.sentAt + 25 };
      },
    };

    const delivery = await deliverTwitchChatFallbackAnnouncement({
      kind: "final-result",
      messageText: "ChatXPT quest selected: Hold the high ground.",
      channelId: "twitch-channel-1",
      sender,
      now: () => FIXTURE_NOW,
      correlationId: "chat-delivery-success",
    });

    expect(sentMessages).toEqual(["ChatXPT quest selected: Hold the high ground."]);
    expect(delivery).toMatchObject({
      kind: "final-result",
      status: "delivered",
      deliveredAt: FIXTURE_NOW + 25,
      retryable: false,
    });
  });

  it("rate limits outbound chat before calling the sender", async () => {
    let sendCount = 0;
    const sender: TwitchChatOutboundSender = {
      async sendMessage() {
        sendCount += 1;
        return { status: "delivered" };
      },
    };
    const limiter = new FixedWindowTwitchChatRateLimiter(1, 30_000);

    const first = await deliverTwitchChatFallbackAnnouncement({
      kind: "poll-open",
      messageText: "ChatXPT vote is open: Reply 1, 2, or 3.",
      channelId: "twitch-channel-1",
      sender,
      rateLimiter: limiter,
      now: () => FIXTURE_NOW,
      correlationId: "chat-delivery-rate-limit-1",
    });
    const second = await deliverTwitchChatFallbackAnnouncement({
      kind: "final-result",
      messageText: "ChatXPT vote closed without starting a quest.",
      channelId: "twitch-channel-1",
      sender,
      rateLimiter: limiter,
      now: () => FIXTURE_NOW + 1_000,
      correlationId: "chat-delivery-rate-limit-2",
    });

    expect(sendCount).toBe(1);
    expect(first.status).toBe("delivered");
    expect(second).toMatchObject({
      status: "rate-limited",
      deliveredAt: null,
      retryable: true,
    });
  });

  it("ties vote acknowledgement status to acknowledgement delivery, not poll delivery", async () => {
    const sender: TwitchChatOutboundSender = {
      async sendMessage(message) {
        return { status: message.messageText.includes("already") ? "failed" : "delivered" };
      },
    };

    const counted = await deliverTwitchChatVoteAcknowledgement({
      processingStatus: "counted",
      candidateId: "quest-candidate-1",
      channelId: "twitch-channel-1",
      sender,
      now: () => FIXTURE_NOW,
      correlationId: "chat-ack-counted",
    });
    const duplicate = await deliverTwitchChatVoteAcknowledgement({
      processingStatus: "duplicate",
      candidateId: "quest-candidate-1",
      channelId: "twitch-channel-1",
      sender,
      now: () => FIXTURE_NOW + 1_000,
      correlationId: "chat-ack-duplicate",
    });

    expect(counted.delivery.status).toBe("delivered");
    expect(counted.acknowledgement).toMatchObject({
      status: "counted",
      candidateId: "quest-candidate-1",
      deliveredAt: FIXTURE_NOW,
    });
    expect(duplicate.delivery.status).toBe("failed");
    expect(duplicate.acknowledgement).toMatchObject({
      status: "not-delivered",
      candidateId: null,
      deliveredAt: null,
    });
  });
});
