import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import test from "node:test";

const execute = promisify(execFile);
const script = resolve("scripts/prepare-local-runtime.mjs");

async function prepare(filePath) {
  return execute(process.execPath, [script], {
    cwd: process.cwd(),
    env: { ...process.env, CHATXPT_LOCAL_ENV_PATH: filePath },
  });
}

test("creates stable private local defaults without external provider credentials", async () => {
  const directory = await mkdtemp(join(tmpdir(), "chatxpt-local-runtime-"));
  const filePath = join(directory, ".env.local");
  try {
    await prepare(filePath);
    const first = await readFile(filePath, "utf8");
    const metadata = await stat(filePath);

    assert.match(first, /^NEXT_PUBLIC_APP_ENV=local$/mu);
    assert.match(first, /^CHATXPT_LLM_ENABLED=false$/mu);
    assert.match(first, /^CHATXPT_TWITCH_EVENTSUB_TRANSPORT=websocket$/mu);
    assert.match(first, /^TWITCH_EVENTSUB_SECRET=\S+$/mu);
    assert.match(first, /^CHATXPT_STUDIO_SESSION_SECRET=\S+$/mu);
    assert.match(first, /^CHATXPT_HOSTED_BOARD_SECRET=\S+$/mu);
    assert.match(first, /^CHATXPT_STUDIO_SETUP_KEY=\S+$/mu);
    assert.match(first, /^CHATXPT_OBS_OVERLAY_SETUP_KEY=\S+$/mu);
    assert.match(first, /^CHATXPT_GAMEPLAY_INGRESS_SETUP_KEY=\S+$/mu);
    assert.doesNotMatch(first, /^TWITCH_CLIENT_ID=/mu);
    assert.doesNotMatch(first, /^TWITCH_CLIENT_SECRET=/mu);
    // Windows exposes inherited ACLs rather than meaningful POSIX mode bits.
    // The script still requests 0600; enforce that mode where the filesystem
    // can actually represent and report it.
    if (process.platform !== "win32") {
      assert.equal(metadata.mode & 0o777, 0o600);
    }

    await prepare(filePath);
    assert.equal(await readFile(filePath, "utf8"), first);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("fills blank generated values without overwriting existing configuration", async () => {
  const directory = await mkdtemp(join(tmpdir(), "chatxpt-local-runtime-"));
  const filePath = join(directory, ".env.local");
  try {
    await writeFile(filePath, [
      "TWITCH_CLIENT_ID=developer-app-id",
      "TWITCH_CLIENT_SECRET=developer-app-secret",
      "TWITCH_EVENTSUB_SECRET=existing-secret",
      "CHATXPT_STUDIO_SESSION_SECRET=",
      "CHATXPT_HOSTED_BOARD_SECRET=\"\"",
      "CHATXPT_STUDIO_SETUP_KEY=existing-studio-setup-key",
      "CHATXPT_OBS_OVERLAY_SETUP_KEY=",
      "CHATXPT_GAMEPLAY_INGRESS_SETUP_KEY=''",
      "CHATXPT_LLM_ENABLED=",
      "",
    ].join("\n"));

    await prepare(filePath);
    const source = await readFile(filePath, "utf8");
    assert.match(source, /^TWITCH_CLIENT_ID=developer-app-id$/mu);
    assert.match(source, /^TWITCH_CLIENT_SECRET=developer-app-secret$/mu);
    assert.match(source, /^TWITCH_EVENTSUB_SECRET=existing-secret$/mu);
    assert.match(source, /^CHATXPT_STUDIO_SESSION_SECRET=\S+$/mu);
    assert.match(source, /^CHATXPT_HOSTED_BOARD_SECRET=\S+$/mu);
    assert.match(source, /^CHATXPT_STUDIO_SETUP_KEY=existing-studio-setup-key$/mu);
    assert.match(source, /^CHATXPT_OBS_OVERLAY_SETUP_KEY=\S+$/mu);
    assert.match(source, /^CHATXPT_GAMEPLAY_INGRESS_SETUP_KEY=\S+$/mu);
    assert.match(source, /^CHATXPT_LLM_ENABLED=false$/mu);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
