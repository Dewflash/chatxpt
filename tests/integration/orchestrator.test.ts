import { describe, expect, it } from "vitest";

import {
  ChatXptOrchestrator,
  audiencePointerAggregateSchema,
  streamerEmergencyClearCommandSchema,
  streamerLiveDirectorIntentCommandSchema,
  streamerLiveDirectorCueCommandSchema,
  streamerProfileSettingsCommandSchema,
  streamerQuestCommandSchema,
  streamerQuestProgressCommandSchema,
  systemIntelligenceCommandSchema,
  systemLiveDirectorContextCommandSchema,
  systemQuestProgressCommandSchema,
  systemVoteCloseCommandSchema,
  viewerReactionCommandSchema,
  type AuthoritativeSessionState,
  type OrchestratorDependencies,
  type AcceptedVoteTallyReader,
  type QuestEngineResult,
  type StatePublisher,
  type GameplaySnapshot,
} from "../../src/core";
import {
  CanonicalFixtureViewProjector,
  FailingFixturePublisher,
  FixedFixtureClock,
  FixtureDenyAuthorizer,
  FixtureCurrentGameplaySnapshotRepository,
  FixtureOnlyAllowAuthorizer,
  FixtureProjectionContextResolver,
  FixtureSessionStateRepository,
  RecordingFixturePublisher,
  ScriptedFixtureAcceptedVoteTallyReader,
  ScriptedFixtureQuestEngine,
  SequenceFixtureMessageIds,
  StaticFixtureCandidateBatchReader,
  StaticFixtureAudiencePointerAggregateReader,
  contractFixtureAudiencePointerAggregate,
  contractFixtureAudienceSnapshot,
  contractFixtureCandidateBatch,
  contractFixtureGameplaySnapshot,
  contractFixtureLiveDirectorState,
  contractFixtureProfile,
  contractFixtureQuestCycle,
  contractFixtureSession,
} from "../../src/core/testing";
import { DefaultDirectorCueConverter, DefaultDirectorCueLifecycle } from "../../src/quest-engine";

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
    emergencyPaused: false,
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

function reactionCommand(commandId = "fixture-viewer-reaction", expectedRevision = 0) {
  return viewerReactionCommandSchema.parse({
    contractVersion: "1.0.0",
    sessionId: contractFixtureSession.sessionId,
    questCycleId: contractFixtureQuestCycle.envelope.questCycleId,
    commandId,
    correlationId: `correlation-${commandId}`,
    expectedRevision,
    issuedAt: ACCEPTED_AT,
    actor: { kind: "anonymous", actorId: null },
    type: "viewer.react",
    reaction: "hype",
  });
}

function liveDirectorCueCommand(
  commandId = "fixture-live-director-cue-command",
  expectedRevision = 0,
) {
  return streamerLiveDirectorCueCommandSchema.parse({
    contractVersion: "1.0.0",
    sessionId: contractFixtureSession.sessionId,
    questCycleId: contractFixtureQuestCycle.envelope.questCycleId,
    commandId,
    correlationId: `correlation-${commandId}`,
    expectedRevision,
    issuedAt: ACCEPTED_AT,
    actor: { kind: "moderator", actorId: "fixture-moderator" },
    type: "streamer.live-director-cue",
    cueId: contractFixtureLiveDirectorState.cue?.cueId,
    action: "later",
  });
}

function liveDirectorIntentCommand(
  commandId = "fixture-live-director-intent-command",
  expectedRevision = 0,
) {
  return streamerLiveDirectorIntentCommandSchema.parse({
    contractVersion: "1.0.0",
    sessionId: contractFixtureSession.sessionId,
    questCycleId: null,
    commandId,
    correlationId: `correlation-${commandId}`,
    expectedRevision,
    issuedAt: ACCEPTED_AT - 1,
    actor: { kind: "broadcaster", actorId: contractFixtureSession.broadcasterId },
    type: "streamer.live-director-intent",
    action: "set",
    intent: {
      goal: "Reach the next safe shelter",
      objective: "Explore carefully while involving chat in the route choice.",
      desiredAudienceInvolvement: "Vote on the next safe route.",
      requestedExpiresAt: ACCEPTED_AT + 600_000,
    },
  });
}

