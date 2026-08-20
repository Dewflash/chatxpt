import { describe, expect, it } from "vitest";

import {
  ChatXptOrchestrator,
  audiencePointerAggregateSchema,
  commandFingerprint,
  streamerLiveDirectorIntentCommandSchema,
  streamerQuestCommandSchema,
  systemLiveDirectorContextCommandSchema,
  viewerVoteCommandSchema,
  type AcceptedCommandReceipt,
  type AuthoritativeSessionState,
  type OrchestratorDependencies,
  type StatePublisher,
} from "../../src/core";
import {
  CanonicalFixtureViewProjector,
  FixedFixtureClock,
  FixtureOnlyAllowAuthorizer,
  FixtureProjectionContextResolver,
  ScriptedFixtureQuestEngine,
  ScriptedFixtureDirectorCueLifecycle,
  ScriptedFixtureDirectorCueConverter,
  SequenceFixtureMessageIds,
  contractFixtureCandidateBatch,
  contractFixtureAudiencePointerAggregate,
  contractFixtureGameplaySnapshot,
  contractFixtureQuestCycle,
  contractFixtureSession,
} from "../../src/core/testing";
import {
  bindPersistenceRuntime,
  buildSessionHistoryFromReceipts,
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
  | "repository"
  | "candidateBatches"
  | "audiencePointers"
  | "acceptedVotes"
  | "gameplaySnapshots"
  | "publisher"
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
    directorCues: new ScriptedFixtureDirectorCueLifecycle(() => ({
      ok: false,
      error: {
        code: "forbidden",
        message: "Fixture persistence test did not script a Director Cue transition",
        retryable: false,
      },
    })),
    directorCueConverter: new ScriptedFixtureDirectorCueConverter(() => ({
      ok: false,
      disposition: "no-publication",
      code: "fixture-conversion-not-scripted",
      reason: "Fixture persistence test did not script a Director Cue conversion",
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
  it("keeps one monotonic gameplay snapshot per matching active session", async () => {
    const runtime = await preparedRuntime();
    const first = {
      ...structuredClone(contractFixtureGameplaySnapshot),
      envelope: {
        ...structuredClone(contractFixtureGameplaySnapshot.envelope),
        occurredAt: FIXTURE_NOW + 100,
        receivedAt: FIXTURE_NOW + 100,
        messageId: "gameplay-current-1",
      },
    };
    const newer = {
      ...structuredClone(first),
      envelope: {
        ...structuredClone(first.envelope),
        occurredAt: FIXTURE_NOW + 200,
        receivedAt: FIXTURE_NOW + 200,
        messageId: "gameplay-current-2",
      },
    };

    await expect(runtime.gameplaySnapshots.ingest(first)).resolves.toMatchObject({
      status: "accepted",
    });
    await expect(runtime.gameplaySnapshots.ingest(first)).resolves.toMatchObject({
      status: "duplicate",
    });
    await expect(runtime.gameplaySnapshots.ingest(newer)).resolves.toMatchObject({
      status: "accepted",
    });
    await expect(runtime.gameplaySnapshots.ingest(first)).resolves.toEqual({
      status: "rejected",
      reason: "older-snapshot",
    });
    await expect(
      runtime.gameplaySnapshots.readCurrent({
        sessionId: newer.envelope.sessionId,
        questCycleId: newer.envelope.questCycleId,
        revision: newer.envelope.revision,
        evidenceClass: newer.envelope.evidenceClass,
      }),
    ).resolves.toMatchObject({ envelope: { messageId: "gameplay-current-2" } });

    const mismatched = {
      ...structuredClone(newer),
      envelope: { ...structuredClone(newer.envelope), revision: 99, messageId: "gameplay-wrong-revision" },
    };
    await expect(runtime.gameplaySnapshots.ingest(mismatched)).resolves.toEqual({
      status: "rejected",
      reason: "state-mismatch",
    });
  });

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
  });

  it("keeps the first accepted vote final across participation surfaces", async () => {
    const runtime = await preparedRuntime();
    const orchestrator = new ChatXptOrchestrator(
      bindPersistenceRuntime(logicDependencies(), runtime),
    );

    const first = await orchestrator.execute(voteCommand("first-vote", 0, "twitch-extension"));
    const repeated = await orchestrator.execute(voteCommand("second-vote", 1, "twitch-chat"));

    expect(first.ok).toBe(true);
    const restored = await runtime.viewerRecovery.readViewerRecovery({
      sessionId: contractFixtureSession.sessionId,
      questCycleId: contractFixtureQuestCycle.envelope.questCycleId ?? "missing-cycle",
      voterKey: "fixture-session-scoped-voter",
    });
    expect(restored).toEqual({
      sessionId: contractFixtureSession.sessionId,
      questCycleId: contractFixtureQuestCycle.envelope.questCycleId,
      acceptedCandidateId: contractFixtureCandidateBatch.candidates[0].candidateId,
      acceptedAt: FIXTURE_NOW + 1_000,
      sessionPoints: 0,
      sourceMode: "twitch-extension",
    });
    const otherViewer = await runtime.viewerRecovery.readViewerRecovery({
      sessionId: contractFixtureSession.sessionId,
      questCycleId: contractFixtureQuestCycle.envelope.questCycleId ?? "missing-cycle",
      voterKey: "another-session-scoped-voter",
    });
    expect(otherViewer.acceptedCandidateId).toBeNull();
    expect(otherViewer.sessionPoints).toBe(0);
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

  it("restores non-zero session-scoped points for participating viewers after success", async () => {
    const runtime = await preparedRuntime();
    const voteOrchestrator = new ChatXptOrchestrator(
      bindPersistenceRuntime(logicDependencies(), runtime),
    );
    expect(await voteOrchestrator.execute(
      voteCommand("rewarded-viewer-vote", 0, "twitch-extension"),
    )).toMatchObject({ ok: true });

    const rewardDependencies = logicDependencies();
    const rewardOrchestrator = new ChatXptOrchestrator(
      bindPersistenceRuntime({
        ...rewardDependencies,
        engine: new ScriptedFixtureQuestEngine((input) => ({
          ok: true,
          decision: {
            nextState: structuredClone(input.currentState),
            events: [{
              eventType: "quest-cycle.terminal",
              attributes: {
                outcome: "succeeded",
                rewardPointsAwarded: 100,
                hypeDelta: 10,
              },
            }],
          },
        })),
      }, runtime),
    );
    const terminal = streamerQuestCommandSchema.parse({
      contractVersion: "1.0.0",
      sessionId: contractFixtureSession.sessionId,
      questCycleId: contractFixtureQuestCycle.envelope.questCycleId,
      commandId: "reward-terminal-success",
      correlationId: "reward-terminal-correlation",
      expectedRevision: 1,
      issuedAt: FIXTURE_NOW + 1_000,
      actor: { kind: "broadcaster", actorId: contractFixtureSession.broadcasterId },
      type: "streamer.quest",
      action: "succeed",
      candidateId: contractFixtureCandidateBatch.candidates[0].candidateId,
    });
    expect(await rewardOrchestrator.execute(terminal)).toMatchObject({ ok: true });

    const restored = await runtime.viewerRecovery.readViewerRecovery({
      sessionId: contractFixtureSession.sessionId,
      questCycleId: contractFixtureQuestCycle.envelope.questCycleId ?? "missing-cycle",
      voterKey: "fixture-session-scoped-voter",
    });
    const otherViewer = await runtime.viewerRecovery.readViewerRecovery({
      sessionId: contractFixtureSession.sessionId,
      questCycleId: contractFixtureQuestCycle.envelope.questCycleId ?? "missing-cycle",
      voterKey: "another-session-scoped-voter",
    });

    expect(restored.sessionPoints).toBe(100);
    expect(otherViewer.sessionPoints).toBe(0);
    expect((await runtime.sessions.load(contractFixtureSession.sessionId))?.communityHype).toBe(10);
    expect(restored).not.toHaveProperty("crossStreamPoints");
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

  it("stages audience pointer deduplication inputs outside authoritative product history", async () => {
    const runtime = await preparedRuntime();
    await runtime.audiencePointers.store(contractFixtureAudiencePointerAggregate);
    await runtime.audiencePointers.store(structuredClone(contractFixtureAudiencePointerAggregate));

    await expect(
      runtime.audiencePointers.read(
        contractFixtureAudiencePointerAggregate.pointerId,
        contractFixtureSession.sessionId,
      ),
    ).resolves.toEqual(contractFixtureAudiencePointerAggregate);
    await expect(
      runtime.audiencePointers.read(
        contractFixtureAudiencePointerAggregate.pointerId,
        "different-session",
      ),
    ).resolves.toBeNull();
    expect(JSON.stringify(await runtime.sessions.load(contractFixtureSession.sessionId))).not.toContain(
      "participantKey",
    );

    const reused = {
      ...structuredClone(contractFixtureAudiencePointerAggregate),
      topic: "Different aggregate with a reused ID",
    };
    await expect(runtime.audiencePointers.store(reused)).rejects.toThrow(
      "Audience pointer aggregate ID was reused",
    );
  });

  it("persists only the composed Live Director aggregate across reconnect", async () => {
    const runtime = await preparedRuntime();
    const aggregate = audiencePointerAggregateSchema.parse({
      ...structuredClone(contractFixtureAudiencePointerAggregate),
      envelope: {
        ...structuredClone(contractFixtureAudiencePointerAggregate.envelope),
        revision: 1,
      },
    });
    await runtime.audiencePointers.store(aggregate);
    const orchestrator = new ChatXptOrchestrator(
      bindPersistenceRuntime(logicDependencies(), runtime),
    );
    const intent = streamerLiveDirectorIntentCommandSchema.parse({
      contractVersion: "1.0.0",
      sessionId: contractFixtureSession.sessionId,
      questCycleId: null,
      commandId: "memory-live-director-intent",
      correlationId: "memory-live-director-intent-correlation",
      expectedRevision: 0,
      issuedAt: FIXTURE_NOW,
      actor: { kind: "broadcaster", actorId: contractFixtureSession.broadcasterId },
      type: "streamer.live-director-intent",
      action: "set",
      intent: {
        goal: "Reach shelter safely",
        objective: "Invite chat to choose the next safe route.",
        desiredAudienceInvolvement: "Vote on the route.",
        requestedExpiresAt: FIXTURE_NOW + 60_000,
      },
    });
    const context = systemLiveDirectorContextCommandSchema.parse({
      contractVersion: "1.0.0",
      sessionId: contractFixtureSession.sessionId,
      questCycleId: contractFixtureQuestCycle.envelope.questCycleId,
      commandId: "memory-live-director-context",
      correlationId: "memory-live-director-context-correlation",
      expectedRevision: 1,
      issuedAt: FIXTURE_NOW,
      actor: { kind: "system", actorId: "fixture-orchestrator" },
      type: "system.live-director-context-ready",
      liveContextId: "memory-live-context",
      audiencePointerId: aggregate.pointerId,
    });

    expect((await orchestrator.execute(intent)).ok).toBe(true);
    expect((await orchestrator.execute(context)).ok).toBe(true);
    const recovered = await runtime.sessions.load(contractFixtureSession.sessionId);
    expect(recovered?.liveDirector?.audiencePointer).toMatchObject({
      status: "known",
      uniqueParticipants: 3,
      qualifyingMessages: 5,
    });
    expect(recovered?.liveDirector?.liveContext?.contextId).toBe("memory-live-context");
    const persisted = JSON.stringify(recovered);
    expect(persisted).not.toContain("participantKey");
    expect(persisted).not.toContain("messageFingerprint");
    expect(persisted).not.toContain("ephemeral-participant");
  });

  it("derives privacy-safe session history from terminal authoritative receipts", async () => {
    const runtime = await preparedRuntime();
    const acceptedAt = FIXTURE_NOW + 30_000;
    const base = persistenceState();
    const terminal: AuthoritativeSessionState = {
      ...base,
      session: {
        ...base.session,
        revision: 1,
      },
      questCycle: {
        ...base.questCycle,
        envelope: {
          ...base.questCycle.envelope,
          revision: 1,
        },
        status: "succeeded",
        options: structuredClone(contractFixtureCandidateBatch.candidates),
        activeCandidateId: contractFixtureCandidateBatch.candidates[0].candidateId,
        availableStreamerActions: [],
        voteTallies: [
          { candidateId: contractFixtureCandidateBatch.candidates[0].candidateId, votes: 2 },
          { candidateId: contractFixtureCandidateBatch.candidates[1].candidateId, votes: 1 },
          { candidateId: contractFixtureCandidateBatch.candidates[2].candidateId, votes: 0 },
        ],
        startsAt: FIXTURE_NOW + 10_000,
        endsAt: null,
        progress: {
          value: 1,
          updatedAt: acceptedAt,
          method: "manual",
          evidenceSignalIds: [],
        },
        completionRule: { mode: "manual", allowedSignalKinds: [] },
        result: {
          outcome: "succeeded",
          occurredAt: acceptedAt,
          reason: "Fixture terminal history result.",
          rewardPointsAwarded: 100,
        },
      },
    };
    const historyCommand = command("history-success");
    await runtime.sessions.commit({
      command: historyCommand,
      commandFingerprint: commandFingerprint(historyCommand),
      expectedRevision: 0,
      nextState: terminal,
      events: [],
      acceptedAt,
    });

    const history = await runtime.sessionHistory.readSessionHistory({
      broadcasterId: contractFixtureSession.broadcasterId,
      at: acceptedAt + 1,
      limit: 10,
    });

    expect(history).toMatchObject({
      broadcasterId: contractFixtureSession.broadcasterId,
      evidenceClass: "diagnostic",
      summary: {
        totalQuestCycles: 1,
        succeeded: 1,
        totalAcceptedVotes: 3,
        totalRewardPointsAwarded: 100,
      },
      privacy: {
        rawChatHistoryRetained: false,
        viewerIdentifiersIncluded: false,
        privateVoteReceiptsIncluded: false,
      },
    });
    expect(history.entries[0]).toMatchObject({
      title: "Hold Your Ground",
      outcome: "succeeded",
      acceptedVoteCount: 3,
      rewardPointsAwarded: 100,
    });
    expect(history.entries[0]).not.toHaveProperty("viewerId");
    expect(history.entries[0]).not.toHaveProperty("rawChat");
  });

  it("downgrades mixed history evidence to diagnostic instead of overclaiming live", () => {
    const base = persistenceState();
    const terminal: AuthoritativeSessionState = {
      ...base,
      session: { ...base.session, revision: 1 },
      gameplay: null,
      audience: null,
      questCycle: {
        ...base.questCycle,
        envelope: { ...base.questCycle.envelope, revision: 1, evidenceClass: "live" },
        status: "succeeded",
        options: structuredClone(contractFixtureCandidateBatch.candidates),
        activeCandidateId: contractFixtureCandidateBatch.candidates[0].candidateId,
        voteTallies: [
          { candidateId: contractFixtureCandidateBatch.candidates[0].candidateId, votes: 1 },
        ],
        startsAt: FIXTURE_NOW,
        result: {
          outcome: "succeeded",
          occurredAt: FIXTURE_NOW + 1_000,
          reason: "Live-like receipt for evidence downgrade test.",
          rewardPointsAwarded: 100,
        },
      },
    };
    const diagnostic: AuthoritativeSessionState = {
      ...terminal,
      session: { ...terminal.session, sessionId: "diagnostic-session", revision: 1 },
      questCycle: {
        ...terminal.questCycle,
        envelope: {
          ...terminal.questCycle.envelope,
          sessionId: "diagnostic-session",
          questCycleId: "diagnostic-cycle",
          evidenceClass: "diagnostic",
        },
      },
    };
    const liveCommand = command("history-live");
    const diagnosticCommand = command("history-diagnostic");
    const receipt: AcceptedCommandReceipt = {
      command: liveCommand,
      commandFingerprint: commandFingerprint(liveCommand),
      state: terminal,
      events: [],
      acceptedAt: FIXTURE_NOW + 1_000,
    };
    const diagnosticReceipt: AcceptedCommandReceipt = {
      command: diagnosticCommand,
      commandFingerprint: commandFingerprint(diagnosticCommand),
      state: diagnostic,
      events: [],
      acceptedAt: FIXTURE_NOW + 1_000,
    };

    const history = buildSessionHistoryFromReceipts({
      broadcasterId: contractFixtureSession.broadcasterId,
      receipts: [receipt, diagnosticReceipt],
      generatedAt: FIXTURE_NOW + 2_000,
      source: "orchestrator",
      evidenceClass: "live",
    });

    expect(history.evidenceClass).toBe("diagnostic");
    expect(history.entries.map((entry) => entry.evidenceClass).sort()).toEqual(["diagnostic", "live"]);
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
