import {
  acceptedVoteTallySnapshotSchema,
  audiencePointerAggregateSchema,
  domainErrorSchema,
  gameplaySnapshotSchema,
  overlayViewModelSchema,
  streamerViewModelSchema,
  viewerViewModelSchema,
  type CandidateBatch,
  type AcceptedVoteTallySnapshot,
  type AudiencePointerAggregate,
  type CommandEnvelope,
  type GameplaySnapshot,
  type QuestEngine,
  type QuestEngineInput,
  type QuestEngineResult,
  type RoleViewModels,
  type ViewModelProjectionInput,
  type ViewModelProjector,
} from "../contracts";
import type {
  AcceptedVoteTallyReadInput,
  AcceptedVoteTallyReader,
  AudiencePointerAggregateReader,
  CandidateBatchReader,
  CommandAuthorizer,
  CommitAuthoritativeStateInput,
  CurrentGameplaySnapshotReadInput,
  CurrentGameplaySnapshotRepository,
  DirectorCueLifecycle,
  DirectorCueLifecycleActionInput,
  DirectorCueLifecycleResult,
  IngestGameplaySnapshotResult,
  MessageIdFactory,
  ProjectionContextResolver,
  ServerClock,
  SessionStateRepository,
  StatePublisher,
} from "../application/ports";
import type {
  AcceptedCommandReceipt,
  AuthoritativeSessionState,
  CommitAuthoritativeStateResult,
  ProjectionContext,
} from "../application/types";

function clone<T>(value: T): T {
  return structuredClone(value);
}

export class FixtureSessionStateRepository implements SessionStateRepository {
  private readonly states = new Map<string, AuthoritativeSessionState>();
  private readonly receipts = new Map<string, AcceptedCommandReceipt>();

  constructor(initialStates: readonly AuthoritativeSessionState[]) {
    for (const state of initialStates) {
      if (state.questCycle.envelope.evidenceClass !== "fixture") {
        throw new Error("Fixture repository accepts only fixture-labelled state");
      }
      this.states.set(state.session.sessionId, clone(state));
    }
  }

  async load(sessionId: string): Promise<AuthoritativeSessionState | null> {
    const state = this.states.get(sessionId);
    return state === undefined ? null : clone(state);
  }

  async findReceipt(commandId: string): Promise<AcceptedCommandReceipt | null> {
    const receipt = this.receipts.get(commandId);
    return receipt === undefined ? null : clone(receipt);
  }

  async commit(input: CommitAuthoritativeStateInput): Promise<CommitAuthoritativeStateResult> {
    const existing = this.receipts.get(input.command.commandId);
    if (existing !== undefined) {
      return { status: "duplicate", receipt: clone(existing) };
    }

    const current = this.states.get(input.command.sessionId);
    if (current === undefined || current.session.revision !== input.expectedRevision) {
      return { status: "stale", currentRevision: current?.session.revision ?? 0 };
    }
    if (
      input.nextState.session.sessionId !== input.command.sessionId ||
      input.nextState.session.revision !== input.expectedRevision + 1 ||
      input.nextState.questCycle.envelope.revision !== input.nextState.session.revision
    ) {
      throw new Error("Fixture commit violates authoritative identity or revision invariants");
    }

    const receipt: AcceptedCommandReceipt = {
      command: clone(input.command),
      commandFingerprint: input.commandFingerprint,
      state: clone(input.nextState),
      events: clone(input.events),
      acceptedAt: input.acceptedAt,
    };
    this.states.set(input.command.sessionId, clone(input.nextState));
    this.receipts.set(input.command.commandId, clone(receipt));
    return { status: "committed", receipt };
  }
}

export class FixtureOnlyAllowAuthorizer implements CommandAuthorizer {
  authorize(_command: CommandEnvelope, state: AuthoritativeSessionState) {
    if (state.questCycle.envelope.evidenceClass !== "fixture") {
      return domainErrorSchema.parse({
        code: "forbidden",
        message: "Fixture authorizer cannot authorize non-fixture state",
        retryable: false,
      });
    }
    return null;
  }
}

