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
  hostedBoardUrl: "https://chatxpt.example/viewer?room=ABCDEFGH",
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

  it("requires counted acknowledgements to identify the accepted choice", () => {
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
        shareUrl: "https://chatxpt.example/viewer?room=ABCDEFGH",
        qrPayload: "https://chatxpt.example/viewer?room=ABCDEFGH",
      },
    };
    expect(hostedBoardAccessViewSchema.safeParse(access).success).toBe(true);
    expect(
      hostedBoardAccessViewSchema.safeParse({
        ...access,
        share: { ...access.share, qrPayload: "https://chatxpt.example/viewer?token=secret" },
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
