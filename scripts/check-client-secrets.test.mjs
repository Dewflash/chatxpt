import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { scanClientArtifacts, writeFixtureArtifact } from "./check-client-secrets.mjs";

async function fixtureBuildRoot() {
  return mkdtemp(path.join(tmpdir(), "chatxpt-client-secret-scan-"));
}

test("passes clean client artifacts without configured secret values", async () => {
  const buildRoot = await fixtureBuildRoot();
  await writeFixtureArtifact(buildRoot, "static/chunks/app.js", "console.log('client ok');");
  await writeFixtureArtifact(buildRoot, "server/app/index.html", "<main>ChatXPT</main>");

  const result = await scanClientArtifacts({
    buildRoot,
    environment: { NEXT_PUBLIC_APP_ENV: "preview" },
  });

  assert.equal(result.scannedFiles, 2);
  assert.deepEqual(result.violations, []);
});

test("rejects server-only environment names in browser bundles", async () => {
  const buildRoot = await fixtureBuildRoot();
  await writeFixtureArtifact(
    buildRoot,
    "static/chunks/app.js",
    "const leaked = 'SUPABASE_SECRET_KEY';",
  );

  const result = await scanClientArtifacts({
    buildRoot,
    environment: { NEXT_PUBLIC_APP_ENV: "preview" },
  });

  assert.ok(result.violations.some((violation) => violation.includes("SUPABASE_SECRET_KEY")));
});

test("rejects configured server secret values without printing the value", async () => {
  const buildRoot = await fixtureBuildRoot();
  const secretValue = "server-secret-token";
  await writeFixtureArtifact(buildRoot, "server/app/index.html", `<script>${secretValue}</script>`);

  const result = await scanClientArtifacts({
    buildRoot,
    environment: {
      NEXT_PUBLIC_APP_ENV: "preview",
      SUPABASE_SECRET_KEY: secretValue,
    },
  });

  assert.ok(result.violations.some((violation) => violation.includes("value for SUPABASE_SECRET_KEY")));
  assert.ok(result.violations.every((violation) => !violation.includes(secretValue)));
});

test("ignores server-only JavaScript chunks that are not browser-delivered artifacts", async () => {
  const buildRoot = await fixtureBuildRoot();
  await writeFixtureArtifact(
    buildRoot,
    "server/chunks/route.js",
    "const serverOnly = process.env.SUPABASE_SECRET_KEY;",
  );

  const result = await scanClientArtifacts({
    buildRoot,
    environment: { SUPABASE_SECRET_KEY: "server-secret-token" },
  });

  assert.equal(result.scannedFiles, 0);
  assert.deepEqual(result.violations, []);
});
