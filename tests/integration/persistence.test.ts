import { describe, expect, it } from "vitest";

import {
  ChatXptOrchestrator,
  commandFingerprint,
  streamerQuestCommandSchema,
  viewerVoteCommandSchema,
  type OrchestratorDependencies,
  type StatePublisher,
} from "../../src/core";
import {
  CanonicalFixtureViewProjector,
  FixedFixtureClock,
  FixtureOnlyAllowAuthorizer,
  FixtureProjectionContextResolver,
  ScriptedFixtureQuestEngine,
  SequenceFixtureMessageIds,
  contractFixtureCandidateBatch,
  contractFixtureQuestCycle,
  contractFixtureSession,
} from "../../src/core/testing";
import {
  bindPersistenceRuntime,
  createMemoryPersistenceRuntime,
  sanitizeRoleViewsForBroadcast,
} from "../../src/realtime";
import { FIXTURE_NOW, persistenceState } from "./persistence-fixtures";

function command(commandId: string, expectedRevision = 0, action = "skip" as const) {
  return streamerQuestCommandSchema.parse({
    contractVersion: "1.0.0",
    sessionId: contractFixtureSession.sessionId,
    questCycleId: contractFixtureQuestCycle.envelope.questCycleId,
    commandId,
    correlationId: `correlation-${commandId}`,
    expectedRevision,
    issuedAt: FIXTURE_NOW + 1_000,
    actor: { kind: "broadcaster", actorId: contractFixtureSession.broadcasterId },
    type: "streamer.quest",
    action,
    candidateId: null,
  });
}

function voteCommand(
  commandId: string,
  expectedRevision: number,
  sourceMode: "twitch-extension" | "hosted-board" | "twitch-chat",
) {
  return viewerVoteCommandSchema.parse({
    contractVersion: "1.0.0",
    sessionId: contractFixtureSession.sessionId,
    questCycleId: contractFixtureQuestCycle.envelope.questCycleId,
    commandId,
    correlationId: `correlation-${commandId}`,
    expectedRevision,
    issuedAt: FIXTURE_NOW + 1_000,
    actor: { kind: "viewer", actorId: "fixture-viewer" },
    type: "viewer.vote",
    candidateId: contractFixtureCandidateBatch.candidates[0].candidateId,
    voterKey: "fixture-session-scoped-voter",
    sourceMode,
  });
}

function logicDependencies(): Omit<
  OrchestratorDependencies,
  "repository" | "candidateBatches" | "acceptedVotes" | "publisher"
> {
  return {
    authorizer: new FixtureOnlyAllowAuthorizer(),
    engine: new ScriptedFixtureQuestEngine((input) => ({
      ok: true,
      decision: {
        nextState: structuredClone(input.currentState),
        events: [
          {
            eventType: "fixture.persistence-accepted",
            attributes: { commandType: input.command.type },
          },
        ],
      },
    })),
    projectionContext: new FixtureProjectionContextResolver({
      participationMode: "hosted-board",
      viewerId: "private-viewer-id",
      sessionPoints: 450,
      acceptedCandidateId: null,
      connection: {
        service: "persistence",
        status: "ready",
        checkedAt: FIXTURE_NOW + 1_000,
        retryable: false,
      },
    }),
    projector: new CanonicalFixtureViewProjector(),
    clock: new FixedFixtureClock(FIXTURE_NOW + 1_000),
    ids: new SequenceFixtureMessageIds(),
  };
}

async function preparedRuntime() {
  const runtime = createMemoryPersistenceRuntime();
  await runtime.lifecycle.bootstrap({
    roomCode: "ABCDEFGH",
    state: persistenceState(),
    createdAt: FIXTURE_NOW,
  });
  return runtime;
}

