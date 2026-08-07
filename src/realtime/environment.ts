import "server-only";

import { z } from "zod";

import { serviceHealthSchema, type ServiceHealth } from "../core";

const deploymentEnvironmentSchema = z.enum(["local", "preview", "production"]);

const nonEmptySecretSchema = z.string().trim().min(1);

const environmentInputSchema = z
  .object({
    NEXT_PUBLIC_APP_ENV: z.string().optional(),
    NEXT_PUBLIC_SUPABASE_URL: z.string().optional(),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().optional(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
    SUPABASE_SECRET_KEY: z.string().optional(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
    TWITCH_CLIENT_ID: z.string().optional(),
    TWITCH_CLIENT_SECRET: z.string().optional(),
    TWITCH_EXTENSION_CLIENT_ID: z.string().optional(),
    TWITCH_EXTENSION_SECRET: z.string().optional(),
    CHATXPT_OBS_OVERLAY_SETUP_KEY: z.string().optional(),
  })
  .passthrough();

export interface MemoryPersistenceEnvironment {
  readonly mode: "memory";
  readonly deployment: "local" | "preview" | "production";
  readonly health: ServiceHealth;
}

export interface SupabasePersistenceEnvironment {
  readonly mode: "supabase";
  readonly deployment: "local" | "preview" | "production";
  readonly url: string;
  readonly publishableKey: string;
  readonly secretKey: string;
  readonly health: ServiceHealth;
}

export interface MisconfiguredPersistenceEnvironment {
  readonly mode: "misconfigured";
  readonly deployment: "local" | "preview" | "production" | "invalid";
  readonly missing: readonly string[];
  readonly health: ServiceHealth;
}

export type ServerPersistenceEnvironment =
  | MemoryPersistenceEnvironment
  | SupabasePersistenceEnvironment
  | MisconfiguredPersistenceEnvironment;

export interface PublicRealtimeConfiguration {
  readonly url: string;
  readonly publishableKey: string;
}

export interface ServerEnvironmentHealthReport {
  readonly ok: boolean;
  readonly checkedAt: number;
  readonly deployment: "local" | "preview" | "production" | "invalid";
  readonly persistenceMode: ServerPersistenceEnvironment["mode"];
  readonly configurationValid: boolean;
  readonly demoReady: boolean;
  readonly services: readonly ServiceHealth[];
  readonly publicRealtime: PublicRealtimeConfiguration | null;
  readonly limitations: readonly string[];
}

function serviceHealth(
  service: string,
  status: ServiceHealth["status"],
  checkedAt: number,
  message: string,
  retryable: boolean,
): ServiceHealth {
  return serviceHealthSchema.parse({
    service,
    status,
    checkedAt,
    message,
    retryable,
  });
}

function health(
  status: ServiceHealth["status"],
  checkedAt: number,
  message: string,
  retryable: boolean,
): ServiceHealth {
  return serviceHealth("persistence", status, checkedAt, message, retryable);
}

function normalise(value: string | undefined): string | null {
  const parsed = nonEmptySecretSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function resolveServerPersistenceEnvironment(
  source: Record<string, string | undefined>,
  checkedAt = Date.now(),
): ServerPersistenceEnvironment {
  const parsed = environmentInputSchema.parse(source);
  const deploymentResult = deploymentEnvironmentSchema.safeParse(
    parsed.NEXT_PUBLIC_APP_ENV ?? "local",
  );
  if (!deploymentResult.success) {
    return {
      mode: "misconfigured",
      deployment: "invalid",
      missing: ["NEXT_PUBLIC_APP_ENV(local|preview|production)"],
      health: health("misconfigured", checkedAt, "Application environment is invalid", false),
    };
  }
  const deployment = deploymentResult.data;
  const url = normalise(parsed.NEXT_PUBLIC_SUPABASE_URL);
  const publishableKey = normalise(
    parsed.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? parsed.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
  const secretKey = normalise(parsed.SUPABASE_SECRET_KEY ?? parsed.SUPABASE_SERVICE_ROLE_KEY);
  const supplied = [url, publishableKey, secretKey].filter((value) => value !== null).length;

  if (supplied === 0 && deployment === "local") {
    return {
      mode: "memory",
      deployment,
      health: health(
        "ready",
        checkedAt,
        "Credential-free in-memory persistence is active for local development",
        false,
      ),
    };
  }

  const missing = [
    ["NEXT_PUBLIC_SUPABASE_URL", url],
    ["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", publishableKey],
    ["SUPABASE_SECRET_KEY", secretKey],
  ]
    .filter((entry) => entry[1] === null)
    .map((entry) => entry[0] as string);

  if (missing.length > 0) {
    return {
      mode: "misconfigured",
      deployment,
      missing,
      health: health(
        "misconfigured",
        checkedAt,
        `Supabase configuration is incomplete: ${missing.join(", ")}`,
        false,
      ),
    };
  }

  const parsedUrl = z.url().safeParse(url);
  if (!parsedUrl.success) {
    return {
      mode: "misconfigured",
      deployment,
      missing: ["NEXT_PUBLIC_SUPABASE_URL(valid URL)"],
      health: health("misconfigured", checkedAt, "Supabase URL is invalid", false),
    };
  }

  return {
    mode: "supabase",
    deployment,
    url: parsedUrl.data,
    publishableKey: publishableKey as string,
    secretKey: secretKey as string,
    health: health("ready", checkedAt, "Supabase persistence is configured", false),
  };
}

export function publicRealtimeEnvironment(
  environment: SupabasePersistenceEnvironment,
): PublicRealtimeConfiguration {
  return { url: environment.url, publishableKey: environment.publishableKey };
}

function pairedServiceHealth(input: {
  readonly service: string;
  readonly checkedAt: number;
  readonly label: string;
  readonly requiredNames: readonly [string, string];
  readonly values: readonly [string | null, string | null];
}): ServiceHealth {
  const missing = input.requiredNames.filter((_, index) => input.values[index] === null);
  if (missing.length === 0) {
    return serviceHealth(
      input.service,
      "ready",
      input.checkedAt,
      `${input.label} is configured`,
      false,
    );
  }
  if (missing.length === input.requiredNames.length) {
    return serviceHealth(
      input.service,
      "unavailable",
      input.checkedAt,
      `${input.label} is not configured`,
      false,
    );
  }
  return serviceHealth(
    input.service,
    "misconfigured",
    input.checkedAt,
    `${input.label} configuration is incomplete: ${missing.join(", ")}`,
    false,
  );
}

export function resolveServerEnvironmentHealth(
  source: Record<string, string | undefined>,
  checkedAt = Date.now(),
): ServerEnvironmentHealthReport {
  const parsed = environmentInputSchema.parse(source);
  const persistence = resolveServerPersistenceEnvironment(source, checkedAt);
  const publicRealtime =
    persistence.mode === "supabase" ? publicRealtimeEnvironment(persistence) : null;
  const twitchApp = pairedServiceHealth({
    service: "twitch-app",
    checkedAt,
    label: "Twitch application",
    requiredNames: ["TWITCH_CLIENT_ID", "TWITCH_CLIENT_SECRET"],
    values: [normalise(parsed.TWITCH_CLIENT_ID), normalise(parsed.TWITCH_CLIENT_SECRET)],
  });
  const twitchExtension = pairedServiceHealth({
    service: "twitch-extension",
    checkedAt,
    label: "Twitch Extension",
    requiredNames: ["TWITCH_EXTENSION_CLIENT_ID", "TWITCH_EXTENSION_SECRET"],
    values: [
      normalise(parsed.TWITCH_EXTENSION_CLIENT_ID),
      normalise(parsed.TWITCH_EXTENSION_SECRET),
    ],
  });
  const overlaySetupKey = normalise(parsed.CHATXPT_OBS_OVERLAY_SETUP_KEY);
  const obsOverlay = serviceHealth(
    "obs-overlay",
    overlaySetupKey === null ? "unavailable" : "ready",
    checkedAt,
    overlaySetupKey === null
      ? "OBS overlay setup key is not configured"
      : "OBS overlay setup grant key is configured",
    false,
  );
  const services = [persistence.health, twitchApp, twitchExtension, obsOverlay];
  const configurationValid = services.every((service) => service.status !== "misconfigured");
  const demoReady =
    persistence.deployment === "local"
      ? configurationValid
      : configurationValid && services.every((service) => service.status === "ready");

  return {
    ok: demoReady,
    checkedAt,
    deployment: persistence.deployment,
    persistenceMode: persistence.mode,
    configurationValid,
    demoReady,
    services,
    publicRealtime,
    limitations: [
      "Health reports configuration only; it does not prove a live Supabase realtime round trip.",
      "Local health may use credential-free fallbacks, but preview and production are not demo-ready until persistence, Twitch, Extension, and OBS setup services are ready.",
      "No server secrets are included in this response.",
    ],
  };
}

export function statusForServerEnvironmentHealth(
  report: ServerEnvironmentHealthReport,
): 200 | 503 {
  return report.ok ? 200 : 503;
}
