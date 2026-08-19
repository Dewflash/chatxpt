import type {
  AcceptedVoteTallySnapshot,
  AudiencePointerAggregate,
  CandidateBatch,
  CommandEnvelope,
  DomainError,
  GameplaySnapshot,
  QuestEngine,
  RoleViewModels,
  ViewModelProjector,
} from "../contracts";
import type {
  AcceptedCommandReceipt,
  AuthoritativeSessionState,
  CommitAuthoritativeStateResult,
  ProjectionContext,
  ViewerRecoveryState,
} from "./types";

export interface CommandAuthorizer {
  authorize(
    command: CommandEnvelope,
    state: AuthoritativeSessionState,
  ): Promise<DomainError | null> | DomainError | null;
}

export interface CandidateBatchReader {
  /** candidateBatchId is the canonical candidate-batch envelope messageId. */
  read(candidateBatchId: string, sessionId: string): Promise<CandidateBatch | null>;
}

export interface AudiencePointerAggregateReader {
  /** pointerId is the ephemeral aggregate identifier, never a retained viewer identity. */
  read(pointerId: string, sessionId: string): Promise<AudiencePointerAggregate | null>;
}

export interface CurrentGameplaySnapshotReadInput {
  readonly sessionId: string;
  readonly questCycleId: string | null;
  readonly revision: number;
  readonly evidenceClass: GameplaySnapshot["envelope"]["evidenceClass"];
}

export type IngestGameplaySnapshotResult =
  | { readonly status: "accepted" | "duplicate"; readonly snapshot: GameplaySnapshot }
  | {
      readonly status: "rejected";
      readonly reason: "session-missing" | "session-inactive" | "state-mismatch" | "older-snapshot";
    };

/**
 * Stores only the latest normalised gameplay observation for each session.
 * This deliberately sits outside the authoritative command revision log:
 * the orchestrator snapshots it into state only when a command is committed.
 */
export interface CurrentGameplaySnapshotRepository {
  ingest(snapshot: GameplaySnapshot): Promise<IngestGameplaySnapshotResult>;
  readCurrent(input: CurrentGameplaySnapshotReadInput): Promise<GameplaySnapshot | null>;
}

export interface AcceptedVoteTallyReadInput {
  readonly sessionId: string;
  readonly questCycleId: string;
  readonly revision: number;
  readonly candidateIds: readonly [string, string, string];
  /** Votes accepted at or after this timestamp are excluded. */
  readonly acceptedBefore: number;
  readonly closedAt: number;
}

export interface AcceptedVoteTallyReader {
  readAcceptedVoteTally(input: AcceptedVoteTallyReadInput): Promise<AcceptedVoteTallySnapshot>;
}

export interface ViewerRecoveryReadInput {
  readonly sessionId: string;
  readonly questCycleId: string;
  readonly voterKey: string;
}

export interface ViewerRecoveryReader {
  readViewerRecovery(input: ViewerRecoveryReadInput): Promise<ViewerRecoveryState>;
}

export interface CommitAuthoritativeStateInput {
  readonly command: CommandEnvelope;
  readonly commandFingerprint: string;
  readonly expectedRevision: number;
  readonly nextState: AuthoritativeSessionState;
  readonly events: AcceptedCommandReceipt["events"];
  readonly acceptedAt: number;
}

export interface SessionStateRepository {
  load(sessionId: string): Promise<AuthoritativeSessionState | null>;
  findReceipt(commandId: string): Promise<AcceptedCommandReceipt | null>;
  /**
   * Atomically enforce unique commandId and expectedRevision, then store the
   * next state, event list, and receipt together before returning committed.
   */
  commit(input: CommitAuthoritativeStateInput): Promise<CommitAuthoritativeStateResult>;
}

export interface ProjectionContextResolver {
  resolve(
    state: AuthoritativeSessionState,
    command: CommandEnvelope,
  ): Promise<ProjectionContext> | ProjectionContext;
}

export interface StatePublisher {
  /** Called only after the corresponding authoritative state commit succeeds. */
  publish(views: RoleViewModels): Promise<void>;
}

export interface ServerClock {
  now(): number;
}

export interface MessageIdFactory {
  nextId(kind: "quest-state" | "quest-event" | "view-model"): string;
}

export interface OrchestratorDependencies {
  readonly authorizer: CommandAuthorizer;
  readonly candidateBatches: CandidateBatchReader;
  readonly audiencePointers: AudiencePointerAggregateReader;
  readonly acceptedVotes: AcceptedVoteTallyReader;
  readonly gameplaySnapshots: CurrentGameplaySnapshotRepository;
  readonly repository: SessionStateRepository;
  readonly engine: QuestEngine;
  readonly projectionContext: ProjectionContextResolver;
  readonly projector: ViewModelProjector;
  readonly publisher: StatePublisher;
  readonly clock: ServerClock;
  readonly ids: MessageIdFactory;
}