export class FixtureDenyAuthorizer implements CommandAuthorizer {
  authorize() {
    return domainErrorSchema.parse({
      code: "forbidden",
      message: "Fixture command denied",
      retryable: false,
    });
  }
}

export class StaticFixtureCandidateBatchReader implements CandidateBatchReader {
  constructor(private readonly batches: readonly CandidateBatch[] = []) {
    if (batches.some((batch) => batch.envelope.evidenceClass !== "fixture")) {
      throw new Error("Fixture candidate reader accepts only fixture-labelled batches");
    }
  }

  async read(candidateBatchId: string, sessionId: string): Promise<CandidateBatch | null> {
    const batch = this.batches.find(
      (candidate) =>
        candidate.envelope.messageId === candidateBatchId && candidate.envelope.sessionId === sessionId,
    );
    return batch === undefined ? null : clone(batch);
  }
}

export class StaticFixtureAudiencePointerAggregateReader
  implements AudiencePointerAggregateReader
{
  constructor(private readonly aggregates: readonly AudiencePointerAggregate[] = []) {
    for (const aggregate of aggregates) {
      const parsed = audiencePointerAggregateSchema.parse(aggregate);
      if (parsed.envelope.evidenceClass !== "fixture") {
        throw new Error("Fixture audience pointer reader accepts only fixture-labelled aggregates");
      }
    }
  }

  async read(pointerId: string, sessionId: string): Promise<AudiencePointerAggregate | null> {
    const aggregate = this.aggregates.find(
      (candidate) =>
        candidate.pointerId === pointerId && candidate.envelope.sessionId === sessionId,
    );
    return aggregate === undefined ? null : clone(aggregate);
  }
}

export class FixtureCurrentGameplaySnapshotRepository
  implements CurrentGameplaySnapshotRepository
{
  private readonly snapshots = new Map<string, GameplaySnapshot>();

  constructor(initialSnapshots: readonly GameplaySnapshot[] = []) {
    for (const snapshot of initialSnapshots) {
      const parsed = gameplaySnapshotSchema.parse(snapshot);
      if (parsed.envelope.evidenceClass !== "fixture") {
        throw new Error("Fixture gameplay repository accepts only fixture-labelled snapshots");
      }
      this.snapshots.set(parsed.envelope.sessionId, clone(parsed));
    }
  }

  async ingest(snapshot: GameplaySnapshot): Promise<IngestGameplaySnapshotResult> {
    const parsed = gameplaySnapshotSchema.parse(snapshot);
    if (parsed.envelope.evidenceClass !== "fixture") {
      return { status: "rejected", reason: "state-mismatch" };
    }
    const existing = this.snapshots.get(parsed.envelope.sessionId);
    if (existing !== undefined && existing.envelope.occurredAt >= parsed.envelope.occurredAt) {
      return existing.envelope.messageId === parsed.envelope.messageId
        ? { status: "duplicate", snapshot: clone(existing) }
        : { status: "rejected", reason: "older-snapshot" };
    }
    this.snapshots.set(parsed.envelope.sessionId, clone(parsed));
    return { status: "accepted", snapshot: clone(parsed) };
  }

  async readCurrent(input: CurrentGameplaySnapshotReadInput): Promise<GameplaySnapshot | null> {
    const snapshot = this.snapshots.get(input.sessionId);
    if (
      snapshot === undefined ||
      snapshot.envelope.questCycleId !== input.questCycleId ||
      snapshot.envelope.revision !== input.revision ||
      snapshot.envelope.evidenceClass !== input.evidenceClass
    ) {
      return null;
    }
    return clone(snapshot);
  }
}

export class ScriptedFixtureAcceptedVoteTallyReader implements AcceptedVoteTallyReader {
  readonly calls: AcceptedVoteTallyReadInput[] = [];

