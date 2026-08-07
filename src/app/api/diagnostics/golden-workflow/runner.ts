import {
  CONTRACT_VERSION,
  ChatXptOrchestrator,
  Role1InterventionCoordinator,
  audienceSnapshotSchema,
  candidateBatchSchema,
  contractEnvelopeSchema,
  gameplaySnapshotSchema,
  intelligenceSnapshotSchema,
  questCycleStateSchema,
  streamSessionSchema,
  streamerProfileSchema,
  streamerQuestCommandSchema,
  streamerQuestProgressCommandSchema,
  type CandidateBatch,
  type CandidateInput,
  type CandidateProvider,
  type CommandEnvelope,
  type ContractEnvelope,
  type OrchestratorResult,
  type QuestEngine,
  type QuestEngineEventDraft,
  type QuestEngineInput,
  type QuestEngineResult,
  type RoleViewModels,
  type ViewModelProjectionInput,
  type ViewModelProjector,
} from "../../../../core";
import { DefaultInterventionPolicy, DefaultQuestEngine } from "../../../../quest-engine";
import {
  MemoryChatXptPersistence,
  ServerCommandAuthorizer,
  SessionLifecycleService,
  type VerifiedCommandActor,
  type VerifiedCommandActorResolver,
} from "../../../../realtime";
import { VoteCloseScheduler } from "../../../../realtime/server";

const FIXTURE_TIME = 1_786_100_000_000;
const SESSION_ID = "golden-fixture-session";
const QUEST_CYCLE_ID = "golden-fixture-cycle";
const BROADCASTER_ID = "golden-fixture-broadcaster";
const SYSTEM_ACTOR_ID = "golden-fixture-system";
const VIEWER_ONE_KEY = "golden-viewer-one";
const VIEWER_TWO_KEY = "golden-viewer-two";

type GoldenStep =
  | {
      readonly name: string;
      readonly ok: true;
      readonly revision: number;
      readonly questStatus: string;
      readonly delivery?: string;
    }
  | {
      readonly name: string;
      readonly ok: false;
      readonly error: { readonly code: string; readonly message: string };
    };

export interface GoldenWorkflowHarnessResult {
  readonly ok: boolean;
  readonly reality: {
    readonly evidenceClass: "fixture";
    readonly liveInputsUsed: false;
    readonly label: "local diagnostic golden workflow";
    readonly limitations: readonly string[];
  };
  readonly steps: readonly GoldenStep[];
  readonly final: {
    readonly sessionRevision: number;
    readonly streamerRevision: number;
    readonly viewerRevision: number;
    readonly overlayRevision: number;
    readonly questStatus: string;
    readonly activeCandidateId: string | null;
    readonly resultOutcome: string | null;
    readonly rewardPointsAwarded: number | null;
    readonly snapshots: RoleViewModels;
  } | null;
}

class MutableClock {
  constructor(private current: number) {}

  now(): number {
    return this.current;
  }

  set(next: number): void {
    this.current = next;
  }

  advance(delta: number): number {
    this.current += delta;
    return this.current;
  }
}

class SequenceIds {
  private sequence = 0;

  nextId(kind: "quest-state" | "quest-event" | "view-model"): string {
    this.sequence += 1;
    return `golden-${kind}-${this.sequence}`;
  }
}

class GoldenActorResolver implements VerifiedCommandActorResolver {
  resolve(command: CommandEnvelope): VerifiedCommandActor | null {
    if (command.actor.kind === "broadcaster") {
      return {
        kind: "broadcaster",
        actorId: BROADCASTER_ID,
        expiresAt: null,
        moderatorForBroadcasterIds: [],
        voterKey: null,
        participationModes: [],
      };
    }
    if (command.actor.kind === "system") {
      return {
        kind: "system",
        actorId: command.actor.actorId,
        expiresAt: null,
        moderatorForBroadcasterIds: [],
        voterKey: null,
        participationModes: [],
      };
    }
    if (command.actor.kind === "anonymous" && command.type === "viewer.vote") {
      return {
        kind: "anonymous",
        actorId: null,
        expiresAt: null,
        moderatorForBroadcasterIds: [],
        voterKey: command.voterKey,
        participationModes: ["hosted-board"],
      };
    }
    return null;
  }
}

