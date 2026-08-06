import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

const expectedServices = ["persistence", "twitch-app", "twitch-extension", "obs-overlay"];
const validDeployments = new Set(["local", "preview", "production", "invalid"]);
const validPersistenceModes = new Set(["memory", "supabase", "misconfigured"]);
const serverOnlyNames = [
  "SUPABASE_SECRET_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "TWITCH_CLIENT_SECRET",
  "TWITCH_EXTENSION_SECRET",
  "CHATXPT_OBS_OVERLAY_SETUP_KEY",
  "OPENAI_API_KEY",
];

function configuredSecretValues(environment = process.env) {
  return serverOnlyNames
    .map((name) => ({ name, value: environment[name]?.trim() }))
    .filter((secret) => secret.value !== undefined && secret.value.length >= 8);
}

function normaliseBaseUrl(value) {
  if (value === undefined || value.trim().length === 0) {
    throw new Error("Deployment URL is required. Pass it as an argument or CHATXPT_DEPLOYMENT_URL.");
  }
  return new URL(value);
}

function headerValue(headers, name) {
  return headers.get(name) ?? headers.get(name.toLowerCase()) ?? "";
}

function requiredHeaderIncludes(headers, name, expectedValue) {
  const value = headerValue(headers, name);
  assert.ok(value.includes(expectedValue), `${name} must include ${expectedValue}`);
}

function parseArguments(argv) {
  const options = { baseUrl: process.env.CHATXPT_DEPLOYMENT_URL, expectedDeployment: null };
  for (const argument of argv) {
    if (argument.startsWith("--expect-deployment=")) {
      options.expectedDeployment = argument.slice("--expect-deployment=".length);
    } else if (argument.startsWith("--")) {
      throw new Error(`Unknown option ${argument}`);
    } else {
      options.baseUrl = argument;
    }
  }
  return options;
}

export async function verifyDeploymentHealth({
  baseUrl,
  expectedDeployment = null,
  fetchImpl = globalThis.fetch,
  environment = process.env,
} = {}) {
  if (typeof fetchImpl !== "function") throw new Error("fetch is unavailable");
  const parsedBaseUrl = normaliseBaseUrl(baseUrl);
  const healthUrl = new URL("/api/health", parsedBaseUrl);
  let response;
  let body;
  try {
    response = await fetchImpl(healthUrl, { cache: "no-store" });
    body = await response.json();
  } catch {
    return {
      ok: false,
      url: healthUrl.toString(),
      deployment: "unknown",
      persistenceMode: "unknown",
      status: null,
      violations: ["could not fetch or parse /api/health"],
    };
  }
  const serializedBody = JSON.stringify(body);
  const violations = [];

  try {
    assert.ok(response.status === 200 || response.status === 503, "/api/health must return 200 or 503");
    assert.equal(typeof body.ok, "boolean", "health ok must be boolean");
    assert.ok(validDeployments.has(body.deployment), "health deployment must be known");
    assert.ok(validPersistenceModes.has(body.persistenceMode), "health persistenceMode must be known");
    assert.ok(Array.isArray(body.services), "health services must be an array");
    assert.ok(Array.isArray(body.limitations), "health limitations must be an array");
    assert.ok(body.limitations.some((limitation) => /No server secrets/i.test(String(limitation))), "health limitations must state that server secrets are omitted");
    if (expectedDeployment !== null) {
      assert.equal(body.deployment, expectedDeployment, `health deployment must be ${expectedDeployment}`);
    }
    for (const service of expectedServices) {
      assert.ok(
        body.services.some((entry) => entry?.service === service),
        `health services must include ${service}`,
      );
    }
    for (const name of serverOnlyNames) {
      assert.ok(!serializedBody.includes(name), `health body must not include server-only env name ${name}`);
    }
    for (const secret of configuredSecretValues(environment)) {
      assert.ok(
        !serializedBody.includes(secret.value),
        `health body must not include configured value for ${secret.name}`,
      );
    }
    requiredHeaderIncludes(response.headers, "content-security-policy", "default-src 'self'");
    requiredHeaderIncludes(response.headers, "content-security-policy", "worker-src 'self' blob:");
    requiredHeaderIncludes(response.headers, "content-security-policy", "connect-src 'self' https://*.supabase.co wss://*.supabase.co");
    requiredHeaderIncludes(response.headers, "content-security-policy", "frame-ancestors 'self' https://*.twitch.tv https://*.twitch-ext.rootonline.de");
    assert.equal(headerValue(response.headers, "x-content-type-options"), "nosniff");
    assert.equal(headerValue(response.headers, "referrer-policy"), "strict-origin-when-cross-origin");
    assert.equal(
      headerValue(response.headers, "permissions-policy"),
      "camera=(self), microphone=(), geolocation=(), payment=()",
    );
  } catch (error) {
    violations.push(error.message);
  }

  return {
    ok: violations.length === 0,
    url: healthUrl.toString(),
    deployment: body.deployment,
    persistenceMode: body.persistenceMode,
    status: response.status,
    violations,
  };
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const result = await verifyDeploymentHealth(options);

  if (!result.ok) {
    console.error(`Deployment health verification failed for ${result.url}:`);
    for (const violation of result.violations) console.error(`- ${violation}`);
    process.exitCode = 1;
    return;
  }

  console.log(
    `Deployment health verified for ${result.url} (${result.deployment}, ${result.persistenceMode}, HTTP ${result.status}).`,
  );
}

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]) {
  await main();
}
