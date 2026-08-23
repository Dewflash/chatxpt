import { describe, expect, it } from "vitest";

import {
  CONTRACT_VERSION,
  streamerProfileSettingsCommandSchema,
  streamerQuestCommandSchema,
  streamerQuestGenerationCommandSchema,
} from "@/core";
import { createMemoryPersistenceRuntime, SessionLifecycleService } from "@/realtime";

import { ChatXptServerRuntime } from "./runtime";
import { ObsOverlayApplication, ObsOverlayApplicationError } from "./obs-overlay";
import { StudioSessionApplication } from "./studio-session";

const NOW = 1_780_000_000_000;
const STUDIO_KEY = "studio-test-key-that-is-at-least-32-characters";
const OVERLAY_KEY = "overlay-test-key-that-is-at-least-32-characters";

async function context() {
  let id = 0;
  const persistence = createMemoryPersistenceRuntime();
  const studio = new StudioSessionApplication({
    runtime: new ChatXptServerRuntime({ persistence, clock: { now: () => NOW } }),
    setupKey: STUDIO_KEY,
    extensionSecret: "",
    environment: {},
    now: () => NOW,
    nextId: () => `studio-${++id}`,
  });
  const started = await studio.start(STUDIO_KEY, {
    channelId: "channel-1",
    displayName: "Streamer One",
    gameId: null,
    gameName: null,
  });
  const overlay = new ObsOverlayApplication({
    runtime: new ChatXptServerRuntime({ persistence, clock: { now: () => NOW } }),
    setupKey: OVERLAY_KEY,
    now: () => NOW,
    nextId: () => `overlay-${++id}`,
  });
  return { overlay, persistence, started, studio };
}

async function activeManualDirectorContext(prefix: string) {
  const { overlay, started, studio } = await context();
  const selectedPresetId = started.view.profile.selectedPresetId;
  const manualProfile = await studio.execute(
    started.grant,
    null,
    streamerProfileSettingsCommandSchema.parse({
      contractVersion: CONTRACT_VERSION,
      sessionId: started.view.session.sessionId,
      questCycleId: null,
      commandId: `${prefix}-manual-mode`,
      correlationId: `${prefix}-manual-mode`,
      expectedRevision: started.view.envelope.revision,
      expectedProfileRevision: started.view.profile.revision,
      issuedAt: NOW,
      actor: { kind: "broadcaster", actorId: "channel-1" },
      type: "streamer.profile-settings",
      experiencePatch: {},
      streamPresets: started.view.profile.streamPresets.map((preset) => ({
        ...preset,
        voting: preset.presetId === selectedPresetId
          ? { ...preset.voting, winnerActivationMode: "streamer-approval" as const }
          : preset.voting,
      })),
      voting: { winnerActivationMode: "streamer-approval" },
    }),
  );
  const issued = await overlay.issueLiveDirectorInstallation(
    "channel-1",
    "https://chatxpt.example",
    {},
  );
  const token = new URLSearchParams(new URL(issued.descriptor.url).hash.slice(1))
    .get("directorAccessToken");
  if (token === null) throw new Error("Expected a private Live Director token");
  const generated = await overlay.executeLiveDirectorCommand(
    `Bearer ${token}`,
    "channel-1",
    streamerQuestGenerationCommandSchema.parse({
      contractVersion: CONTRACT_VERSION,
      sessionId: manualProfile.view.session.sessionId,
      questCycleId: manualProfile.view.questCycle.envelope.questCycleId,
      commandId: `${prefix}-generate`,
      correlationId: `${prefix}-generate`,
      expectedRevision: manualProfile.view.envelope.revision,
      issuedAt: NOW,
      actor: { kind: "broadcaster", actorId: "channel-1" },
      type: "streamer.quest-generation",
      mode: "deterministic-fallback",
    }),
  );
  const selected = generated.view.questCycle.options[0];
  const active = await overlay.executeLiveDirectorCommand(
    `Bearer ${token}`,
    "channel-1",
    streamerQuestCommandSchema.parse({
      contractVersion: CONTRACT_VERSION,
      sessionId: generated.view.session.sessionId,
      questCycleId: generated.view.questCycle.envelope.questCycleId,
      commandId: `${prefix}-start`,
      correlationId: `${prefix}-start`,
      expectedRevision: generated.view.envelope.revision,
      issuedAt: NOW,
      actor: { kind: "broadcaster", actorId: "channel-1" },
      type: "streamer.quest",
      action: "approve",
      candidateId: selected.candidateId,
    }),
  );
  return { active, overlay, started, studio, token };
}