describe("production-shaped memory persistence integration", () => {
  it("fingerprints commands canonically across JSONB key reordering", () => {
    const input = command("canonical-command");
    const reordered = Object.fromEntries(Object.entries(input).reverse()) as typeof input;

    expect(commandFingerprint(reordered)).toBe(commandFingerprint(input));
  });

  it("binds the orchestrator to atomic persistence and stores sanitised reconnect snapshots", async () => {
    const runtime = await preparedRuntime();
    const orchestrator = new ChatXptOrchestrator(
      bindPersistenceRuntime(logicDependencies(), runtime),
    );

    const result = await orchestrator.execute(command("memory-command"));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.delivery).toBe("published");
    expect((await runtime.sessions.load("fixture-session"))?.session.revision).toBe(1);
    expect(result.views?.viewer.viewerId).toBe("private-viewer-id");
    expect(result.views?.viewer.sessionPoints).toBe(450);

    const reconnect = await runtime.snapshots.readSnapshot("fixture-session", "viewer");
    expect(reconnect?.envelope.revision).toBe(1);
    expect(reconnect?.viewerId).toBeNull();
    expect(reconnect?.sessionPoints).toBe(0);
    expect(reconnect?.acceptedCandidateId).toBeNull();
    expect(reconnect?.privateRecovery?.status).toBe("unavailable");
    expect(reconnect?.privateRecovery?.acceptedCandidateId).toBeNull();
    expect(reconnect?.chatVote?.commandId).toBeNull();
  });

  it("resolves hosted-board room codes without exposing inactive sessions", async () => {
    const runtime = await preparedRuntime();

    const discovered = await runtime.hostedDiscovery?.discoverHostedBoard({
      roomCode: "ABCDEFGH",
      baseUrl: "https://chatxpt.example",
      at: FIXTURE_NOW + 1_000,
    });
    expect(discovered).toMatchObject({
      status: "available",
      sessionId: "fixture-session",
      roomCode: "ABCDEFGH",
      url: "https://chatxpt.example/viewer/hosted?room=ABCDEFGH",
    });

    const missing = await runtime.hostedDiscovery?.discoverHostedBoard({
      roomCode: "JKLMNPQR",
      baseUrl: "https://chatxpt.example",
      at: FIXTURE_NOW + 1_000,
    });
    expect(missing).toMatchObject({
      status: "unavailable",
      sessionId: null,
      roomCode: null,
      url: null,
    });
  });

  it("restores only the matching viewer's accepted participation", async () => {
    const runtime = await preparedRuntime();
    const orchestrator = new ChatXptOrchestrator(
      bindPersistenceRuntime(logicDependencies(), runtime),
    );

    const result = await orchestrator.execute(voteCommand("memory-vote", 0, "hosted-board"));

    expect(result.ok).toBe(true);
    const questCycleId = contractFixtureQuestCycle.envelope.questCycleId;
    expect(questCycleId).not.toBeNull();
    const restored = await runtime.viewerRecovery?.readViewerRecovery({
      sessionId: "fixture-session",
      questCycleId: questCycleId as string,
      viewerId: "fixture-viewer",
      voterKey: "fixture-session-scoped-voter",
      restoredAt: FIXTURE_NOW + 2_000,
    });
    expect(restored).toMatchObject({
      status: "identified",
      viewerId: "fixture-viewer",
      acceptedCandidateId: contractFixtureCandidateBatch.candidates[0].candidateId,
      acceptedAt: FIXTURE_NOW + 1_000,
      sourceMode: "hosted-board",
      sessionPoints: 1,
    });

    const otherViewer = await runtime.viewerRecovery?.readViewerRecovery({
      sessionId: "fixture-session",
      questCycleId: questCycleId as string,
      viewerId: "other-viewer",
      voterKey: "other-session-scoped-voter",
      restoredAt: FIXTURE_NOW + 2_000,
    });
    expect(otherViewer).toMatchObject({
      status: "identified",
      viewerId: "other-viewer",
      acceptedCandidateId: null,
      acceptedAt: null,
      sessionPoints: 0,
    });
  });

  it("keeps the first accepted vote final across participation surfaces", async () => {
    const runtime = await preparedRuntime();
    const orchestrator = new ChatXptOrchestrator(
      bindPersistenceRuntime(logicDependencies(), runtime),
    );

    const first = await orchestrator.execute(voteCommand("first-vote", 0, "twitch-extension"));
    const repeated = await orchestrator.execute(voteCommand("second-vote", 1, "twitch-chat"));

    expect(first.ok).toBe(true);
    expect(repeated.ok).toBe(false);
    if (repeated.ok) return;
    expect(repeated.error.code).toBe("duplicate");
    expect((await runtime.sessions.load(contractFixtureSession.sessionId))?.session.revision).toBe(1);

    const tally = await runtime.acceptedVotes.readAcceptedVoteTally({
      sessionId: contractFixtureSession.sessionId,
      questCycleId: contractFixtureQuestCycle.envelope.questCycleId ?? "missing-cycle",
      revision: 1,
      candidateIds: contractFixtureCandidateBatch.candidates.map(({ candidateId }) => candidateId) as [
        string,
        string,
        string,
      ],
      acceptedBefore: FIXTURE_NOW + 2_000,
      closedAt: FIXTURE_NOW + 2_000,
    });
    expect(tally.acceptedVoteCount).toBe(1);
    expect(tally.tallies[0]?.votes).toBe(1);

    const deadlineTally = await runtime.acceptedVotes.readAcceptedVoteTally({
      sessionId: contractFixtureSession.sessionId,
      questCycleId: contractFixtureQuestCycle.envelope.questCycleId ?? "missing-cycle",
      revision: 1,
      candidateIds: contractFixtureCandidateBatch.candidates.map(({ candidateId }) => candidateId) as [
        string,
        string,
        string,
      ],
      acceptedBefore: FIXTURE_NOW + 1_000,
      closedAt: FIXTURE_NOW + 2_000,
    });
    expect(deadlineTally.acceptedVoteCount).toBe(0);
  });

  it("returns one commit and one stale result for concurrent expected revisions", async () => {
    const runtime = await preparedRuntime();
    const orchestrator = new ChatXptOrchestrator(
      bindPersistenceRuntime(logicDependencies(), runtime),
    );

    const [first, second] = await Promise.all([
      orchestrator.execute(command("concurrent-one")),
      orchestrator.execute(command("concurrent-two")),
    ]);

    expect([first, second].filter((result) => result.ok)).toHaveLength(1);
    const rejected = [first, second].find((result) => !result.ok);
    expect(rejected?.ok).toBe(false);
    if (rejected?.ok === false) expect(rejected.error.code).toBe("stale-revision");
    expect((await runtime.sessions.load("fixture-session"))?.session.revision).toBe(1);
  });

  it("deduplicates identical command IDs and rejects reused IDs with different input", async () => {
    const runtime = await preparedRuntime();
    const orchestrator = new ChatXptOrchestrator(
      bindPersistenceRuntime(logicDependencies(), runtime),
    );
    const input = command("dedupe-command");

    const first = await orchestrator.execute(input);
    const duplicate = await orchestrator.execute(input);
    const reused = await orchestrator.execute({ ...input, action: "cancel" });

    expect(first.ok).toBe(true);
    expect(duplicate).toMatchObject({ ok: true, outcome: "duplicate", delivery: "not-republished" });
    expect(reused.ok).toBe(false);
    if (!reused.ok) expect(reused.error.code).toBe("duplicate");
  });

  it("stores candidate batches immutably", async () => {
    const runtime = await preparedRuntime();
    await runtime.candidates.store(contractFixtureCandidateBatch);
    await runtime.candidates.store(structuredClone(contractFixtureCandidateBatch));

    const reused = {
      ...structuredClone(contractFixtureCandidateBatch),
      candidates: contractFixtureCandidateBatch.candidates.map((candidate, index) =>
        index === 0 ? { ...candidate, rewardPoints: candidate.rewardPoints + 1 } : candidate,
      ),
    };
    await expect(runtime.candidates.store(reused)).rejects.toThrow("Candidate batch ID was reused");
  });

  it("scopes realtime read grants by principal, session, role, expiry, and revocation", async () => {
    const runtime = await preparedRuntime();
    await runtime.accessGrants.grant({
      principalId: "principal-one",
      sessionId: "fixture-session",
      viewRole: "viewer",
      expiresAt: FIXTURE_NOW + 10_000,
    });

    expect(
      await runtime.accessGrants.canRead(
        "principal-one",
        "fixture-session",
        "viewer",
        FIXTURE_NOW + 1,
      ),
    ).toBe(true);
    expect(
      await runtime.accessGrants.canRead(
        "principal-one",
        "fixture-session",
        "streamer",
        FIXTURE_NOW + 1,
      ),
    ).toBe(false);
    expect(
      await runtime.accessGrants.canRead(
        "principal-one",
        "fixture-session",
        "viewer",
        FIXTURE_NOW + 10_000,
      ),
    ).toBe(false);

    await runtime.accessGrants.revoke(
      "principal-one",
      "fixture-session",
      "viewer",
      FIXTURE_NOW + 2,
    );
    expect(
      await runtime.accessGrants.canRead(
        "principal-one",
        "fixture-session",
        "viewer",
        FIXTURE_NOW + 3,
      ),
    ).toBe(false);
  });

  it("persists snapshots before a transport-level notification callback", async () => {
    const runtime = await preparedRuntime();
    let revisionAtNotification: number | null = null;
    const publishing: StatePublisher = {
      async publish(views) {
        await runtime.snapshots.publish(sanitizeRoleViewsForBroadcast(views));
        revisionAtNotification = (
          await runtime.snapshots.readSnapshot("fixture-session", "overlay")
        )?.envelope.revision ?? null;
      },
    };
    const dependencies = bindPersistenceRuntime(logicDependencies(), runtime);
    const orchestrator = new ChatXptOrchestrator({ ...dependencies, publisher: publishing });

    await orchestrator.execute(command("ordered-publication"));

    expect(revisionAtNotification).toBe(1);
  });

  it("keeps committed authoritative state reconnectable when snapshot publication fails", async () => {
    const runtime = await preparedRuntime();
    const dependencies = bindPersistenceRuntime(logicDependencies(), runtime);
    const orchestrator = new ChatXptOrchestrator({
      ...dependencies,
      publisher: {
        async publish(views) {
          await runtime.snapshots.publish(views);
          throw new Error("fixture transport outage");
        },
      },
    });

    const result = await orchestrator.execute(command("failed-publication"));

    expect(result).toMatchObject({ ok: true, delivery: "pending-recovery" });
    expect((await runtime.sessions.load("fixture-session"))?.session.revision).toBe(1);
    expect((await runtime.snapshots.readSnapshot("fixture-session", "viewer"))?.envelope.revision).toBe(1);
  });
});
