import "server-only";

/** Server-only composition entrypoint. Never import this file from a client component. */
export {
  deploymentHealthReportSchema,
  resolveDeploymentHealthReport,
  type DeploymentHealthReport,
} from "./deployment-health";
export {
  publicRealtimeEnvironment,
  resolveServerPersistenceEnvironment,
  type MemoryPersistenceEnvironment,
  type MisconfiguredPersistenceEnvironment,
  type ServerPersistenceEnvironment,
  type SupabasePersistenceEnvironment,
} from "./environment";
export {
  SupabaseAcceptedVoteTallyReader,
  SupabaseCandidateBatchRepository,
  SupabaseChatXptDataApi,
  SupabaseDataError,
  SupabaseDueVoteCycleReader,
  SupabaseHostedBoardSessionDirectory,
  SupabaseRoleSnapshotPublisher,
  SupabaseRealtimeAccessGrantStore,
  SupabaseSessionHistoryReader,
  SupabaseSessionLifecycleStore,
  SupabaseSessionStateRepository,
  SupabaseTwitchChannelSessionDirectory,
  SupabaseViewerRecoveryReader,
  createSupabasePersistenceRuntime,
  createSupabaseServerClient,
} from "./supabase";
export {
  PersistenceConfigurationError,
  createConfiguredPersistenceRuntime,
  type ConfiguredPersistenceRuntime,
} from "./server-runtime";
export {
  SYSTEM_VOTE_CLOSE_ACTOR_ID,
  Sha256VoteCloseCommandIds,
  VoteCloseScheduler,
  type AuthoritativeCommandExecutor,
  type VoteCloseAttempt,
  type VoteCloseCommandIdFactory,
  type VoteCloseCommandIdentityInput,
  type VoteCloseSweepResult,
} from "./vote-close-scheduler";