  constructor(
    private readonly script: (
      input: AcceptedVoteTallyReadInput,
    ) => AcceptedVoteTallySnapshot = (input) =>
      acceptedVoteTallySnapshotSchema.parse({
        sessionId: input.sessionId,
        questCycleId: input.questCycleId,
        revision: input.revision,
        closedAt: input.closedAt,
        acceptedVoteCount: 0,
        tallies: input.candidateIds.map((candidateId) => ({ candidateId, votes: 0 })),
      }),
  ) {}

  async readAcceptedVoteTally(
    input: AcceptedVoteTallyReadInput,
  ): Promise<AcceptedVoteTallySnapshot> {
    this.calls.push(clone(input));
    return clone(this.script(input));
  }
}

export class FixedFixtureClock implements ServerClock {
  constructor(private readonly timestamp: number) {}

  now(): number {
    return this.timestamp;
  }
}

export class SequenceFixtureMessageIds implements MessageIdFactory {
  private sequence = 0;

  nextId(kind: "quest-state" | "quest-event" | "view-model"): string {
    this.sequence += 1;
    return `fixture-${kind}-${this.sequence}`;
  }
}

export class FixtureProjectionContextResolver implements ProjectionContextResolver {
  constructor(private readonly context: ProjectionContext) {}

  resolve(state: AuthoritativeSessionState): ProjectionContext {
    if (state.questCycle.envelope.evidenceClass !== "fixture") {
      throw new Error("Fixture projection context cannot resolve non-fixture state");
    }
    return clone(this.context);
  }
}

export class CanonicalFixtureViewProjector implements ViewModelProjector {
  project(input: ViewModelProjectionInput): RoleViewModels {
    if (input.envelope.evidenceClass !== "fixture") {
      throw new Error("Fixture projector cannot project non-fixture state");
    }
    return {
      streamer: streamerViewModelSchema.parse({
        envelope: input.envelope,
        session: input.session,
        profile: input.profile,
        services: input.services,
        gameplay: input.gameplay,
        audience: input.audience,
        questCycle: input.questCycle,
        emergencyPaused: input.emergencyPaused,
        ...(input.liveDirector === undefined ? {} : { liveDirector: input.liveDirector }),
      }),
      viewer: viewerViewModelSchema.parse({
        envelope: input.envelope,
        session: input.session,
        capabilities: input.capabilities,
        participationMode: input.participationMode,
        canVote: false,
        canReact: false,
        viewerId: input.viewerId,
        sessionPoints: input.sessionPoints,
        communityHype: input.communityHype,
        acceptedCandidateId: input.acceptedCandidateId,
        questCycle: input.questCycle,
        connection: input.connection,
        ...(input.liveDirector === undefined
          ? {}
          : {
              liveDirector:
                input.liveDirector === null
                  ? null
                  : { publicContext: input.liveDirector.publicContext },
            }),
      }),
      overlay: overlayViewModelSchema.parse({
        envelope: input.envelope,
        session: input.session,
        readOnly: true,
        communityHype: input.communityHype,
        questCycle: input.questCycle,
        connection: input.connection,
      }),
    };
  }
}

export class ScriptedFixtureQuestEngine implements QuestEngine {
  calls = 0;

  constructor(private readonly script: (input: QuestEngineInput) => QuestEngineResult) {}

  decide(input: QuestEngineInput): QuestEngineResult {
    this.calls += 1;
    return this.script(input);
  }
}

export class ScriptedFixtureDirectorCueLifecycle implements DirectorCueLifecycle {
  calls = 0;

  constructor(
    private readonly script: (
      input: DirectorCueLifecycleActionInput,
    ) => DirectorCueLifecycleResult,
  ) {}

  applyAction(input: DirectorCueLifecycleActionInput): DirectorCueLifecycleResult {
    this.calls += 1;
    return this.script(input);
  }
}

export class RecordingFixturePublisher implements StatePublisher {
  readonly published: RoleViewModels[] = [];

  async publish(views: RoleViewModels): Promise<void> {
    this.published.push(clone(views));
  }
}

export class FailingFixturePublisher implements StatePublisher {
  async publish(): Promise<void> {
    throw new Error("Fixture publisher failure");
  }
}
