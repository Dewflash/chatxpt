import { createHmac } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  synchronizeVerifiedTwitchOnline: vi.fn(),
  synchronizeVerifiedTwitchOffline: vi.fn(),
  ingestChat: vi.fn(),
}));

vi.mock("@/app/server/studio-session", () => ({
  getStudioSessionApplication: () => ({
    synchronizeVerifiedTwitchOnline: mocks.synchronizeVerifiedTwitchOnline,
    synchronizeVerifiedTwitchOffline: mocks.synchronizeVerifiedTwitchOffline,
  }),
}));

vi.mock("@/app/server/twitch-chat", () => ({
  getTwitchChatApplication: () => ({ ingest: mocks.ingestChat }),
}));

import { POST } from "../api/twitch/eventsub/route";

const SECRET = "eventsub-route-secret-at-least-32-characters";

function request(
  rawBody: string,
  signature: string,
  messageType = "webhook_callback_verification",
  messageId = "eventsub-route-message",
) {
  const timestamp = new Date().toISOString();
  const validSignature = `sha256=${createHmac("sha256", SECRET)
    .update(messageId)
    .update(timestamp)
    .update(rawBody)
    .digest("hex")}`;
  return new Request("http://localhost:3000/api/twitch/eventsub", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "twitch-eventsub-message-id": messageId,
      "twitch-eventsub-message-timestamp": timestamp,
      "twitch-eventsub-message-signature": signature === "valid" ? validSignature : signature,
      "twitch-eventsub-message-type": messageType,
    },
    body: rawBody,
  });
}

describe("Twitch EventSub route", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.unstubAllEnvs());

  it("returns the exact challenge only after HMAC verification", async () => {
    vi.stubEnv("TWITCH_EVENTSUB_SECRET", SECRET);
    const body = JSON.stringify({
      challenge: "challenge-token",
      subscription: { type: "channel.chat.message" },
    });
    const response = await POST(request(body, "valid"));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/plain");
    await expect(response.text()).resolves.toBe("challenge-token");
  });

  it("rejects an invalid webhook signature", async () => {
    vi.stubEnv("TWITCH_EVENTSUB_SECRET", SECRET);
    const body = JSON.stringify({
      challenge: "challenge-token",
      subscription: { type: "channel.chat.message" },
    });
    const response = await POST(request(body, `sha256=${"0".repeat(64)}`));
    expect(response.status).toBe(403);
  });

  it("starts the authoritative Studio session from a signed Twitch online event", async () => {
    vi.stubEnv("TWITCH_EVENTSUB_SECRET", SECRET);
    mocks.synchronizeVerifiedTwitchOnline.mockResolvedValue({ status: "started" });
    const body = JSON.stringify({
      subscription: { type: "stream.online" },
      event: {
        id: "stream-1",
        broadcaster_user_id: "channel-1",
        broadcaster_user_name: "Streamer One",
        started_at: "2026-05-27T10:26:40.000Z",
      },
    });
    const response = await POST(request(body, "valid", "notification", "online-delivery-1"));

    expect(response.status).toBe(204);
    expect(mocks.synchronizeVerifiedTwitchOnline).toHaveBeenCalledWith({
      broadcasterId: "channel-1",
      displayName: "Streamer One",
      deliveryId: "online-delivery-1",
      occurredAt: Date.parse("2026-05-27T10:26:40.000Z"),
    });
  });

  it("ends the authoritative Studio session from a signed Twitch offline event", async () => {
    vi.stubEnv("TWITCH_EVENTSUB_SECRET", SECRET);
    mocks.synchronizeVerifiedTwitchOffline.mockResolvedValue({ status: "ended" });
    const body = JSON.stringify({
      subscription: { type: "stream.offline" },
      event: {
        broadcaster_user_id: "channel-1",
        broadcaster_user_name: "Streamer One",
      },
    });
    const response = await POST(request(body, "valid", "notification", "offline-delivery-1"));

    expect(response.status).toBe(204);
    expect(mocks.synchronizeVerifiedTwitchOffline).toHaveBeenCalledWith(expect.objectContaining({
      broadcasterId: "channel-1",
      displayName: "Streamer One",
      deliveryId: "offline-delivery-1",
    }));
  });
});
