import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  CONTRACT_VERSION,
  gameplaySnapshotSchema,
  streamerServiceCommandSchema,
  streamerLiveDirectorIntentCommandSchema,
  streamerProfileSettingsCommandSchema,
} from "@/core";
import { contractFixtureGameplaySnapshot } from "@/core/testing";
import { createMemoryPersistenceRuntime } from "@/realtime";

import { GameplayIngressApplication } from "./gameplay-ingress";
import { ChatXptServerRuntime } from "./runtime";
import { StudioSessionApplication, StudioSessionApplicationError } from "./studio-session";

const NOW = 1_780_000_000_000;
const SETUP_KEY = "studio-test-key-that-is-at-least-32-characters";
const GAMEPLAY_KEY = "gameplay-test-key-that-is-at-least-32-characters";
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
        TWITCH_EVENTSUB_SECRET: "eventsub-secret",
      },
      now: () => NOW,
      nextId: () => `id-${++id}`,
    }),
  };
}

async function ingestGameplaySnapshot(context: ReturnType<typeof application>, started: Awaited<ReturnType<StudioSessionApplication["start"]>>) {
  const ingress = new GameplayIngressApplication({
    persistence: context.persistence,
    setupKey: GAMEPLAY_KEY,
    now: () => NOW,
    nextId: () => "studio-gameplay-grant",
  });
  const grant = await ingress.issueGrant(GAMEPLAY_KEY, {
    sessionId: started.view.session.sessionId,
  });
  const base = structuredClone(contractFixtureGameplaySnapshot);
  const snapshot = gameplaySnapshotSchema.parse({
    ...base,
    envelope: {
      ...base.envelope,
      sessionId: started.view.session.sessionId,
      questCycleId: started.view.questCycle.envelope.questCycleId,
      messageId: "studio-live-gameplay-1",
      correlationId: "studio-live-gameplay",
      revision: started.view.session.revision,
      occurredAt: NOW,
      receivedAt: NOW,
      source: "obs-virtual-camera",
      evidenceClass: "live",
    },
    signals: base.signals.map((signal) => ({
      ...signal,
      observation: {
        ...signal.observation,
        provenance: {
          ...signal.observation.provenance,
          source: "obs-virtual-camera",
          method: "studio-session-start-readiness-test",
          observedAt: NOW,
          receivedAt: NOW,
          evidenceClass: "live",
        },
      },
    })),
  });
  await expect(ingress.ingest(`Bearer ${grant.token}`, snapshot)).resolves.toMatchObject({
    result: { status: "accepted" },
  });
}

describe("StudioSessionApplication", () => {
  it("creates one mapped preparing session and returns only a scoped server grant", async () => {
    const context = application();
    const started = await context.application.start(SETUP_KEY, {
      channelId: "channel-1",
      displayName: "Streamer One",
      gameId: "minecraft",
      gameName: "Minecraft",
    });

    expect(started.view.session.status).toBe("preparing");
    expect(started.view.session.broadcasterId).toBe("channel-1");
    expect(started.view.profile.gameName).toBe("Minecraft");
    expect(started.roomCode).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
    expect(started.readiness.ready).toBe(false);
    expect(started.readiness.blockerCodes).toContain("gameplay-capture");
    expect(started.readiness.services.find((service) => service.service === "session")?.allowedActions)
      .not.toContain("start-session");
    expect(await context.persistence.twitchChannelSessions.findTwitchChannelSession("channel-1"))
      .toMatchObject({ sessionId: started.view.session.sessionId, status: "preparing" });

    const reopened = await context.application.start(SETUP_KEY, {
      channelId: "channel-1",
      displayName: "Ignored duplicate profile",
      gameId: null,
      gameName: null,
    });
    expect(reopened.view.session.sessionId).toBe(started.view.session.sessionId);
    expect(reopened.view.session.status).toBe("preparing");
    expect(reopened.roomCode).toBe(started.roomCode);
  });

  it("starts only after readiness has a current Gameplay Capture snapshot", async () => {
    const context = application();
    const started = await context.application.start(SETUP_KEY, {
      channelId: "channel-1",
      displayName: "Streamer One",
      gameId: "minecraft",
      gameName: "Minecraft",
    });
    const blockedCommand = streamerServiceCommandSchema.parse({
      contractVersion: CONTRACT_VERSION,
      sessionId: started.view.session.sessionId,
      commandId: "start-before-capture",
      correlationId: "start-before-capture",
      expectedRevision: started.view.session.revision,
      issuedAt: NOW,
      actor: { kind: "broadcaster", actorId: "channel-1" },
      type: "streamer.session",
      action: "start",
    });
    await expect(context.application.execute(started.grant, null, blockedCommand))
      .rejects.toMatchObject({
        code: "dependency-unavailable",
      } satisfies Partial<StudioSessionApplicationError>);

    await ingestGameplaySnapshot(context, started);
    const ready = await context.application.read(started.grant, null);
    expect(ready.readiness.ready).toBe(true);
    expect(ready.readiness.recommendedAction).toBe("start-session");

    const startCommand = streamerServiceCommandSchema.parse({
      ...blockedCommand,
      commandId: "start-after-capture",
      correlationId: "start-after-capture",
    });
    const result = await context.application.execute(started.grant, null, startCommand);
    expect(result.outcome).toBe("committed");
    expect(result.view.session.status).toBe("live");
    expect(result.readiness.services.find((service) => service.service === "session")?.allowedActions)
      .toContain("end-session");

    await expect(context.application.presence(started.grant, null, { action: "heartbeat" }))
      .resolves.toMatchObject({ status: "live", reconnectDeadlineAt: null });
    await expect(context.application.presence(started.grant, null, { action: "disconnect" }))
      .resolves.toMatchObject({ status: "live", reconnectDeadlineAt: NOW + 10 * 60 * 1_000 });
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
      keywordWatchlist: ["diamonds", "food supplies"],
      streamPresets: started.view.profile.streamPresets,
      selectedPresetId: "chill",
    });

    const result = await context.application.execute(started.grant, null, command);
    expect(result.outcome).toBe("committed");
    expect(result.view.profile.experience.intensity).toBe(0.7);
    expect(result.view.profile.keywordWatchlist).toEqual(["diamonds", "food supplies"]);
    expect(result.view.profile.selectedPresetId).toBe("chill");
    expect(result.view.session.revision).toBe(started.view.session.revision + 1);

    const restored = await context.application.read(started.grant, null);
    expect(restored.view.profile.selectedPresetId).toBe("chill");
    expect(restored.view.profile.keywordWatchlist).toEqual(["diamonds", "food supplies"]);
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

  it("keeps OAuth verification in the signed HttpOnly Studio grant", async () => {
    const context = application();
    const started = await context.application.start(SETUP_KEY, {
      channelId: "channel-1",
      displayName: "Streamer One",
      gameId: "minecraft",
      gameName: "Minecraft",
    }, true);

    const reopened = await context.application.read(started.grant, null);
    expect(reopened.readiness.liveInputsUsed).toBe(true);
    expect(reopened.readiness.services.find((service) => service.service === "twitch")?.health.message)
      .toContain("authorization verified");
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
