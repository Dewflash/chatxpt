import { describe, expect, it } from "vitest";

import { contractFixtureEnvelope } from "../testing";
import {
  chatDeliveryReceiptSchema,
  chatFallbackMessageSchema,
  hostedBoardAccessViewSchema,
} from "./fallbacks";

const poll = {
  envelope: { ...contractFixtureEnvelope, messageId: "fixture-chat-poll" },
  kind: "poll-open" as const,
  audience: "channel" as const,
  text: "Vote 1, 2, or 3 for the next sidequest.",
  options: [
    { position: 1, candidateId: "candidate-1", title: "First quest" },
    { position: 2, candidateId: "candidate-2", title: "Second quest" },
    { position: 3, candidateId: "candidate-3", title: "Third quest" },
  ] as const,
  voteClosesAt: contractFixtureEnvelope.occurredAt + 30_000,
  hostedBoardUrl: "https://chatxpt.example/quest-board/ABCDEFGH",
};

describe("viewer fallback contracts", () => {
  it("accepts a three-option poll and rejects duplicate or misordered options", () => {
    expect(chatFallbackMessageSchema.safeParse(poll).success).toBe(true);
    expect(
      chatFallbackMessageSchema.safeParse({
        ...poll,
        options: [poll.options[0], poll.options[0], poll.options[2]],
      }).success,
    ).toBe(false);
    expect(
      chatFallbackMessageSchema.safeParse({
        ...poll,
        options: [poll.options[1], poll.options[0], poll.options[2]],
      }).success,
    ).toBe(false);
  });

  it("requires counted and duplicate acknowledgements to identify the accepted choice", () => {
    expect(
      chatFallbackMessageSchema.safeParse({
        envelope: { ...contractFixtureEnvelope, messageId: "fixture-chat-ack" },
        kind: "vote-acknowledgement",
        audience: "viewer",
        viewerKey: "viewer-key",
        text: "Your vote counted.",
        outcome: "counted",
        choicePosition: null,
      }).success,
    ).toBe(false);
    expect(
      chatFallbackMessageSchema.safeParse({
        envelope: { ...contractFixtureEnvelope, messageId: "fixture-chat-duplicate" },
        kind: "vote-acknowledgement",
        audience: "viewer",
        viewerKey: "viewer-key",
        text: "You already voted for option 2.",
        outcome: "duplicate",
        choicePosition: 2,
      }).success,
    ).toBe(true);
    expect(
      chatFallbackMessageSchema.safeParse({
        envelope: { ...contractFixtureEnvelope, messageId: "fixture-chat-late" },
        kind: "vote-acknowledgement",
        audience: "viewer",
        viewerKey: "viewer-key",
        text: "Voting has closed.",
        outcome: "late",
        choicePosition: 2,
      }).success,
    ).toBe(false);
  });

  it("represents final results with either a winner or a no-winner outcome", () => {
    expect(
      chatFallbackMessageSchema.safeParse({
        envelope: { ...contractFixtureEnvelope, messageId: "fixture-chat-winner" },
        kind: "final-result",
        audience: "channel",
        text: "Option 2 wins.",
        outcome: "winner",
        candidateId: "candidate-2",
        winnerTitle: "Second quest",
        acceptedVotes: 3,
      }).success,
    ).toBe(true);
    expect(
      chatFallbackMessageSchema.safeParse({
        envelope: { ...contractFixtureEnvelope, messageId: "fixture-chat-no-winner" },
        kind: "final-result",
        audience: "channel",
        text: "No quest activated because nobody voted.",
        outcome: "no-winner",
        candidateId: null,
        winnerTitle: null,
        acceptedVotes: 0,
      }).success,
    ).toBe(true);
    expect(
      chatFallbackMessageSchema.safeParse({
        envelope: { ...contractFixtureEnvelope, messageId: "fixture-chat-bad-no-winner" },
        kind: "final-result",
        audience: "channel",
        text: "No quest activated.",
        outcome: "no-winner",
        candidateId: "candidate-2",
        winnerTitle: "Second quest",
        acceptedVotes: 0,
      }).success,
    ).toBe(false);
  });

  it("never accepts an unconfirmed receipt as delivered", () => {
    expect(
      chatDeliveryReceiptSchema.safeParse({
        deliveryId: "delivery-1",
        messageId: "fixture-chat-poll",
        status: "delivered",
        attemptedAt: 10,
        deliveredAt: null,
        providerMessageId: null,
        error: null,
      }).success,
    ).toBe(false);
  });

  it("keeps the optional QR payload identical to the token-free share URL", () => {
    const access = {
      sessionId: "fixture-session",
      revision: 0,
      roomCode: "ABCDEFGH",
      participationMode: "hosted-board",
      actorKind: "anonymous",
      expiresAt: 1_786_003_600_000,
      share: {
        roomCode: "ABCDEFGH",
        shareUrl: "https://chatxpt.example/quest-board/ABCDEFGH",
        qrPayload: "https://chatxpt.example/quest-board/ABCDEFGH",
      },
    };
    expect(hostedBoardAccessViewSchema.safeParse(access).success).toBe(true);
    expect(
      hostedBoardAccessViewSchema.safeParse({
        ...access,
        share: { ...access.share, qrPayload: "https://chatxpt.example/quest-board/ABCDEFGH?token=secret" },
      }).success,
    ).toBe(false);
    expect(
      hostedBoardAccessViewSchema.safeParse({
        ...access,
        share: {
          ...access.share,
          shareUrl: "https://chatxpt.example/viewer?room=ABCDEFGH&token=secret",
          qrPayload: null,
        },
      }).success,
    ).toBe(false);
  });
});
