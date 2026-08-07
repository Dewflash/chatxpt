import { serviceHealthSchema, type ServiceHealth } from "../../core";

export const TWITCH_OAUTH_CALLBACK_PATH = "/api/twitch/oauth/callback";
export const TWITCH_EXTENSION_VIEWER_PATH = "/twitch/viewer";
export const TWITCH_EXTENSION_CONFIG_PATH = "/twitch/config";
export const TWITCH_EXTENSION_LIVE_CONFIG_PATH = "/twitch/live-config";
export const TWITCH_LOCAL_CALLBACK_URL = "http://localhost:3000/api/twitch/oauth/callback";
export const TWITCH_REGISTRATION_DECISION_ID = "D-055";
export const TWITCH_EXTENSION_VIEW_DECISION_ID = "D-056";
export const TWITCH_EXTENSION_PANEL_HEIGHT_PX = 496;

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
      readonly status: "accepted";
      readonly decisionId: typeof TWITCH_REGISTRATION_DECISION_ID;
      readonly configured: readonly string[];
      readonly note: string;
    };
    readonly callbackUrls: readonly string[];
    readonly tokenExchange: "reserved-disabled";
    readonly deferredRuntimeScopeProfiles: readonly {
      readonly name: string;
      readonly status: "deferred-runtime";
      readonly scopes: readonly string[];
      readonly reason: string;
    }[];
  };
  readonly extension: {
    readonly viewerPath: typeof TWITCH_EXTENSION_VIEWER_PATH;
    readonly viewerUrl: string | null;
    readonly viewPolicy: {
      readonly status: "accepted";
      readonly decisionId: typeof TWITCH_EXTENSION_VIEW_DECISION_ID;
      readonly selectedTypes: readonly ["Panel", "Mobile"];
      readonly panelHeightPx: typeof TWITCH_EXTENSION_PANEL_HEIGHT_PX;
      readonly viewerPaths: readonly {
        readonly twitchField: "Panel Viewer Path" | "Mobile Viewer Path";
        readonly value: typeof TWITCH_EXTENSION_VIEWER_PATH;
        readonly url: string | null;
      }[];
      readonly unselectedTypes: readonly {
        readonly twitchLabel: "Video - Fullscreen" | "Video - Component";
        readonly reason: string;
      }[];
      readonly notes: readonly string[];
    };
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

const eventSubChatApiScopes = [
  "user:read:chat",
  "user:write:chat",
  "user:bot",
  "channel:bot",
] as const;

const ircFallbackScopes = [
  "chat:read",
  "chat:edit",
] as const;

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
      callbackUrls: [
        ...(callbackUrlFor(baseUrl) === null ? [] : [callbackUrlFor(baseUrl)!]),
        TWITCH_LOCAL_CALLBACK_URL,
      ],
      scopes: {
        status: "accepted",
        decisionId: TWITCH_REGISTRATION_DECISION_ID,
        configured: [],
        note: "Initial Twitch app registration requests no OAuth scopes because token exchange is disabled until the chat/EventSub adapter is implemented and tested.",
      },
      tokenExchange: "reserved-disabled",
      deferredRuntimeScopeProfiles: [
        {
          name: "eventsub-chat-api",
          status: "deferred-runtime",
          scopes: eventSubChatApiScopes,
          reason: "Use for the later Twitch chat/EventSub adapter if ChatXPT reads and sends chat through the modern EventSub/API path.",
        },
        {
          name: "irc-fallback",
          status: "deferred-runtime",
          scopes: ircFallbackScopes,
          reason: "Use only if Role 1 deliberately enables a legacy IRC fallback instead of the EventSub/API chat path.",
        },
      ],
    },
    extension: {
      viewerPath: TWITCH_EXTENSION_VIEWER_PATH,
      viewerUrl: pathUrlFor(baseUrl, TWITCH_EXTENSION_VIEWER_PATH),
      viewPolicy: {
        status: "accepted",
        decisionId: TWITCH_EXTENSION_VIEW_DECISION_ID,
        selectedTypes: ["Panel", "Mobile"],
        panelHeightPx: TWITCH_EXTENSION_PANEL_HEIGHT_PX,
        viewerPaths: [
          {
            twitchField: "Panel Viewer Path",
            value: TWITCH_EXTENSION_VIEWER_PATH,
            url: pathUrlFor(baseUrl, TWITCH_EXTENSION_VIEWER_PATH),
          },
          {
            twitchField: "Mobile Viewer Path",
            value: TWITCH_EXTENSION_VIEWER_PATH,
            url: pathUrlFor(baseUrl, TWITCH_EXTENSION_VIEWER_PATH),
          },
        ],
        unselectedTypes: [
          {
            twitchLabel: "Video - Fullscreen",
            reason:
              "OBS Browser Source remains the MVP broadcast overlay path, so the Twitch Extension is not activated as a full-video overlay.",
          },
          {
            twitchLabel: "Video - Component",
            reason:
              "The MVP voting surface targets compact panel and mobile contexts; partial-video component placement is deferred until Role 5 asks for it.",
          },
        ],
        notes: [
          "Use one viewer route for Panel and Mobile so Role 5 can keep the voting surface consistent across Twitch clients.",
          "Keep the Panel height at 496px to match the compact Role 5 target while staying inside Twitch's panel-height range.",
          "Config remains install-time setup, while Live Config remains the streamer dashboard control surface.",
        ],
      },
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
      "Configured team-controlled broadcaster test channel and allowlisted team viewer accounts",
      "Evidence manifest entry before claiming live Twitch readiness",
    ],
    limitations: [
      "This manifest is a copy-safe registration checklist, not evidence that Twitch accepted the configuration.",
      "OAuth token exchange remains disabled in this build.",
      "Initial registration intentionally requests no OAuth scopes; runtime chat scopes are deferred until the Twitch adapter enables that path.",
      "No Twitch secrets are included in this response.",
    ],
  };
}
