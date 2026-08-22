import { z } from "zod";

const tokenResponseSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
  expires_in: z.number().int().positive(),
  scope: z.array(z.string()),
  token_type: z.string().min(1),
}).passthrough();

const validateResponseSchema = z.object({
  client_id: z.string().min(1),
  user_id: z.string().min(1),
  scopes: z.array(z.string()).default([]),
  expires_in: z.number().int().positive(),
}).passthrough();

const usersResponseSchema = z.object({
  data: z.array(z.object({
    id: z.string().min(1),
    display_name: z.string().min(1),
  }).passthrough()).min(1),
}).passthrough();

const channelsResponseSchema = z.object({
  data: z.array(z.object({
    broadcaster_id: z.string().min(1),
    game_id: z.string(),
    game_name: z.string(),
  }).passthrough()).max(1),
}).passthrough();

const streamsResponseSchema = z.object({
  data: z.array(z.object({
    id: z.string().min(1),
    user_id: z.string().min(1),
    started_at: z.iso.datetime({ offset: true }),
  }).passthrough()).max(1),
}).passthrough();

const appTokenResponseSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().int().positive(),
  token_type: z.string().min(1),
}).passthrough();

const eventSubResponseSchema = z.object({
  data: z.array(z.object({
    id: z.string().min(1),
    status: z.string().min(1),
  }).passthrough()).min(1),
}).passthrough();

export const TWITCH_OAUTH_SCOPES = ["user:read:chat", "user:bot", "channel:bot"] as const;

export interface TwitchOAuthConfiguration {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly eventSubSecret: string;
  readonly redirectUri: string;
  readonly eventSubWebhookUrl: string;
  readonly eventSubTransport?: "websocket" | "webhook";
}

export interface TwitchOAuthConnection {
  readonly broadcasterId: string;
  readonly displayName: string;
  readonly gameId: string | null;
  readonly gameName: string | null;
  readonly grantedScopes: readonly string[];
  readonly tokenExpiresInSeconds: number;
  readonly stream: {
    readonly status: "live" | "offline";
    readonly startedAt: number | null;
  };
  /** Server-only user authorization used by localhost EventSub WebSocket recovery. */
  readonly authorization: {
    readonly accessToken: string;
    readonly refreshToken: string;
    readonly expiresAt: number;
  };
  readonly eventSub: {
    readonly status: "configured" | "pending" | "skipped";
    readonly subscriptionId: string | null;
    readonly subscriptionIds: readonly string[];
    readonly detail: string;
  };
}

export class TwitchOAuthError extends Error {
  constructor(
    readonly code: "misconfigured" | "secret-mismatch" | "exchange-failed" | "identity-failed" | "eventsub-failed",
    message: string,
  ) {
    super(message);
    this.name = "TwitchOAuthError";
  }
}

async function parseResponse(response: Response, message: string): Promise<unknown> {
  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    // A bounded generic error is safer than reflecting Twitch's response body.
  }
  if (!response.ok) {
    const twitchMessage = payload !== null && typeof payload === "object" && "message" in payload
      ? String((payload as { readonly message?: unknown }).message ?? "")
      : "";
    if (response.status === 403 && twitchMessage.toLowerCase().includes("invalid client secret")) {
      throw new TwitchOAuthError(
        "secret-mismatch",
        "The configured Twitch client secret does not belong to this application",
      );
    }
    throw new TwitchOAuthError("exchange-failed", message);
  }
  return payload;
}

export function twitchAuthorizationUrl(input: {
  readonly clientId: string;
  readonly redirectUri: string;
  readonly state: string;
}): string {
  const url = new URL("https://id.twitch.tv/oauth2/authorize");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", input.clientId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("scope", TWITCH_OAUTH_SCOPES.join(" "));
  url.searchParams.set("state", input.state);
  return url.toString();
}

export class TwitchOAuthClient {
  constructor(
    private readonly configuration: TwitchOAuthConfiguration,
    private readonly request: typeof fetch = fetch,
  ) {
    const webhookRequiresSecret = configuration.eventSubTransport !== "websocket" &&
      new URL(configuration.eventSubWebhookUrl).protocol === "https:";
    if (
      configuration.clientId.trim() === "" ||
      configuration.clientSecret.trim() === "" ||
      (webhookRequiresSecret && configuration.eventSubSecret.trim() === "")
    ) {
      throw new TwitchOAuthError("misconfigured", "Twitch OAuth credentials are incomplete");
    }
  }