function liveDirectorContextCommand(
  commandId = "fixture-live-director-context-command",
  expectedRevision = 1,
  audiencePointerId: string | null = "fixture-pointer",
) {
  return systemLiveDirectorContextCommandSchema.parse({
    contractVersion: "1.0.0",
    sessionId: contractFixtureSession.sessionId,
    questCycleId: contractFixtureQuestCycle.envelope.questCycleId,
    commandId,
    correlationId: `correlation-${commandId}`,
    expectedRevision,
    issuedAt: ACCEPTED_AT,
    actor: { kind: "system", actorId: "fixture-orchestrator" },
    type: "system.live-director-context-ready",
    liveContextId: `context-${commandId}`,
    audiencePointerId,
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
  acceptedVotes: AcceptedVoteTallyReader = new ScriptedFixtureAcceptedVoteTallyReader(),
): OrchestratorDependencies {
  return {
    authorizer,
    candidateBatches: new StaticFixtureCandidateBatchReader(),
    audiencePointers: new StaticFixtureAudiencePointerAggregateReader([
      contractFixtureAudiencePointerAggregate,
    ]),
    acceptedVotes,
    gameplaySnapshots: new FixtureCurrentGameplaySnapshotRepository(),
    repository,
    engine,
    directorCues: new DefaultDirectorCueLifecycle(),
    directorCueConverter: new DefaultDirectorCueConverter(),
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
  it("hydrates the latest matching gameplay snapshot without a frame-level revision commit", async () => {
    const repository = new FixtureSessionStateRepository([initialState()]);
    const latestGameplay: GameplaySnapshot = {
      ...structuredClone(contractFixtureGameplaySnapshot),
      envelope: {
        ...structuredClone(contractFixtureGameplaySnapshot.envelope),
        messageId: "fixture-latest-gameplay",
        occurredAt: ACCEPTED_AT - 100,
        receivedAt: ACCEPTED_AT - 100,
      },
    };
    const orchestrator = new ChatXptOrchestrator({
      ...dependencies(repository, new RecordingFixturePublisher()),
      gameplaySnapshots: new FixtureCurrentGameplaySnapshotRepository([latestGameplay]),
    });

    const result = await orchestrator.execute(command("hydrate-latest-gameplay"));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.receipt.state.gameplay?.envelope.messageId).toBe("fixture-latest-gameplay");
    expect(result.receipt.state.services).toContainEqual(
      expect.objectContaining({ service: "gameplay-extraction", status: "degraded" }),
    );
    expect(result.receipt.state.session.revision).toBe(1);
  });

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

  it("records viewer reactions as community hype without invoking the quest engine", async () => {
    const state = initialState();
    const liveState: AuthoritativeSessionState = {
      ...state,
      session: {
        ...state.session,
        status: "live",
        startedAt: ACCEPTED_AT - 60_000,
        capabilities: { ...state.session.capabilities, reactions: true },
      },
      communityHype: 4,
    };
    const repository = new FixtureSessionStateRepository([liveState]);
    const recording = new RecordingFixturePublisher();
    const engine = successfulEngine();
    const orchestrator = new ChatXptOrchestrator(dependencies(repository, recording, engine));

    const result = await orchestrator.execute(reactionCommand());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.outcome).toBe("committed");
    expect(result.receipt.state.session.revision).toBe(1);
    expect(result.receipt.state.communityHype).toBe(5);
    expect(result.receipt.events[0]?.event).toMatchObject({
      eventType: "viewer.reaction-recorded",
      attributes: { reaction: "hype", hypeDelta: 1 },
    });
    expect(engine.calls).toBe(0);
    expect(recording.published[0]?.viewer.communityHype).toBe(5);
    expect(recording.published[0]?.overlay.communityHype).toBe(5);
  });

  it("applies broadcaster profile settings without invoking Role 3", async () => {
    const repository = new FixtureSessionStateRepository([initialState()]);
    const engine = successfulEngine();
    const publisher = new RecordingFixturePublisher();
    const orchestrator = new ChatXptOrchestrator(dependencies(repository, publisher, engine));
    const settings = streamerProfileSettingsCommandSchema.parse({
      contractVersion: "1.0.0",
      sessionId: contractFixtureSession.sessionId,
      questCycleId: null,
      commandId: "fixture-profile-settings",
      correlationId: "fixture-profile-settings-correlation",
      expectedRevision: 0,
      issuedAt: ACCEPTED_AT,
      actor: { kind: "broadcaster", actorId: contractFixtureSession.broadcasterId },
      type: "streamer.profile-settings",
      game: { gameId: "minecraft", gameName: "Minecraft Java Edition" },
      experiencePatch: { intensity: 0.8 },
      restrictions: ["No wagering", "No elytra challenges"],
      preferredQuestTypes: ["exploration", "chat-choice"],
      forbiddenQuestTypes: ["humiliation", "inventory-trash"],
      accessibilityNeeds: ["high-contrast", "reduced-motion"],
      voting: { voteVisibility: "hidden-until-close" },
      rewards: { rewardDisplay: "session-points" },
    });

    const result = await orchestrator.execute(settings);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(engine.calls).toBe(0);
    expect(result.receipt.state.session.revision).toBe(1);
    expect(result.receipt.state.profile.revision).toBe(1);
    expect(result.receipt.state.profile.gameId).toBe("minecraft");
    expect(result.receipt.state.profile.gameName).toBe("Minecraft Java Edition");
    expect(result.receipt.state.profile.restrictions).toEqual(["No wagering", "No elytra challenges"]);
    expect(result.receipt.state.profile.preferredQuestTypes).toEqual(["exploration", "chat-choice"]);
    expect(result.receipt.state.profile.forbiddenQuestTypes).toEqual(["humiliation", "inventory-trash"]);
    expect(result.receipt.state.profile.accessibilityNeeds).toEqual(["high-contrast", "reduced-motion"]);
    expect(result.receipt.state.profile.experience.intensity).toBe(0.8);
    expect(result.receipt.state.profile.voting).toMatchObject({
      voteVisibility: "hidden-until-close",
      voteDurationSeconds: 30,
      voteChangesAllowed: false,
    });
    expect(result.receipt.state.profile.rewards).toMatchObject({
      rewardDisplay: "session-points",
      persistentEconomy: false,
      monetaryRewards: false,
    });
    expect(result.receipt.state.questCycle.envelope.revision).toBe(1);
    expect(result.receipt.events[0]?.event.eventType).toBe("profile.settings-updated");
    expect(result.views?.streamer.profile.experience.intensity).toBe(0.8);
    expect(publisher.published[0]?.streamer.profile.voting.voteVisibility).toBe(
      "hidden-until-close",
    );
    expect(publisher.published[0]?.streamer.profile.gameName).toBe("Minecraft Java Edition");
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

  it("loads a neutral accepted tally for system vote-close without prescribing a winner", async () => {
    const votingEndsAt = ACCEPTED_AT;
    const base = initialState();
    const state: AuthoritativeSessionState = {
      ...base,
      recentQuests: [{ title: "Hold Your Ground", occurredAt: ACCEPTED_AT - 1_000 }],
      questCycle: {
        ...base.questCycle,
        status: "voting",
        options: structuredClone(contractFixtureCandidateBatch.candidates),
        availableStreamerActions: ["cancel", "skip", "emergency-pause"],
        voteTallies: contractFixtureCandidateBatch.candidates.map(({ candidateId }) => ({
          candidateId,
          votes: 0,
        })),
        startsAt: votingEndsAt - 30_000,
        endsAt: votingEndsAt,
      },
    };
    const repository = new FixtureSessionStateRepository([state]);
    const acceptedVotes = new ScriptedFixtureAcceptedVoteTallyReader((input) => ({
      sessionId: input.sessionId,
      questCycleId: input.questCycleId,
      revision: input.revision,
      closedAt: input.closedAt,
      acceptedVoteCount: 3,
      tallies: input.candidateIds.map((candidateId, index) => ({
        candidateId,
        votes: [2, 1, 0][index] ?? 0,
      })) as [
        { candidateId: string; votes: number },
        { candidateId: string; votes: number },
        { candidateId: string; votes: number },
      ],
    }));
    let observedTally: unknown = null;
    let observedCloseContext: unknown = null;
    const engine = new ScriptedFixtureQuestEngine((input) => {
      observedTally = input.acceptedVoteTally;
      observedCloseContext = input.voteCloseValidationContext;
      return {
        ok: true,
        decision: { nextState: structuredClone(input.currentState), events: [] },
      };
    });
    const close = systemVoteCloseCommandSchema.parse({
      contractVersion: "1.0.0",
      sessionId: state.session.sessionId,
      questCycleId: state.questCycle.envelope.questCycleId,
      commandId: "fixture-vote-close",
      correlationId: "fixture-vote-close-correlation",
      expectedRevision: 0,
      issuedAt: ACCEPTED_AT,
      actor: { kind: "system", actorId: "fixture-orchestrator" },
      type: "system.vote-close",
    });
    const orchestrator = new ChatXptOrchestrator(
      dependencies(
        repository,
        new RecordingFixturePublisher(),
        engine,
        new FixtureOnlyAllowAuthorizer(),
        acceptedVotes,
      ),
    );

    const result = await orchestrator.execute(close);

    expect(result.ok).toBe(true);
    expect(acceptedVotes.calls).toEqual([
      expect.objectContaining({
        acceptedBefore: votingEndsAt,
        closedAt: ACCEPTED_AT,
        revision: 0,
      }),
    ]);
    expect(observedTally).toMatchObject({ acceptedVoteCount: 3 });
    expect(observedTally).not.toHaveProperty("winnerCandidateId");
    expect(observedCloseContext).toMatchObject({
      profile: { profileId: state.profile.profileId },
      session: { sessionId: state.session.sessionId },
      gameplay: { envelope: { messageId: state.gameplay?.envelope.messageId } },
      audience: { envelope: { messageId: state.audience?.envelope.messageId } },
      recentQuests: [{ title: "Hold Your Ground", occurredAt: ACCEPTED_AT - 1_000 }],
    });
  });

  it("sets the durable emergency latch only after an authorised emergency-pause command commits", async () => {
    const repository = new FixtureSessionStateRepository([initialState()]);
    const orchestrator = new ChatXptOrchestrator(dependencies(repository, new RecordingFixturePublisher()));
    const pause = streamerQuestCommandSchema.parse({
      ...command("fixture-emergency-pause"),
      action: "emergency-pause",
    });

    const result = await orchestrator.execute(pause);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.receipt.state.emergencyPaused).toBe(true);
    expect((await repository.load(contractFixtureSession.sessionId))?.emergencyPaused).toBe(true);
  });

  it("clears the emergency latch with an authenticated Role 1 state command without invoking Role 3", async () => {
    const state = { ...initialState(), emergencyPaused: true };
    const repository = new FixtureSessionStateRepository([state]);
    const engine = successfulEngine();
    const orchestrator = new ChatXptOrchestrator(
      dependencies(repository, new RecordingFixturePublisher(), engine),
    );
    const clear = streamerEmergencyClearCommandSchema.parse({
      contractVersion: "1.0.0",
      sessionId: contractFixtureSession.sessionId,
      questCycleId: null,
      commandId: "fixture-emergency-clear",
      correlationId: "fixture-emergency-clear-correlation",
      expectedRevision: 0,
      issuedAt: ACCEPTED_AT,
      actor: { kind: "broadcaster", actorId: contractFixtureSession.broadcasterId },
      type: "streamer.emergency-clear",
    });

    const result = await orchestrator.execute(clear);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(engine.calls).toBe(0);
    expect(result.receipt.state.emergencyPaused).toBe(false);
    expect(result.receipt.events[0]?.event.eventType).toBe("session.emergency-cleared");
  });

  it("blocks new intervention candidate publication while the emergency latch is active", async () => {
    const state = { ...initialState(), emergencyPaused: true };
    const repository = new FixtureSessionStateRepository([state]);
    const publisher = new RecordingFixturePublisher();
    const engine = successfulEngine();
    const systemCommand = systemIntelligenceCommandSchema.parse({
      contractVersion: "1.0.0",
      sessionId: contractFixtureSession.sessionId,
      questCycleId: contractFixtureQuestCycle.envelope.questCycleId,
      commandId: "fixture-blocked-intelligence-command",
      correlationId: "fixture-blocked-intelligence-correlation",
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

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("forbidden");
    expect(engine.calls).toBe(0);
    expect(publisher.published).toHaveLength(0);
  });

  it("passes neutral progress validation context for manual and system progress commands", async () => {
    const base = initialState();
    const activeState: AuthoritativeSessionState = {
      ...base,
      questCycle: {
        ...base.questCycle,
        status: "active",
        options: structuredClone(contractFixtureCandidateBatch.candidates),
        activeCandidateId: contractFixtureCandidateBatch.candidates[0]?.candidateId ?? null,
        availableStreamerActions: ["cancel", "skip", "succeed", "fail", "emergency-pause"],
        startsAt: ACCEPTED_AT - 1_000,
        endsAt: ACCEPTED_AT + 30_000,
        completionRule: { mode: "signal", allowedSignalKinds: ["activity-intensity"] },
      },
    };
    const repository = new FixtureSessionStateRepository([activeState]);
    const observedContexts: unknown[] = [];
    const engine = new ScriptedFixtureQuestEngine((input) => {
      observedContexts.push(input.questProgressValidationContext);
      return {
        ok: true,
        decision: { nextState: structuredClone(input.currentState), events: [] },
      };
    });
    const orchestrator = new ChatXptOrchestrator(dependencies(repository, new RecordingFixturePublisher(), engine));
    const manual = streamerQuestProgressCommandSchema.parse({
      contractVersion: "1.0.0",
      sessionId: activeState.session.sessionId,
      questCycleId: activeState.questCycle.envelope.questCycleId,
      commandId: "fixture-manual-progress",
      correlationId: "fixture-manual-progress-correlation",
      expectedRevision: 0,
      issuedAt: ACCEPTED_AT,
      actor: { kind: "broadcaster", actorId: activeState.session.broadcasterId },
      type: "streamer.quest-progress",
      requestedValue: 0.5,
    });
    const system = systemQuestProgressCommandSchema.parse({
      ...manual,
      commandId: "fixture-system-progress",
      correlationId: "fixture-system-progress-correlation",
      expectedRevision: 1,
      actor: { kind: "system", actorId: "fixture-orchestrator" },
      type: "system.quest-progress",
      evidenceSignalIds: ["fixture-gameplay-signal-activity"],
    });

    expect((await orchestrator.execute(manual)).ok).toBe(true);
    expect((await orchestrator.execute(system)).ok).toBe(true);
    expect(observedContexts).toHaveLength(2);
    expect(observedContexts[0]).toMatchObject({
      completionRule: { mode: "signal", allowedSignalKinds: ["activity-intensity"] },
      profile: { profileId: activeState.profile.profileId },
    });
    expect(observedContexts[1]).toMatchObject({
      completionRule: { mode: "signal", allowedSignalKinds: ["activity-intensity"] },
      gameplay: { envelope: { messageId: activeState.gameplay?.envelope.messageId } },
    });
  });

  it("stores terminal quest history summaries for later vote-close validation", async () => {
    const base = initialState();
    const state: AuthoritativeSessionState = {
      ...base,
      questCycle: {
        ...base.questCycle,
        status: "active",
        options: structuredClone(contractFixtureCandidateBatch.candidates),
        activeCandidateId: contractFixtureCandidateBatch.candidates[1].candidateId,
        availableStreamerActions: ["cancel", "skip", "succeed", "fail", "emergency-pause"],
        startsAt: ACCEPTED_AT - 15_000,
        endsAt: ACCEPTED_AT + 30_000,
        progress: {
          value: 0,
          updatedAt: ACCEPTED_AT - 15_000,
          method: "unknown",
          evidenceSignalIds: [],
        },
      },
    };
    const repository = new FixtureSessionStateRepository([state]);
    const engine = new ScriptedFixtureQuestEngine((input) => ({
      ok: true,
      decision: {
        nextState: structuredClone(input.currentState),
        events: [
          {
            eventType: "quest-cycle.terminal",
            attributes: {
              outcome: "succeeded",
              historyCandidateId: contractFixtureCandidateBatch.candidates[1].candidateId,
            },
          },
        ],
      },
    }));
    const succeed = streamerQuestCommandSchema.parse({
      contractVersion: "1.0.0",
      sessionId: state.session.sessionId,
      questCycleId: state.questCycle.envelope.questCycleId,
      commandId: "fixture-terminal-history",
      correlationId: "fixture-terminal-history-correlation",
      expectedRevision: 0,
      issuedAt: ACCEPTED_AT,
      actor: { kind: "broadcaster", actorId: state.session.broadcasterId },
      type: "streamer.quest",
      action: "succeed",
      candidateId: contractFixtureCandidateBatch.candidates[1].candidateId,
    });
    const orchestrator = new ChatXptOrchestrator(
      dependencies(repository, new RecordingFixturePublisher(), engine),
    );

    const result = await orchestrator.execute(succeed);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.receipt.state.recentQuests).toEqual([
      { title: contractFixtureCandidateBatch.candidates[1].title, occurredAt: ACCEPTED_AT },
    ]);
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

  it("keeps Live Director projections revision-consistent and fails duplicate/stale cue commands closed", async () => {
    const state = { ...initialState(), liveDirector: structuredClone(contractFixtureLiveDirectorState) };
    const repository = new FixtureSessionStateRepository([state]);
    const publisher = new RecordingFixturePublisher();
    const engine = successfulEngine();
    const orchestrator = new ChatXptOrchestrator(dependencies(repository, publisher, engine));
    const input = liveDirectorCueCommand();

    const first = await orchestrator.execute(input);
    const duplicate = await orchestrator.execute(input);
    const stale = await orchestrator.execute(liveDirectorCueCommand("fixture-stale-live-director", 0));

    expect(first.ok).toBe(true);
    if (!first.ok || first.views === null) return;
    expect(first.views.streamer.liveDirector?.cue).toMatchObject({
      state: "postponed",
      reason: "Streamer postponed this cue once",
      availableActions: [],
    });
    expect(first.views.viewer.liveDirector).toEqual({
      publicContext: contractFixtureLiveDirectorState.publicContext,
    });
    expect(first.views.viewer.liveDirector).not.toHaveProperty("cue");
    expect(first.views.overlay).not.toHaveProperty("liveDirector");
    expect(
      [first.views.streamer, first.views.viewer, first.views.overlay].map(
        (view) => view.envelope.revision,
      ),
    ).toEqual([1, 1, 1]);

    expect(duplicate.ok).toBe(true);
    if (!duplicate.ok) return;
    expect(duplicate.outcome).toBe("duplicate");
    expect(duplicate.delivery).toBe("not-republished");
    expect(stale.ok).toBe(false);
    if (stale.ok) return;
    expect(stale.error.code).toBe("stale-revision");
    expect(engine.calls).toBe(0);
    expect(publisher.published).toHaveLength(1);
  });

  it("commits declared intent and composed private context without invoking the quest engine", async () => {
    const repository = new FixtureSessionStateRepository([initialState()]);
    const publisher = new RecordingFixturePublisher();
    const engine = successfulEngine();
    const aggregate = audiencePointerAggregateSchema.parse({
      ...structuredClone(contractFixtureAudiencePointerAggregate),
      envelope: {
        ...structuredClone(contractFixtureAudiencePointerAggregate.envelope),
        revision: 1,
      },
    });
    const orchestrator = new ChatXptOrchestrator({
      ...dependencies(repository, publisher, engine),
      audiencePointers: new StaticFixtureAudiencePointerAggregateReader([aggregate]),
    });

    const intent = await orchestrator.execute(liveDirectorIntentCommand());
    const staleIntent = await orchestrator.execute(
      liveDirectorIntentCommand("older-live-director-intent", 0),
    );
    const context = await orchestrator.execute(liveDirectorContextCommand());

    expect(intent.ok).toBe(true);
    expect(staleIntent.ok).toBe(false);
    if (!staleIntent.ok) expect(staleIntent.error.code).toBe("stale-revision");
    expect(context.ok).toBe(true);
    if (!context.ok || context.views === null) return;
    expect(context.receipt.state.session.revision).toBe(2);
    expect(context.receipt.state.liveDirector?.declaredIntent).toMatchObject({
      status: "known",
      intentId: "fixture-live-director-intent-command",
    });
    expect(context.receipt.state.liveDirector?.audiencePointer).toMatchObject({
      status: "known",
      uniqueParticipants: 3,
      qualifyingMessages: 5,
    });
    expect(
      context.receipt.state.liveDirector?.liveContext?.facts.map((fact) => fact.sourceClass),
    ).toEqual(expect.arrayContaining(["streamer-declared", "gameplay-observed", "audience-derived"]));
    expect(context.receipt.events).toHaveLength(1);
    expect(context.receipt.events[0].event).toEqual({
      eventType: "live-director.context-composed",
      attributes: {
        contextId: "context-fixture-live-director-context-command",
        audiencePointerStatus: "known",
        uniqueParticipants: 3,
        qualifyingMessages: 5,
        rawChatRetained: false,
      },
    });
    expect(context.views.streamer.liveDirector?.liveContext).not.toBeNull();
    expect(context.views.viewer.liveDirector).toEqual({ publicContext: null });
    expect(context.views.overlay).not.toHaveProperty("liveDirector");
    expect(engine.calls).toBe(0);
    expect(publisher.published).toHaveLength(2);

    const persisted = JSON.stringify(context.receipt.state);
    expect(persisted).not.toContain("participantKey");
    expect(persisted).not.toContain("messageFingerprint");
    expect(persisted).not.toContain("ephemeral-participant");
  });

  it("recovers composed context from authoritative state and fails duplicate/stale updates closed", async () => {
    const repository = new FixtureSessionStateRepository([initialState()]);
    const aggregate = audiencePointerAggregateSchema.parse({
      ...structuredClone(contractFixtureAudiencePointerAggregate),
      envelope: {
        ...structuredClone(contractFixtureAudiencePointerAggregate.envelope),
        revision: 1,
      },
    });
    const reader = new StaticFixtureAudiencePointerAggregateReader([aggregate]);
    const firstPublisher = new RecordingFixturePublisher();
    const firstOrchestrator = new ChatXptOrchestrator({
      ...dependencies(repository, firstPublisher),
      audiencePointers: reader,
    });
    await firstOrchestrator.execute(liveDirectorIntentCommand());
    const contextCommand = liveDirectorContextCommand();
    const first = await firstOrchestrator.execute(contextCommand);
    const duplicate = await firstOrchestrator.execute(contextCommand);
    const stale = await firstOrchestrator.execute(
      liveDirectorContextCommand("stale-context-command", 1),
    );

    expect(first.ok).toBe(true);
    expect(duplicate.ok).toBe(true);
    if (duplicate.ok) expect(duplicate.outcome).toBe("duplicate");
    expect(stale.ok).toBe(false);
    if (!stale.ok) expect(stale.error.code).toBe("stale-revision");

    const recovered = await repository.load(contractFixtureSession.sessionId);
    expect(recovered?.liveDirector?.liveContext?.contextId).toBe(
      "context-fixture-live-director-context-command",
    );
    const reconnectPublisher = new RecordingFixturePublisher();
    const reconnectOrchestrator = new ChatXptOrchestrator({
      ...dependencies(repository, reconnectPublisher),
      audiencePointers: reader,
    });
    const resumed = await reconnectOrchestrator.execute(command("reconnect-command", 2));
    expect(resumed.ok).toBe(true);
    if (!resumed.ok || resumed.views === null) return;
    expect(resumed.views.streamer.liveDirector?.liveContext?.contextId).toBe(
      "context-fixture-live-director-context-command",
    );
    expect(resumed.views.viewer.liveDirector).toEqual({ publicContext: null });
  });

  it("rejects unavailable audience aggregates and intents expired at server acceptance", async () => {
    const repository = new FixtureSessionStateRepository([initialState()]);
    const orchestrator = new ChatXptOrchestrator({
      ...dependencies(repository, new RecordingFixturePublisher()),
      audiencePointers: new StaticFixtureAudiencePointerAggregateReader(),
    });
    const expiredIntent = streamerLiveDirectorIntentCommandSchema.parse({
      ...liveDirectorIntentCommand("expired-intent-command"),
      issuedAt: ACCEPTED_AT - 2_000,
      intent: {
        ...liveDirectorIntentCommand("expired-intent-command").intent!,
        requestedExpiresAt: ACCEPTED_AT - 1_000,
      },
    });
    const expired = await orchestrator.execute(expiredIntent);
    expect(expired.ok).toBe(false);
    if (!expired.ok) expect(expired.error.code).toBe("expired");

    const missing = await orchestrator.execute(
      liveDirectorContextCommand("missing-pointer-command", 0),
    );
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.error.code).toBe("dependency-unavailable");
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
