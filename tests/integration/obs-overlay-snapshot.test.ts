import { afterEach, describe, expect, it } from "vitest";

import { obsOverlayGrantPOST, obsOverlaySnapshotGET } from "../../src/app";
import {
  MAX_OBS_OVERLAY_READ_GRANT_MILLISECONDS,
  buildObsOverlaySnapshotUrl,
  issueObsOverlayReadGrant,
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
const ORIGINAL_OVERLAY_SETUP_KEY = process.env.CHATXPT_OBS_OVERLAY_SETUP_KEY;

afterEach(() => {
  if (ORIGINAL_OVERLAY_SETUP_KEY === undefined) {
    delete process.env.CHATXPT_OBS_OVERLAY_SETUP_KEY;
  } else {
    process.env.CHATXPT_OBS_OVERLAY_SETUP_KEY = ORIGINAL_OVERLAY_SETUP_KEY;
  }
});

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

  it("issues a bounded overlay-only Browser Source read grant that can recover the snapshot", async () => {
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

    const grant = await issueObsOverlayReadGrant(runtime, {
      baseUrl: "https://chatxpt.example/studio",
      sessionId: contractFixtureSession.sessionId,
      readKey: READ_KEY,
      now: FIXTURE_NOW,
      expiresAt: FIXTURE_NOW + MAX_OBS_OVERLAY_READ_GRANT_MILLISECONDS,
      minimumRevision: contractFixtureOverlayView.envelope.revision,
    });

    expect(grant.ok).toBe(true);
    if (!grant.ok) return;
    expect(grant).toMatchObject({
      role: "overlay",
      sessionId: contractFixtureSession.sessionId,
      readKey: READ_KEY,
      expiresAt: FIXTURE_NOW + MAX_OBS_OVERLAY_READ_GRANT_MILLISECONDS,
      reconnect: { nextPollMs: 1_000, stale: false },
    });
    expect(grant.snapshotUrl).toBe(
      `https://chatxpt.example/api/overlay/snapshot?sessionId=${contractFixtureSession.sessionId}&readKey=${READ_KEY}&minimumRevision=${contractFixtureOverlayView.envelope.revision}`,
    );
    await expect(
      runtime.accessGrants.canRead(
        READ_KEY,
        contractFixtureSession.sessionId,
        "streamer",
        FIXTURE_NOW + 1_000,
      ),
    ).resolves.toBe(false);
    await expect(
      runtime.accessGrants.canRead(
        READ_KEY,
        contractFixtureSession.sessionId,
        "viewer",
        FIXTURE_NOW + 1_000,
      ),
    ).resolves.toBe(false);

    const readable = await readObsOverlaySnapshot(runtime, {
      sessionId: contractFixtureSession.sessionId,
      readKey: READ_KEY,
      minimumRevision: contractFixtureOverlayView.envelope.revision,
      now: FIXTURE_NOW + 1_000,
    });

    expect(readable).toMatchObject({
      ok: true,
      role: "overlay",
      snapshot: { readOnly: true },
    });
  });

  it("fails closed when issuing an invalid or missing-session overlay read grant", async () => {
    const runtime = await preparedRuntime();
    const expired = await issueObsOverlayReadGrant(runtime, {
      baseUrl: "https://chatxpt.example",
      sessionId: contractFixtureSession.sessionId,
      readKey: READ_KEY,
      now: FIXTURE_NOW,
      expiresAt: FIXTURE_NOW,
    });
    const tooLong = await issueObsOverlayReadGrant(runtime, {
      baseUrl: "https://chatxpt.example",
      sessionId: contractFixtureSession.sessionId,
      readKey: READ_KEY,
      now: FIXTURE_NOW,
      expiresAt: FIXTURE_NOW + MAX_OBS_OVERLAY_READ_GRANT_MILLISECONDS + 1,
    });
    const missingSession = await issueObsOverlayReadGrant(runtime, {
      baseUrl: "https://chatxpt.example",
      sessionId: "missing-session",
      readKey: READ_KEY,
      now: FIXTURE_NOW,
      expiresAt: FIXTURE_NOW + 60_000,
    });

    expect(expired).toMatchObject({
      ok: false,
      error: { code: "validation", retryable: false },
    });
    expect(tooLong).toMatchObject({
      ok: false,
      error: { code: "validation", retryable: false },
    });
    expect(missingSession).toMatchObject({
      ok: false,
      error: { code: "dependency-unavailable", retryable: true },
    });
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

  it("protects the production grant route with a server-only setup key", async () => {
    delete process.env.CHATXPT_OBS_OVERLAY_SETUP_KEY;
    const unconfigured = await obsOverlayGrantPOST(
      new Request("http://localhost/api/overlay/grant", {
        method: "POST",
        body: JSON.stringify({ sessionId: contractFixtureSession.sessionId }),
      }),
    );
    const unconfiguredBody = await unconfigured.json();

    process.env.CHATXPT_OBS_OVERLAY_SETUP_KEY = "fixture-overlay-setup-secret";
    const forbidden = await obsOverlayGrantPOST(
      new Request("http://localhost/api/overlay/grant", {
        method: "POST",
        headers: { "x-chatxpt-overlay-setup-key": "wrong-secret" },
        body: JSON.stringify({ sessionId: contractFixtureSession.sessionId }),
      }),
    );
    const forbiddenBody = await forbidden.json();

    expect(unconfigured.status).toBe(503);
    expect(unconfiguredBody).toMatchObject({
      ok: false,
      error: { code: "dependency-unavailable", retryable: false },
    });
    expect(forbidden.status).toBe(403);
    expect(forbiddenBody).toMatchObject({
      ok: false,
      error: { code: "forbidden", retryable: false },
    });
  });

  it("fails closed for malformed or missing-session production grant requests", async () => {
    process.env.CHATXPT_OBS_OVERLAY_SETUP_KEY = "fixture-overlay-setup-secret";
    const headers = { "x-chatxpt-overlay-setup-key": "fixture-overlay-setup-secret" };
    const malformed = await obsOverlayGrantPOST(
      new Request("http://localhost/api/overlay/grant", {
        method: "POST",
        headers,
        body: JSON.stringify({ sessionId: contractFixtureSession.sessionId, expiresInMs: -1 }),
      }),
    );
    const malformedBody = await malformed.json();
    const missingSession = await obsOverlayGrantPOST(
      new Request("http://localhost/api/overlay/grant", {
        method: "POST",
        headers,
        body: JSON.stringify({ sessionId: "missing-session", expiresInMs: 60_000 }),
      }),
    );
    const missingSessionBody = await missingSession.json();

    expect(malformed.status).toBe(400);
    expect(malformedBody).toMatchObject({
      ok: false,
      error: { code: "validation", retryable: false },
    });
    expect(missingSession.status).toBe(503);
    expect(missingSessionBody).toMatchObject({
      ok: false,
      error: { code: "dependency-unavailable", retryable: true },
      source: {
        persistenceMode: "memory",
        evidenceClass: "unknown",
      },
    });
    expect(missingSessionBody).not.toHaveProperty("snapshotUrl");
  });
});
