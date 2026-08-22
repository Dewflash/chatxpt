import { afterEach, describe, expect, it, vi } from "vitest";

import { realtimePublicConfiguration } from "./realtime-access";

describe("realtime public configuration", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("keeps credential-free local mode on the recovery read path", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_ENV", "local");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
    vi.stubEnv("SUPABASE_SECRET_KEY", "");

    expect(realtimePublicConfiguration()).toEqual({ enabled: false });
  });

  it("returns only the public Supabase connection values", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_ENV", "preview");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://fixture.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_fixture");
    vi.stubEnv("SUPABASE_SECRET_KEY", "sb_secret_must-never-leak");

    const config = realtimePublicConfiguration();
    expect(config).toEqual({
      enabled: true,
      url: "https://fixture.supabase.co",
      publishableKey: "sb_publishable_fixture",
    });
    expect(JSON.stringify(config)).not.toContain("sb_secret");
  });
});
