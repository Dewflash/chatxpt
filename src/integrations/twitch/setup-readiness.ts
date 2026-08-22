import { serviceHealthSchema, type ServiceHealth } from "../../core";

export const TWITCH_OAUTH_CALLBACK_PATH = "/api/twitch/oauth/callback" as const;
export const TWITCH_SETUP_READINESS_PATH = "/api/twitch/setup/readiness" as const;
export const TWITCH_EVENTSUB_WEBHOOK_PATH = "/api/twitch/eventsub" as const;

export const TWITCH_EXTENSION_VIEWER_PATH = "/viewer.html" as const;
export const TWITCH_EXTENSION_CONFIG_PATH = "/config.html" as const;
export const TWITCH_EXTENSION_LIVE_CONFIG_PATH = "/live-config.html" as const;
export const TWITCH_EXTENSION_HELPER_SCRIPT_URL =
  "https://extension-files.twitch.tv/helper/v1/twitch-ext.min.js" as const;

export interface TwitchSetupReadiness {
  readonly ok: boolean;
  readonly callbackPath: typeof TWITCH_OAUTH_CALLBACK_PATH;
  readonly callbackUrl: string | null;
  readonly eventSubWebhookPath: typeof TWITCH_EVENTSUB_WEBHOOK_PATH;
  readonly eventSubWebhookUrl: string | null;
  readonly extensionPaths: {
    readonly viewer: typeof TWITCH_EXTENSION_VIEWER_PATH;
    readonly config: typeof TWITCH_EXTENSION_CONFIG_PATH;
    readonly liveConfig: typeof TWITCH_EXTENSION_LIVE_CONFIG_PATH;
  };
  readonly helperScriptUrl: typeof TWITCH_EXTENSION_HELPER_SCRIPT_URL;
  readonly missing: readonly string[];
  readonly services: readonly ServiceHealth[];
  readonly limitations: readonly string[];
}

function hasValue(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function health(
  service: string,
  status: ServiceHealth["status"],
  checkedAt: number,
  message: string,
): ServiceHealth {
  return serviceHealthSchema.parse({
    service,
    status,
    checkedAt,
    message,
    retryable: status !== "ready",
  });
}

function normaliseBaseUrl(baseUrl: string | undefined): string | null {
  if (!hasValue(baseUrl)) return null;
  const parsed = URL.canParse(baseUrl as string) ? new URL(baseUrl as string) : null;
  if (parsed === null) return null;
  parsed.pathname = "";
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString().replace(/\/$/, "");
}

export function resolveTwitchSetupReadiness(
  source: Record<string, string | undefined>,
  options: { readonly baseUrl?: string; readonly checkedAt?: number } = {},
): TwitchSetupReadiness {
  const checkedAt = options.checkedAt ?? Date.now();
  const baseUrl = normaliseBaseUrl(options.baseUrl);
  const configuredTransport = source.CHATXPT_TWITCH_EVENTSUB_TRANSPORT?.trim().toLowerCase();
  const parsedBaseUrl = baseUrl === null ? null : new URL(baseUrl);
  const localHttp = parsedBaseUrl?.protocol === "http:" &&
    ["localhost", "127.0.0.1", "[::1]"].includes(parsedBaseUrl.hostname);
  const websocketEventSub = configuredTransport === "websocket" ||
    (configuredTransport !== "webhook" && (localHttp || source.NEXT_PUBLIC_APP_ENV === "local"));
  const required = [
    ["TWITCH_CLIENT_ID", source.TWITCH_CLIENT_ID],
    ["TWITCH_CLIENT_SECRET", source.TWITCH_CLIENT_SECRET],
    ["TWITCH_EXTENSION_CLIENT_ID", source.TWITCH_EXTENSION_CLIENT_ID],
    ["TWITCH_EXTENSION_SECRET", source.TWITCH_EXTENSION_SECRET],
    ...(websocketEventSub
      ? []
      : [["TWITCH_EVENTSUB_SECRET", source.TWITCH_EVENTSUB_SECRET] as const]),
  ] as const;
  const missing = required.filter(([, value]) => !hasValue(value)).map(([name]) => name);
  const appReady = !missing.includes("TWITCH_CLIENT_ID") && !missing.includes("TWITCH_CLIENT_SECRET");
  const extensionReady =
    !missing.includes("TWITCH_EXTENSION_CLIENT_ID") &&
    !missing.includes("TWITCH_EXTENSION_SECRET");
  const eventSubReady = websocketEventSub || !missing.includes("TWITCH_EVENTSUB_SECRET");

  return {
    ok: missing.length === 0,
    callbackPath: TWITCH_OAUTH_CALLBACK_PATH,
    callbackUrl: baseUrl === null ? null : `${baseUrl}${TWITCH_OAUTH_CALLBACK_PATH}`,
    eventSubWebhookPath: TWITCH_EVENTSUB_WEBHOOK_PATH,
    eventSubWebhookUrl: baseUrl === null ? null : `${baseUrl}${TWITCH_EVENTSUB_WEBHOOK_PATH}`,
    extensionPaths: {
      viewer: TWITCH_EXTENSION_VIEWER_PATH,
      config: TWITCH_EXTENSION_CONFIG_PATH,
      liveConfig: TWITCH_EXTENSION_LIVE_CONFIG_PATH,
    },
    helperScriptUrl: TWITCH_EXTENSION_HELPER_SCRIPT_URL,
    missing,
    services: [
      health(
        "twitch-app",
        appReady ? "ready" : "misconfigured",
        checkedAt,
        appReady ? "Twitch application credentials are configured" : "Twitch application credentials are missing",
      ),
      health(
        "twitch-extension",
        extensionReady ? "ready" : "misconfigured",
        checkedAt,
        extensionReady ? "Twitch Extension credentials are configured" : "Twitch Extension credentials are missing",
      ),
      health(
        "twitch-eventsub-chat",
        eventSubReady ? "ready" : "misconfigured",
        checkedAt,
        eventSubReady
          ? websocketEventSub
            ? "Twitch EventSub WebSocket delivery is configured for localhost"
            : "Twitch EventSub webhook verification is configured"
          : "Twitch EventSub webhook secret is missing",
      ),
    ],
    limitations: [
      "No Twitch secrets are included in this response or rendered route.",
      websocketEventSub
        ? "Studio stores localhost Twitch authorization encrypted server-side and restores EventSub WebSocket delivery after restart."
        : "Studio creates the OAuth chat subscription; the viewer EBS verifies Extension JWTs and the chat webhook verifies every EventSub HMAC delivery.",
      "Twitch Asset Hosting compliance, Local Test, or Hosted Test evidence must be recorded separately before Twitch is described as live.",
    ],
  };
}
