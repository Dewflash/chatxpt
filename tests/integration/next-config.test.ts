import { describe, expect, it } from "vitest";

import nextConfig from "../../next.config";

async function configuredHeaders() {
  if (typeof nextConfig.headers !== "function") {
    throw new TypeError("nextConfig.headers must be configured");
  }
  return nextConfig.headers();
}

describe("Role 1 deployment headers", () => {
  it("publishes a CSP that permits bounded browser OCR workers without broad network access", async () => {
    const headers = await configuredHeaders();
    const root = headers.find(({ source }) => source === "/(.*)");
    expect(root).toBeDefined();
    const csp = root?.headers.find(({ key }) => key === "Content-Security-Policy")?.value;

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
    expect(csp).toContain("https://extension-files.twitch.tv");
    expect(csp).toContain("https://supervisor.ext-twitch.tv");
    expect(csp).toContain("https://localhost.twitch.tv:*");
    expect(csp).toContain("http://localhost.rig.twitch.tv:*");
    expect(csp?.split(/\s+/)).not.toContain("*");
    expect(csp).not.toContain("TWITCH_CLIENT_SECRET");
    expect(csp).not.toContain("SUPABASE_SECRET_KEY");
  });

  it("sets baseline browser hardening headers while preserving OBS camera permission", async () => {
    const headers = await configuredHeaders();
    const root = headers.find(({ source }) => source === "/(.*)");
    const byName = new Map(root?.headers.map((header) => [header.key, header.value]));

    expect(byName.get("X-Content-Type-Options")).toBe("nosniff");
    expect(byName.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(byName.get("Permissions-Policy")).toBe(
      "camera=(self), microphone=(), geolocation=(), payment=()",
    );
  });
});
