import { describe, expect, it } from "vitest";

import nextConfig from "../../next.config";

type HeaderRule = {
  readonly source: string;
  readonly headers: readonly { readonly key: string; readonly value: string }[];
};

function headerValue(rule: HeaderRule, key: string): string | null {
  return rule.headers.find((header) => header.key.toLowerCase() === key.toLowerCase())?.value ?? null;
}

describe("deployment configuration", () => {
  it("sets safe global headers without blocking Twitch or OBS embedding", async () => {
    const rules = await nextConfig.headers?.();
    expect(rules).toBeDefined();
    const global = rules?.find((rule) => rule.source === "/:path*") as HeaderRule | undefined;
    expect(global).toBeDefined();
    if (global === undefined) return;

    expect(headerValue(global, "X-Content-Type-Options")).toBe("nosniff");
    expect(headerValue(global, "Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(headerValue(global, "Permissions-Policy")).toContain("camera=(self)");
    expect(headerValue(global, "X-Frame-Options")).toBeNull();
    const csp = headerValue(global, "Content-Security-Policy");
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain(
      "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://extension-files.twitch.tv",
    );
    expect(csp).toContain("worker-src 'self' blob:");
    expect(csp).toContain(
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.twitch.tv wss://pubsub-edge.twitch.tv",
    );
    expect(csp).toContain(
      "frame-ancestors 'self' https://supervisor.ext-twitch.tv https://extension-files.twitch.tv https://*.twitch.tv https://*.twitch.tech https://localhost.twitch.tv:* https://localhost.twitch.tech:* http://localhost.rig.twitch.tv:* https://*.twitch-ext.rootonline.de",
    );
    expect(csp?.split(/\s+/)).not.toContain("*");
    expect(csp).not.toContain("TWITCH_CLIENT_SECRET");
    expect(csp).not.toContain("SUPABASE_SECRET_KEY");
  });

  it("keeps deployment health responses uncached", async () => {
    const rules = await nextConfig.headers?.();
    const health = rules?.find((rule) => rule.source === "/api/health/deployment") as HeaderRule | undefined;
    expect(health).toBeDefined();
    if (health === undefined) return;

    expect(headerValue(health, "Cache-Control")).toBe("no-store");
  });
});
