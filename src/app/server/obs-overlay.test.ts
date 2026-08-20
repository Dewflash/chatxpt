import { describe, expect, it } from "vitest";

import { createMemoryPersistenceRuntime } from "@/realtime";

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
  return { overlay, started };
}

describe("ObsOverlayApplication", () => {
  it("lets authorised Studio issue an overlay URL without exposing the setup key", async () => {
    const { overlay, started } = await context();

    await expect(overlay.issueGrantForStudio(
      "https://chatxpt.example",
      { sessionId: started.view.session.sessionId },
      started.view.session.sessionId,
    )).resolves.toMatchObject({ descriptor: { width: 1920, height: 1080 } });
    await expect(overlay.issueGrantForStudio(
      "https://chatxpt.example",
      { sessionId: started.view.session.sessionId },
      "another-session",
    )).rejects.toMatchObject({ code: "forbidden" });
  });

  it("issues a fragment-held read grant and projects authoritative overlay state", async () => {
    const { overlay, started } = await context();
    const issued = await overlay.issueGrant(OVERLAY_KEY, "https://chatxpt.example", {
      sessionId: started.view.session.sessionId,
      width: 1280,
      height: 720,
    });

    expect(issued.descriptor.url).toContain("/obs-overlay?sessionId=");
    expect(new URL(issued.descriptor.url).searchParams.has("overlayAccessToken")).toBe(false);
    expect(issued.descriptor.url).toContain("#overlayAccessToken=");
    expect(issued.descriptor).toMatchObject({ width: 1280, height: 720, readOnly: true });

    const token = new URLSearchParams(new URL(issued.descriptor.url).hash.slice(1))
      .get("overlayAccessToken");
    const view = await overlay.read(
      `Bearer ${token}`,
      started.view.session.sessionId,
    );
    expect(view).toMatchObject({
      readOnly: true,
      session: { sessionId: started.view.session.sessionId },
      connection: { service: "obs-overlay", status: "ready" },
    });
  });

  it("rejects a wrong setup key and a cross-session read", async () => {
    const { overlay, started } = await context();
    await expect(
      overlay.issueGrant("wrong", "https://chatxpt.example", {
        sessionId: started.view.session.sessionId,
      }),
    ).rejects.toMatchObject({ code: "unauthenticated" } satisfies Partial<ObsOverlayApplicationError>);

    const issued = await overlay.issueGrant(OVERLAY_KEY, "https://chatxpt.example", {
      sessionId: started.view.session.sessionId,
    });
    const token = new URLSearchParams(new URL(issued.descriptor.url).hash.slice(1))
      .get("overlayAccessToken");
    await expect(overlay.read(`Bearer ${token}`, "another-session")).rejects.toMatchObject({
      code: "forbidden",
    } satisfies Partial<ObsOverlayApplicationError>);
  });
});
