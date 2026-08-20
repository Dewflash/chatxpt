import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  TwitchExtensionRouteShell,
  twitchOAuthCallbackGET,
  twitchSetupReadinessGET,
} from "../../src/app";
import {
  TWITCH_EXTENSION_CONFIG_PATH,
  TWITCH_EXTENSION_HELPER_SCRIPT_URL,
  TWITCH_EXTENSION_LIVE_CONFIG_PATH,
  TWITCH_EXTENSION_VIEWER_PATH,
  TWITCH_EVENTSUB_WEBHOOK_PATH,
  TWITCH_OAUTH_CALLBACK_PATH,
  resolveTwitchSetupReadiness,
} from "../../src/integrations";

const CHECKED_AT = 1_786_300_000_000;

describe("Twitch setup readiness", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("reports unavailable setup without leaking Twitch secrets", () => {
    const readiness = resolveTwitchSetupReadiness(
      {},
      {
        baseUrl: "https://preview.example.test",
        checkedAt: CHECKED_AT,
      },
    );

    expect(readiness).toMatchObject({
      ok: false,
      callbackPath: TWITCH_OAUTH_CALLBACK_PATH,
      callbackUrl: "https://preview.example.test/api/twitch/oauth/callback",
      eventSubWebhookPath: TWITCH_EVENTSUB_WEBHOOK_PATH,
      eventSubWebhookUrl: "https://preview.example.test/api/twitch/eventsub",
      extensionPaths: {
        viewer: TWITCH_EXTENSION_VIEWER_PATH,
        config: TWITCH_EXTENSION_CONFIG_PATH,
        liveConfig: TWITCH_EXTENSION_LIVE_CONFIG_PATH,
      },
      helperScriptUrl: TWITCH_EXTENSION_HELPER_SCRIPT_URL,
      missing: [
        "TWITCH_CLIENT_ID",
        "TWITCH_CLIENT_SECRET",
        "TWITCH_EXTENSION_CLIENT_ID",
        "TWITCH_EXTENSION_SECRET",
        "TWITCH_EVENTSUB_SECRET",
      ],
    });
    expect(readiness.services.map((service) => service.status)).toEqual([
      "misconfigured",
      "misconfigured",
      "misconfigured",
    ]);
    expect(JSON.stringify(readiness)).not.toContain("fixture-secret");
  });

  it("marks Twitch setup configured without returning secret values", () => {
    const readiness = resolveTwitchSetupReadiness(
      {
        TWITCH_CLIENT_ID: "fixture-client",
        TWITCH_CLIENT_SECRET: "fixture-client-secret",
        TWITCH_EXTENSION_CLIENT_ID: "fixture-extension",
        TWITCH_EXTENSION_SECRET: "fixture-extension-secret",
        TWITCH_EVENTSUB_SECRET: "fixture-eventsub-secret-that-is-long-enough",
      },
      { checkedAt: CHECKED_AT },
    );

    expect(readiness.ok).toBe(true);
    expect(readiness.missing).toEqual([]);
    expect(readiness.services.map((service) => service.status)).toEqual(["ready", "ready", "ready"]);
    expect(JSON.stringify(readiness)).not.toContain("fixture-client-secret");
    expect(JSON.stringify(readiness)).not.toContain("fixture-extension-secret");
    expect(JSON.stringify(readiness)).not.toContain("fixture-eventsub-secret");
  });

  it("exposes a no-store setup readiness API", async () => {
    vi.stubEnv("TWITCH_CLIENT_ID", "fixture-client");
    vi.stubEnv("TWITCH_CLIENT_SECRET", "fixture-client-secret");
    vi.stubEnv("TWITCH_EXTENSION_CLIENT_ID", "fixture-extension");
    vi.stubEnv("TWITCH_EXTENSION_SECRET", "fixture-extension-secret");
    vi.stubEnv("TWITCH_EVENTSUB_SECRET", "fixture-eventsub-secret-that-is-long-enough");

    const response = await twitchSetupReadinessGET(
      new Request("https://preview.example.test/api/twitch/setup/readiness"),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = await response.json();
    expect(body).toMatchObject({
      ok: true,
      callbackUrl: "https://preview.example.test/api/twitch/oauth/callback",
      eventSubWebhookPath: "/api/twitch/eventsub",
      eventSubWebhookUrl: "https://preview.example.test/api/twitch/eventsub",
      extensionPaths: {
        viewer: "/viewer.html",
        config: "/config.html",
        liveConfig: "/live-config.html",
      },
      helperScriptUrl: TWITCH_EXTENSION_HELPER_SCRIPT_URL,
      missing: [],
    });
    expect(JSON.stringify(body)).not.toContain("fixture-client-secret");
    expect(JSON.stringify(body)).not.toContain("fixture-extension-secret");
    expect(JSON.stringify(body)).not.toContain("fixture-eventsub-secret");
  });

  it("rejects an OAuth callback that lacks the matching HttpOnly state", async () => {
    const response = await twitchOAuthCallbackGET(
      new Request("https://preview.example.test/api/twitch/oauth/callback?code=fixture"),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("location")).toBe(
      "https://preview.example.test/studio?oauth=error&reason=state",
    );
  });

  it("renders exact Twitch html surface shells without requiring credentials", () => {
    const viewer = renderToStaticMarkup(
      createElement(TwitchExtensionRouteShell, { surface: "viewer" }),
    );
    const config = renderToStaticMarkup(
      createElement(TwitchExtensionRouteShell, { surface: "config" }),
    );
    const liveConfig = renderToStaticMarkup(
      createElement(TwitchExtensionRouteShell, { surface: "live-config" }),
    );

    expect(viewer).toContain("Viewer Quest Surface Reserved");
    expect(viewer).toContain(TWITCH_EXTENSION_VIEWER_PATH);
    expect(viewer).toContain("not configured");
    expect(config).toContain("Extension Config Surface Reserved");
    expect(config).toContain(TWITCH_EXTENSION_CONFIG_PATH);
    expect(liveConfig).toContain("Live Control Surface Reserved");
    expect(liveConfig).toContain(TWITCH_EXTENSION_LIVE_CONFIG_PATH);
  });

  it("loads the Twitch Extension Helper before any other shell script", () => {
    const surfaces = ["viewer", "config", "live-config"] as const;

    for (const surface of surfaces) {
      const html = renderToStaticMarkup(createElement(TwitchExtensionRouteShell, { surface }));
      const scriptSources = Array.from(
        html.matchAll(/<script[^>]*src="([^"]+)"/g),
        (match) => match[1],
      );

      expect(scriptSources[0]).toBe(TWITCH_EXTENSION_HELPER_SCRIPT_URL);
      expect(scriptSources).toEqual([TWITCH_EXTENSION_HELPER_SCRIPT_URL]);
      expect(html.indexOf("<script")).toBe(0);
      expect(html).not.toContain("<script>");
    }
  });

  it("keeps extension surfaces dynamic so readiness reflects runtime environment", () => {
    for (const route of ["viewer.html", "config.html", "live-config.html"]) {
      const source = readFileSync(resolve(process.cwd(), `src/app/${route}/page.tsx`), "utf8");

      expect(source).toContain('export const runtime = "nodejs"');
      expect(source).toContain('export const dynamic = "force-dynamic"');
    }
  });
});
