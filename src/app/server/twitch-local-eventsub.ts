import "server-only";

import { z } from "zod";

import { parseTwitchEventSubMessage } from "@/integrations/server";

import { getStudioSessionApplication } from "./studio-session";
import { getTwitchChatApplication } from "./twitch-chat";
import {
  TwitchLocalAuthorizationStore,
  type TwitchLocalAuthorization,
} from "./twitch-local-authorization";
import { studioSessionSecret } from "./twitch-connection-grant";

const TWITCH_EVENTSUB_WEBSOCKET_URL =
  "wss://eventsub.wss.twitch.tv/ws?keepalive_timeout_seconds=30";

const websocketEnvelopeSchema = z.object({
  metadata: z.object({
    message_id: z.string().trim().min(1).max(128),
    message_type: z.enum([
      "session_welcome",
      "session_keepalive",
      "notification",
      "session_reconnect",
      "revocation",
    ]),
    message_timestamp: z.iso.datetime({ offset: true }),
  }).passthrough(),
  payload: z.unknown(),
}).passthrough();

const welcomePayloadSchema = z.object({
  session: z.object({
    id: z.string().trim().min(1).max(256),
  }).passthrough(),
}).passthrough();

const reconnectPayloadSchema = z.object({
  session: z.object({
    reconnect_url: z.url().startsWith("wss://"),
  }).passthrough(),
}).passthrough();

const refreshResponseSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
  expires_in: z.number().int().positive(),
  scope: z.array(z.string()).default([]),
}).passthrough();

const validationResponseSchema = z.object({
  client_id: z.string().min(1),
  user_id: z.string().min(1),
  scopes: z.array(z.string()).default([]),
  expires_in: z.number().int().positive(),
}).passthrough();

const streamsResponseSchema = z.object({
  data: z.array(z.object({
    id: z.string().min(1),
    user_id: z.string().min(1),
    started_at: z.iso.datetime({ offset: true }),
  }).passthrough()).max(1),
}).passthrough();

type WebSocketLike = Pick<WebSocket, "addEventListener" | "close">;

export interface TwitchLocalEventSubDependencies {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly store: TwitchLocalAuthorizationStore;
  readonly request?: typeof fetch;
  readonly socketFactory?: (url: string) => WebSocketLike;
  readonly now?: () => number;
  readonly reconnect?: (callback: () => void, delayMs: number) => unknown;
}

export class TwitchLocalEventSubError extends Error {
  constructor(
    readonly code: "misconfigured" | "authorization" | "connection" | "subscription",
    message: string,
  ) {
    super(message);
    this.name = "TwitchLocalEventSubError";
  }
}

export function shouldUseLocalTwitchEventSub(
  origin: string,
  environment: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  const configured = environment.CHATXPT_TWITCH_EVENTSUB_TRANSPORT?.trim().toLowerCase();
  if (configured === "websocket") return true;
  if (configured === "webhook") return false;
  const url = new URL(origin);
  return url.protocol === "http:" &&
    (url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]");
}

export class TwitchLocalEventSubConnection {
  private readonly request: typeof fetch;
  private readonly socketFactory: (url: string) => WebSocketLike;
  private readonly now: () => number;
  private readonly reconnect: (callback: () => void, delayMs: number) => unknown;
  private socket: WebSocketLike | null = null;
  private starting: Promise<void> | null = null;
  private authorization: TwitchLocalAuthorization | null = null;

  constructor(private readonly dependencies: TwitchLocalEventSubDependencies) {
    this.request = dependencies.request ?? fetch;
    this.socketFactory = dependencies.socketFactory ?? ((url) => {
      if (typeof WebSocket === "undefined") {
        throw new TwitchLocalEventSubError(
          "misconfigured",
          "This local Node runtime does not provide WebSocket support",
        );
      }
      return new WebSocket(url);
    });
    this.now = dependencies.now ?? Date.now;
    this.reconnect = dependencies.reconnect ?? ((callback, delayMs) => setTimeout(callback, delayMs));
  }

  start(broadcasterId: string): Promise<void> {
    if (this.starting !== null) return this.starting;
    this.starting = this.startCurrent(broadcasterId)
      .catch((caught) => {
        this.starting = null;
        throw caught;
      });
    return this.starting;
  }

