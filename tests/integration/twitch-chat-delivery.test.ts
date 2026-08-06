import { describe, expect, it } from "vitest";

import {
  FixedWindowTwitchChatRateLimiter,
  deliverTwitchChatFallbackAnnouncement,
  deliverTwitchChatVoteAcknowledgement,
  deliverTwitchChatVoteSubmissionAcknowledgement,
  type TwitchChatOutboundSender,
  type TwitchChatVoteSubmissionResult,
} from "../../src/integrations";
import { viewerVoteCommandSchema } from "../../src/core";

const FIXTURE_NOW = 1_900_000_000_000;

function voteCommand(candidateId = "quest-candidate-1") {
  return viewerVoteCommandSchema.parse({
    contractVersion: "1.0.0",
    sessionId: "fixture-session",
    questCycleId: "fixture-cycle",
    commandId: `fixture-command-${candidateId}`,
    correlationId: `fixture-correlation-${candidateId}`,
    expectedRevision: 1,
    issuedAt: FIXTURE_NOW,
    actor: { kind: "viewer", actorId: "fixture-viewer" },
    type: "viewer.vote",
    candidateId,
    voterKey: "fixture-voter",
    sourceMode: "twitch-chat",
  });
}

function submittedVote(input: {
  readonly outcome: "committed" | "duplicate";
  readonly candidateId?: string;
}): TwitchChatVoteSubmissionResult {
  const command = voteCommand(input.candidateId);
  return {
    status: "submitted",
    selectedIndex: 0,
    command,
    acceptedCandidateId: command.candidateId,
    result: {
      ok: true,
      outcome: input.outcome,
      receipt: {
        command,
        commandFingerprint: "fixture-fingerprint",
        state: {} as never,
        events: [],
        acceptedAt: FIXTURE_NOW,
      },
      views: null,
      delivery: "not-republished",
    },
  };
}

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

  it("does not deliver acknowledgements for ignored chat", async () => {
    let sendCount = 0;
    const result = await deliverTwitchChatVoteSubmissionAcknowledgement({
      submission: { status: "ignored", reason: "not-a-vote" },
      channelId: "twitch-channel-1",
      sender: {
        async sendMessage() {
          sendCount += 1;
          throw new Error("Ignored chat must not send");
        },
      },
      now: () => FIXTURE_NOW,
      correlationId: "chat-ack-ignored",
    });

    expect(sendCount).toBe(0);
    expect(result).toEqual({
      status: "not-required",
      intent: { status: "none", candidateId: null, reason: "not-a-vote" },
      delivery: null,
      acknowledgement: null,
    });
  });

  it("delivers acknowledgement intent for submitted chat votes", async () => {
    const sentMessages: string[] = [];
    const sender: TwitchChatOutboundSender = {
      async sendMessage(message) {
        sentMessages.push(message.messageText);
        return { status: "delivered", deliveredAt: message.sentAt + 5 };
      },
    };

    const result = await deliverTwitchChatVoteSubmissionAcknowledgement({
      submission: submittedVote({ outcome: "committed", candidateId: "quest-candidate-2" }),
      channelId: "twitch-channel-1",
      sender,
      now: () => FIXTURE_NOW,
      correlationId: "chat-ack-submission-counted",
    });

    expect(sentMessages).toEqual(["ChatXPT counted your vote."]);
    expect(result).toMatchObject({
      status: "delivery-attempted",
      intent: { status: "counted", candidateId: "quest-candidate-2" },
      delivery: { status: "delivered", deliveredAt: FIXTURE_NOW + 5 },
      acknowledgement: {
        status: "counted",
        candidateId: "quest-candidate-2",
        deliveredAt: FIXTURE_NOW + 5,
      },
    });
  });

  it("keeps duplicate acknowledgement unavailable when no Twitch sender exists", async () => {
    const result = await deliverTwitchChatVoteSubmissionAcknowledgement({
      submission: submittedVote({ outcome: "duplicate", candidateId: "quest-candidate-3" }),
      channelId: null,
      sender: null,
      now: () => FIXTURE_NOW,
      correlationId: "chat-ack-submission-unavailable",
    });

    expect(result).toMatchObject({
      status: "delivery-attempted",
      intent: { status: "duplicate", candidateId: "quest-candidate-3" },
      delivery: { status: "unavailable", deliveredAt: null },
      acknowledgement: {
        status: "unavailable",
        candidateId: null,
        deliveredAt: null,
      },
    });
  });
});
