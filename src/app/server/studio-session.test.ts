import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import { CONTRACT_VERSION, streamerProfileSettingsCommandSchema } from "@/core";
import { createMemoryPersistenceRuntime } from "@/realtime";

import { ChatXptServerRuntime } from "./runtime";
import { StudioSessionApplication, StudioSessionApplicationError } from "./studio-session";

const NOW = 1_780_000_000_000;
const SETUP_KEY = "studio-test-key-that-is-at-least-32-characters";
const EXTENSION_SECRET_BYTES = Buffer.from("extension-secret-for-studio-tests-1234", "utf8");
const EXTENSION_SECRET = EXTENSION_SECRET_BYTES.toString("base64");

function twitchJwt(role: "broadcaster" | "viewer", channelId = "channel-1"): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({
    channel_id: channelId,
    exp: Math.floor((NOW + 60_000) / 1_000),
    opaque_user_id: "Ustudio-test-user",
    role,
  })).toString("base64url");
  const signature = createHmac("sha256", EXTENSION_SECRET_BYTES)
    .update(`${header}.${payload}`)
    .digest("base64url");
  return `${header}.${payload}.${signature}`;
}

function application() {
  let id = 0;
  const persistence = createMemoryPersistenceRuntime();
  return {
    persistence,
    application: new StudioSessionApplication({
      runtime: new ChatXptServerRuntime({ persistence, clock: { now: () => NOW } }),
      setupKey: SETUP_KEY,
      extensionSecret: EXTENSION_SECRET,
      environment: {
        TWITCH_CLIENT_ID: "client-id",
        TWITCH_CLIENT_SECRET: "client-secret",
        TWITCH_EXTENSION_CLIENT_ID: "extension-client-id",
        TWITCH_EXTENSION_SECRET: EXTENSION_SECRET,
      },
      now: () => NOW,
      nextId: () => `id-${++id}`,
    }),
  };
}

describe("StudioSessionApplication", () => {
  it("creates one mapped live session and returns only a scoped server grant", async () => {
    const context = application();
    const started = await context.application.start(SETUP_KEY, {
      channelId: "channel-1",
      displayName: "Streamer One",
      gameId: "minecraft",
      gameName: "Minecraft",
    });

    expect(started.view.session.status).toBe("live");
    expect(started.view.session.broadcasterId).toBe("channel-1");
    expect(started.view.profile.gameName).toBe("Minecraft");
    expect(started.roomCode).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
    expect(started.readiness.ready).toBe(false);
    expect(started.readiness.blockerCodes).toContain("gameplay-capture");
    expect(await context.persistence.twitchChannelSessions.findTwitchChannelSession("channel-1"))
      .toMatchObject({ sessionId: started.view.session.sessionId, status: "live" });

    const reopened = await context.application.start(SETUP_KEY, {
      channelId: "channel-1",
      displayName: "Ignored duplicate profile",
      gameId: null,
      gameName: null,
    });
    expect(reopened.view.session.sessionId).toBe(started.view.session.sessionId);
    expect(reopened.roomCode).toBeNull();
  });

  it("accepts authoritative profile commands through the HttpOnly grant identity", async () => {
    const context = application();
    const started = await context.application.start(SETUP_KEY, {
      channelId: "channel-1",
      displayName: "Streamer One",
      gameId: null,
      gameName: null,
    });
    const command = streamerProfileSettingsCommandSchema.parse({
      contractVersion: CONTRACT_VERSION,
      sessionId: started.view.session.sessionId,
      questCycleId: null,
      commandId: "profile-command-1",
      correlationId: "profile-command-1",
      expectedRevision: started.view.session.revision,
      issuedAt: NOW,
      actor: { kind: "broadcaster", actorId: "channel-1" },
      type: "streamer.profile-settings",
      experiencePatch: { intensity: 0.7 },
    });

    const result = await context.application.execute(started.grant, null, command);
    expect(result.outcome).toBe("committed");
    expect(result.view.profile.experience.intensity).toBe(0.7);
    expect(result.view.session.revision).toBe(started.view.session.revision + 1);
  });

  it("uses a signed Twitch broadcaster JWT for Config and rejects viewer-role control", async () => {
    const context = application();
    const started = await context.application.start(SETUP_KEY, {
      channelId: "channel-1",
      displayName: "Streamer One",
      gameId: null,
      gameName: null,
    });
    const broadcaster = await context.application.read(
      null,
      `Bearer ${twitchJwt("broadcaster")}`,
    );
    expect(broadcaster.view.session.sessionId).toBe(started.view.session.sessionId);
    expect(broadcaster.readiness.liveInputsUsed).toBe(true);

    await expect(
      context.application.read(null, `Bearer ${twitchJwt("viewer")}`),
    ).rejects.toMatchObject({ code: "forbidden" } satisfies Partial<StudioSessionApplicationError>);
  });

  it("rejects an invalid bootstrap key before creating state", async () => {
    const context = application();
    await expect(
      context.application.start("wrong", {
        channelId: "channel-1",
        displayName: "Streamer One",
        gameId: null,
        gameName: null,
      }),
    ).rejects.toMatchObject({ code: "unauthenticated" } satisfies Partial<StudioSessionApplicationError>);
  });
});
