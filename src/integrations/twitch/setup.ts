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

export interface TwitchSetupRegistrationManifest {
  readonly ok: boolean;
  readonly baseUrl: string | null;
  readonly oauth: {
    readonly callbackPath: typeof TWITCH_OAUTH_CALLBACK_PATH;
    readonly callbackUrl: string | null;
    readonly scopes: {
      readonly status: "open-decision";
      readonly decisionId: "D1-07";
      readonly configured: readonly string[];
      readonly note: string;
    };
    readonly tokenExchange: "reserved-disabled";
  };
  readonly extension: {
    readonly viewerPath: typeof TWITCH_EXTENSION_VIEWER_PATH;
    readonly viewerUrl: string | null;
    readonly configPath: typeof TWITCH_EXTENSION_CONFIG_PATH;
    readonly configUrl: string | null;
    readonly liveConfigPath: typeof TWITCH_EXTENSION_LIVE_CONFIG_PATH;
    readonly liveConfigUrl: string | null;
    readonly status: "reserved-shells";
  };
  readonly requiredEnvironment: readonly {
    readonly name: string;
    readonly configured: boolean;
    readonly serverOnly: boolean;
  }[];
  readonly evidenceRequired: readonly string[];
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

function pathUrlFor(baseUrl: string | null, path: string): string | null {
  if (baseUrl === null) return null;
  const parsed = new URL(baseUrl);
  return new URL(path, parsed).toString();
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

export function resolveTwitchSetupRegistrationManifest(
  source: Record<string, string | undefined>,
  options: { readonly baseUrl?: string | null } = {},
): TwitchSetupRegistrationManifest {
  const baseUrl = options.baseUrl ?? normalise(source.CHATXPT_PUBLIC_BASE_URL);
  const requiredEnvironment = [
    { name: "TWITCH_CLIENT_ID", configured: normalise(source.TWITCH_CLIENT_ID) !== null, serverOnly: false },
    { name: "TWITCH_CLIENT_SECRET", configured: normalise(source.TWITCH_CLIENT_SECRET) !== null, serverOnly: true },
    {
      name: "TWITCH_EXTENSION_CLIENT_ID",
      configured: normalise(source.TWITCH_EXTENSION_CLIENT_ID) !== null,
      serverOnly: false,
    },
    {
      name: "TWITCH_EXTENSION_SECRET",
      configured: normalise(source.TWITCH_EXTENSION_SECRET) !== null,
      serverOnly: true,
    },
    {
      name: "CHATXPT_PUBLIC_BASE_URL",
      configured: baseUrl !== null,
      serverOnly: false,
    },
  ];

  return {
    ok: baseUrl !== null,
    baseUrl,
    oauth: {
      callbackPath: TWITCH_OAUTH_CALLBACK_PATH,
      callbackUrl: callbackUrlFor(baseUrl),
      scopes: {
        status: "open-decision",
        decisionId: "D1-07",
        configured: [],
        note: "OAuth scopes, callback URL allowlist, and test-channel allowlist remain a Role 1 decision gate before token exchange is enabled.",
      },
      tokenExchange: "reserved-disabled",
    },
    extension: {
      viewerPath: TWITCH_EXTENSION_VIEWER_PATH,
      viewerUrl: pathUrlFor(baseUrl, TWITCH_EXTENSION_VIEWER_PATH),
      configPath: TWITCH_EXTENSION_CONFIG_PATH,
      configUrl: pathUrlFor(baseUrl, TWITCH_EXTENSION_CONFIG_PATH),
      liveConfigPath: TWITCH_EXTENSION_LIVE_CONFIG_PATH,
      liveConfigUrl: pathUrlFor(baseUrl, TWITCH_EXTENSION_LIVE_CONFIG_PATH),
      status: "reserved-shells",
    },
    requiredEnvironment,
    evidenceRequired: [
      "Twitch developer-console app registration",
      "Twitch Extension Local or Hosted Test",
      "Configured test channel and allowlisted viewers",
      "Evidence manifest entry before claiming live Twitch readiness",
    ],
    limitations: [
      "This manifest is a copy-safe registration checklist, not evidence that Twitch accepted the configuration.",
      "OAuth token exchange remains disabled in this build.",
      "OAuth scopes are intentionally not selected here because D1-07 is still open.",
      "No Twitch secrets are included in this response.",
    ],
  };
}
