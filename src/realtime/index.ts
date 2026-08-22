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
export { EphemeralAudiencePointerAggregateRepository } from "./live-director-context";
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
  HostedBoardAccessService,
} from "./hosted-access";
export {
  buildSessionHistoryFromReceipts,
  type BuildSessionHistoryInput,
} from "./session-history";
export {
  FALLBACK_ROOM_CODE_LENGTH,
  PREPARING_SESSION_EXPIRY_MS,
  SESSION_RECONNECT_GRACE_MS,
  PersistenceConflictError,
  type BootstrapSessionInput,
  type AudiencePointerAggregateRepository,
  type CandidateBatchRepository,
  type ChatXptPersistenceRuntime,
  type CommitSessionLifecycleInput,
  type DueVoteCycleReader,
  type HostedBoardAccessRequest,
  type HostedBoardAccessResult,
  type HostedBoardSessionDirectory,
  type HostedBoardSessionRecord,
  type LifecycleStoreCommitResult,
  type ObsOverlayConnectionRecord,
  type ObsOverlayConnectionStore,
  type RealtimeAccessGrant,
  type RealtimeAccessGrantStore,
  type RoleSnapshotPublisher,
  type RoleSnapshotReader,
  type SessionLifecycleAction,
  type SessionLifecycleCommitResult,
  type SessionLifecycleStore,
  type SessionHistoryReadInput,
  type SessionHistoryReader,
  type SessionPresenceAction,
  type SessionPresenceResult,
  type SnapshotRole,
  type TwitchChannelSessionDirectory,
  type TwitchChannelSessionRecord,
} from "./types";
export type {
  AcceptedCommandReceipt,
  AcceptedVoteTallyReadInput,
  AcceptedVoteTallyReader,
  AcceptedVoteTallySnapshot,
  AuthoritativeSessionState,
  CommandAuthorizer,
  CommandEnvelope,
  CommitAuthoritativeStateInput,
  CurrentGameplaySnapshotReadInput,
  CurrentGameplaySnapshotRepository,
  DomainError,
  GameplaySnapshot,
  IngestGameplaySnapshotResult,
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
  ViewerRecoveryReadInput,
  ViewerRecoveryReader,
  ViewerRecoveryState,
} from "../core";

export {
  bindPersistenceRuntime,
  type OrchestratorLogicDependencies,
} from "./composition";