  private async startCurrent(broadcasterId: string): Promise<void> {
    const stored = await this.dependencies.store.read(broadcasterId);
    if (stored === null) {
      throw new TwitchLocalEventSubError(
        "authorization",
        "Connect Twitch once before starting local EventSub delivery",
      );
    }
    this.authorization = await this.ensureValidAuthorization(stored);
    await this.synchronizeCurrentLive(this.authorization);
    await this.open(TWITCH_EVENTSUB_WEBSOCKET_URL, true);
  }

  private async synchronizeCurrentLive(
    authorization: TwitchLocalAuthorization,
  ): Promise<void> {
    const response = await this.request(
      `https://api.twitch.tv/helix/streams?user_id=${encodeURIComponent(authorization.broadcasterId)}`,
      {
        headers: {
          authorization: `Bearer ${authorization.accessToken}`,
          "client-id": this.dependencies.clientId,
        },
        cache: "no-store",
      },
    );
    if (!response.ok) return;
    const stream = streamsResponseSchema.parse(await response.json()).data[0] ?? null;
    if (stream === null) return;
    if (stream.user_id !== authorization.broadcasterId) {
      throw new TwitchLocalEventSubError(
        "authorization",
        "Twitch stream metadata belongs to another broadcaster",
      );
    }
    const startedAt = Date.parse(stream.started_at);
    await getStudioSessionApplication().synchronizeVerifiedTwitchOnline({
      broadcasterId: authorization.broadcasterId,
      displayName: authorization.displayName,
      deliveryId: `local-live:${authorization.broadcasterId}:${startedAt}`,
      occurredAt: startedAt,
    });
  }

