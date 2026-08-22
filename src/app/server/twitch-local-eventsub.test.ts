import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

const applications = vi.hoisted(() => ({
  online: vi.fn(),
  offline: vi.fn(),
  chat: vi.fn(),
}));

vi.mock("./studio-session", () => ({
  getStudioSessionApplication: () => ({
    synchronizeVerifiedTwitchOnline: applications.online,
    synchronizeVerifiedTwitchOffline: applications.offline,
  }),
}));

vi.mock("./twitch-chat", () => ({
  getTwitchChatApplication: () => ({ ingest: applications.chat }),
}));

import { TwitchLocalAuthorizationStore } from "./twitch-local-authorization";
import {
  TwitchLocalEventSubConnection,
  shouldUseLocalTwitchEventSub,
} from "./twitch-local-eventsub";

const SECRET = "local-eventsub-test-secret-that-is-at-least-32-characters";
const NOW = 1_780_000_000_000;
const directories: string[] = [];

class FakeSocket {
  private readonly listeners = new Map<string, Array<(event: MessageEvent | Event) => void>>();

  addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
    const callback = typeof listener === "function"
      ? listener
      : (event: Event) => listener.handleEvent(event);
    const existing = this.listeners.get(type) ?? [];
    existing.push(callback as (event: MessageEvent | Event) => void);
    this.listeners.set(type, existing);
  }

  close() {
    this.emit("close", new Event("close"));
  }

  message(input: unknown) {
    this.emit("message", { data: JSON.stringify(input) } as MessageEvent);
  }

  private emit(type: string, event: MessageEvent | Event) {
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function authorizationStore() {
  const directory = await mkdtemp(join(tmpdir(), "chatxpt-local-eventsub-"));
  directories.push(directory);
  const store = new TwitchLocalAuthorizationStore({
    secret: SECRET,
    filePath: join(directory, "authorization.enc"),
  });
  await store.save({
    version: 1,
    broadcasterId: "broadcaster-1",
    displayName: "Streamer One",
    gameId: "27471",
    gameName: "Minecraft",
    accessToken: "user-access-token",
    refreshToken: "user-refresh-token",
    scopes: ["user:read:chat", "user:bot", "channel:bot"],
    expiresAt: NOW + 60_000,
  });
  return store;
}

describe("local Twitch EventSub WebSocket", () => {
  afterEach(async () => {
    vi.clearAllMocks();
    await Promise.all(directories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true })
    ));
  });

  it("auto-selects WebSocket transport only for local HTTP origins", () => {
    expect(shouldUseLocalTwitchEventSub("http://localhost:3000")).toBe(true);
    expect(shouldUseLocalTwitchEventSub("http://127.0.0.1:3000")).toBe(true);
    expect(shouldUseLocalTwitchEventSub("https://chatxpt.example")).toBe(false);
    expect(shouldUseLocalTwitchEventSub("http://localhost:3000", {
      CHATXPT_TWITCH_EVENTSUB_TRANSPORT: "webhook",
    })).toBe(false);
  });

  it("subscribes local chat/live lifecycle and dispatches signed Twitch-shaped messages", async () => {
    const store = await authorizationStore();
    const socket = new FakeSocket();
    const request = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json({
        client_id: "client-id",
        user_id: "broadcaster-1",
        scopes: ["user:read:chat", "user:bot", "channel:bot"],
        expires_in: 3_600,
      }))
      .mockResolvedValueOnce(json({ data: [{
        id: "current-stream-1",
        user_id: "broadcaster-1",
        started_at: new Date(NOW - 5_000).toISOString(),
      }] }))
      .mockResolvedValue(json({ data: [{ id: "subscription-1", status: "enabled" }] }));
    const connection = new TwitchLocalEventSubConnection({
      clientId: "client-id",
      clientSecret: "client-secret",
      store,
      request,
      socketFactory: () => socket as unknown as WebSocket,
      now: () => NOW,
      reconnect: () => undefined,
    });

    const started = connection.start("broadcaster-1");
    await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(2));
    expect(applications.online).toHaveBeenCalledWith({
      broadcasterId: "broadcaster-1",
      displayName: "Streamer One",
      deliveryId: `local-live:broadcaster-1:${NOW - 5_000}`,
      occurredAt: NOW - 5_000,
    });
    socket.message({
      metadata: {
        message_id: "welcome-1",
        message_type: "session_welcome",
        message_timestamp: new Date(NOW).toISOString(),
      },
      payload: { session: { id: "websocket-session-1" } },
    });
    await expect(started).resolves.toBeUndefined();

    const subscriptionBodies = request.mock.calls.slice(2).map((call) =>
      JSON.parse(String(call[1]?.body)) as { type: string; transport: { method: string; session_id: string } }
    );
    expect(subscriptionBodies.map((body) => body.type)).toEqual([
      "channel.chat.message",
      "stream.online",
      "stream.offline",
    ]);
    expect(subscriptionBodies.every((body) =>
      body.transport.method === "websocket" && body.transport.session_id === "websocket-session-1"
    )).toBe(true);

    socket.message({
      metadata: {
        message_id: "online-delivery-1",
        message_type: "notification",
        message_timestamp: new Date(NOW).toISOString(),
      },
      payload: {
        subscription: { type: "stream.online" },
        event: {
          id: "stream-1",
          broadcaster_user_id: "broadcaster-1",
          broadcaster_user_name: "Streamer One",
          started_at: new Date(NOW).toISOString(),
        },
      },
    });
    await vi.waitFor(() => expect(applications.online).toHaveBeenCalledWith({
      broadcasterId: "broadcaster-1",
      displayName: "Streamer One",
      deliveryId: "online-delivery-1",
      occurredAt: NOW,
    }));

    socket.message({
      metadata: {
        message_id: "chat-delivery-1",
        message_type: "notification",
        message_timestamp: new Date(NOW + 1_000).toISOString(),
      },
      payload: {
        subscription: { type: "channel.chat.message" },
        event: {
          broadcaster_user_id: "broadcaster-1",
          chatter_user_id: "viewer-1",
          message_id: "chat-message-1",
          message: { text: "3" },
        },
      },
    });
    await vi.waitFor(() => expect(applications.chat).toHaveBeenCalledWith({
      broadcasterId: "broadcaster-1",
      chatterId: "viewer-1",
      messageId: "chat-message-1",
      text: "3",
      occurredAt: NOW + 1_000,
      receivedAt: NOW + 1_000,
    }));
  });

  it("refreshes and rotates an expired local Twitch authorization before reconnecting", async () => {
    const store = await authorizationStore();
    const socket = new FakeSocket();
    const request = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json({ message: "invalid access token" }, 401))
      .mockResolvedValueOnce(json({
        access_token: "refreshed-access-token",
        refresh_token: "rotated-refresh-token",
        expires_in: 3_600,
        scope: ["user:read:chat", "user:bot", "channel:bot"],
        token_type: "bearer",
      }))
      .mockResolvedValueOnce(json({ data: [] }))
      .mockResolvedValue(json({ data: [{ id: "subscription-1", status: "enabled" }] }));
    const connection = new TwitchLocalEventSubConnection({
      clientId: "client-id",
      clientSecret: "client-secret",
      store,
      request,
      socketFactory: () => socket as unknown as WebSocket,
      now: () => NOW,
      reconnect: () => undefined,
    });

    const started = connection.start("broadcaster-1");
    await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(3));
    socket.message({
      metadata: {
        message_id: "welcome-refresh",
        message_type: "session_welcome",
        message_timestamp: new Date(NOW).toISOString(),
      },
      payload: { session: { id: "websocket-session-refresh" } },
    });
    await expect(started).resolves.toBeUndefined();
    await expect(store.read("broadcaster-1")).resolves.toMatchObject({
      accessToken: "refreshed-access-token",
      refreshToken: "rotated-refresh-token",
      expiresAt: NOW + 3_600_000,
    });
  });
});
