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
    if (path === "/api/twitch/oauth/callback") return responseJson(callbackBody, 400);
    if (routeMarkers.has(path)) {
      return responseText(`${routeMarkers.get(path)} /api/twitch/oauth/callback`);
    }
    throw new Error(`unexpected URL ${url}`);
  };
}

test("accepts Twitch setup readiness, callback, and Extension route shells", async () => {
  const result = await verifyTwitchSetup({
    baseUrl: "https://preview.example.test/dashboard",
    fetchImpl: fetchFixture(),
  });

  assert.equal(result.ok, true);
  assert.equal(result.inspected.length, 5);
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
