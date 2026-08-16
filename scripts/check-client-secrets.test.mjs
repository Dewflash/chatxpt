import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

const script = resolve("scripts/check-client-secrets.mjs");

async function withBundle(contents, callback) {
  const cwd = await mkdtemp(join(tmpdir(), "chatxpt-client-secret-test-"));
  try {
    const output = join(cwd, ".next", "static", "chunks");
    await mkdir(output, { recursive: true });
    await writeFile(join(output, "app.js"), contents);
    callback(cwd);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
}

test("client secret scanner accepts ordinary client output", async () => {
  await withBundle("console.log('chatxpt public bundle');", (cwd) => {
    const result = spawnSync(process.execPath, [script], {
      cwd,
      encoding: "utf8",
    });

    assert.equal(result.status, 0);
    assert.match(result.stdout, /passed/);
  });
});

test("client secret scanner rejects configured secret values", async () => {
  await withBundle("const leaked = 'super-secret-token';", (cwd) => {
    const result = spawnSync(process.execPath, [script], {
      cwd,
      encoding: "utf8",
      env: { ...process.env, SUPABASE_SECRET_KEY: "super-secret-token" },
    });

    assert.equal(result.status, 1);
    assert.match(result.stderr, /SUPABASE_SECRET_KEY/);
  });
});

test("client secret scanner rejects server-only env names", async () => {
  await withBundle("process.env.CHATXPT_GAMEPLAY_INGRESS_SETUP_KEY", (cwd) => {
    const result = spawnSync(process.execPath, [script], {
      cwd,
      encoding: "utf8",
    });

    assert.equal(result.status, 1);
    assert.match(result.stderr, /CHATXPT_GAMEPLAY_INGRESS_SETUP_KEY/);
  });
});
