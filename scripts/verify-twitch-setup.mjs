import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

const extensionRoutes = [
  { path: "/twitch/viewer", marker: "Viewer Quest Surface Reserved" },
  { path: "/twitch/config", marker: "Extension Config Surface Reserved" },
  { path: "/twitch/live-config", marker: "Live Control Surface Reserved" },
];

const configuredSecretNames = [
  "TWITCH_CLIENT_SECRET",
  "TWITCH_EXTENSION_SECRET",
];

function normaliseBaseUrl(value) {
  if (value === undefined || value.trim().length === 0) {
    throw new Error("Twitch setup URL is required. Pass it as an argument or CHATXPT_DEPLOYMENT_URL.");
  }
  return new URL(value);
}

function configuredSecretValues(environment = process.env) {
  return configuredSecretNames
    .map((name) => ({ name, value: environment[name]?.trim() }))
    .filter((secret) => secret.value !== undefined && secret.value.length >= 8);
}

function assertNoConfiguredSecretValues(serialized, environment) {
  for (const secret of configuredSecretValues(environment)) {
    assert.ok(
      !serialized.includes(secret.value),
      `response must not include configured value for ${secret.name}`,
    );
  }
}

async function fetchJson(fetchImpl, url) {
  try {
    const response = await fetchImpl(url, { cache: "no-store" });
    const body = await response.json();
    return { response, body };
  } catch {
    throw new Error(`could not fetch or parse ${new URL(url).pathname}`);
  }
}

async function fetchText(fetchImpl, url) {
  try {
    const response = await fetchImpl(url, { cache: "no-store" });
    const body = await response.text();
    return { response, body };
  } catch {
    throw new Error(`could not fetch or parse ${new URL(url).pathname}`);
  }
}

function parseArguments(argv) {
  const options = { baseUrl: process.env.CHATXPT_DEPLOYMENT_URL };
  for (const argument of argv) {
    if (argument.startsWith("--")) {
      throw new Error(`Unknown option ${argument}`);
    }
    options.baseUrl = argument;
  }
  return options;
}

export async function verifyTwitchSetup({
  baseUrl,
  fetchImpl = globalThis.fetch,
  environment = process.env,
} = {}) {
  if (typeof fetchImpl !== "function") throw new Error("fetch is unavailable");
  const parsedBaseUrl = normaliseBaseUrl(baseUrl);
  const violations = [];
  const inspected = [];

  try {
    const readinessUrl = new URL("/api/twitch/setup/readiness", parsedBaseUrl);
    const { response, body } = await fetchJson(fetchImpl, readinessUrl);
    inspected.push(readinessUrl.toString());

    assert.equal(response.status, 200, "readiness endpoint must return HTTP 200");
    assert.ok(
      (response.headers.get("cache-control") ?? "").toLowerCase().includes("no-store"),
      "readiness endpoint must be no-store",
    );
    assert.equal(typeof body.ok, "boolean", "readiness ok must be boolean");
    assert.equal(body.callbackPath, "/api/twitch/oauth/callback", "readiness callbackPath must be canonical");
    assert.ok(
      String(body.callbackUrl ?? "").endsWith("/api/twitch/oauth/callback"),
      "readiness callbackUrl must point at the OAuth callback route",
    );
    assert.deepEqual(body.extensionPaths, {
      viewer: "/twitch/viewer",
      config: "/twitch/config",
      liveConfig: "/twitch/live-config",
    });
    assert.ok(Array.isArray(body.services), "readiness services must be an array");
    assert.ok(Array.isArray(body.missing), "readiness missing must be an array");
    assert.ok(Array.isArray(body.limitations), "readiness limitations must be an array");
    assert.ok(
      body.services.some((service) => service?.service === "twitch-app"),
      "readiness services must include twitch-app",
    );
    assert.ok(
      body.services.some((service) => service?.service === "twitch-extension"),
      "readiness services must include twitch-extension",
    );
    assert.ok(
      body.limitations.some((limitation) => /No Twitch secrets/i.test(String(limitation))),
      "readiness limitations must state that Twitch secrets are omitted",
    );
    assertNoConfiguredSecretValues(JSON.stringify(body), environment);
  } catch (error) {
    violations.push(error.message);
  }

  try {
    const callbackUrl = new URL("/api/twitch/oauth/callback", parsedBaseUrl);
    const { response, body } = await fetchJson(fetchImpl, callbackUrl);
    inspected.push(callbackUrl.toString());

    assert.equal(response.status, 400, "OAuth callback without code/state must return HTTP 400");
    assert.equal(body.ok, false, "OAuth callback validation response must not be ok");
    assert.equal(body.error?.code, "validation", "OAuth callback missing-query error must be validation");
    assert.equal(
      body.setup?.callbackPath,
      "/api/twitch/oauth/callback",
      "OAuth callback response must include canonical setup callback path",
    );
    assertNoConfiguredSecretValues(JSON.stringify(body), environment);
  } catch (error) {
    violations.push(error.message);
  }

  for (const route of extensionRoutes) {
    try {
      const routeUrl = new URL(route.path, parsedBaseUrl);
      const { response, body } = await fetchText(fetchImpl, routeUrl);
      inspected.push(routeUrl.toString());

      assert.equal(response.status, 200, `${route.path} must return HTTP 200`);
      assert.ok(body.includes(route.marker), `${route.path} must render its reserved setup shell`);
      assert.ok(body.includes("/api/twitch/oauth/callback"), `${route.path} must render callback setup context`);
      assertNoConfiguredSecretValues(body, environment);
    } catch (error) {
      violations.push(error.message);
    }
  }

  return {
    ok: violations.length === 0,
    baseUrl: parsedBaseUrl.toString(),
    inspected,
    violations,
  };
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const result = await verifyTwitchSetup(options);

  if (!result.ok) {
    console.error(`Twitch setup verification failed for ${result.baseUrl}:`);
    for (const violation of result.violations) console.error(`- ${violation}`);
    process.exitCode = 1;
    return;
  }

  console.log(`Twitch setup routes verified for ${result.baseUrl} (${result.inspected.length} checks).`);
}

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]) {
  await main();
}
