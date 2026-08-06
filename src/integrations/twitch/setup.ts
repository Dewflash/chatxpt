import { serviceHealthSchema, type ServiceHealth } from "../../core";

export const TWITCH_OAUTH_CALLBACK_PATH = "/api/twitch/oauth/callback";
export const TWITCH_EXTENSION_VIEWER_PATH = "/twitch/viewer";
export const TWITCH_EXTENSION_CONFIG_PATH = "/twitch/config";
export const TWITCH_EXTENSION_LIVE_CONFIG_PATH = "/twitch/live-config";

export interface TwitchSetupReadiness {
  readonly ok: boolean;
  readonly callbackPath: typeof TWITCH_OAUTH_CALLBACK_PATH;
  readonly callbackUrl: string | null;
  readonly extensionPaths: {
    readonly viewer: typeof TWITCH_EXTENSION_VIEWER_PATH;
    readonly config: typeof TWITCH_EXTENSION_CONFIG_PATH;
    readonly liveConfig: typeof TWITCH_EXTENSION_LIVE_CONFIG_PATH;
  };
  readonly services: readonly ServiceHealth[];
  readonly missing: readonly string[];
  readonly limitations: readonly string[];
}

function normalise(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed === undefined || trimmed.length === 0 ? null : trimmed;
}

function serviceHealth(input: {
  readonly service: string;
  readonly status: ServiceHealth["status"];
  readonly checkedAt: number;
  readonly message: string;
  readonly retryable: boolean;
}): ServiceHealth {
  return serviceHealthSchema.parse(input);
}

function pairedService(input: {
  readonly service: string;
  readonly checkedAt: number;
  readonly publicValue: string | null;
  readonly secretValue: string | null;
  readonly publicName: string;
  readonly secretName: string;
}): { readonly health: ServiceHealth; readonly missing: readonly string[] } {
  const entries: ReadonlyArray<readonly [string, string | null]> = [
    [input.publicName, input.publicValue],
    [input.secretName, input.secretValue],
  ];
  const missing = entries
    .filter(([, value]) => value === null)
    .map(([name]) => name);

  if (missing.length === 0) {
    return {
      missing,
      health: serviceHealth({
        service: input.service,
        status: "ready",
        checkedAt: input.checkedAt,
        message: `${input.service} credentials are configured`,
        retryable: false,
      }),
    };
  }

  const status = missing.length === 2 ? "unavailable" : "misconfigured";
  return {
    missing,
    health: serviceHealth({
      service: input.service,
      status,
      checkedAt: input.checkedAt,
      message:
        status === "unavailable"
          ? `${input.service} credentials are not configured`
          : `${input.service} credentials are partially configured`,
      retryable: false,
    }),
  };
}

function callbackUrlFor(baseUrl: string | null): string | null {
  if (baseUrl === null) return null;
  const parsed = new URL(baseUrl);
  return new URL(TWITCH_OAUTH_CALLBACK_PATH, parsed).toString();
}

export function resolveTwitchSetupReadiness(
  source: Record<string, string | undefined>,
  options: { readonly baseUrl?: string | null; readonly checkedAt?: number } = {},
): TwitchSetupReadiness {
  const checkedAt = options.checkedAt ?? Date.now();
  const app = pairedService({
    service: "twitch-app",
    checkedAt,
    publicName: "TWITCH_CLIENT_ID",
    secretName: "TWITCH_CLIENT_SECRET",
    publicValue: normalise(source.TWITCH_CLIENT_ID),
    secretValue: normalise(source.TWITCH_CLIENT_SECRET),
  });
  const extension = pairedService({
    service: "twitch-extension",
    checkedAt,
    publicName: "TWITCH_EXTENSION_CLIENT_ID",
    secretName: "TWITCH_EXTENSION_SECRET",
    publicValue: normalise(source.TWITCH_EXTENSION_CLIENT_ID),
    secretValue: normalise(source.TWITCH_EXTENSION_SECRET),
  });
  const services = [app.health, extension.health];

  return {
    ok: services.every((service) => service.status === "ready"),
    callbackPath: TWITCH_OAUTH_CALLBACK_PATH,
    callbackUrl: callbackUrlFor(options.baseUrl ?? normalise(source.CHATXPT_PUBLIC_BASE_URL)),
    extensionPaths: {
      viewer: TWITCH_EXTENSION_VIEWER_PATH,
      config: TWITCH_EXTENSION_CONFIG_PATH,
      liveConfig: TWITCH_EXTENSION_LIVE_CONFIG_PATH,
    },
    services,
    missing: [...app.missing, ...extension.missing],
    limitations: [
      "This readiness report validates configuration shape only; it does not prove Twitch developer-console access.",
      "The OAuth callback route is reserved but token exchange remains disabled until Role 1 configures Twitch credentials.",
      "Twitch Extension Local or Hosted Test evidence must be recorded separately from this readiness check.",
      "No Twitch secrets are included in this response.",
    ],
  };
}
