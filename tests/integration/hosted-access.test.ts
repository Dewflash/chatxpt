import { describe, expect, it } from "vitest";

import {
  HostedBoardAccessService,
  createMemoryPersistenceRuntime,
  type HostedBoardSessionDirectory,
} from "../../src/realtime";
import { FIXTURE_NOW, persistenceState } from "./persistence-fixtures";

async function preparedRuntime() {
  const runtime = createMemoryPersistenceRuntime();
  await runtime.lifecycle.bootstrap({
    roomCode: "ABCDEFGH",
    state: persistenceState(),
    createdAt: FIXTURE_NOW,
  });
  return runtime;
}

describe("hosted board access seam", () => {
  it("normalises a room code, resolves the session, and grants viewer snapshot access", async () => {
    const runtime = await preparedRuntime();
    const service = new HostedBoardAccessService(
      runtime.hostedBoardSessions,
      runtime.accessGrants,
    );

    const result = await service.resolve({
      roomCode: " abcd efgh ",
      principalId: "viewer-principal",
      requestedAt: FIXTURE_NOW,
      expiresAt: FIXTURE_NOW + 60_000,
      viewerPathPrefix: "/quest-board",
    });

    expect(result).toMatchObject({
      status: "granted",
      sessionId: "fixture-session",
      roomCode: "ABCDEFGH",
      revision: 0,
      viewRole: "viewer",
      expiresAt: FIXTURE_NOW + 60_000,
      viewerPath: "/quest-board/ABCDEFGH",
      share: {
        roomCode: "ABCDEFGH",
        viewerPath: "/quest-board/ABCDEFGH",
        qrPayload: "/quest-board/ABCDEFGH",
      },
    });
    expect(
      await runtime.accessGrants.canRead(
        "viewer-principal",
        "fixture-session",
        "viewer",
        FIXTURE_NOW + 1,
      ),
    ).toBe(true);
  });

  it("returns typed hosted-board access failures without granting read access", async () => {
    const runtime = await preparedRuntime();
    const service = new HostedBoardAccessService(
      runtime.hostedBoardSessions,
      runtime.accessGrants,
    );

    await expect(
      service.resolve({
        roomCode: "ABC1",
        principalId: "viewer-principal",
        requestedAt: FIXTURE_NOW,
        expiresAt: FIXTURE_NOW + 60_000,
      }),
    ).resolves.toMatchObject({ status: "invalid-code", retryable: false });

    await expect(
      service.resolve({
        roomCode: "ZZZZZZZZ",
        principalId: "viewer-principal",
        requestedAt: FIXTURE_NOW,
        expiresAt: FIXTURE_NOW + 60_000,
      }),
    ).resolves.toMatchObject({ status: "not-found", retryable: false });

    const inactiveDirectory: HostedBoardSessionDirectory = {
      async findHostedBoardSession(roomCode) {
        return {
          sessionId: "ended-session",
          roomCode,
          status: "ended",
          revision: 5,
        };
      },
    };
    await expect(
      new HostedBoardAccessService(inactiveDirectory, runtime.accessGrants).resolve({
        roomCode: "ABCDEFGH",
        principalId: "viewer-principal",
        requestedAt: FIXTURE_NOW,
        expiresAt: FIXTURE_NOW + 60_000,
      }),
    ).resolves.toMatchObject({ status: "inactive", retryable: false });
  });
});
