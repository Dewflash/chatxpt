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

  it("validates identity, imports the channel game, and requests signed live-status and chat delivery", async () => {
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
      .mockResolvedValueOnce(json({ data: [{ id: "stream-1", user_id: "broadcaster-1", started_at: "2026-08-21T01:02:03Z" }] }))
      .mockResolvedValueOnce(json({ access_token: "app-access", expires_in: 3_600, token_type: "bearer" }))
      .mockResolvedValueOnce(json({ data: [{ id: "eventsub-chat", status: "webhook_callback_verification_pending" }] }))
      .mockResolvedValueOnce(json({ data: [{ id: "eventsub-online", status: "webhook_callback_verification_pending" }] }))
      .mockResolvedValueOnce(json({ data: [{ id: "eventsub-offline", status: "webhook_callback_verification_pending" }] }));

    const connection = await new TwitchOAuthClient(configuration, request).connect("code-1");

    expect(connection).toMatchObject({
      broadcasterId: "broadcaster-1",
      displayName: "Streamer",
      gameId: "27471",
      gameName: "Minecraft",
      stream: { status: "live", startedAt: Date.parse("2026-08-21T01:02:03Z") },
      eventSub: {
        status: "pending",
        subscriptionId: "eventsub-chat",
        subscriptionIds: ["eventsub-chat", "eventsub-online", "eventsub-offline"],
      },
    });
    expect(request).toHaveBeenCalledTimes(9);
    const eventSubRequests = request.mock.calls.slice(6);
    expect(eventSubRequests.map((call) => JSON.parse(String(call[1]?.body)).type)).toEqual([
      "channel.chat.message",
      "stream.online",
      "stream.offline",
    ]);
    expect(eventSubRequests[0]?.[0]).toBe("https://api.twitch.tv/helix/eventsub/subscriptions");
    expect(JSON.parse(String(eventSubRequests[0]?.[1]?.body))).toMatchObject({
      type: "channel.chat.message",
      condition: { broadcaster_user_id: "broadcaster-1", user_id: "broadcaster-1" },
      transport: { method: "webhook", callback: configuration.eventSubWebhookUrl },
    });
    expect(JSON.parse(String(eventSubRequests[1]?.[1]?.body))).toMatchObject({
      type: "stream.online",
      condition: { broadcaster_user_id: "broadcaster-1" },
    });
    expect(JSON.parse(String(eventSubRequests[2]?.[1]?.body))).toMatchObject({
      type: "stream.offline",
      condition: { broadcaster_user_id: "broadcaster-1" },
    });
  });

  it("connects locally over HTTPS while deferring delivery to the WebSocket transport", async () => {
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
      .mockResolvedValueOnce(json({ data: [] }))
      .mockResolvedValueOnce(json({ data: [] }));

    const connection = await new TwitchOAuthClient({
      ...configuration,
      eventSubSecret: "",
      redirectUri: "https://localhost:3000/api/twitch/oauth/callback",
      eventSubWebhookUrl: "https://localhost:3000/api/twitch/eventsub",
      eventSubTransport: "websocket",
    }, request).connect("code-1");

    expect(connection.eventSub.status).toBe("skipped");
    expect(connection.gameId).toBeNull();
    expect(connection.stream).toEqual({ status: "offline", startedAt: null });
    expect(request).toHaveBeenCalledTimes(5);
  });

  it("treats already-existing EventSub subscriptions as an idempotent reconnect", async () => {
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
      .mockResolvedValueOnce(json({ data: [] }))
      .mockResolvedValueOnce(json({ data: [] }))
      .mockResolvedValueOnce(json({ access_token: "app-access", expires_in: 3_600, token_type: "bearer" }))
      .mockResolvedValueOnce(json({ message: "subscription already exists" }, 409))
      .mockResolvedValueOnce(json({ message: "subscription already exists" }, 409))
      .mockResolvedValueOnce(json({ message: "subscription already exists" }, 409));

    const connection = await new TwitchOAuthClient(configuration, request).connect("code-1");

    expect(connection.eventSub).toMatchObject({
      status: "configured",
      subscriptionId: null,
      subscriptionIds: [],
    });
    expect(request).toHaveBeenCalledTimes(9);
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
