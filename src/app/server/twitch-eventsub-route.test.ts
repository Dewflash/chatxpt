import { createHmac } from "node:crypto";

import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "../api/twitch/eventsub/route";

const SECRET = "eventsub-route-secret-at-least-32-characters";

function request(rawBody: string, signature: string) {
  const timestamp = new Date().toISOString();
  const messageId = "eventsub-route-message";
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
      "twitch-eventsub-message-type": "webhook_callback_verification",
    },
    body: rawBody,
  });
}

describe("Twitch EventSub route", () => {
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
});
