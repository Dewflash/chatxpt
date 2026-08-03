/** Role 1 public boundary for authoritative commands, snapshots, and realtime health. */
export {
  ChatXptOrchestrator,
  commandEnvelopeSchema,
  domainErrorSchema,
  overlayViewModelSchema,
  serviceHealthSchema,
  streamerViewModelSchema,
  viewerViewModelSchema,
} from "../core";

export {
  MemoryChatXptPersistence,
  createMemoryPersistenceRuntime,
} from "./memory";
export {
  ServerCommandAuthorizer,
  StaticVerifiedActorResolver,
  type VerifiedCommandActor,
  type VerifiedCommandActorResolver,
} from "./permissions";
export {
  SecureLifecycleOperationIds,
  SecureRoomCodeGenerator,
  SessionLifecycleService,
  type LifecycleOperationIdFactory,
  type LifecycleServiceResult,
  type RoomCodeGenerator,
} from "./session-lifecycle";
export { sanitizeRoleViewsForBroadcast } from "./sanitization";
export {
  SupabaseSnapshotSubscriber,
  createSupabaseRealtimeClient,
  type RealtimePublicConfiguration,
  type SnapshotSubscription,
  type SubscribeToSnapshotsInput,
} from "./subscriber";
export {
  FALLBACK_ROOM_CODE_LENGTH,
  PREPARING_SESSION_EXPIRY_MS,
  SESSION_RECONNECT_GRACE_MS,
  PersistenceConflictError,
  type BootstrapSessionInput,
  type CandidateBatchRepository,
  type ChatXptPersistenceRuntime,
  type CommitSessionLifecycleInput,
  type LifecycleStoreCommitResult,
  type RealtimeAccessGrant,
  type RealtimeAccessGrantStore,
  type RoleSnapshotPublisher,
  type RoleSnapshotReader,
  type SessionLifecycleAction,
  type SessionLifecycleCommitResult,
  type SessionLifecycleStore,
  type SessionPresenceAction,
  type SessionPresenceResult,
  type SnapshotRole,
} from "./types";
export type {
  AcceptedCommandReceipt,
  AuthoritativeSessionState,
  CommandAuthorizer,
  CommandEnvelope,
  CommitAuthoritativeStateInput,
  DomainError,
  MessageIdFactory,
  OverlayViewModel,
  OrchestratorDependencies,
  OrchestratorResult,
  ProjectionContextResolver,
  ServiceHealth,
  ServerClock,
  SessionStateRepository,
  StatePublisher,
  StreamerViewModel,
  ViewerViewModel,
} from "../core";

export {
  bindPersistenceRuntime,
  type OrchestratorLogicDependencies,
} from "./composition";
