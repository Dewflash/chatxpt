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
  buildTwitchChatFinalResultText,
  buildTwitchChatPollOpenText,
  buildTwitchChatVoteAcknowledgement,
  recordTwitchChatFallbackDelivery,
  type TwitchChatFallbackDeliveryInput,
  type TwitchChatVoteAcknowledgementInput,
  type TwitchChatVoteProcessingStatus,
} from "./chat-fallback";
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
  type DueVoteCycleReader,
  type HostedBoardAccessInput,
  type HostedBoardAccessResolver,
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
  type ViewerParticipationReceiptReadInput,
  type ViewerParticipationReceiptReader,
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
  DomainError,
  HostedBoardAccess,
  HostedBoardAccessResult,
  MessageIdFactory,
  OverlayViewModel,
  OrchestratorDependencies,
  OrchestratorResult,
  PrivateViewerIdentityKind,
  ProjectionContextResolver,
  ServiceHealth,
  ServerClock,
  SessionStateRepository,
  StatePublisher,
  StreamerViewModel,
  TwitchChatFallbackAnnouncementKind,
  TwitchChatFallbackDelivery,
  TwitchChatFallbackDeliveryStatus,
  TwitchChatVoteAcknowledgement,
  TwitchChatVoteAcknowledgementStatus,
  ViewerParticipationReceipt,
  ViewerParticipationReceiptReadResult,
  ViewerViewModel,
} from "../core";

export {
  bindPersistenceRuntime,
  type OrchestratorLogicDependencies,
} from "./composition";