  async connect(code: string): Promise<TwitchOAuthConnection> {
    const tokenBody = new URLSearchParams({
      client_id: this.configuration.clientId,
      client_secret: this.configuration.clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: this.configuration.redirectUri,
    });
    const token = tokenResponseSchema.parse(await parseResponse(await this.request(
      "https://id.twitch.tv/oauth2/token",
      {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: tokenBody,
        cache: "no-store",
      },
    ), "Twitch did not accept the OAuth code"));

    const validation = validateResponseSchema.parse(await parseResponse(await this.request(
      "https://id.twitch.tv/oauth2/validate",
      {
        headers: { authorization: `OAuth ${token.access_token}` },
        cache: "no-store",
      },
    ), "Twitch could not validate the OAuth token"));
    if (validation.client_id !== this.configuration.clientId) {
      throw new TwitchOAuthError("identity-failed", "Twitch token belongs to another application");
    }
    const missingScopes = TWITCH_OAUTH_SCOPES.filter((scope) => !validation.scopes.includes(scope));
    if (missingScopes.length > 0) {
      throw new TwitchOAuthError("identity-failed", "Twitch chat permissions were not granted");
    }

    const helixHeaders = {
      authorization: `Bearer ${token.access_token}`,
      "client-id": this.configuration.clientId,
    };
    const [usersPayload, channelsPayload, streamsPayload] = await Promise.all([
      parseResponse(await this.request("https://api.twitch.tv/helix/users", {
        headers: helixHeaders,
        cache: "no-store",
      }), "Twitch user metadata is unavailable"),
      parseResponse(await this.request(
        `https://api.twitch.tv/helix/channels?broadcaster_id=${encodeURIComponent(validation.user_id)}`,
        { headers: helixHeaders, cache: "no-store" },
      ), "Twitch channel metadata is unavailable"),
      parseResponse(await this.request(
        `https://api.twitch.tv/helix/streams?user_id=${encodeURIComponent(validation.user_id)}`,
        { headers: helixHeaders, cache: "no-store" },
      ), "Twitch stream status is unavailable"),
    ]);
    const user = usersResponseSchema.parse(usersPayload).data[0];
    const channel = channelsResponseSchema.parse(channelsPayload).data[0] ?? null;
    const stream = streamsResponseSchema.parse(streamsPayload).data[0] ?? null;
    if (user.id !== validation.user_id) {
      throw new TwitchOAuthError("identity-failed", "Twitch user metadata did not match the token");
    }
    if (stream !== null && stream.user_id !== validation.user_id) {
      throw new TwitchOAuthError("identity-failed", "Twitch stream metadata did not match the token");
    }

    const eventSub = await this.createEventSubscriptions(validation.user_id).catch(() => ({
      status: "skipped" as const,
      subscriptionId: null,
      subscriptionIds: [],
      detail: "Twitch connected, but live status and chat delivery still need EventSub recovery.",
    }));
    return {
      broadcasterId: validation.user_id,
      displayName: user.display_name,
      gameId: channel?.game_id.trim() ? channel.game_id : null,
      gameName: channel?.game_name.trim() ? channel.game_name : null,
      grantedScopes: validation.scopes,
      tokenExpiresInSeconds: Math.min(token.expires_in, validation.expires_in),
      stream: stream === null
        ? { status: "offline", startedAt: null }
        : { status: "live", startedAt: Date.parse(stream.started_at) },
      authorization: {
        accessToken: token.access_token,
        refreshToken: token.refresh_token,
        expiresAt: Date.now() + Math.min(token.expires_in, validation.expires_in) * 1_000,
      },
      eventSub,
    };
  }

  private async createEventSubscriptions(
    broadcasterId: string,
  ): Promise<TwitchOAuthConnection["eventSub"]> {
    const webhook = new URL(this.configuration.eventSubWebhookUrl);
    if (this.configuration.eventSubTransport === "websocket" || webhook.protocol !== "https:") {
      return {
        status: "skipped",
        subscriptionId: null,
        subscriptionIds: [],
        detail: this.configuration.eventSubTransport === "websocket"
          ? "EventSub WebSocket subscriptions are created after the Twitch connection is stored."
          : "EventSub webhook creation requires the deployed HTTPS callback.",
      };
    }
    const appTokenBody = new URLSearchParams({
      client_id: this.configuration.clientId,
      client_secret: this.configuration.clientSecret,
      grant_type: "client_credentials",
    });
    const appToken = appTokenResponseSchema.parse(await parseResponse(await this.request(
      "https://id.twitch.tv/oauth2/token",
      {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: appTokenBody,
        cache: "no-store",
      },
    ), "Twitch app authorization is unavailable"));
    const types = ["channel.chat.message", "stream.online", "stream.offline"] as const;
    const subscriptionIds: string[] = [];
    let chatSubscriptionId: string | null = null;
    for (const type of types) {
      const response = await this.request("https://api.twitch.tv/helix/eventsub/subscriptions", {
        method: "POST",
        headers: {
          authorization: `Bearer ${appToken.access_token}`,
          "client-id": this.configuration.clientId,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          type,
          version: "1",
          condition: type === "channel.chat.message"
            ? {
                broadcaster_user_id: broadcasterId,
                user_id: broadcasterId,
              }
            : { broadcaster_user_id: broadcasterId },
          transport: {
            method: "webhook",
            callback: this.configuration.eventSubWebhookUrl,
            secret: this.configuration.eventSubSecret,
          },
        }),
        cache: "no-store",
      });
      // Twitch returns 409 when the exact subscription already exists. That is
      // an idempotent success for a broadcaster reconnecting the same account.
      if (response.status === 409) continue;
      if (!response.ok) {
        throw new TwitchOAuthError(
          "eventsub-failed",
          `Twitch ${type} subscription could not be created`,
        );
      }
      const subscription = eventSubResponseSchema.parse(await response.json()).data[0];
      subscriptionIds.push(subscription.id);
      if (type === "channel.chat.message") chatSubscriptionId = subscription.id;
    }
    return {
      status: subscriptionIds.length === 0 ? "configured" : "pending",
      subscriptionId: chatSubscriptionId,
      subscriptionIds,
      detail: subscriptionIds.length === 0
        ? "Twitch live status and chat delivery subscriptions already exist."
        : "Twitch live status and chat delivery are configured; new webhooks are being verified.",
    };
  }
}
