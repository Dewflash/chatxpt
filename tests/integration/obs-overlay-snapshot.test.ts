import { describe, expect, it } from "vitest";

import { obsOverlaySnapshotGET } from "../../src/app";
import {
  buildObsOverlaySnapshotUrl,
  readObsOverlaySnapshot,
} from "../../src/integrations";
import { createMemoryPersistenceRuntime } from "../../src/realtime";
import {
  contractFixtureOverlayView,
  contractFixtureSession,
  contractFixtureStreamerView,
  contractFixtureViewerView,
} from "../../src/core/testing";
import { FIXTURE_NOW, persistenceState } from "./persistence-fixtures";

const READ_KEY = "obs-browser-source-read-key";

async function preparedRuntime() {
  const runtime = createMemoryPersistenceRuntime();
  await runtime.lifecycle.bootstrap({
    roomCode: "ABCDEF23",
    state: persistenceState(),
    createdAt: FIXTURE_NOW,
  });
  await runtime.snapshots.publish({
    streamer: contractFixtureStreamerView,
    viewer: contractFixtureViewerView,
    overlay: contractFixtureOverlayView,
  });
  await runtime.accessGrants.grant({
    principalId: READ_KEY,
    sessionId: contractFixtureSession.sessionId,
    viewRole: "overlay",
    expiresAt: FIXTURE_NOW + 60_000,
  });
  return runtime;
}

describe("OBS browser overlay snapshot seam", () => {
  it("builds a session-bound snapshot URL without exposing streamer or viewer state", () => {
    const url = buildObsOverlaySnapshotUrl({
      baseUrl: "https://chatxpt.example",
      sessionId: contractFixtureSession.sessionId,
      readKey: READ_KEY,
      minimumRevision: 3,
    });

    expect(url).toBe(
      `https://chatxpt.example/api/overlay/snapshot?sessionId=${contractFixtureSession.sessionId}&readKey=${READ_KEY}&minimumRevision=3`,
    );
  });

  it("returns only the authorised read-only overlay snapshot", async () => {
    const runtime = await preparedRuntime();

    const result = await readObsOverlaySnapshot(runtime, {
      sessionId: contractFixtureSession.sessionId,
      readKey: READ_KEY,
      now: FIXTURE_NOW + 1_000,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.role).toBe("overlay");
    expect(result.snapshot.readOnly).toBe(true);
    expect(result.snapshot).not.toHaveProperty("profile");
    expect(result.snapshot).not.toHaveProperty("viewerId");
    expect(result.snapshot.envelope.revision).toBe(contractFixtureOverlayView.envelope.revision);
    expect(result.reconnect).toEqual({ nextPollMs: 1_000, stale: false });
  });

  it("rejects missing or stale OBS read capabilities", async () => {
    const runtime = await preparedRuntime();

    const denied = await readObsOverlaySnapshot(runtime, {
      sessionId: contractFixtureSession.sessionId,
      readKey: "not-the-overlay-read-key",
      now: FIXTURE_NOW + 1_000,
    });
    expect(denied).toMatchObject({
      ok: false,
      error: { code: "unauthenticated" },
    });

    const stale = await readObsOverlaySnapshot(runtime, {
      sessionId: contractFixtureSession.sessionId,
      readKey: READ_KEY,
      minimumRevision: contractFixtureOverlayView.envelope.revision + 1,
      now: FIXTURE_NOW + 1_000,
    });
    expect(stale).toMatchObject({
      ok: false,
      error: {
        code: "stale-revision",
        details: {
          currentRevision: contractFixtureOverlayView.envelope.revision,
          minimumRevision: contractFixtureOverlayView.envelope.revision + 1,
        },
      },
    });
  });

  it("exposes the production route as a thin fail-closed OBS snapshot mount", async () => {
    const missing = await obsOverlaySnapshotGET(
      new Request("http://localhost/api/overlay/snapshot"),
    );
    const missingBody = await missing.json();

    expect(missing.status).toBe(400);
    expect(missingBody).toMatchObject({
      ok: false,
      error: { code: "validation" },
    });

    const noGrant = await obsOverlaySnapshotGET(
      new Request(
        `http://localhost/api/overlay/snapshot?sessionId=${contractFixtureSession.sessionId}&readKey=${READ_KEY}`,
      ),
    );
    const noGrantBody = await noGrant.json();

    expect(noGrant.status).toBe(401);
    expect(noGrantBody).toMatchObject({
      ok: false,
      error: { code: "unauthenticated" },
      source: {
        persistenceMode: "memory",
        evidenceClass: "unknown",
      },
    });
  });
});
