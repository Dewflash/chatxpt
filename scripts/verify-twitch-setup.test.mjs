import assert from "node:assert/strict";
import test from "node:test";

import { verifyTwitchSetup } from "./verify-twitch-setup.mjs";

const readinessBody = {
  ok: false,
  callbackPath: "/api/twitch/oauth/callback",
  callbackUrl: "https://preview.example.test/api/twitch/oauth/callback",
  extensionPaths: {
    viewer: "/twitch/viewer",
    config: "/twitch/config",
    liveConfig: "/twitch/live-config",
  },
  services: [
    { service: "twitch-app", status: "unavailable", message: "missing", retryable: false },
    { service: "twitch-extension", status: "unavailable", message: "missing", retryable: false },
  ],
  missing: [
    "TWITCH_CLIENT_ID",
    "TWITCH_CLIENT_SECRET",
    "TWITCH_EXTENSION_CLIENT_ID",
    "TWITCH_EXTENSION_SECRET",
  ],
  limitations: ["No Twitch secrets are included in this response."],
};

const callbackBody = {
  ok: false,
  setup: { callbackPath: "/api/twitch/oauth/callback" },
  error: { code: "validation", message: "missing", retryable: false },
};

const registrationBody = {
  ok: true,
  baseUrl: "https://preview.example.test",
  oauth: {
    callbackPath: "/api/twitch/oauth/callback",
    callbackUrl: "https://preview.example.test/api/twitch/oauth/callback",
    scopes: {
      status: "open-decision",
      decisionId: "D1-07",
      configured: [],
      note: "open",
    },
    tokenExchange: "reserved-disabled",
  },
  extension: {
    viewerPath: "/twitch/viewer",
    viewerUrl: "https://preview.example.test/twitch/viewer",
    configPath: "/twitch/config",
    configUrl: "https://preview.example.test/twitch/config",
    liveConfigPath: "/twitch/live-config",
    liveConfigUrl: "https://preview.example.test/twitch/live-config",
    status: "reserved-shells",
  },
  requiredEnvironment: [
    { name: "TWITCH_CLIENT_ID", configured: false, serverOnly: false },
    { name: "TWITCH_CLIENT_SECRET", configured: false, serverOnly: true },
  ],
  evidenceRequired: ["Twitch developer-console app registration"],
  limitations: ["No Twitch secrets are included in this response."],
};

const routeMarkers = new Map([
  ["/twitch/viewer", "Viewer Quest Surface Reserved"],
  ["/twitch/config", "Extension Config Surface Reserved"],
  ["/twitch/live-config", "Live Control Surface Reserved"],
]);

function responseJson(body, status = 200, headers = {}) {
  return {
    status,
    headers: new Headers(headers),
    async json() {
      return body;
    },
  };
}

function responseText(body, status = 200) {
  return {
    status,
    headers: new Headers(),
    async text() {
      return body;
    },
  };
}

function fetchFixture(overrides = {}) {
  return async (url) => {
    const path = new URL(url).pathname;
    if (overrides[path] !== undefined) return overrides[path];
    if (path === "/api/twitch/setup/readiness") {
      return responseJson(readinessBody, 200, { "cache-control": "no-store" });
    }
    if (path === "/api/twitch/setup/registration") {
      return responseJson(registrationBody, 200, { "cache-control": "no-store" });
    }
    if (path === "/api/twitch/oauth/callback") return responseJson(callbackBody, 400);
    if (routeMarkers.has(path)) {
      return responseText(`${routeMarkers.get(path)} /api/twitch/oauth/callback`);
    }
    throw new Error(`unexpected URL ${url}`);
  };
}

test("accepts Twitch setup readiness, registration, callback, and Extension route shells", async () => {
  const result = await verifyTwitchSetup({
    baseUrl: "https://preview.example.test/dashboard",
    fetchImpl: fetchFixture(),
  });

  assert.equal(result.ok, true);
  assert.equal(result.inspected.length, 6);
  assert.deepEqual(result.violations, []);
});

test("rejects readiness responses that expose configured secret values", async () => {
  const result = await verifyTwitchSetup({
    baseUrl: "https://preview.example.test",
    fetchImpl: fetchFixture({
      "/api/twitch/setup/readiness": responseJson({
        ...readinessBody,
        limitations: ["No Twitch secrets are included in this response.", "leaked fixture-secret-value"],
      }, 200, { "cache-control": "no-store" }),
    }),
    environment: { TWITCH_CLIENT_SECRET: "fixture-secret-value" },
  });

  assert.equal(result.ok, false);
  assert.ok(result.violations.some((violation) => violation.includes("TWITCH_CLIENT_SECRET")));
  assert.ok(result.violations.every((violation) => !violation.includes("fixture-secret-value")));
});

test("rejects registration manifests that settle OAuth scopes early", async () => {
  const result = await verifyTwitchSetup({
    baseUrl: "https://preview.example.test",
    fetchImpl: fetchFixture({
      "/api/twitch/setup/registration": responseJson({
        ...registrationBody,
        oauth: {
          ...registrationBody.oauth,
          scopes: { status: "ready", decisionId: "D1-07", configured: ["channel:read:redemptions"] },
        },
      }, 200, { "cache-control": "no-store" }),
    }),
  });

  assert.equal(result.ok, false);
  assert.ok(result.violations.some((violation) => violation.includes("OAuth scopes")));
});

test("rejects callback routes that do not fail closed on missing query params", async () => {
  const result = await verifyTwitchSetup({
    baseUrl: "https://preview.example.test",
    fetchImpl: fetchFixture({
      "/api/twitch/oauth/callback": responseJson({ ok: true }, 200),
    }),
  });

  assert.equal(result.ok, false);
  assert.ok(result.violations.some((violation) => violation.includes("must return HTTP 400")));
});

test("rejects Extension routes that no longer render setup shells", async () => {
  const result = await verifyTwitchSetup({
    baseUrl: "https://preview.example.test",
    fetchImpl: fetchFixture({
      "/twitch/viewer": responseText("empty page"),
    }),
  });

  assert.equal(result.ok, false);
  assert.ok(result.violations.some((violation) => violation.includes("/twitch/viewer")));
});

test("reports fetch failures without leaking raw network details", async () => {
  const result = await verifyTwitchSetup({
    baseUrl: "https://preview.example.test",
    fetchImpl: async () => {
      throw new Error("connection refused with fixture-secret-value");
    },
    environment: { TWITCH_CLIENT_SECRET: "fixture-secret-value" },
  });

  assert.equal(result.ok, false);
  assert.ok(result.violations.some((violation) => violation.includes("could not fetch or parse")));
  assert.ok(result.violations.every((violation) => !violation.includes("fixture-secret-value")));
});
