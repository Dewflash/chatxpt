import type {
  CandidateBatch,
  CommandEnvelope,
  DomainError,
  QuestEngine,
  RoleViewModels,
  ViewModelProjector,
} from "../contracts";
import type {
  AcceptedCommandReceipt,
  AuthoritativeSessionState,
  CommitAuthoritativeStateResult,
  ProjectionContext,
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
  readonly repository: SessionStateRepository;
  readonly engine: QuestEngine;
  readonly projectionContext: ProjectionContextResolver;
  readonly projector: ViewModelProjector;
  readonly publisher: StatePublisher;
  readonly clock: ServerClock;
  readonly ids: MessageIdFactory;
}
