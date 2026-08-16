import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  parseTwitchEventSubMessage,
  pseudonymizeTwitchChatViewer,
  verifyTwitchEventSubMessage,
} from "./eventsub";

const SECRET = "eventsub-test-secret-at-least-32-characters";
const NOW = 1_780_000_000_000;
const TIMESTAMP = new Date(NOW).toISOString();

function signature(messageId: string, rawBody: string): string {
  return `sha256=${createHmac("sha256", SECRET)
    .update(messageId)
    .update(TIMESTAMP)
    .update(rawBody)
    .digest("hex")}`;
}

describe("Twitch EventSub boundary", () => {
  it("verifies the exact raw body and parses a channel chat message", () => {
    const rawBody = JSON.stringify({
      subscription: { type: "channel.chat.message" },
      event: {
        broadcaster_user_id: "channel-1",
        chatter_user_id: "viewer-1",
        message_id: "message-1",
        message: { text: "2" },
      },
    });
    expect(verifyTwitchEventSubMessage({
      messageId: "delivery-1",
      messageTimestamp: TIMESTAMP,
      messageSignature: signature("delivery-1", rawBody),
      rawBody,
      secret: SECRET,
      now: NOW,
    })).toBe(NOW);
    expect(parseTwitchEventSubMessage(rawBody, "notification")).toEqual({
      kind: "chat-message",
      broadcasterId: "channel-1",
      chatterId: "viewer-1",
      messageId: "message-1",
      text: "2",
    });
  });

  it("parses the signed callback challenge and rejects body tampering", () => {
    const rawBody = JSON.stringify({
      challenge: "challenge-value",
      subscription: { type: "channel.chat.message" },
    });
    expect(parseTwitchEventSubMessage(rawBody, "webhook_callback_verification"))
      .toMatchObject({ kind: "challenge", challenge: "challenge-value" });
    expect(() => verifyTwitchEventSubMessage({
      messageId: "delivery-1",
      messageTimestamp: TIMESTAMP,
      messageSignature: signature("delivery-1", rawBody),
      rawBody: `${rawBody} `,
      secret: SECRET,
      now: NOW,
    })).toThrow("signature");
  });

  it("pseudonymizes raw Twitch chatter IDs per session", () => {
    const first = pseudonymizeTwitchChatViewer(SECRET, "session-1", "raw-viewer-1");
    expect(first).toBe(pseudonymizeTwitchChatViewer(SECRET, "session-1", "raw-viewer-1"));
    expect(first).not.toBe(pseudonymizeTwitchChatViewer(SECRET, "session-2", "raw-viewer-1"));
    expect(first).not.toContain("raw-viewer-1");
  });
});
