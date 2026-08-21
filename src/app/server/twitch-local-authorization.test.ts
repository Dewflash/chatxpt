import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  TwitchLocalAuthorizationError,
  TwitchLocalAuthorizationStore,
} from "./twitch-local-authorization";

const SECRET = "local-twitch-store-secret-that-is-at-least-32-characters";
const directories: string[] = [];

async function store() {
  const directory = await mkdtemp(join(tmpdir(), "chatxpt-twitch-store-"));
  directories.push(directory);
  const filePath = join(directory, "authorization.enc");
  return {
    filePath,
    store: new TwitchLocalAuthorizationStore({ secret: SECRET, filePath }),
  };
}

describe("local Twitch authorization storage", () => {
  afterEach(async () => {
    await Promise.all(directories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true })
    ));
  });

  it("persists OAuth tokens encrypted and restores the broadcaster connection", async () => {
    const context = await store();
    await context.store.save({
      version: 1,
      broadcasterId: "broadcaster-1",
      displayName: "Streamer One",
      gameId: "27471",
      gameName: "Minecraft",
      accessToken: "private-user-access-token",
      refreshToken: "private-user-refresh-token",
      scopes: ["user:read:chat"],
      expiresAt: 1_800_000_000_000,
    });

    const encrypted = await readFile(context.filePath, "utf8");
    expect(encrypted).not.toContain("private-user-access-token");
    expect(encrypted).not.toContain("private-user-refresh-token");
    await expect(context.store.read("broadcaster-1")).resolves.toMatchObject({
      broadcasterId: "broadcaster-1",
      accessToken: "private-user-access-token",
      refreshToken: "private-user-refresh-token",
    });
  });

  it("fails closed when the encrypted store is tampered with", async () => {
    const context = await store();
    await context.store.save({
      version: 1,
      broadcasterId: "broadcaster-1",
      displayName: "Streamer One",
      gameId: null,
      gameName: null,
      accessToken: "private-user-access-token",
      refreshToken: "private-user-refresh-token",
      scopes: ["user:read:chat"],
      expiresAt: 1_800_000_000_000,
    });
    const encrypted = JSON.parse(await readFile(context.filePath, "utf8")) as {
      ciphertext: string;
    };
    encrypted.ciphertext = `${encrypted.ciphertext.slice(0, -1)}A`;
    await writeFile(context.filePath, JSON.stringify(encrypted), "utf8");

    await expect(context.store.read("broadcaster-1"))
      .rejects.toBeInstanceOf(TwitchLocalAuthorizationError);
  });
});