  private async ensureValidAuthorization(
    input: TwitchLocalAuthorization,
  ): Promise<TwitchLocalAuthorization> {
    const validation = await this.request("https://id.twitch.tv/oauth2/validate", {
      headers: { authorization: `OAuth ${input.accessToken}` },
      cache: "no-store",
    });
    if (validation.ok) {
      const parsed = validationResponseSchema.parse(await validation.json());
      if (
        parsed.client_id !== this.dependencies.clientId ||
        parsed.user_id !== input.broadcasterId
      ) {
        throw new TwitchLocalEventSubError(
          "authorization",
          "Stored Twitch authorization belongs to another app or broadcaster",
        );
      }
      return {
        ...input,
        scopes: parsed.scopes,
        expiresAt: this.now() + parsed.expires_in * 1_000,
      };
    }
    if (validation.status !== 401) {
      throw new TwitchLocalEventSubError(
        "authorization",
        "Twitch authorization validation is unavailable",
      );
    }
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: input.refreshToken,
      client_id: this.dependencies.clientId,
      client_secret: this.dependencies.clientSecret,
    });
    const refreshed = await this.request("https://id.twitch.tv/oauth2/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
      cache: "no-store",
    });
    if (!refreshed.ok) {
      throw new TwitchLocalEventSubError(
        "authorization",
        "Twitch authorization expired; reconnect Twitch in Studio",
      );
    }
    const token = refreshResponseSchema.parse(await refreshed.json());
    const next = {
      ...input,
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      scopes: token.scope,
      expiresAt: this.now() + token.expires_in * 1_000,
    };
    await this.dependencies.store.save(next);
    return next;
  }

  private open(url: string, subscribeOnWelcome: boolean): Promise<void> {
    const authorization = this.authorization;
    if (authorization === null) {
      throw new TwitchLocalEventSubError("authorization", "Twitch authorization is unavailable");
    }
    let settled = false;
    const socket = this.socketFactory(url);
    const previous = this.socket;
    return new Promise<void>((resolve, reject) => {
      const fail = (caught: unknown) => {
        if (settled) return;
        settled = true;
        reject(caught instanceof TwitchLocalEventSubError
          ? caught
          : new TwitchLocalEventSubError("connection", "Twitch EventSub WebSocket failed"));
      };
      socket.addEventListener("message", (event) => {
        void (async () => {
          const raw = typeof event.data === "string" ? event.data : "";
          const envelope = websocketEnvelopeSchema.parse(JSON.parse(raw) as unknown);
          if (envelope.metadata.message_type === "session_welcome") {
            const welcome = welcomePayloadSchema.parse(envelope.payload);
            if (subscribeOnWelcome) {
              await this.createSubscriptions(welcome.session.id, authorization);
            }
            this.socket = socket;
            previous?.close(1000, "Twitch reconnect completed");
            if (!settled) {
              settled = true;
              resolve();
            }
            return;
          }
          if (envelope.metadata.message_type === "session_reconnect") {
            const reconnect = reconnectPayloadSchema.parse(envelope.payload);
            await this.open(reconnect.session.reconnect_url, false);
            return;
          }
          if (envelope.metadata.message_type === "notification") {
            await this.dispatchNotification(envelope);
          }
        })().catch(fail);
      });
      socket.addEventListener("error", () => fail(
        new TwitchLocalEventSubError("connection", "Twitch EventSub WebSocket failed"),
      ));
      socket.addEventListener("close", () => {
        if (!settled) {
          fail(new TwitchLocalEventSubError(
            "connection",
            "Twitch EventSub WebSocket closed before setup completed",
          ));
          return;
        }
        if (this.socket !== socket) return;
        this.socket = null;
        this.starting = null;
        this.reconnect(() => {
          void this.start(authorization.broadcasterId).catch(() => undefined);
        }, 1_000);
      });
    });
  }

  private async createSubscriptions(
    sessionId: string,
    authorization: TwitchLocalAuthorization,
  ): Promise<void> {
    const types = ["channel.chat.message", "stream.online", "stream.offline"] as const;
    for (const type of types) {
      const response = await this.request("https://api.twitch.tv/helix/eventsub/subscriptions", {
        method: "POST",
        headers: {
          authorization: `Bearer ${authorization.accessToken}`,
          "client-id": this.dependencies.clientId,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          type,
          version: "1",
          condition: type === "channel.chat.message"
            ? {
                broadcaster_user_id: authorization.broadcasterId,
                user_id: authorization.broadcasterId,
              }
            : { broadcaster_user_id: authorization.broadcasterId },
          transport: { method: "websocket", session_id: sessionId },
        }),
        cache: "no-store",
      });
      if (!response.ok) {
        throw new TwitchLocalEventSubError(
          "subscription",
          `Twitch ${type} WebSocket subscription failed`,
        );
      }
    }
  }

  private async dispatchNotification(
    envelope: z.infer<typeof websocketEnvelopeSchema>,
  ): Promise<void> {
    const payload = parseTwitchEventSubMessage(
      JSON.stringify(envelope.payload),
      "notification",
    );
    const occurredAt = Date.parse(envelope.metadata.message_timestamp);
    if (payload.kind === "chat-message") {
      await getTwitchChatApplication().ingest({
        broadcasterId: payload.broadcasterId,
        chatterId: payload.chatterId,
        messageId: payload.messageId,
        text: payload.text,
        occurredAt,
        receivedAt: Math.max(this.now(), occurredAt),
      });
    } else if (payload.kind === "stream-online") {
      await getStudioSessionApplication().synchronizeVerifiedTwitchOnline({
        broadcasterId: payload.broadcasterId,
        displayName: payload.displayName,
        deliveryId: envelope.metadata.message_id,
        occurredAt: payload.startedAt,
      });
    } else if (payload.kind === "stream-offline") {
      await getStudioSessionApplication().synchronizeVerifiedTwitchOffline({
        broadcasterId: payload.broadcasterId,
        displayName: payload.displayName,
        deliveryId: envelope.metadata.message_id,
        occurredAt,
      });
    }
  }
}

const localConnections = new Map<string, TwitchLocalEventSubConnection>();

function configuredConnection(): TwitchLocalEventSubConnection {
  const clientId = process.env.TWITCH_CLIENT_ID?.trim() ?? "";
  const clientSecret = process.env.TWITCH_CLIENT_SECRET?.trim() ?? "";
  const secret = studioSessionSecret();
  if (clientId === "" || clientSecret === "" || secret === "") {
    throw new TwitchLocalEventSubError(
      "misconfigured",
      "Local Twitch EventSub requires the configured ChatXPT Twitch app",
    );
  }
  return new TwitchLocalEventSubConnection({
    clientId,
    clientSecret,
    store: new TwitchLocalAuthorizationStore({ secret }),
  });
}

export async function ensureLocalTwitchEventSub(
  broadcasterId: string,
): Promise<void> {
  let connection = localConnections.get(broadcasterId);
  if (connection === undefined) {
    connection = configuredConnection();
    localConnections.set(broadcasterId, connection);
  }
  try {
    await connection.start(broadcasterId);
  } catch (caught) {
    localConnections.delete(broadcasterId);
    throw caught;
  }
}
