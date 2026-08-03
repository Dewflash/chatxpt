import { describe, expect, it } from "vitest";

import {
  ChatXptOrchestrator,
  streamerQuestCommandSchema,
  systemIntelligenceCommandSchema,
  type AuthoritativeSessionState,
  type OrchestratorDependencies,
  type QuestEngineResult,
  type StatePublisher,
} from "../../src/core";
import {
  CanonicalFixtureViewProjector,
  FailingFixturePublisher,
  FixedFixtureClock,
  FixtureDenyAuthorizer,
  FixtureOnlyAllowAuthorizer,
  FixtureProjectionContextResolver,
  FixtureSessionStateRepository,
  RecordingFixturePublisher,
  ScriptedFixtureQuestEngine,
  SequenceFixtureMessageIds,
  StaticFixtureCandidateBatchReader,
  contractFixtureAudienceSnapshot,
  contractFixtureCandidateBatch,
  contractFixtureGameplaySnapshot,
  contractFixtureProfile,
  contractFixtureQuestCycle,
  contractFixtureSession,
} from "../../src/core/testing";

const ACCEPTED_AT = contractFixtureQuestCycle.envelope.occurredAt + 1_000;

function initialState(): AuthoritativeSessionState {
  return {
    session: structuredClone(contractFixtureSession),
    profile: structuredClone(contractFixtureProfile),
    services: [
      {
        service: "fixture-realtime",
        status: "ready",
        checkedAt: ACCEPTED_AT,
        retryable: false,
      },
    ],
    gameplay: structuredClone(contractFixtureGameplaySnapshot),
    audience: structuredClone(contractFixtureAudienceSnapshot),
    questCycle: structuredClone(contractFixtureQuestCycle),
    communityHype: 0,
  };
}

function command(commandId = "fixture-streamer-command", expectedRevision = 0) {
  return streamerQuestCommandSchema.parse({
    contractVersion: "1.0.0",
    sessionId: contractFixtureSession.sessionId,
    questCycleId: contractFixtureQuestCycle.envelope.questCycleId,
    commandId,
    correlationId: `correlation-${commandId}`,
    expectedRevision,
    issuedAt: ACCEPTED_AT,
    actor: { kind: "broadcaster", actorId: contractFixtureSession.broadcasterId },
    type: "streamer.quest",
    action: "skip",
    candidateId: null,
  });
}

function successfulEngine() {
  return new ScriptedFixtureQuestEngine((input) => ({
    ok: true,
    decision: {
      nextState: structuredClone(input.currentState),
      events: [
        {
          eventType: "fixture.command-accepted",
          attributes: { commandType: input.command.type },
        },
      ],
    },
  }));
}

function dependencies(
  repository: FixtureSessionStateRepository,
  publisher: StatePublisher,
  engine = successfulEngine(),
  authorizer: OrchestratorDependencies["authorizer"] = new FixtureOnlyAllowAuthorizer(),
): OrchestratorDependencies {
  return {
    authorizer,
    candidateBatches: new StaticFixtureCandidateBatchReader(),
    repository,
    engine,
    projectionContext: new FixtureProjectionContextResolver({
      participationMode: "hosted-board",
      viewerId: null,
      sessionPoints: 0,
      acceptedCandidateId: null,
      connection: {
        service: "fixture-realtime",
        status: "ready",
        checkedAt: ACCEPTED_AT,
        retryable: false,
      },
    }),
    projector: new CanonicalFixtureViewProjector(),
    publisher,
    clock: new FixedFixtureClock(ACCEPTED_AT),
    ids: new SequenceFixtureMessageIds(),
  };
}