describe("ObsOverlayApplication", () => {
  it("issues a reusable broadcaster installation and projects authoritative overlay state", async () => {
    const { overlay, persistence, started, studio } = await context();
    const issued = await overlay.issueInstallation("channel-1", "https://chatxpt.example", {
      width: 1280,
      height: 720,
    });

    expect(issued.descriptor.url).toContain("/obs-overlay?broadcasterId=channel-1");
    expect(new URL(issued.descriptor.url).searchParams.has("overlayAccessToken")).toBe(false);
    expect(issued.descriptor.url).toContain("#overlayAccessToken=");
    expect(issued.descriptor).toMatchObject({
      width: 1280,
      height: 720,
      readOnly: true,
      reusableAcrossSessions: true,
    });

    const token = new URLSearchParams(new URL(issued.descriptor.url).hash.slice(1))
      .get("overlayAccessToken");
    const view = await overlay.read(
      `Bearer ${token}`,
      { broadcasterId: "channel-1", sessionId: null },
    );
    expect(view).toMatchObject({
      readOnly: true,
      session: { sessionId: started.view.session.sessionId },
      connection: { service: "obs-overlay", status: "ready" },
    });

    const ended = await new SessionLifecycleService(persistence.lifecycle).end(
      started.view.session.sessionId,
      started.view.session.revision,
      NOW,
      "test-next-stream",
      "end-first-session",
    );
    expect(ended.ok).toBe(true);
    const next = await studio.start(STUDIO_KEY, {
      channelId: "channel-1",
      displayName: "Streamer One",
      gameId: null,
      gameName: null,
    });
    const nextView = await overlay.read(`Bearer ${token}`, {
      broadcasterId: "channel-1",
      sessionId: null,
    });
    expect(nextView.session.sessionId).toBe(next.view.session.sessionId);
    expect(nextView.session.sessionId).not.toBe(started.view.session.sessionId);
  });

  it("issues a permanent private Live Director installation that follows the broadcaster", async () => {
    const { overlay, persistence, started, studio } = await context();
    const issued = await overlay.issueLiveDirectorInstallation(
      "channel-1",
      "https://chatxpt.example",
      {},
    );
    expect(issued.descriptor).toMatchObject({
      role: "live-director",
      broadcasterId: "channel-1",
      readOnly: false,
      commandScope: [
        "quest-generation",
        "quest-approval",
        "quest-cancel",
        "quest-complete",
      ],
      reusableAcrossSessions: true,
      width: 420,
      height: 900,
    });
    const url = new URL(issued.descriptor.url);
    const token = new URLSearchParams(url.hash.slice(1)).get("directorAccessToken");
    expect(token).not.toBeNull();

    const firstView = await overlay.readLiveDirector(`Bearer ${token}`, "channel-1");
    expect(firstView).toMatchObject({
      session: { sessionId: started.view.session.sessionId },
      profile: { streamerId: "channel-1" },
    });
    await expect(
      overlay.read(`Bearer ${token}`, { broadcasterId: "channel-1", sessionId: null }),
    ).rejects.toMatchObject({ code: "forbidden" } satisfies Partial<ObsOverlayApplicationError>);

    const ended = await new SessionLifecycleService(persistence.lifecycle).end(
      started.view.session.sessionId,
      started.view.session.revision,
      NOW,
      "test-director-next-stream",
      "end-director-first-session",
    );
    expect(ended.ok).toBe(true);
    const next = await studio.start(STUDIO_KEY, {
      channelId: "channel-1",
      displayName: "Streamer One",
      gameId: null,
      gameName: null,
    });
    const nextView = await overlay.readLiveDirector(`Bearer ${token}`, "channel-1");
    expect(nextView.session.sessionId).toBe(next.view.session.sessionId);
    expect(nextView.session.sessionId).not.toBe(started.view.session.sessionId);
  });

  it("opens the same authoritative viewer vote when Live Director approves recommendations", async () => {
    const { overlay, started, studio } = await context();
    const proposed = await studio.execute(
      started.grant,
      null,
      streamerQuestGenerationCommandSchema.parse({
        contractVersion: CONTRACT_VERSION,
        sessionId: started.view.session.sessionId,
        questCycleId: started.view.questCycle.envelope.questCycleId,
        commandId: "live-director-generate-recommendations",
        correlationId: "live-director-generate-recommendations",
        expectedRevision: started.view.envelope.revision,
        issuedAt: NOW,
        actor: { kind: "broadcaster", actorId: "channel-1" },
        type: "streamer.quest-generation",
        mode: "deterministic-fallback",
      }),
    );
    expect(proposed.view.questCycle.status).toBe("proposed");
    expect(proposed.view.questCycle.options).toHaveLength(3);

    const issued = await overlay.issueLiveDirectorInstallation(
      "channel-1",
      "https://chatxpt.example",
      {},
    );
    const token = new URLSearchParams(new URL(issued.descriptor.url).hash.slice(1))
      .get("directorAccessToken");
    if (token === null) throw new Error("Expected a private Live Director token");
    const command = streamerQuestCommandSchema.parse({
      contractVersion: CONTRACT_VERSION,
      sessionId: proposed.view.session.sessionId,
      questCycleId: proposed.view.questCycle.envelope.questCycleId,
      commandId: "live-director-approve-recommendations",
      correlationId: "live-director-approve-recommendations",
      expectedRevision: proposed.view.envelope.revision,
      issuedAt: NOW,
      actor: { kind: "broadcaster", actorId: "channel-1" },
      type: "streamer.quest",
      action: "approve",
      candidateId: null,
    });
    const result = await overlay.executeLiveDirectorCommand(
      `Bearer ${token}`,
      "channel-1",
      command,
    );

    expect(result).toMatchObject({
      outcome: "committed",
      view: {
        questCycle: {
          status: "voting",
          options: expect.arrayContaining(proposed.view.questCycle.options),
        },
      },
    });
    expect(result.message).toContain("pushed");
    const studioView = await studio.read(started.grant, null);
    expect(studioView.view.questCycle.status).toBe("voting");
    expect(studioView.view.envelope.revision).toBe(result.view.envelope.revision);

    const publicInstallation = await overlay.issueInstallation(
      "channel-1",
      "https://chatxpt.example",
      {},
    );
    const publicToken = new URLSearchParams(
      new URL(publicInstallation.descriptor.url).hash.slice(1),
    ).get("overlayAccessToken");
    if (publicToken === null) throw new Error("Expected a public overlay token");
    const publicOverlay = await overlay.read(
      `Bearer ${publicToken}`,
      { broadcasterId: "channel-1", sessionId: null },
    );
    expect(publicOverlay).toMatchObject({
      envelope: { revision: result.view.envelope.revision },
      questCycle: {
        status: "voting",
        options: proposed.view.questCycle.options.map(({ candidateId }) => ({ candidateId })),
      },
    });
    await expect(overlay.executeLiveDirectorCommand(
      `Bearer ${token}`,
      "channel-1",
      command,
    )).resolves.toMatchObject({
      outcome: "duplicate",
      view: { envelope: { revision: result.view.envelope.revision } },
    });
  });

  it("generates and directly starts the selected quest from Live Director in manual mode", async () => {
    const { overlay, started, studio } = await context();
    const selectedPresetId = started.view.profile.selectedPresetId;
    const manualProfile = await studio.execute(
      started.grant,
      null,
      streamerProfileSettingsCommandSchema.parse({
        contractVersion: CONTRACT_VERSION,
        sessionId: started.view.session.sessionId,
        questCycleId: null,
        commandId: "live-director-manual-mode",
        correlationId: "live-director-manual-mode",
        expectedRevision: started.view.envelope.revision,
        expectedProfileRevision: started.view.profile.revision,
        issuedAt: NOW,
        actor: { kind: "broadcaster", actorId: "channel-1" },
        type: "streamer.profile-settings",
        experiencePatch: {},
        streamPresets: started.view.profile.streamPresets.map((preset) => ({
          ...preset,
          voting: preset.presetId === selectedPresetId
            ? { ...preset.voting, winnerActivationMode: "streamer-approval" as const }
            : preset.voting,
        })),
        voting: { winnerActivationMode: "streamer-approval" },
      }),
    );
    const issued = await overlay.issueLiveDirectorInstallation(
      "channel-1",
      "https://chatxpt.example",
      {},
    );
    const token = new URLSearchParams(new URL(issued.descriptor.url).hash.slice(1))
      .get("directorAccessToken");
    if (token === null) throw new Error("Expected a private Live Director token");

    const generated = await overlay.executeLiveDirectorCommand(
      `Bearer ${token}`,
      "channel-1",
      streamerQuestGenerationCommandSchema.parse({
        contractVersion: CONTRACT_VERSION,
        sessionId: manualProfile.view.session.sessionId,
        questCycleId: manualProfile.view.questCycle.envelope.questCycleId,
        commandId: "live-director-generate-manual-options",
        correlationId: "live-director-generate-manual-options",
        expectedRevision: manualProfile.view.envelope.revision,
        issuedAt: NOW,
        actor: { kind: "broadcaster", actorId: "channel-1" },
        type: "streamer.quest-generation",
        mode: "deterministic-fallback",
      }),
    );
    expect(generated).toMatchObject({
      view: { questCycle: { status: "proposed", options: [{}, {}, {}] } },
    });
    expect(generated.message).toContain("Choose one");

    const selected = generated.view.questCycle.options[1];
    const result = await overlay.executeLiveDirectorCommand(
      `Bearer ${token}`,
      "channel-1",
      streamerQuestCommandSchema.parse({
        contractVersion: CONTRACT_VERSION,
        sessionId: generated.view.session.sessionId,
        questCycleId: generated.view.questCycle.envelope.questCycleId,
        commandId: "live-director-start-manual-selection",
        correlationId: "live-director-start-manual-selection",
        expectedRevision: generated.view.envelope.revision,
        issuedAt: NOW,
        actor: { kind: "broadcaster", actorId: "channel-1" },
        type: "streamer.quest",
        action: "approve",
        candidateId: selected.candidateId,
      }),
    );

    expect(result).toMatchObject({
      view: {
        questCycle: {
          status: "active",
          activeCandidateId: selected.candidateId,
          voteTallies: [],
        },
      },
    });
    expect(result.message).toContain("without viewer voting");
    const studioView = await studio.read(started.grant, null);
    expect(studioView.view.questCycle.status).toBe("active");
    expect(studioView.view.envelope.revision).toBe(result.view.envelope.revision);
  });

  it("cancels or completes an active quest through the narrow Live Director grant", async () => {
    for (const [action, expectedStatus, expectedMessage] of [
      ["cancel", "cancelled", "cancelled"],
      ["succeed", "succeeded", "complete"],
    ] as const) {
      const { active, overlay, started, studio, token } =
        await activeManualDirectorContext(`live-director-${action}`);
      expect(active.view.questCycle.status).toBe("active");
      expect(active.view.questCycle.availableStreamerActions).toContain(action);

      if (action === "cancel") {
        await expect(overlay.executeLiveDirectorCommand(
          `Bearer ${token}`,
          "channel-1",
          streamerQuestCommandSchema.parse({
            contractVersion: CONTRACT_VERSION,
            sessionId: active.view.session.sessionId,
            questCycleId: active.view.questCycle.envelope.questCycleId,
            commandId: "live-director-disallowed-fail",
            correlationId: "live-director-disallowed-fail",
            expectedRevision: active.view.envelope.revision,
            issuedAt: NOW,
            actor: { kind: "broadcaster", actorId: "channel-1" },
            type: "streamer.quest",
            action: "fail",
            candidateId: null,
          }),
        )).rejects.toMatchObject({
          code: "validation",
        } satisfies Partial<ObsOverlayApplicationError>);
      }

      const command = streamerQuestCommandSchema.parse({
        contractVersion: CONTRACT_VERSION,
        sessionId: active.view.session.sessionId,
        questCycleId: active.view.questCycle.envelope.questCycleId,
        commandId: `live-director-${action}-active`,
        correlationId: `live-director-${action}-active`,
        expectedRevision: active.view.envelope.revision,
        issuedAt: NOW,
        actor: { kind: "broadcaster", actorId: "channel-1" },
        type: "streamer.quest",
        action,
        candidateId: null,
      });
      const result = await overlay.executeLiveDirectorCommand(
        `Bearer ${token}`,
        "channel-1",
        command,
      );

      expect(result.view.questCycle.status).toBe(expectedStatus);
      expect(result.message.toLowerCase()).toContain(expectedMessage);
      const studioView = await studio.read(started.grant, null);
      expect(studioView.view.questCycle.status).toBe(expectedStatus);
      expect(studioView.view.envelope.revision).toBe(result.view.envelope.revision);
      await expect(overlay.executeLiveDirectorCommand(
        `Bearer ${token}`,
        "channel-1",
        command,
      )).resolves.toMatchObject({
        outcome: "duplicate",
        view: { envelope: { revision: result.view.envelope.revision } },
      });
    }
  });

  it("rejects unauthenticated and cross-broadcaster reads", async () => {
    const { overlay } = await context();
    await expect(overlay.read(null, {
      broadcasterId: "channel-1",
      sessionId: null,
    })).rejects.toMatchObject({
      code: "unauthenticated",
    } satisfies Partial<ObsOverlayApplicationError>);
    await expect(
      overlay.issueInstallation("another-channel", "https://chatxpt.example", {}),
    ).rejects.toMatchObject({ code: "session-not-found" } satisfies Partial<ObsOverlayApplicationError>);
    const issued = await overlay.issueInstallation("channel-1", "https://chatxpt.example", {});
    const token = new URLSearchParams(new URL(issued.descriptor.url).hash.slice(1))
      .get("overlayAccessToken");
    await expect(overlay.read(`Bearer ${token}`, {
      broadcasterId: "another-channel",
      sessionId: null,
    })).rejects.toMatchObject({
      code: "forbidden",
    } satisfies Partial<ObsOverlayApplicationError>);
    await expect(
      overlay.executeLiveDirectorCommand(`Bearer ${token}`, "channel-1", {}),
    ).rejects.toMatchObject({
      code: "forbidden",
    } satisfies Partial<ObsOverlayApplicationError>);
  });
});
