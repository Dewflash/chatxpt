import assert from "node:assert/strict";
import test from "node:test";

import { verifyDeploymentHealth } from "./verify-deployment-health.mjs";

const headers = new Headers({
  "content-security-policy": [
    "default-src 'self'",
    "worker-src 'self' blob:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
    "frame-ancestors 'self' https://*.twitch.tv https://*.twitch-ext.rootonline.de",
  ].join("; "),
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy": "camera=(self), microphone=(), geolocation=(), payment=()",
});

function healthBody(overrides = {}) {
  return {
    ok: true,
    checkedAt: 1_786_200_000_000,
    deployment: "preview",
    persistenceMode: "supabase",
    services: [
      { service: "persistence", status: "ready", message: "ready", retryable: false },
      { service: "twitch-app", status: "ready", message: "ready", retryable: false },
      { service: "twitch-extension", status: "ready", message: "ready", retryable: false },
      { service: "obs-overlay", status: "ready", message: "ready", retryable: false },
    ],
    publicRealtime: { url: "https://fixture.supabase.co", publishableKey: "sb_publishable_fixture" },
    limitations: ["No server secrets are included in this response."],
    ...overrides,
  };
}

function fetchResponse(body = healthBody(), init = {}) {
  return async (url) => ({
    status: init.status ?? 200,
    headers: init.headers ?? headers,
    async json() {
      assert.equal(String(url), "https://preview.example.test/api/health");
      return body;
    },
  });
}

test("accepts a preview health response with required hardening headers", async () => {
  const result = await verifyDeploymentHealth({
    baseUrl: "https://preview.example.test/dashboard",
    expectedDeployment: "preview",
    fetchImpl: fetchResponse(),
  });

  assert.equal(result.ok, true);
  assert.equal(result.deployment, "preview");
  assert.deepEqual(result.violations, []);
});

test("rejects missing hardening headers", async () => {
  const result = await verifyDeploymentHealth({
    baseUrl: "https://preview.example.test",
    expectedDeployment: "preview",
    fetchImpl: fetchResponse(healthBody(), { headers: new Headers() }),
  });

  assert.equal(result.ok, false);
  assert.ok(result.violations.some((violation) => violation.includes("content-security-policy")));
});

test("rejects unexpected deployment names", async () => {
  const result = await verifyDeploymentHealth({
    baseUrl: "https://preview.example.test",
    expectedDeployment: "preview",
    fetchImpl: fetchResponse(healthBody({ deployment: "local" })),
  });

  assert.equal(result.ok, false);
  assert.ok(result.violations.some((violation) => violation.includes("deployment must be preview")));
});

test("rejects server-only names and configured values without printing the value", async () => {
  const secretValue = "server-secret-token";
  const result = await verifyDeploymentHealth({
    baseUrl: "https://preview.example.test",
    fetchImpl: fetchResponse(
      healthBody({
        limitations: [
          "No server secrets are included in this response.",
          `accidental ${secretValue} TWITCH_CLIENT_SECRET`,
        ],
      }),
    ),
    environment: { TWITCH_CLIENT_SECRET: secretValue },
  });

  assert.equal(result.ok, false);
  assert.ok(result.violations.some((violation) => violation.includes("TWITCH_CLIENT_SECRET")));
  assert.ok(result.violations.every((violation) => !violation.includes(secretValue)));
});

test("reports fetch failures without throwing raw network errors", async () => {
  const result = await verifyDeploymentHealth({
    baseUrl: "https://preview.example.test",
    fetchImpl: async () => {
      throw new Error("connection refused with private details");
    },
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, null);
  assert.deepEqual(result.violations, ["could not fetch or parse /api/health"]);
});