class GoldenViewProjector implements ViewModelProjector {
  project(input: ViewModelProjectionInput): RoleViewModels {
    const connection = {
      service: "fixture-realtime",
      status: "ready" as const,
      checkedAt: input.envelope.occurredAt,
      retryable: false,
    };
    return {
      streamer: {
        envelope: input.envelope,
        session: input.session,
        profile: input.profile,
        services: [...input.services],
        gameplay: input.gameplay,
        audience: input.audience,
        questCycle: input.questCycle,
        emergencyPaused: input.emergencyPaused,
      },
      viewer: {
        envelope: input.envelope,
        session: input.session,
        capabilities: input.capabilities,
        participationMode: input.participationMode,
        canVote: input.questCycle.status === "voting",
        canReact: false,
        viewerId: input.viewerId,
        sessionPoints: input.sessionPoints,
        communityHype: input.communityHype,
        acceptedCandidateId: input.acceptedCandidateId,
        questCycle: input.questCycle,
        connection,
      },
      overlay: {
        envelope: input.envelope,
        session: input.session,
        readOnly: true,
        communityHype: input.communityHype,
        questCycle: input.questCycle,
        connection,
      },
    };
  }
}

class FixtureCandidateProvider implements CandidateProvider {
  async generate(input: CandidateInput): Promise<CandidateBatch> {
    return candidateBatchSchema.parse({
      envelope: { ...input.envelope, messageId: "golden-candidate-batch" },
      candidates: [
        candidate("golden-candidate-1", "Hold Your Ground", "Stay in the safe playable area for the next 30 seconds.", 100),
        candidate("golden-candidate-2", "Caster Mode", "Narrate the next 30 seconds like a sports commentator.", 75),
        candidate("golden-candidate-3", "Plan Out Loud", "Explain your next move before taking the next major action.", 50),
      ],
    });
  }
}

class DiagnosticVoteCloseEngine implements QuestEngine {
  private readonly defaultEngine = new DefaultQuestEngine();

  decide(input: QuestEngineInput): QuestEngineResult {
    if (input.command.type !== "system.vote-close") return this.defaultEngine.decide(input);
    if (
      input.currentState.status !== "voting" ||
      input.acceptedVoteTally === null ||
      input.acceptedVoteTally === undefined ||
      input.currentState.options.length !== 3
    ) {
      return this.defaultEngine.decide(input);
    }
    const winner = [...input.acceptedVoteTally.tallies].sort(
      (left, right) => right.votes - left.votes,
    )[0];
    const winningCandidate = input.currentState.options.find(
      (candidate) => candidate.candidateId === winner?.candidateId,
    );
    if (winner === undefined || winner.votes === 0 || winningCandidate === undefined) {
      return this.defaultEngine.decide(input);
    }
    const nextState = questCycleStateSchema.parse({
      ...input.currentState,
      status: "active",
      activeCandidateId: winningCandidate.candidateId,
      availableStreamerActions: ["cancel", "skip", "succeed", "fail", "emergency-pause"],
      voteTallies: input.acceptedVoteTally.tallies,
      startsAt: input.now,
      endsAt: input.now + winningCandidate.durationSeconds * 1_000,
      progress: null,
      completionRule: { mode: "manual", allowedSignalKinds: [] },
      result: null,
    });
    const event: QuestEngineEventDraft = {
      eventType: "quest-cycle.fixture-vote-close-activated",
      attributes: {
        candidateId: winningCandidate.candidateId,
        acceptedVoteCount: input.acceptedVoteTally.acceptedVoteCount,
      },
    };
    return { ok: true, decision: { nextState, events: [event] } };
  }
}

function envelope(
  messageId: string,
  revision: number,
  occurredAt = FIXTURE_TIME,
): ContractEnvelope {
  return contractEnvelopeSchema.parse({
    contractVersion: CONTRACT_VERSION,
    sessionId: SESSION_ID,
    questCycleId: QUEST_CYCLE_ID,
    messageId,
    correlationId: "golden-fixture-correlation",
    revision,
    occurredAt,
    receivedAt: occurredAt,
    source: "test-fixture",
    evidenceClass: "fixture",
  });
}

function knownSignal(signalId: string, kind: string, value: number, confidence = 0.9) {
  return {
    signalId,
    kind,
    observation: {
      status: "known" as const,
      value,
      provenance: {
        source: "test-fixture" as const,
        method: "golden-workflow-fixture",
        confidence,
        observedAt: FIXTURE_TIME,
        receivedAt: FIXTURE_TIME,
        evidenceClass: "fixture" as const,
      },
    },
  };
}

