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

function health(
  status: ServiceHealth["status"],
  checkedAt: number,
  message: string,
  retryable: boolean,
): ServiceHealth {
  return serviceHealthSchema.parse({
    service: "persistence",
    status,
    checkedAt,
    message,
    retryable,
  });
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
): { readonly url: string; readonly publishableKey: string } {
  return { url: environment.url, publishableKey: environment.publishableKey };
}
