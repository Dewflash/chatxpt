import { describe, expect, it } from "vitest";

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
  });
});
