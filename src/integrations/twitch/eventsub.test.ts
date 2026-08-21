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

  it("parses Twitch stream online and offline lifecycle notifications", () => {
    const online = JSON.stringify({
      subscription: { type: "stream.online" },
      event: {
        id: "stream-1",
        broadcaster_user_id: "channel-1",
        broadcaster_user_name: "Streamer One",
        started_at: "2026-05-27T10:26:40.000Z",
      },
    });
    expect(parseTwitchEventSubMessage(online, "notification")).toEqual({
      kind: "stream-online",
      streamId: "stream-1",
      broadcasterId: "channel-1",
      displayName: "Streamer One",
      startedAt: Date.parse("2026-05-27T10:26:40.000Z"),
    });

    const offline = JSON.stringify({
      subscription: { type: "stream.offline" },
      event: {
        broadcaster_user_id: "channel-1",
        broadcaster_user_name: "Streamer One",
      },
    });
    expect(parseTwitchEventSubMessage(offline, "notification")).toEqual({
      kind: "stream-offline",
      broadcasterId: "channel-1",
      displayName: "Streamer One",
    });
  });

  it("pseudonymizes raw Twitch chatter IDs per session", () => {
    const first = pseudonymizeTwitchChatViewer(SECRET, "session-1", "raw-viewer-1");
    expect(first).toBe(pseudonymizeTwitchChatViewer(SECRET, "session-1", "raw-viewer-1"));
    expect(first).not.toBe(pseudonymizeTwitchChatViewer(SECRET, "session-2", "raw-viewer-1"));
    expect(first).not.toContain("raw-viewer-1");
  });

  it("rejects webhook secrets that Twitch cannot register", () => {
    const input = {
      messageId: "delivery-1",
      messageTimestamp: TIMESTAMP,
      messageSignature: `sha256=${"0".repeat(64)}`,
      rawBody: "{}",
      now: NOW,
    };
    expect(() => verifyTwitchEventSubMessage({ ...input, secret: "x".repeat(101) }))
      .toThrow("32 to 100 printable ASCII");
    expect(() => verifyTwitchEventSubMessage({ ...input, secret: `${"x".repeat(31)}é` }))
      .toThrow("32 to 100 printable ASCII");
  });
});