describe("Role 1 application orchestrator", () => {
  it("persists the authoritative revision before publishing role views", async () => {
    const repository = new FixtureSessionStateRepository([initialState()]);
    let persistedRevisionAtPublish: number | null = null;
    const recording = new RecordingFixturePublisher();
    const publisher: StatePublisher = {
      async publish(views) {
        persistedRevisionAtPublish = (await repository.load(contractFixtureSession.sessionId))?.session.revision ?? null;
        await recording.publish(views);
      },
    };
    const orchestrator = new ChatXptOrchestrator(dependencies(repository, publisher));

    const result = await orchestrator.execute(command());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.outcome).toBe("committed");
    expect(result.delivery).toBe("published");
    expect(result.receipt.state.session.revision).toBe(1);
    expect(result.receipt.state.questCycle.envelope.revision).toBe(1);
    expect(result.receipt.state.questCycle.envelope.source).toBe("orchestrator");
    expect(result.receipt.state.questCycle.envelope.evidenceClass).toBe("fixture");
    expect(result.receipt.events[0]?.envelope.revision).toBe(1);
    expect(persistedRevisionAtPublish).toBe(1);
    expect(recording.published).toHaveLength(1);
    expect(recording.published[0]?.streamer.envelope.revision).toBe(1);
    expect(recording.published[0]?.viewer.envelope.revision).toBe(1);
    expect(recording.published[0]?.overlay.envelope.revision).toBe(1);
  });

  it("passes a canonical candidate batch through the engine before persistence and broadcast", async () => {
    const repository = new FixtureSessionStateRepository([initialState()]);
    const publisher = new RecordingFixturePublisher();
    let observedCandidateCount = 0;
    const engine = new ScriptedFixtureQuestEngine((input) => {
      observedCandidateCount = input.candidateBatch?.candidates.length ?? 0;
      return {
        ok: true,
        decision: {
          nextState: structuredClone(input.currentState),
          events: [],
        },
      };
    });
    const systemCommand = systemIntelligenceCommandSchema.parse({
      contractVersion: "1.0.0",
      sessionId: contractFixtureSession.sessionId,
      questCycleId: contractFixtureQuestCycle.envelope.questCycleId,
      commandId: "fixture-intelligence-command",
      correlationId: "fixture-intelligence-correlation",
      expectedRevision: 0,
      issuedAt: ACCEPTED_AT,
      actor: { kind: "system", actorId: "fixture-orchestrator" },
      type: "system.intelligence-ready",
      candidateBatchId: contractFixtureCandidateBatch.envelope.messageId,
    });
    const configured = dependencies(repository, publisher, engine);
    const orchestrator = new ChatXptOrchestrator({
      ...configured,
      candidateBatches: new StaticFixtureCandidateBatchReader([contractFixtureCandidateBatch]),
    });

    const result = await orchestrator.execute(systemCommand);

    expect(result.ok).toBe(true);
    expect(observedCandidateCount).toBe(3);
    expect((await repository.load(contractFixtureSession.sessionId))?.session.revision).toBe(1);
    expect(publisher.published).toHaveLength(1);
  });

  it("returns the original receipt for an identical command without deciding or publishing twice", async () => {
    const repository = new FixtureSessionStateRepository([initialState()]);
    const publisher = new RecordingFixturePublisher();
    const engine = successfulEngine();
    const orchestrator = new ChatXptOrchestrator(dependencies(repository, publisher, engine));
    const input = command();

    const first = await orchestrator.execute(input);
    const duplicate = await orchestrator.execute(input);

    expect(first.ok).toBe(true);
    expect(duplicate.ok).toBe(true);
    if (!duplicate.ok) return;
    expect(duplicate.outcome).toBe("duplicate");
    expect(duplicate.delivery).toBe("not-republished");
    expect(duplicate.receipt.state.session.revision).toBe(1);
    expect(engine.calls).toBe(1);
    expect(publisher.published).toHaveLength(1);
  });

  it("rejects reuse of a command ID with different canonical input", async () => {
    const repository = new FixtureSessionStateRepository([initialState()]);
    const orchestrator = new ChatXptOrchestrator(
      dependencies(repository, new RecordingFixturePublisher()),
    );
    await orchestrator.execute(command());

    const reused = await orchestrator.execute({ ...command(), action: "cancel" });

    expect(reused.ok).toBe(false);
    if (reused.ok) return;
    expect(reused.error.code).toBe("duplicate");
  });

  it("rejects stale revisions before invoking the engine", async () => {
    const repository = new FixtureSessionStateRepository([initialState()]);
    const engine = successfulEngine();
    const orchestrator = new ChatXptOrchestrator(
      dependencies(repository, new RecordingFixturePublisher(), engine),
    );
    await orchestrator.execute(command());

    const stale = await orchestrator.execute(command("fixture-stale-command", 0));

    expect(stale.ok).toBe(false);
    if (stale.ok) return;
    expect(stale.error.code).toBe("stale-revision");
    expect(engine.calls).toBe(1);
  });

  it("applies the injected authorization policy before engine or persistence", async () => {
    const repository = new FixtureSessionStateRepository([initialState()]);
    const engine = successfulEngine();
    const orchestrator = new ChatXptOrchestrator(
      dependencies(
        repository,
        new RecordingFixturePublisher(),
        engine,
        new FixtureDenyAuthorizer(),
      ),
    );

    const denied = await orchestrator.execute(command());

    expect(denied.ok).toBe(false);
    if (denied.ok) return;
    expect(denied.error.code).toBe("forbidden");
    expect(engine.calls).toBe(0);
    expect((await repository.load(contractFixtureSession.sessionId))?.session.revision).toBe(0);
  });

  it("keeps a committed revision available for reconnect when broadcasting fails", async () => {
    const repository = new FixtureSessionStateRepository([initialState()]);
    const orchestrator = new ChatXptOrchestrator(
      dependencies(repository, new FailingFixturePublisher()),
    );

    const result = await orchestrator.execute(command());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.delivery).toBe("pending-recovery");
    expect(result.deliveryError?.code).toBe("dependency-unavailable");
    const reconnectSnapshot = await repository.load(contractFixtureSession.sessionId);
    expect(reconnectSnapshot?.session.revision).toBe(1);
    expect(reconnectSnapshot?.questCycle.envelope.revision).toBe(1);
  });

  it("rejects a quest-engine decision that crosses session identity", async () => {
    const repository = new FixtureSessionStateRepository([initialState()]);
    const engine = new ScriptedFixtureQuestEngine((input) => ({
      ok: true,
      decision: {
        nextState: {
          ...structuredClone(input.currentState),
          envelope: { ...input.currentState.envelope, sessionId: "different-session" },
        },
        events: [],
      },
    }));
    const orchestrator = new ChatXptOrchestrator(
      dependencies(repository, new RecordingFixturePublisher(), engine),
    );

    const result = await orchestrator.execute(command());

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("validation");
    expect((await repository.load(contractFixtureSession.sessionId))?.session.revision).toBe(0);
  });

  it("rejects malformed event drafts returned across the engine runtime boundary", async () => {
    const repository = new FixtureSessionStateRepository([initialState()]);
    const engine = new ScriptedFixtureQuestEngine(
      (input) =>
        ({
          ok: true,
          decision: {
            nextState: structuredClone(input.currentState),
            events: [{ eventType: "", attributes: {} }],
          },
        }) as QuestEngineResult,
    );
    const orchestrator = new ChatXptOrchestrator(
      dependencies(repository, new RecordingFixturePublisher(), engine),
    );

    const result = await orchestrator.execute(command());

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("validation");
    expect((await repository.load(contractFixtureSession.sessionId))?.session.revision).toBe(0);
  });

  it("lets only one concurrent command commit the expected revision", async () => {
    const repository = new FixtureSessionStateRepository([initialState()]);
    const engine = successfulEngine();
    const orchestrator = new ChatXptOrchestrator(
      dependencies(repository, new RecordingFixturePublisher(), engine),
    );

    const results = await Promise.all([
      orchestrator.execute(command("fixture-race-a", 0)),
      orchestrator.execute(command("fixture-race-b", 0)),
    ]);

    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(
      results.filter((result) => !result.ok && result.error.code === "stale-revision"),
    ).toHaveLength(1);
    expect((await repository.load(contractFixtureSession.sessionId))?.session.revision).toBe(1);
  });
});
