import type {
  AcceptedVoteTallyReader,
  AuthoritativeSessionState,
  CandidateBatch,
  CandidateBatchReader,
  RoleViewModels,
  SessionStateRepository,
  StatePublisher,
} from "../core";

export type SnapshotRole = keyof RoleViewModels;

export interface CandidateBatchRepository extends CandidateBatchReader {
  store(batch: CandidateBatch): Promise<void>;
}

export interface RoleSnapshotReader {
  readSnapshot<Role extends SnapshotRole>(
    sessionId: string,
    role: Role,
  ): Promise<RoleViewModels[Role] | null>;
}

export interface RoleSnapshotPublisher extends StatePublisher, RoleSnapshotReader {}

export interface RealtimeAccessGrant {
  readonly principalId: string;
  readonly sessionId: string;
  readonly viewRole: SnapshotRole;
  readonly expiresAt: number;
  readonly revokedAt: number | null;
}

export interface RealtimeAccessGrantStore {
  grant(input: Omit<RealtimeAccessGrant, "revokedAt">): Promise<RealtimeAccessGrant>;
  revoke(
    principalId: string,
    sessionId: string,
    viewRole: SnapshotRole,
    revokedAt: number,
  ): Promise<void>;
  canRead(
    principalId: string,
    sessionId: string,
    viewRole: SnapshotRole,
    at: number,
  ): Promise<boolean>;
}

export type SessionPresenceAction = "heartbeat" | "disconnect";
export type SessionLifecycleAction = "start" | "end" | "expire";

export const PREPARING_SESSION_EXPIRY_MS = 2 * 60 * 60 * 1_000;
export const SESSION_RECONNECT_GRACE_MS = 10 * 60 * 1_000;
export const FALLBACK_ROOM_CODE_LENGTH = 8;

export interface SessionPresenceResult {
  readonly sessionId: string;
  readonly status: "live";
  readonly revision: number;
  readonly lastActivityAt: number;
  readonly lastHeartbeatAt: number | null;
  readonly reconnectDeadlineAt: number | null;
}

export interface SessionLifecycleCommitResult {
  readonly sessionId: string;
  readonly action: SessionLifecycleAction;
  readonly revision: number;
  readonly state: AuthoritativeSessionState;
  readonly occurredAt: number;
}

export type LifecycleStoreCommitResult =
  | { readonly status: "committed"; readonly result: SessionLifecycleCommitResult }
  | { readonly status: "duplicate"; readonly result: SessionLifecycleCommitResult }
  | { readonly status: "stale"; readonly currentRevision: number }
  | { readonly status: "expired" }
  | { readonly status: "not-due" }
  | { readonly status: "missing" };

export interface BootstrapSessionInput {
  readonly roomCode: string;
  readonly state: AuthoritativeSessionState;
  readonly createdAt: number;
}

export interface CommitSessionLifecycleInput {
  readonly sessionId: string;
  readonly operationId: string;
  readonly action: SessionLifecycleAction;
  readonly expectedRevision: number;
  readonly nextState: AuthoritativeSessionState;
  readonly occurredAt: number;
  readonly endReason: string | null;
}

export interface SessionLifecycleStore {
  bootstrap(input: BootstrapSessionInput): Promise<void>;
  load(sessionId: string): Promise<AuthoritativeSessionState | null>;
  findOperation(operationId: string): Promise<SessionLifecycleCommitResult | null>;
  commitLifecycle(input: CommitSessionLifecycleInput): Promise<LifecycleStoreCommitResult>;
  touch(
    sessionId: string,
    action: SessionPresenceAction,
    occurredAt: number,
  ): Promise<SessionPresenceResult | null>;
  due(at: number): Promise<readonly AuthoritativeSessionState[]>;
}

export interface ChatXptPersistenceRuntime {
  readonly mode: "memory" | "supabase";
  readonly sessions: SessionStateRepository;
  readonly lifecycle: SessionLifecycleStore;
  readonly candidates: CandidateBatchRepository;
  readonly acceptedVotes: AcceptedVoteTallyReader;
  readonly snapshots: RoleSnapshotPublisher;
  readonly accessGrants: RealtimeAccessGrantStore;
}

export class PersistenceConflictError extends Error {
  constructor(
    readonly kind: "room-code" | "active-broadcaster" | "session-id" | "unknown",
    message: string,
  ) {
    super(message);
    this.name = "PersistenceConflictError";
  }
}
