import { describe, expect, it } from "vitest";

import {
  PersistenceConfigurationError,
  createConfiguredPersistenceRuntime,
  resolveDeploymentHealthReport,
  publicRealtimeEnvironment,
  resolveServerPersistenceEnvironment,
} from "../../src/realtime/server";

const CHECKED_AT = 1_786_000_000_000;

describe("Role 1 persistence environment", () => {
  it("uses credential-free memory mode only for a completely unconfigured local environment", () => {
    const environment = resolveServerPersistenceEnvironment(
      { NEXT_PUBLIC_APP_ENV: "local" },
      CHECKED_AT,
    );

    expect(environment.mode).toBe("memory");
    expect(environment.health.status).toBe("ready");
  });

  it("lets local development explicitly bypass configured Supabase with the memory fallback", () => {
    const environment = resolveServerPersistenceEnvironment(
      {
        NEXT_PUBLIC_APP_ENV: "local",
        CHATXPT_PERSISTENCE_MODE: "memory",
        NEXT_PUBLIC_SUPABASE_URL: "https://fixture.supabase.co",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture",
        SUPABASE_SECRET_KEY: "sb_secret_fixture",
      },
      CHECKED_AT,
    );

    expect(environment).toMatchObject({
      mode: "memory",
      deployment: "local",
      health: {
        status: "degraded",
        message: "Local fallback persistence is active; Supabase is bypassed",
      },
    });
    expect(createConfiguredPersistenceRuntime(environment).mode).toBe("memory");
  });

  it("does not allow process-local persistence to be forced in hosted environments", () => {
    const environment = resolveServerPersistenceEnvironment(
      {
        NEXT_PUBLIC_APP_ENV: "preview",
        CHATXPT_PERSISTENCE_MODE: "memory",
      },
      CHECKED_AT,
    );

    expect(environment).toMatchObject({
      mode: "misconfigured",
      deployment: "preview",
      missing: ["CHATXPT_PERSISTENCE_MODE(auto in preview|production)"],
    });
  });

  it("fails closed when Supabase configuration is partial", () => {
    const environment = resolveServerPersistenceEnvironment(
      {
        NEXT_PUBLIC_APP_ENV: "preview",
        NEXT_PUBLIC_SUPABASE_URL: "https://fixture.supabase.co",
      },
      CHECKED_AT,
    );

    expect(environment.mode).toBe("misconfigured");
    if (environment.mode !== "misconfigured") return;
    expect(environment.missing).toEqual([
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      "SUPABASE_SECRET_KEY",
    ]);
    expect(environment.health.status).toBe("misconfigured");
  });

  it("fails closed on an invalid deployment name instead of silently selecting local memory", () => {
    const environment = resolveServerPersistenceEnvironment(
      { NEXT_PUBLIC_APP_ENV: "prodution" },
      CHECKED_AT,
    );

    expect(environment.mode).toBe("misconfigured");
    expect(environment.deployment).toBe("invalid");
  });

  it("accepts current key names and exposes only public realtime configuration", () => {
    const environment = resolveServerPersistenceEnvironment(
      {
        NEXT_PUBLIC_APP_ENV: "preview",
        NEXT_PUBLIC_SUPABASE_URL: "https://fixture.supabase.co",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture",
        SUPABASE_SECRET_KEY: "sb_secret_fixture",
      },
      CHECKED_AT,
    );

    expect(environment.mode).toBe("supabase");
    if (environment.mode !== "supabase") return;
    expect(publicRealtimeEnvironment(environment)).toEqual({
      url: "https://fixture.supabase.co",
      publishableKey: "sb_publishable_fixture",
    });
    expect(JSON.stringify(publicRealtimeEnvironment(environment))).not.toContain("sb_secret_fixture");
  });

  it("supports legacy anon and service-role key names during Supabase migration", () => {
    const environment = resolveServerPersistenceEnvironment({
      NEXT_PUBLIC_APP_ENV: "preview",
      NEXT_PUBLIC_SUPABASE_URL: "https://fixture.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "legacy-anon",
      SUPABASE_SERVICE_ROLE_KEY: "legacy-service-role",
    });

    expect(environment.mode).toBe("supabase");
  });

  it("builds the local runtime but refuses to compose a misconfigured preview", () => {
    const local = resolveServerPersistenceEnvironment({ NEXT_PUBLIC_APP_ENV: "local" });
    expect(createConfiguredPersistenceRuntime(local).mode).toBe("memory");

    const preview = resolveServerPersistenceEnvironment({ NEXT_PUBLIC_APP_ENV: "preview" });
    expect(() => createConfiguredPersistenceRuntime(preview)).toThrow(PersistenceConfigurationError);
  });

  it("reports deployment health without exposing keys", () => {
    const local = resolveDeploymentHealthReport({ NEXT_PUBLIC_APP_ENV: "local" }, CHECKED_AT);
    expect(local).toMatchObject({
      checkedAt: CHECKED_AT,
      deployment: "local",
      persistence: { mode: "memory", status: "ready" },
      publicRealtime: { configured: false },
      gameplayIngress: { configured: false },
    });

    const preview = resolveDeploymentHealthReport(
      {
        NEXT_PUBLIC_APP_ENV: "preview",
        NEXT_PUBLIC_SUPABASE_URL: "https://fixture.supabase.co",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture",
        SUPABASE_SECRET_KEY: "sb_secret_fixture",
        CHATXPT_GAMEPLAY_INGRESS_SETUP_KEY: "fixture-gameplay-ingress-key-0123456789abcdef",
      },
      CHECKED_AT,
    );
    expect(preview).toMatchObject({
      deployment: "preview",
      persistence: { mode: "supabase", status: "ready" },
      publicRealtime: { configured: true, url: "https://fixture.supabase.co" },
      gameplayIngress: { configured: true },
    });
    expect(JSON.stringify(preview)).not.toContain("sb_secret_fixture");
    expect(JSON.stringify(preview)).not.toContain("sb_publishable_fixture");
    expect(JSON.stringify(preview)).not.toContain("fixture-gameplay-ingress-key");

    const broken = resolveDeploymentHealthReport({ NEXT_PUBLIC_APP_ENV: "preview" }, CHECKED_AT);
    expect(broken.persistence).toMatchObject({
      mode: "misconfigured",
      status: "misconfigured",
      missing: [
        "NEXT_PUBLIC_SUPABASE_URL",
        "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
        "SUPABASE_SECRET_KEY",
      ],
    });
  });
});
