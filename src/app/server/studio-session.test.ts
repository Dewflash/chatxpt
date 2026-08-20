import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  CONTRACT_VERSION,
  streamerLiveDirectorIntentCommandSchema,
  streamerProfileSettingsCommandSchema,
} from "@/core";
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

function application(options: { readonly historyFails?: boolean } = {}) {
  let id = 0;
  const persistence = createMemoryPersistenceRuntime();
  const runtimePersistence = options.historyFails
    ? {
        ...persistence,
        sessionHistory: {
          readSessionHistory: async () => {
            throw new Error("fixture history reader unavailable");
          },
        },
      }
    : persistence;
  return {
    persistence: runtimePersistence,
    application: new StudioSessionApplication({
      runtime: new ChatXptServerRuntime({ persistence: runtimePersistence, clock: { now: () => NOW } }),
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
    expect(started.history).toMatchObject({
      broadcasterId: "channel-1",
      entries: [],
      summary: { totalQuestCycles: 0, totalAcceptedVotes: 0 },
      privacy: {
        rawChatHistoryRetained: false,
        viewerIdentifiersIncluded: false,
        privateVoteReceiptsIncluded: false,
      },
    });
    expect(await context.persistence.twitchChannelSessions.findTwitchChannelSession("channel-1"))
      .toMatchObject({ sessionId: started.view.session.sessionId, status: "live" });

    const reopened = await context.application.start(SETUP_KEY, {
      channelId: "channel-1",
      displayName: "Ignored duplicate profile",
      gameId: null,
      gameName: null,
    });
    expect(reopened.view.session.sessionId).toBe(started.view.session.sessionId);
    expect(reopened.roomCode).toBe(started.roomCode);
    expect(reopened.history?.summary.totalQuestCycles).toBe(0);
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

  it("persists private declared intent through the same broadcaster-authorised command path", async () => {
    const context = application();
    const started = await context.application.start(SETUP_KEY, {
      channelId: "channel-1",
      displayName: "Streamer One",
      gameId: "minecraft",
      gameName: "Minecraft",
    });
    const command = streamerLiveDirectorIntentCommandSchema.parse({
      contractVersion: CONTRACT_VERSION,
      sessionId: started.view.session.sessionId,
      questCycleId: null,
      commandId: "live-intent-command-1",
      correlationId: "live-intent-command-1",
      expectedRevision: started.view.session.revision,
      issuedAt: NOW,
      actor: { kind: "broadcaster", actorId: "channel-1" },
      type: "streamer.live-director-intent",
      action: "set",
      intent: {
        goal: "Reach the next shelter",
        objective: "Explore carefully while chat helps choose the route.",
        desiredAudienceInvolvement: "Suggest the next safe route.",
        requestedExpiresAt: NOW + 60 * 60 * 1_000,
      },
    });

    const result = await context.application.execute(started.grant, null, command);

    expect(result.outcome).toBe("committed");
    expect(result.view.liveDirector?.declaredIntent).toMatchObject({
      status: "known",
      goal: "Reach the next shelter",
      objective: "Explore carefully while chat helps choose the route.",
    });
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

  it("keeps the current Studio session available when optional history cannot load", async () => {
    const context = application({ historyFails: true });
    const started = await context.application.start(SETUP_KEY, {
      channelId: "channel-1",
      displayName: "Streamer One",
      gameId: null,
      gameName: null,
    });

    expect(started.view.session.status).toBe("live");
    expect(started.history).toBeNull();
    expect(started.readiness.blockerCodes).toContain("gameplay-capture");
  });
});
