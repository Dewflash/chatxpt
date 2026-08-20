import { describe, expect, it, vi } from "vitest";

import {
  TWITCH_OAUTH_SCOPES,
  TwitchOAuthClient,
  TwitchOAuthError,
  twitchAuthorizationUrl,
} from "./oauth";

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const configuration = {
  clientId: "client-id",
  clientSecret: "client-secret",
  eventSubSecret: "eventsub-secret-that-is-long-enough",
  redirectUri: "https://chatxpt.example/api/twitch/oauth/callback",
  eventSubWebhookUrl: "https://chatxpt.example/api/twitch/eventsub",
};

describe("Twitch OAuth", () => {
  it("builds a state-bound authorization-code request with the required chat scopes", () => {
    const url = new URL(twitchAuthorizationUrl({
      clientId: "client-id",
      redirectUri: configuration.redirectUri,
      state: "csrf-state",
    }));

    expect(url.origin + url.pathname).toBe("https://id.twitch.tv/oauth2/authorize");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("client_id")).toBe("client-id");
    expect(url.searchParams.get("redirect_uri")).toBe(configuration.redirectUri);
    expect(url.searchParams.get("state")).toBe("csrf-state");
    expect(url.searchParams.get("scope")?.split(" ")).toEqual(TWITCH_OAUTH_SCOPES);
  });

  it("validates identity, imports the channel game, and requests signed chat delivery", async () => {
    const request = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json({
        access_token: "user-access",
        refresh_token: "user-refresh",
        expires_in: 3_600,
        scope: [...TWITCH_OAUTH_SCOPES],
        token_type: "bearer",
      }))
      .mockResolvedValueOnce(json({
        client_id: "client-id",
        user_id: "broadcaster-1",
        scopes: [...TWITCH_OAUTH_SCOPES],
        expires_in: 3_500,
      }))
      .mockResolvedValueOnce(json({ data: [{ id: "broadcaster-1", display_name: "Streamer" }] }))
      .mockResolvedValueOnce(json({ data: [{ broadcaster_id: "broadcaster-1", game_id: "27471", game_name: "Minecraft" }] }))
      .mockResolvedValueOnce(json({ access_token: "app-access", expires_in: 3_600, token_type: "bearer" }))
      .mockResolvedValueOnce(json({ data: [{ id: "eventsub-1", status: "webhook_callback_verification_pending" }] }));

    const connection = await new TwitchOAuthClient(configuration, request).connect("code-1");

    expect(connection).toMatchObject({
      broadcasterId: "broadcaster-1",
      displayName: "Streamer",
      gameId: "27471",
      gameName: "Minecraft",
      eventSub: { status: "pending", subscriptionId: "eventsub-1" },
    });
    expect(request).toHaveBeenCalledTimes(6);
    const eventSubRequest = request.mock.calls[5];
    expect(eventSubRequest?.[0]).toBe("https://api.twitch.tv/helix/eventsub/subscriptions");
    expect(JSON.parse(String(eventSubRequest?.[1]?.body))).toMatchObject({
      type: "channel.chat.message",
      condition: { broadcaster_user_id: "broadcaster-1", user_id: "broadcaster-1" },
      transport: { method: "webhook", callback: configuration.eventSubWebhookUrl },
    });
  });

  it("connects locally while truthfully skipping the HTTPS-only webhook", async () => {
    const request = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json({
        access_token: "user-access",
        refresh_token: "user-refresh",
        expires_in: 3_600,
        scope: [...TWITCH_OAUTH_SCOPES],
        token_type: "bearer",
      }))
      .mockResolvedValueOnce(json({
        client_id: "client-id",
        user_id: "broadcaster-1",
        scopes: [...TWITCH_OAUTH_SCOPES],
        expires_in: 3_500,
      }))
      .mockResolvedValueOnce(json({ data: [{ id: "broadcaster-1", display_name: "Streamer" }] }))
      .mockResolvedValueOnce(json({ data: [] }));

    const connection = await new TwitchOAuthClient({
      ...configuration,
      redirectUri: "http://localhost:3000/api/twitch/oauth/callback",
      eventSubWebhookUrl: "http://localhost:3000/api/twitch/eventsub",
    }, request).connect("code-1");

    expect(connection.eventSub.status).toBe("skipped");
    expect(connection.gameId).toBeNull();
    expect(request).toHaveBeenCalledTimes(4);
  });

  it("rejects a token that lacks a required chat permission", async () => {
    const request = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json({
        access_token: "user-access",
        refresh_token: "user-refresh",
        expires_in: 3_600,
        scope: ["user:read:chat"],
        token_type: "bearer",
      }))
      .mockResolvedValueOnce(json({
        client_id: "client-id",
        user_id: "broadcaster-1",
        scopes: ["user:read:chat"],
        expires_in: 3_500,
      }));

    await expect(new TwitchOAuthClient(configuration, request).connect("code-1"))
      .rejects.toMatchObject({ code: "identity-failed" } satisfies Partial<TwitchOAuthError>);
    expect(request).toHaveBeenCalledTimes(2);
  });
});
