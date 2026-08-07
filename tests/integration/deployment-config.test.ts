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
    expect(headerValue(global, "Content-Security-Policy")).toBeNull();
  });

  it("keeps deployment health responses uncached", async () => {
    const rules = await nextConfig.headers?.();
    const health = rules?.find((rule) => rule.source === "/api/health/deployment") as HeaderRule | undefined;
    expect(health).toBeDefined();
    if (health === undefined) return;

    expect(headerValue(health, "Cache-Control")).toBe("no-store");
  });
});
