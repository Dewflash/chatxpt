import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  CONTRACT_VERSION,
  gameplaySnapshotSchema,
  streamerLiveDirectorIntentCommandSchema,
  streamerProfileSettingsCommandSchema,
  streamerQuestGenerationCommandSchema,
  streamerServiceCommandSchema,
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

function application(
  environment: Record<string, string | undefined> = {},
  now: () => number = () => NOW,
) {
  let id = 0;
  const persistence = createMemoryPersistenceRuntime();
  return {
    persistence,
    application: new StudioSessionApplication({
      runtime: new ChatXptServerRuntime({ persistence, clock: { now } }),
      setupKey: SETUP_KEY,
      extensionSecret: EXTENSION_SECRET,
      environment: {
        TWITCH_CLIENT_ID: "client-id",
        TWITCH_CLIENT_SECRET: "client-secret",
        TWITCH_EXTENSION_CLIENT_ID: "extension-client-id",
        TWITCH_EXTENSION_SECRET: EXTENSION_SECRET,
        TWITCH_EVENTSUB_SECRET: "eventsub-secret",
        ...environment,
      },
      now,
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
  it("generates exactly three deterministic fallback quests before gameplay evidence exists", async () => {
    const context = application();
    const started = await context.application.start(SETUP_KEY, {
      channelId: "channel-1",
      displayName: "Streamer One",
      gameId: null,
      gameName: null,
    });
    const command = streamerQuestGenerationCommandSchema.parse({
      contractVersion: CONTRACT_VERSION,
      sessionId: started.view.session.sessionId,
      questCycleId: started.view.questCycle.envelope.questCycleId,
      commandId: "manual-deterministic-fallback-1",
      correlationId: "manual-deterministic-fallback-1",
      expectedRevision: started.view.envelope.revision,
      issuedAt: NOW,
      actor: { kind: "broadcaster", actorId: "channel-1" },
      type: "streamer.quest-generation",
      mode: "deterministic-fallback",
    });

    const result = await context.application.execute(started.grant, null, command);

    expect(result.view.gameplay).toBeNull();
    expect(result.view.questCycle.status).toBe("proposed");
    expect(result.view.questCycle.options).toHaveLength(3);
    expect(result.view.questCycle.options.every((candidate) =>
      candidate.generation.method === "deterministic-fallback" &&
      candidate.sourceSignalIds.length === 0,
    )).toBe(true);
    expect(result.message).toContain("No gameplay or audience evidence was used");
  });

  it("creates and resumes a Twitch-verified session without the diagnostic setup key", async () => {
    const context = application();
    const connected = await context.application.startFromVerifiedTwitch({
      channelId: "channel-1",
      displayName: "Streamer One",
      gameId: "minecraft",
      gameName: "Minecraft",
    });

    expect(connected.view.session.status).toBe("preparing");
    expect(connected.view.session.broadcasterId).toBe("channel-1");
    expect(connected.view.profile.displayName).toBe("Streamer One");
    expect(connected.view.profile.gameName).toBe("Minecraft");
    expect(connected.readiness.twitchAuthorization).toBe("verified");
    expect(connected.readiness.services.find((service) => service.service === "twitch")?.health.message)
      .toContain("Twitch broadcaster authorization");

    await ingestGameplaySnapshot(context, connected);
    const connectedReady = await context.application.read(connected.grant, null);
    expect(connectedReady.readiness.label).toBe("Twitch connected — waiting for the stream");
    expect(connectedReady.readiness.recommendedAction).toBeNull();
    expect(connectedReady.readiness.services.find((service) => service.service === "session")?.allowedActions)
      .not.toContain("start-session");

    const resumed = await context.application.startFromVerifiedTwitch({
      channelId: "channel-1",
      displayName: "Streamer One",
      gameId: "minecraft",
      gameName: "Minecraft",
    });
    expect(resumed.view.session.sessionId).toBe(connected.view.session.sessionId);
    await expect(context.application.read(resumed.grant, null)).resolves.toMatchObject({
      view: { session: { broadcasterId: "channel-1", status: "preparing" } },
    });

    await expect(context.application.start("wrong-diagnostic-key", {
      channelId: "attacker-channel",
      displayName: "Attacker",
      gameId: null,
      gameName: null,
    })).rejects.toMatchObject({ code: "unauthenticated" });
  });

  it("updates an existing session from the freshly verified Twitch category without replacing saved defaults", async () => {
    const context = application();
    const connected = await context.application.startFromVerifiedTwitch({
      channelId: "channel-1",
      displayName: "Streamer One",
      gameId: "minecraft",
      gameName: "Minecraft",
    });

    const reconnected = await context.application.startFromVerifiedTwitch({
      channelId: "channel-1",
      displayName: "Streamer One",
      gameId: "brawl-stars",
      gameName: "Brawl Stars",
    });

    expect(reconnected.view.session.sessionId).toBe(connected.view.session.sessionId);
    expect(reconnected.view.session.revision).toBe(connected.view.session.revision + 1);
    expect(reconnected.view.profile.gameName).toBe("Minecraft");
    expect(reconnected.view.session.currentGame).toEqual({
      gameId: "brawl-stars",
      gameName: "Brawl Stars",
      source: "twitch",
    });
    expect(reconnected.view.gameplay).toBeNull();
  });

  it("keeps connected Twitch ready when only Extension credentials are absent", async () => {
    const context = application({
      TWITCH_EXTENSION_CLIENT_ID: undefined,
      TWITCH_EXTENSION_SECRET: undefined,
    });
    const connected = await context.application.startFromVerifiedTwitch({
      channelId: "channel-1",
      displayName: "Streamer One",
      gameId: "minecraft",
      gameName: "Minecraft",
    });

    expect(connected.view.session.capabilities.twitchExtension).toBe(false);
    const twitch = connected.readiness.services.find((service) => service.service === "twitch");
    expect(twitch).toMatchObject({ configured: true, health: { status: "ready" } });
    expect(twitch?.health.message).toContain("viewer fallbacks remain available");
    expect(connected.readiness.blockerCodes).not.toContain("twitch-configuration");
    expect(twitch?.allowedActions).toContain("install-extension");

    await ingestGameplaySnapshot(context, connected);
    const ready = await context.application.read(connected.grant, null);
    expect(ready.readiness.ready).toBe(true);
    expect(ready.readiness.blockerCodes).toEqual([]);
  });

  it("synchronizes signed Twitch online and offline events with the authoritative session", async () => {
    const context = application();
    const connected = await context.application.startFromVerifiedTwitch({
      channelId: "channel-1",
      displayName: "Streamer One",
      gameId: "minecraft",
      gameName: "Minecraft",
    });

    await expect(context.application.synchronizeVerifiedTwitchOnline({
      broadcasterId: "channel-1",
      displayName: "Streamer One",
      deliveryId: "eventsub-online-1",
      occurredAt: NOW,
    })).resolves.toMatchObject({
      status: "started",
      sessionId: connected.view.session.sessionId,
      revision: connected.view.session.revision + 1,
    });
    await expect(context.application.read(connected.grant, null)).resolves.toMatchObject({
      view: { session: { status: "live" } },
    });
    await expect(context.application.synchronizeVerifiedTwitchOnline({
      broadcasterId: "channel-1",
      displayName: "Streamer One",
      deliveryId: "eventsub-online-duplicate",
      occurredAt: NOW,
    })).resolves.toMatchObject({ status: "already-live" });

    await expect(context.application.synchronizeVerifiedTwitchOffline({
      broadcasterId: "channel-1",
      displayName: "Streamer One",
      deliveryId: "eventsub-offline-1",
      occurredAt: NOW + 60_000,
    })).resolves.toMatchObject({ status: "ended" });
    await expect(context.application.read(connected.grant, null)).resolves.toMatchObject({
      view: { session: { status: "ended" } },
    });
    await expect(context.persistence.twitchChannelSessions.findTwitchChannelSession("channel-1"))
      .resolves.toBeNull();
    await expect(context.application.resumeExistingFromVerifiedTwitch({
      channelId: "channel-1",
      displayName: "Streamer One",
      gameId: "minecraft",
      gameName: "Minecraft",
    })).resolves.toBeNull();

    const nextStream = await context.application.synchronizeVerifiedTwitchOnline({
      broadcasterId: "channel-1",
      displayName: "Streamer One",
      deliveryId: "eventsub-online-2",
      occurredAt: NOW + 120_000,
    });
    expect(nextStream).toMatchObject({ status: "started" });
    expect(nextStream.sessionId).not.toBe(connected.view.session.sessionId);
    await expect(context.application.resumeExistingFromVerifiedTwitch({
      channelId: "channel-1",
      displayName: "Streamer One",
      gameId: "minecraft",
      gameName: "Minecraft",
    })).resolves.toMatchObject({
      view: { session: { sessionId: nextStream.sessionId, status: "live" } },
    });
  });

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

  it("blocks readiness when Gameplay Capture stops reporting fresh frames", async () => {
    let now = NOW;
    const context = application({}, () => now);
    const connected = await context.application.startFromVerifiedTwitch({
      channelId: "channel-1",
      displayName: "Streamer One",
      gameId: "minecraft",
      gameName: "Minecraft",
    });
    await ingestGameplaySnapshot(context, connected);

    expect((await context.application.read(connected.grant, null)).readiness.ready).toBe(true);

    now += 11_000;
    const stale = await context.application.read(connected.grant, null);
    expect(stale.readiness).toMatchObject({
      ready: false,
      label: "Gameplay Capture stopped — reopen Gameplay Engine",
      recommendedAction: "request-capture-permission",
    });
    expect(stale.readiness.blockerCodes).toContain("gameplay-capture-stale");
    expect(stale.readiness.services.find((service) => service.service === "obs-capture"))
      .toMatchObject({ health: { status: "unavailable", retryable: true } });
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
      expectedProfileRevision: started.view.profile.revision,
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

  it("keeps saved defaults separate from the active stream game unless capture applies both", async () => {
    const context = application();
    const started = await context.application.startFromVerifiedTwitch({
      channelId: "channel-1",
      displayName: "Streamer One",
      gameId: "minecraft",
      gameName: "Minecraft",
    });
    const savedOnly = streamerProfileSettingsCommandSchema.parse({
      contractVersion: CONTRACT_VERSION,
      sessionId: started.view.session.sessionId,
      questCycleId: null,
      commandId: "profile-default-game-only",
      correlationId: "profile-default-game-only",
      expectedRevision: started.view.session.revision,
      expectedProfileRevision: started.view.profile.revision,
      issuedAt: NOW,
      actor: { kind: "broadcaster", actorId: "channel-1" },
      type: "streamer.profile-settings",
      game: { gameId: "fortnite", gameName: "Fortnite" },
      experiencePatch: {},
    });

    const defaultChanged = await context.application.execute(started.grant, null, savedOnly);
    expect(defaultChanged.view.profile.gameName).toBe("Fortnite");
    expect(defaultChanged.view.session.currentGame).toEqual({
      gameId: "minecraft",
      gameName: "Minecraft",
      source: "twitch",
    });

    const applyBoth = streamerProfileSettingsCommandSchema.parse({
      ...savedOnly,
      commandId: "profile-current-game-too",
      correlationId: "profile-current-game-too",
      expectedRevision: defaultChanged.view.session.revision,
      expectedProfileRevision: defaultChanged.view.profile.revision,
      game: { gameId: "brawl-stars", gameName: "Brawl Stars" },
      gameApplication: "saved-and-current",
    });
    const currentChanged = await context.application.execute(started.grant, null, applyBoth);

    expect(currentChanged.view.profile.gameName).toBe("Brawl Stars");
    expect(currentChanged.view.session.currentGame).toEqual({
      gameId: "brawl-stars",
      gameName: "Brawl Stars",
      source: "streamer",
    });
  });

  it("isolates profiles and authorised reads between Twitch broadcaster accounts", async () => {
    const context = application();
    const first = await context.application.startFromVerifiedTwitch({
      channelId: "channel-one",
      displayName: "Streamer One",
      gameId: "minecraft",
      gameName: "Minecraft",
    });
    const firstCommand = streamerProfileSettingsCommandSchema.parse({
      contractVersion: CONTRACT_VERSION,
      sessionId: first.view.session.sessionId,
      questCycleId: null,
      commandId: "profile-account-one",
      correlationId: "profile-account-one",
      expectedRevision: first.view.session.revision,
      expectedProfileRevision: first.view.profile.revision,
      issuedAt: NOW,
      actor: { kind: "broadcaster", actorId: "channel-one" },
      type: "streamer.profile-settings",
      experiencePatch: { intensity: 0.9 },
      restrictions: ["Account one only"],
    });
    await context.application.execute(first.grant, null, firstCommand);

    const second = await context.application.startFromVerifiedTwitch({
      channelId: "channel-two",
      displayName: "Streamer Two",
      gameId: "brawl-stars",
      gameName: "Brawl Stars",
    });
    const firstRead = await context.application.read(first.grant, null);
    const secondRead = await context.application.read(second.grant, null);

    expect(firstRead.view.profile.streamerId).toBe("channel-one");
    expect(firstRead.view.profile.restrictions).toEqual(["Account one only"]);
    expect(secondRead.view.profile.streamerId).toBe("channel-two");
    expect(secondRead.view.profile.restrictions).toEqual([]);
    expect(secondRead.view.profile.experience.intensity).not.toBe(0.9);
  });

  it("hydrates a new stream from the saved profile without letting Twitch overwrite defaults", async () => {
    const context = application();
    const started = await context.application.startFromVerifiedTwitch({
      channelId: "channel-1",
      displayName: "Streamer One",
      gameId: "minecraft",
      gameName: "Minecraft",
    });
    const customPreset = {
      ...started.view.profile.streamPresets[0],
      presetId: "saved-custom",
      name: "Saved Custom",
      origin: "custom" as const,
    };
    const command = streamerProfileSettingsCommandSchema.parse({
      contractVersion: CONTRACT_VERSION,
      sessionId: started.view.session.sessionId,
      questCycleId: null,
      commandId: "profile-persist-across-streams",
      correlationId: "profile-persist-across-streams",
      expectedRevision: started.view.session.revision,
      expectedProfileRevision: started.view.profile.revision,
      issuedAt: NOW,
      actor: { kind: "broadcaster", actorId: "channel-1" },
      type: "streamer.profile-settings",
      experiencePatch: {},
      streamPresets: [...started.view.profile.streamPresets, customPreset],
      selectedPresetId: customPreset.presetId,
    });
    const saved = await context.application.execute(started.grant, null, command);

    await context.application.synchronizeVerifiedTwitchOnline({
      broadcasterId: "channel-1",
      displayName: "Streamer One",
      deliveryId: "profile-online",
      occurredAt: NOW + 1_000,
    });
    await context.application.synchronizeVerifiedTwitchOffline({
      broadcasterId: "channel-1",
      displayName: "Streamer One",
      deliveryId: "profile-offline",
      occurredAt: NOW + 2_000,
    });
    const next = await context.application.startFromVerifiedTwitch({
      channelId: "channel-1",
      displayName: "Renamed on Twitch",
      gameId: "fortnite",
      gameName: "Fortnite",
    });

    expect(next.view.session.sessionId).not.toBe(started.view.session.sessionId);
    expect(next.view.profile.revision).toBe(saved.view.profile.revision);
    expect(next.view.profile.selectedPresetId).toBe("saved-custom");
    expect(next.view.profile.streamPresets.some((preset) => preset.presetId === "saved-custom")).toBe(true);
    expect(next.view.profile.displayName).toBe("Streamer One");
    expect(next.view.profile.gameName).toBe("Minecraft");
    expect(next.view.session.currentGame).toEqual({
      gameId: "fortnite",
      gameName: "Fortnite",
      source: "twitch",
    });
    expect(next.view.profileConnection).toMatchObject({
      accountStatus: "twitch-verified",
      profileOrigin: "memory",
      persistenceStatus: "temporary",
    });
  });

  it("rebases an authenticated Studio command while live inputs advance the session revision", async () => {
    const context = application();
    const started = await context.application.start(SETUP_KEY, {
      channelId: "channel-1",
      displayName: "Streamer One",
      gameId: "minecraft",
      gameName: "Minecraft",
    });
    await ingestGameplaySnapshot(context, started);
    const staleCommand = streamerProfileSettingsCommandSchema.parse({
      contractVersion: CONTRACT_VERSION,
      sessionId: started.view.session.sessionId,
      questCycleId: null,
      commandId: "profile-command-after-live-input",
      correlationId: "profile-command-after-live-input",
      expectedRevision: started.view.session.revision,
      expectedProfileRevision: started.view.profile.revision,
      issuedAt: NOW,
      actor: { kind: "broadcaster", actorId: "channel-1" },
      type: "streamer.profile-settings",
      experiencePatch: { intensity: 0.6 },
      keywordWatchlist: ["diamonds"],
      streamPresets: started.view.profile.streamPresets,
      selectedPresetId: "chill",
    });

    const result = await context.application.execute(started.grant, null, staleCommand);

    expect(result.outcome).toBe("committed");
    expect(result.view.profile.experience.intensity).toBe(0.6);
    expect(result.view.session.revision).toBeGreaterThan(started.view.session.revision);
  });

  it("does not rebase a stale full-profile write over a newer profile", async () => {
    const context = application();
    const started = await context.application.start(SETUP_KEY, {
      channelId: "channel-1",
      displayName: "Streamer One",
      gameId: "minecraft",
      gameName: "Minecraft",
    });
    const stale = streamerProfileSettingsCommandSchema.parse({
      contractVersion: CONTRACT_VERSION,
      sessionId: started.view.session.sessionId,
      questCycleId: null,
      commandId: "stale-profile-window",
      correlationId: "stale-profile-window",
      expectedRevision: started.view.session.revision,
      expectedProfileRevision: started.view.profile.revision,
      issuedAt: NOW,
      actor: { kind: "broadcaster", actorId: "channel-1" },
      type: "streamer.profile-settings",
      experiencePatch: { intensity: 0.1 },
    });
    const fresh = streamerProfileSettingsCommandSchema.parse({
      ...stale,
      commandId: "fresh-profile-window",
      correlationId: "fresh-profile-window",
      experiencePatch: { intensity: 0.9 },
    });

    const accepted = await context.application.execute(started.grant, null, fresh);
    expect(accepted.view.profile.experience.intensity).toBe(0.9);
    await expect(context.application.execute(started.grant, null, stale)).rejects.toMatchObject({
      code: "stale-revision",
      retryable: true,
    } satisfies Partial<StudioSessionApplicationError>);
    await expect(context.application.read(started.grant, null)).resolves.toMatchObject({
      view: { profile: { experience: { intensity: 0.9 } } },
    });
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
        objective: "I am going mining for iron.",
        desiredAudienceInvolvement: "Suggest the next safe route.",
        inputMethod: "speech",
        confidence: 0.82,
        requestedExpiresAt: NOW + 60 * 60 * 1_000,
      },
    });

    const result = await context.application.execute(started.grant, null, command);

    expect(result.outcome).toBe("committed");
    expect(result.view.liveDirector?.declaredIntent).toMatchObject({
      status: "known",
      goal: "Reach the next shelter",
      objective: "I am going mining for iron.",
      inputMethod: "speech",
      confidence: 0.82,
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
    expect(reopened.readiness.twitchAuthorization).toBe("verified");
    expect(reopened.readiness.services.find((service) => service.service === "twitch")?.health.message)
      .toContain("authorization is verified");
  });

  it("ends the active broadcaster session so the next Test Lab run starts clean", async () => {
    const context = application();
    const started = await context.application.start(SETUP_KEY, {
      channelId: "channel-1",
      displayName: "Streamer One",
      gameId: null,
      gameName: null,
    });
    const command = streamerServiceCommandSchema.parse({
      contractVersion: CONTRACT_VERSION,
      sessionId: started.view.session.sessionId,
      commandId: "test-lab-reset-1",
      correlationId: "test-lab-reset-1",
      expectedRevision: started.view.envelope.revision,
      issuedAt: NOW,
      actor: { kind: "broadcaster", actorId: "channel-1" },
      type: "streamer.session",
      action: "end",
    });

    const ended = await context.application.execute(started.grant, null, command);
    expect(ended.view.session.status).toBe("offline");
    expect(await context.persistence.twitchChannelSessions.findTwitchChannelSession("channel-1"))
      .toBeNull();

    const restarted = await context.application.start(SETUP_KEY, {
      channelId: "channel-1",
      displayName: "Streamer One",
      gameId: null,
      gameName: null,
    });
    expect(restarted.view.session.status).toBe("preparing");
    expect(restarted.view.session.sessionId).not.toBe(started.view.session.sessionId);
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
