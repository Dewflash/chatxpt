import { describe, expect, it, vi } from "vitest";

import {
  TWITCH_EXTENSION_CONFIG_PATH,
  TWITCH_EXTENSION_LIVE_CONFIG_PATH,
  TWITCH_EXTENSION_VIEWER_PATH,
  TWITCH_OAUTH_CALLBACK_PATH,
  resolveTwitchSetupReadiness,
} from "../../src/integrations";
import { twitchOAuthCallbackGET } from "../../src/app";

const CHECKED_AT = 1_786_300_000_000;

describe("Twitch setup readiness", () => {
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
});
