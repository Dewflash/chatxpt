import type {
  AcceptedVoteTallyReader,
  AudiencePointerAggregate,
  AudiencePointerAggregateReader,
  AuthoritativeSessionState,
  CandidateBatch,
  CandidateBatchReader,
  CurrentGameplaySnapshotRepository,
  RoleViewModels,
  SessionHistorySnapshot,
  SessionStateRepository,
  StatePublisher,
  ViewerRecoveryReader,
} from "../core";

export type SnapshotRole = keyof RoleViewModels;

export interface CandidateBatchRepository extends CandidateBatchReader {
  store(batch: CandidateBatch): Promise<void>;
}

/** Process-local staging only; participant/message deduplication keys never enter product history. */
export interface AudiencePointerAggregateRepository extends AudiencePointerAggregateReader {
  store(aggregate: AudiencePointerAggregate): Promise<void>;
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

export interface HostedBoardSessionRecord {
  readonly sessionId: string;
  readonly roomCode: string;
  readonly status: AuthoritativeSessionState["session"]["status"];
  readonly revision: number;
}

export interface HostedBoardSessionDirectory {
  findHostedBoardSession(roomCode: string): Promise<HostedBoardSessionRecord | null>;
  findHostedBoardSessionBySessionId(sessionId: string): Promise<HostedBoardSessionRecord | null>;
}

export interface TwitchChannelSessionRecord {
  readonly sessionId: string;
  readonly channelId: string;
  readonly status: AuthoritativeSessionState["session"]["status"];
  readonly revision: number;
}

export interface TwitchChannelSessionDirectory {
  findTwitchChannelSession(channelId: string): Promise<TwitchChannelSessionRecord | null>;
}

export interface HostedBoardAccessRequest {
  readonly roomCode: string;
  readonly principalId: string;
  readonly requestedAt: number;
  readonly expiresAt: number;
  readonly viewerPathPrefix?: string;
}

export type HostedBoardAccessResult =
  | {
      readonly status: "granted";
      readonly sessionId: string;
      readonly roomCode: string;
      readonly revision: number;
      readonly viewRole: "viewer";
      readonly expiresAt: number;
      readonly viewerPath: string;
      readonly share: {
        readonly roomCode: string;
        readonly viewerPath: string;
        readonly qrPayload: string;
      };
    }
  | {
      readonly status: "invalid-code" | "not-found" | "inactive" | "expired" | "unavailable";
      readonly roomCode: string | null;
      readonly retryable: boolean;
      readonly message: string;
    };

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

export interface DueVoteCycleReader {
  dueVoteCycles(at: number): Promise<readonly AuthoritativeSessionState[]>;
}

export interface SessionHistoryReadInput {
  readonly broadcasterId: string;
  readonly at: number;
  readonly limit?: number;
}

export interface SessionHistoryReader {
  readSessionHistory(input: SessionHistoryReadInput): Promise<SessionHistorySnapshot>;
}

export interface ChatXptPersistenceRuntime {
  readonly mode: "memory" | "supabase";
  readonly sessions: SessionStateRepository;
  readonly lifecycle: SessionLifecycleStore;
  readonly hostedBoardSessions: HostedBoardSessionDirectory;
  readonly twitchChannelSessions: TwitchChannelSessionDirectory;
  readonly candidates: CandidateBatchRepository;
  readonly audiencePointers: AudiencePointerAggregateRepository;
  readonly acceptedVotes: AcceptedVoteTallyReader;
  readonly gameplaySnapshots: CurrentGameplaySnapshotRepository;
  readonly snapshots: RoleSnapshotPublisher;
  readonly accessGrants: RealtimeAccessGrantStore;
  readonly dueVotes: DueVoteCycleReader;
  readonly viewerRecovery: ViewerRecoveryReader;
  readonly sessionHistory: SessionHistoryReader;
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
