import { describe, expect, it } from "vitest";

import { authoritativeSessionStateSchema } from "../../src/core";
import {
  HostedBoardAccessService,
  HostedBoardGrantCodec,
} from "../../src/realtime/server";
import { SessionLifecycleService, createMemoryPersistenceRuntime } from "../../src/realtime";
import { FIXTURE_NOW, persistenceState } from "./persistence-fixtures";

function codec() {
  return new HostedBoardGrantCodec(new Uint8Array(32).fill(7));
}

describe("hosted-board discovery and access", () => {
  it("exchanges a normalised room code for a short-lived HTTP-only grant", async () => {
    const runtime = createMemoryPersistenceRuntime();
    await runtime.lifecycle.bootstrap({
      roomCode: "ABCDEFGH",
      state: persistenceState(),
      createdAt: FIXTURE_NOW,
    });
    const service = new HostedBoardAccessService(
      runtime.hostedSessions,
      runtime.accessGrants,
      codec(),
      () => FIXTURE_NOW,
    );

    const result = await service.exchange({
      roomCode: " abcdefgh ",
      trustedShareOrigin: "https://chatxpt.example/studio",
      includeQr: true,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.view).toMatchObject({
      sessionId: "fixture-session",
      roomCode: "ABCDEFGH",
      actorKind: "anonymous",
      participationMode: "hosted-board",
    });
    expect(result.view.share.shareUrl).toBe(
      "https://chatxpt.example/quest-board/ABCDEFGH",
    );
    expect(result.view.share.qrPayload).toBe(result.view.share.shareUrl);
    expect(result.view.share.shareUrl).not.toContain(result.credential.value);
    expect(result.credential).toMatchObject({
      cookieName: "chatxpt_hosted_viewer",
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
    });
    expect(await service.authenticate(result.credential.value)).toMatchObject({
      sessionId: "fixture-session",
      actorKind: "anonymous",
      expiresAt: FIXTURE_NOW + 60 * 60 * 1_000,
    });
  });

  it("rejects tampered and expired grant credentials", async () => {
    const runtime = createMemoryPersistenceRuntime();
    await runtime.lifecycle.bootstrap({
      roomCode: "ABCDEFGH",
      state: persistenceState(),
      createdAt: FIXTURE_NOW,
    });
    let now = FIXTURE_NOW;
    const service = new HostedBoardAccessService(
      runtime.hostedSessions,
      runtime.accessGrants,
      codec(),
      () => now,
      1_000,
    );
    const result = await service.exchange({
      roomCode: "ABCDEFGH",
      trustedShareOrigin: "http://localhost:3000",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(await service.authenticate(`${result.credential.value}tampered`)).toBeNull();
    await new SessionLifecycleService(runtime.lifecycle).end(
      "fixture-session",
      0,
      FIXTURE_NOW + 1,
      "test-session-ended",
      "test-end-operation",
    );
    expect(await service.authenticate(result.credential.value)).toBeNull();
    now += 1_001;
    expect(await service.authenticate(result.credential.value)).toBeNull();
  });

  it("returns typed errors for invalid, missing, ended, and disabled rooms", async () => {
    const runtime = createMemoryPersistenceRuntime();
    const service = new HostedBoardAccessService(
      runtime.hostedSessions,
      runtime.accessGrants,
      codec(),
      () => FIXTURE_NOW,
    );
    await expect(
      service.exchange({ roomCode: "BAD", trustedShareOrigin: "https://chatxpt.example" }),
    ).resolves.toMatchObject({ ok: false, error: { code: "validation" } });
    await expect(
      service.exchange({
        roomCode: "ABCDEFGH",
        trustedShareOrigin: "https://chatxpt.example",
      }),
    ).resolves.toMatchObject({ ok: false, error: { code: "expired" } });

    const disabled = authoritativeSessionStateSchema.parse({
      ...persistenceState(),
      session: {
        ...persistenceState().session,
        capabilities: {
          ...persistenceState().session.capabilities,
          hostedViewerBoard: false,
        },
      },
    });
    await runtime.lifecycle.bootstrap({
      roomCode: "JKLMNPQR",
      state: disabled,
      createdAt: FIXTURE_NOW,
    });
    await expect(
      service.exchange({
        roomCode: "JKLMNPQR",
        trustedShareOrigin: "https://chatxpt.example",
      }),
    ).resolves.toMatchObject({ ok: false, error: { code: "unavailable-capability" } });

    const endedLookup = {
      findByRoomCode: async () =>
        authoritativeSessionStateSchema.parse({
          ...persistenceState(),
          session: {
            ...persistenceState().session,
            status: "ended",
            startedAt: FIXTURE_NOW,
            endedAt: FIXTURE_NOW + 1,
          },
        }),
      loadSession: async () => null,
    };
    const endedService = new HostedBoardAccessService(
      endedLookup,
      runtime.accessGrants,
      codec(),
      () => FIXTURE_NOW + 1,
    );
    await expect(
      endedService.exchange({
        roomCode: "ABCDEFGH",
        trustedShareOrigin: "https://chatxpt.example",
      }),
    ).resolves.toMatchObject({ ok: false, error: { code: "expired" } });
  });

  it("requires an allowed identity mode instead of silently downgrading", async () => {
    const runtime = createMemoryPersistenceRuntime();
    const noAnonymous = authoritativeSessionStateSchema.parse({
      ...persistenceState(),
      session: {
        ...persistenceState().session,
        capabilities: {
          ...persistenceState().session.capabilities,
          anonymousParticipation: false,
        },
      },
    });
    await runtime.lifecycle.bootstrap({
      roomCode: "ABCDEFGH",
      state: noAnonymous,
      createdAt: FIXTURE_NOW,
    });
    const service = new HostedBoardAccessService(
      runtime.hostedSessions,
      runtime.accessGrants,
      codec(),
      () => FIXTURE_NOW,
    );
    await expect(
      service.exchange({
        roomCode: "ABCDEFGH",
        trustedShareOrigin: "https://chatxpt.example",
      }),
    ).resolves.toMatchObject({ ok: false, error: { code: "forbidden" } });
    await expect(
      service.exchange({
        roomCode: "ABCDEFGH",
        trustedShareOrigin: "https://chatxpt.example",
        verifiedIdentity: { kind: "viewer", externalViewerId: "twitch-viewer" },
      }),
    ).resolves.toMatchObject({ ok: false, error: { code: "unavailable-capability" } });

    await expect(
      service.exchange({
        roomCode: "ABCDEFGH",
        trustedShareOrigin: "https://chatxpt.example",
        verifiedIdentity: { kind: "viewer", externalViewerId: "   " },
      }),
    ).resolves.toMatchObject({ ok: false, error: { code: "unauthenticated" } });
  });
});
