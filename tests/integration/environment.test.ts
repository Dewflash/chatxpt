import { describe, expect, it } from "vitest";

import {
  PersistenceConfigurationError,
  createConfiguredPersistenceRuntime,
  publicRealtimeEnvironment,
  resolveServerEnvironmentHealth,
  resolveServerPersistenceEnvironment,
  statusForServerEnvironmentHealth,
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

  it("summarises safe deployment health without requiring local credentials", () => {
    const report = resolveServerEnvironmentHealth(
      { NEXT_PUBLIC_APP_ENV: "local" },
      CHECKED_AT,
    );

    expect(report).toMatchObject({
      ok: true,
      checkedAt: CHECKED_AT,
      deployment: "local",
      persistenceMode: "memory",
      publicRealtime: null,
    });
    expect(report.services.map(({ service, status }) => [service, status])).toEqual([
      ["persistence", "ready"],
      ["twitch-app", "unavailable"],
      ["twitch-extension", "unavailable"],
      ["obs-overlay", "unavailable"],
    ]);
    expect(statusForServerEnvironmentHealth(report)).toBe(200);
  });

  it("exposes only public realtime config when Supabase preview is configured", () => {
    const report = resolveServerEnvironmentHealth(
      {
        NEXT_PUBLIC_APP_ENV: "preview",
        NEXT_PUBLIC_SUPABASE_URL: "https://fixture.supabase.co",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture",
        SUPABASE_SECRET_KEY: "sb_secret_fixture",
        TWITCH_CLIENT_ID: "fixture-client",
        TWITCH_CLIENT_SECRET: "fixture-client-secret",
        TWITCH_EXTENSION_CLIENT_ID: "fixture-extension",
        TWITCH_EXTENSION_SECRET: "fixture-extension-secret",
        CHATXPT_OBS_OVERLAY_SETUP_KEY: "fixture-overlay-secret",
      },
      CHECKED_AT,
    );

    expect(report.ok).toBe(true);
    expect(report.persistenceMode).toBe("supabase");
    expect(report.publicRealtime).toEqual({
      url: "https://fixture.supabase.co",
      publishableKey: "sb_publishable_fixture",
    });
    expect(report.services.every(({ status }) => status === "ready")).toBe(true);
    const serialized = JSON.stringify(report);
    expect(serialized).not.toContain("sb_secret_fixture");
    expect(serialized).not.toContain("fixture-client-secret");
    expect(serialized).not.toContain("fixture-extension-secret");
    expect(serialized).not.toContain("fixture-overlay-secret");
  });

  it("marks partial service configuration as unhealthy", () => {
    const report = resolveServerEnvironmentHealth(
      {
        NEXT_PUBLIC_APP_ENV: "preview",
        NEXT_PUBLIC_SUPABASE_URL: "https://fixture.supabase.co",
        TWITCH_CLIENT_ID: "fixture-client",
      },
      CHECKED_AT,
    );

    expect(report.ok).toBe(false);
    expect(statusForServerEnvironmentHealth(report)).toBe(503);
    expect(report.services).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ service: "persistence", status: "misconfigured" }),
        expect.objectContaining({ service: "twitch-app", status: "misconfigured" }),
      ]),
    );
  });
});
