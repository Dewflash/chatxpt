import { afterEach, describe, expect, it, vi } from "vitest";

import {
  TWITCH_EXTENSION_CONFIG_PATH,
  TWITCH_EXTENSION_LIVE_CONFIG_PATH,
  TWITCH_EXTENSION_PANEL_HEIGHT_PX,
  TWITCH_EXTENSION_VIEWER_PATH,
  TWITCH_EXTENSION_VIEW_DECISION_ID,
  TWITCH_LOCAL_CALLBACK_URL,
  TWITCH_OAUTH_CALLBACK_PATH,
  TWITCH_REGISTRATION_DECISION_ID,
  resolveTwitchSetupRegistrationManifest,
  resolveTwitchSetupReadiness,
} from "../../src/integrations";
import {
  twitchOAuthCallbackGET,
  twitchSetupReadinessGET,
  twitchSetupRegistrationGET,
} from "../../src/app";

const CHECKED_AT = 1_786_300_000_000;

describe("Twitch setup readiness", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("reports unavailable setup without leaking Twitch secrets", () => {
    const readiness = resolveTwitchSetupReadiness({}, {
      baseUrl: "https://preview.example.test",
      checkedAt: CHECKED_AT,
    });

    expect(readiness.ok).toBe(false);
    expect(readiness.callbackPath).toBe(TWITCH_OAUTH_CALLBACK_PATH);
    expect(readiness.callbackUrl).toBe("https://preview.example.test/api/twitch/oauth/callback");
    expect(readiness.extensionPaths).toEqual({
      viewer: TWITCH_EXTENSION_VIEWER_PATH,
      config: TWITCH_EXTENSION_CONFIG_PATH,
      liveConfig: TWITCH_EXTENSION_LIVE_CONFIG_PATH,
    });
    expect(readiness.missing).toEqual([
      "TWITCH_CLIENT_ID",
      "TWITCH_CLIENT_SECRET",
      "TWITCH_EXTENSION_CLIENT_ID",
      "TWITCH_EXTENSION_SECRET",
    ]);
    expect(readiness.services.map(({ service, status }) => [service, status])).toEqual([
      ["twitch-app", "unavailable"],
      ["twitch-extension", "unavailable"],
    ]);
    expect(JSON.stringify(readiness)).not.toContain("fixture-secret");
  });

  it("marks partially configured Twitch credentials as misconfigured", () => {
    const readiness = resolveTwitchSetupReadiness({
      TWITCH_CLIENT_ID: "fixture-client",
      TWITCH_EXTENSION_SECRET: "fixture-extension-secret",
    }, { checkedAt: CHECKED_AT });

    expect(readiness.ok).toBe(false);
    expect(readiness.services).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ service: "twitch-app", status: "misconfigured" }),
        expect.objectContaining({ service: "twitch-extension", status: "misconfigured" }),
      ]),
    );
    expect(readiness.missing).toEqual([
      "TWITCH_CLIENT_SECRET",
      "TWITCH_EXTENSION_CLIENT_ID",
    ]);
  });

  it("reports ready shape while omitting configured secrets", () => {
    const readiness = resolveTwitchSetupReadiness({
      CHATXPT_PUBLIC_BASE_URL: "https://preview.example.test",
      TWITCH_CLIENT_ID: "fixture-client",
      TWITCH_CLIENT_SECRET: "fixture-client-secret",
      TWITCH_EXTENSION_CLIENT_ID: "fixture-extension",
      TWITCH_EXTENSION_SECRET: "fixture-extension-secret",
    }, { checkedAt: CHECKED_AT });

    expect(readiness.ok).toBe(true);
    expect(readiness.callbackUrl).toBe("https://preview.example.test/api/twitch/oauth/callback");
    expect(readiness.missing).toEqual([]);
    expect(JSON.stringify(readiness)).not.toContain("fixture-client-secret");
    expect(JSON.stringify(readiness)).not.toContain("fixture-extension-secret");
  });

  it("publishes copy-safe Twitch developer-console registration values with staged OAuth policy", () => {
    const manifest = resolveTwitchSetupRegistrationManifest({
      TWITCH_CLIENT_ID: "fixture-client",
      TWITCH_CLIENT_SECRET: "fixture-client-secret",
      TWITCH_EXTENSION_CLIENT_ID: "fixture-extension",
      TWITCH_EXTENSION_SECRET: "fixture-extension-secret",
    }, { baseUrl: "https://preview.example.test/dashboard" });

    expect(manifest.ok).toBe(true);
    expect(manifest.oauth).toMatchObject({
      callbackPath: TWITCH_OAUTH_CALLBACK_PATH,
      callbackUrl: "https://preview.example.test/api/twitch/oauth/callback",
      callbackUrls: [
        "https://preview.example.test/api/twitch/oauth/callback",
        TWITCH_LOCAL_CALLBACK_URL,
      ],
      tokenExchange: "reserved-disabled",
      scopes: {
        status: "accepted",
        decisionId: TWITCH_REGISTRATION_DECISION_ID,
        configured: [],
      },
    });
    expect(manifest.oauth.deferredRuntimeScopeProfiles).toEqual([
      expect.objectContaining({
        name: "eventsub-chat-api",
        status: "deferred-runtime",
        scopes: ["user:read:chat", "user:write:chat", "user:bot", "channel:bot"],
      }),
      expect.objectContaining({
        name: "irc-fallback",
        status: "deferred-runtime",
        scopes: ["chat:read", "chat:edit"],
      }),
    ]);
    expect(manifest.extension).toMatchObject({
      viewerPath: TWITCH_EXTENSION_VIEWER_PATH,
      viewerUrl: "https://preview.example.test/twitch/viewer",
      viewPolicy: {
        status: "accepted",
        decisionId: TWITCH_EXTENSION_VIEW_DECISION_ID,
        selectedTypes: ["Panel", "Mobile"],
        panelHeightPx: TWITCH_EXTENSION_PANEL_HEIGHT_PX,
      },
      configPath: TWITCH_EXTENSION_CONFIG_PATH,
      configUrl: "https://preview.example.test/twitch/config",
      liveConfigPath: TWITCH_EXTENSION_LIVE_CONFIG_PATH,
      liveConfigUrl: "https://preview.example.test/twitch/live-config",
      status: "reserved-shells",
    });
    expect(manifest.extension.viewPolicy.viewerPaths).toEqual([
      {
        twitchField: "Panel Viewer Path",
        value: TWITCH_EXTENSION_VIEWER_PATH,
        url: "https://preview.example.test/twitch/viewer",
      },
      {
        twitchField: "Mobile Viewer Path",
        value: TWITCH_EXTENSION_VIEWER_PATH,
        url: "https://preview.example.test/twitch/viewer",
      },
    ]);
    expect(manifest.extension.viewPolicy.unselectedTypes).toEqual([
      expect.objectContaining({ twitchLabel: "Video - Fullscreen" }),
      expect.objectContaining({ twitchLabel: "Video - Component" }),
    ]);
    expect(manifest.requiredEnvironment).toEqual(
      expect.arrayContaining([
        { name: "TWITCH_CLIENT_ID", configured: true, serverOnly: false },
        { name: "TWITCH_CLIENT_SECRET", configured: true, serverOnly: true },
        { name: "CHATXPT_PUBLIC_BASE_URL", configured: true, serverOnly: false },
      ]),
    );
    expect(JSON.stringify(manifest)).not.toContain("fixture-client-secret");
    expect(JSON.stringify(manifest)).not.toContain("fixture-extension-secret");
  });

  it("reserves the OAuth callback route with safe validation and setup failures", async () => {
    vi.stubEnv("TWITCH_CLIENT_ID", "");
    vi.stubEnv("TWITCH_CLIENT_SECRET", "");
    vi.stubEnv("TWITCH_EXTENSION_CLIENT_ID", "");
    vi.stubEnv("TWITCH_EXTENSION_SECRET", "");

    const missingQuery = await twitchOAuthCallbackGET(
      new Request("https://preview.example.test/api/twitch/oauth/callback"),
    );
    expect(missingQuery.status).toBe(400);
    await expect(missingQuery.json()).resolves.toMatchObject({
      ok: false,
      error: { code: "validation" },
      setup: { callbackUrl: "https://preview.example.test/api/twitch/oauth/callback" },
    });

    const unconfigured = await twitchOAuthCallbackGET(
      new Request("https://preview.example.test/api/twitch/oauth/callback?code=fixture&state=fixture"),
    );
    expect(unconfigured.status).toBe(503);
    await expect(unconfigured.json()).resolves.toMatchObject({
      ok: false,
      error: { code: "dependency-unavailable" },
    });
  });

  it("exposes a no-store setup readiness API without leaking configured secrets", async () => {
    vi.stubEnv("TWITCH_CLIENT_ID", "fixture-client");
    vi.stubEnv("TWITCH_CLIENT_SECRET", "fixture-client-secret");
    vi.stubEnv("TWITCH_EXTENSION_CLIENT_ID", "fixture-extension");
    vi.stubEnv("TWITCH_EXTENSION_SECRET", "fixture-extension-secret");

    const response = await twitchSetupReadinessGET(
      new Request("https://preview.example.test/api/twitch/setup/readiness"),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = await response.json();
    expect(body).toMatchObject({
      ok: true,
      callbackPath: TWITCH_OAUTH_CALLBACK_PATH,
      callbackUrl: "https://preview.example.test/api/twitch/oauth/callback",
      extensionPaths: {
        viewer: TWITCH_EXTENSION_VIEWER_PATH,
        config: TWITCH_EXTENSION_CONFIG_PATH,
        liveConfig: TWITCH_EXTENSION_LIVE_CONFIG_PATH,
      },
      missing: [],
    });
    expect(JSON.stringify(body)).not.toContain("fixture-client-secret");
    expect(JSON.stringify(body)).not.toContain("fixture-extension-secret");
  });

  it("exposes a no-store registration manifest API without leaking configured secrets", async () => {
    vi.stubEnv("TWITCH_CLIENT_ID", "fixture-client");
    vi.stubEnv("TWITCH_CLIENT_SECRET", "fixture-client-secret");
    vi.stubEnv("TWITCH_EXTENSION_CLIENT_ID", "fixture-extension");
    vi.stubEnv("TWITCH_EXTENSION_SECRET", "fixture-extension-secret");

    const response = await twitchSetupRegistrationGET(
      new Request("https://preview.example.test/api/twitch/setup/registration"),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = await response.json();
    expect(body).toMatchObject({
      ok: true,
      baseUrl: "https://preview.example.test",
      oauth: {
        callbackUrl: "https://preview.example.test/api/twitch/oauth/callback",
        callbackUrls: [
          "https://preview.example.test/api/twitch/oauth/callback",
          TWITCH_LOCAL_CALLBACK_URL,
        ],
        scopes: { status: "accepted", decisionId: TWITCH_REGISTRATION_DECISION_ID, configured: [] },
        tokenExchange: "reserved-disabled",
      },
      extension: {
        viewerUrl: "https://preview.example.test/twitch/viewer",
        viewPolicy: {
          status: "accepted",
          decisionId: TWITCH_EXTENSION_VIEW_DECISION_ID,
          selectedTypes: ["Panel", "Mobile"],
          panelHeightPx: TWITCH_EXTENSION_PANEL_HEIGHT_PX,
        },
        configUrl: "https://preview.example.test/twitch/config",
        liveConfigUrl: "https://preview.example.test/twitch/live-config",
      },
    });
    expect(body.oauth.deferredRuntimeScopeProfiles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "eventsub-chat-api" }),
        expect.objectContaining({ name: "irc-fallback" }),
      ]),
    );
    expect(JSON.stringify(body)).not.toContain("fixture-client-secret");
    expect(JSON.stringify(body)).not.toContain("fixture-extension-secret");
  });
});