function candidate(candidateId: string, title: string, instruction: string, rewardPoints: number) {
  return {
    candidateId,
    title,
    instruction,
    durationSeconds: 30,
    difficulty: "easy" as const,
    rewardPoints,
    rationale: "Fixture-only golden workflow candidate generated from neutral low-activity signals.",
    sourceSignalIds: ["golden-activity", "golden-boredom"],
    confidence: 0.82,
    generation: {
      method: "deterministic-fallback" as const,
      provider: null,
      generatedAt: FIXTURE_TIME,
    },
  };
}

function initialState() {
  const session = streamSessionSchema.parse({
    sessionId: SESSION_ID,
    broadcasterId: BROADCASTER_ID,
    platform: "twitch",
    status: "preparing",
    revision: 0,
    createdAt: FIXTURE_TIME,
    startedAt: null,
    endedAt: null,
    capabilities: {
      twitchExtension: false,
      hostedViewerBoard: true,
      twitchChatVoting: false,
      twitchIdentity: false,
      anonymousParticipation: true,
      reactions: false,
    },
  });
  const profile = streamerProfileSchema.parse({
    profileId: "golden-fixture-profile",
    streamerId: BROADCASTER_ID,
    revision: 0,
    displayName: "Golden Fixture Streamer",
    gameId: null,
    gameName: null,
    experience: {
      intensity: 0.5,
      creativity: 0.6,
    },
    restrictions: ["No unsafe or humiliating dares"],
    preferredQuestTypes: ["commentary", "positioning"],
    forbiddenQuestTypes: ["account", "wagering"],
    accessibilityNeeds: [],
  });
  const gameplay = gameplaySnapshotSchema.parse({
    envelope: envelope("golden-gameplay", 0),
    capabilities: {
      tier: "universal-visual",
      gameId: null,
      adapterId: null,
      supportedSignals: ["activity-intensity"],
    },
    signals: [knownSignal("golden-activity", "activity-intensity", 0.2)],
  });
  const audience = audienceSnapshotSchema.parse({
    envelope: envelope("golden-audience", 0),
    sampleSize: 2,
    signals: [
      knownSignal("golden-boredom", "audience-boredom", 0.9),
      knownSignal("golden-hype", "audience-hype", 0.6),
    ],
  });
  return {
    session,
    profile,
    services: [
      {
        service: "fixture-realtime",
        status: "ready" as const,
        checkedAt: FIXTURE_TIME,
        retryable: false,
      },
    ],
    gameplay,
    audience,
    questCycle: questCycleStateSchema.parse({
      envelope: envelope("golden-cycle", 0),
      status: "idle",
      options: [],
      activeCandidateId: null,
      availableStreamerActions: [],
      voteTallies: [],
      startsAt: null,
      endsAt: null,
      progress: null,
      completionRule: null,
      result: null,
    }),
    emergencyPaused: false,
    communityHype: 0,
  };
}

function commandEnvelopeFor(revision: number, messageId: string): ContractEnvelope {
  return envelope(messageId, revision, FIXTURE_TIME);
}

function stepFromResult(name: string, result: OrchestratorResult): GoldenStep {
  if (!result.ok) {
    return {
      name,
      ok: false,
      error: {
        code: result.error.code,
        message: result.error.message,
      },
    };
  }
  return {
    name,
    ok: true,
    revision: result.receipt.state.session.revision,
    questStatus: result.receipt.state.questCycle.status,
    delivery: result.delivery,
  };
}

function assertAccepted(name: string, result: OrchestratorResult): Extract<OrchestratorResult, { ok: true }> {
  if (!result.ok) throw new Error(`${name} failed: ${result.error.code} ${result.error.message}`);
  return result;
}

export async function runFixtureGoldenWorkflow(): Promise<GoldenWorkflowHarnessResult> {
  const steps: GoldenStep[] = [];
  const clock = new MutableClock(FIXTURE_TIME);
  const persistence = new MemoryChatXptPersistence();
  const lifecycle = new SessionLifecycleService(
    persistence,
    { next: () => "CHATXPT2" },
    { next: (action) => `golden-${action}` },
  );
  const created = await lifecycle.create(initialState(), FIXTURE_TIME);
  if (!created.ok) throw new Error(`session create failed: ${created.error.message}`);
  const started = await lifecycle.start(SESSION_ID, 0, clock.advance(1_000), "golden-start");
  if (!started.ok) throw new Error(`session start failed: ${started.error.message}`);

  const authorizer = new ServerCommandAuthorizer(new GoldenActorResolver(), () => clock.now());
  const orchestrator = new ChatXptOrchestrator({
    authorizer,
    candidateBatches: persistence,
    acceptedVotes: persistence,
    repository: persistence,
    engine: new DiagnosticVoteCloseEngine(),
    projectionContext: {
      resolve(state, command) {
        return {
          participationMode: "hosted-board",
          viewerId: command.actor.kind === "anonymous" ? command.type === "viewer.vote" ? command.voterKey : null : null,
          sessionPoints: state.questCycle.result?.rewardPointsAwarded ?? 0,
          acceptedCandidateId: command.type === "viewer.vote" ? command.candidateId : null,
          connection: {
            service: "fixture-realtime",
            status: "ready",
            checkedAt: clock.now(),
            retryable: false,
          },
        };
      },
    },
    projector: new GoldenViewProjector(),
    publisher: persistence,
    clock,
    ids: new SequenceIds(),
  });

  const liveState = await persistence.load(SESSION_ID);
  if (liveState === null) throw new Error("live session state was not persisted");
  const intelligence = intelligenceSnapshotSchema.parse({
    envelope: envelope("golden-intelligence", liveState.session.revision),
    gameplay: {
      ...liveState.gameplay,
      envelope: envelope("golden-gameplay-live", liveState.session.revision),
    },
    audience: {
      ...liveState.audience,
      envelope: envelope("golden-audience-live", liveState.session.revision),
    },
  });
  const coordinator = new Role1InterventionCoordinator(
    new DefaultInterventionPolicy(),
    new FixtureCandidateProvider(),
    persistence,
    orchestrator,
    () => clock.now(),
  );
  const intervention = await coordinator.run({
    state: liveState,
    intelligence,
    recentQuests: [],
    candidateInputEnvelope: commandEnvelopeFor(liveState.session.revision, "golden-candidate-input"),
    commandId: "golden-intelligence-ready",
    correlationId: "golden-correlation-intelligence",
    systemActorId: SYSTEM_ACTOR_ID,
    issuedAt: clock.now(),
  });
  if (!intervention.ok) throw new Error(`intervention failed: ${intervention.error.message}`);
  if (intervention.outcome !== "submitted") throw new Error("fixture intervention unexpectedly denied");
  steps.push(stepFromResult("intervention-candidates-submitted", intervention.orchestrator));
  const proposed = assertAccepted("intervention", intervention.orchestrator).receipt.state;

  clock.advance(500);
  const approve = await orchestrator.execute(
    streamerQuestCommandSchema.parse({
      contractVersion: CONTRACT_VERSION,
      sessionId: SESSION_ID,
      questCycleId: QUEST_CYCLE_ID,
      commandId: "golden-approve",
      correlationId: "golden-correlation-approve",
      expectedRevision: proposed.session.revision,
      issuedAt: clock.now(),
      actor: { kind: "broadcaster", actorId: BROADCASTER_ID },
      type: "streamer.quest",
      action: "approve",
      candidateId: null,
    }),
  );
  steps.push(stepFromResult("streamer-approves-vote", approve));
  const voting = assertAccepted("approve", approve).receipt.state;

  clock.advance(1_000);
  const voteOne = await orchestrator.execute({
    contractVersion: CONTRACT_VERSION,
    sessionId: SESSION_ID,
    questCycleId: QUEST_CYCLE_ID,
    commandId: "golden-vote-one",
    correlationId: "golden-correlation-vote-one",
    expectedRevision: voting.session.revision,
    issuedAt: clock.now(),
    actor: { kind: "anonymous", actorId: null },
    type: "viewer.vote",
    candidateId: "golden-candidate-1",
    voterKey: VIEWER_ONE_KEY,
    sourceMode: "hosted-board",
  });
  steps.push(stepFromResult("viewer-one-votes", voteOne));
  const afterVoteOne = assertAccepted("vote one", voteOne).receipt.state;

  clock.advance(1_000);
  const voteTwo = await orchestrator.execute({
    contractVersion: CONTRACT_VERSION,
    sessionId: SESSION_ID,
    questCycleId: QUEST_CYCLE_ID,
    commandId: "golden-vote-two",
    correlationId: "golden-correlation-vote-two",
    expectedRevision: afterVoteOne.session.revision,
    issuedAt: clock.now(),
    actor: { kind: "anonymous", actorId: null },
    type: "viewer.vote",
    candidateId: "golden-candidate-1",
    voterKey: VIEWER_TWO_KEY,
    sourceMode: "hosted-board",
  });
  steps.push(stepFromResult("viewer-two-votes", voteTwo));
  const afterVoteTwo = assertAccepted("vote two", voteTwo).receipt.state;

  if (afterVoteTwo.questCycle.endsAt === null) throw new Error("voting cycle has no authoritative deadline");
  clock.set(afterVoteTwo.questCycle.endsAt);
  const scheduler = new VoteCloseScheduler(persistence, orchestrator, clock);
  const closeSweep = await scheduler.closeDue();
  if (!closeSweep.ok) throw new Error(`vote-close sweep failed: ${closeSweep.error.message}`);
  const close = closeSweep.attempts[0]?.result;
  if (close === undefined) throw new Error("vote-close scheduler did not attempt the due cycle");
  steps.push(stepFromResult("vote-close-scheduler-activates-winner", close));
  const active = assertAccepted("vote close", close).receipt.state;

  clock.advance(1_000);
  const progress = await orchestrator.execute(
    streamerQuestProgressCommandSchema.parse({
      contractVersion: CONTRACT_VERSION,
      sessionId: SESSION_ID,
      questCycleId: QUEST_CYCLE_ID,
      commandId: "golden-progress-complete",
      correlationId: "golden-correlation-progress",
      expectedRevision: active.session.revision,
      issuedAt: clock.now(),
      actor: { kind: "broadcaster", actorId: BROADCASTER_ID },
      type: "streamer.quest-progress",
      requestedValue: 1,
    }),
  );
  steps.push(stepFromResult("streamer-updates-progress", progress));
  const progressed = assertAccepted("progress", progress).receipt.state;

  clock.advance(500);
  const succeed = await orchestrator.execute(
    streamerQuestCommandSchema.parse({
      contractVersion: CONTRACT_VERSION,
      sessionId: SESSION_ID,
      questCycleId: QUEST_CYCLE_ID,
      commandId: "golden-succeed",
      correlationId: "golden-correlation-succeed",
      expectedRevision: progressed.session.revision,
      issuedAt: clock.now(),
      actor: { kind: "broadcaster", actorId: BROADCASTER_ID },
      type: "streamer.quest",
      action: "succeed",
      candidateId: null,
    }),
  );
  steps.push(stepFromResult("streamer-marks-success", succeed));
  const finalState = assertAccepted("succeed", succeed).receipt.state;

  const streamer = await persistence.readSnapshot(SESSION_ID, "streamer");
  const viewer = await persistence.readSnapshot(SESSION_ID, "viewer");
  const overlay = await persistence.readSnapshot(SESSION_ID, "overlay");
  if (streamer === null || viewer === null || overlay === null) {
    throw new Error("final role snapshots were not published");
  }

  const snapshots = { streamer, viewer, overlay };
  const sameRevision =
    finalState.session.revision === streamer.envelope.revision &&
    streamer.envelope.revision === viewer.envelope.revision &&
    viewer.envelope.revision === overlay.envelope.revision;

  return {
    ok: sameRevision && finalState.questCycle.status === "succeeded",
    reality: {
      evidenceClass: "fixture",
      liveInputsUsed: false,
      label: "local diagnostic golden workflow",
      limitations: [
        "Uses fixture gameplay, fixture audience signals, in-memory persistence, and hosted-board anonymous votes.",
        "The diagnostic vote-close engine adapter covers winner activation until PR #57 is merged into this branch.",
        "No Twitch, OBS, Supabase cloud, Vercel, browser, or live extraction evidence is claimed.",
      ],
    },
    steps,
    final: {
      sessionRevision: finalState.session.revision,
      streamerRevision: streamer.envelope.revision,
      viewerRevision: viewer.envelope.revision,
      overlayRevision: overlay.envelope.revision,
      questStatus: finalState.questCycle.status,
      activeCandidateId: finalState.questCycle.activeCandidateId,
      resultOutcome: finalState.questCycle.result?.outcome ?? null,
      rewardPointsAwarded: finalState.questCycle.result?.rewardPointsAwarded ?? null,
      snapshots,
    },
  };
}
