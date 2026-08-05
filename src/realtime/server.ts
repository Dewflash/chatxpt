import "server-only";

/** Server-only composition entrypoint. Never import this file from a client component. */
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
  SupabaseHostedSessionLookup,
  SupabaseRoleSnapshotPublisher,
  SupabaseRealtimeAccessGrantStore,
  SupabaseSessionLifecycleStore,
  SupabaseSessionStateRepository,
  createSupabasePersistenceRuntime,
  createSupabaseServerClient,
} from "./supabase";
export {
  HostedBoardAccessService,
  HostedBoardGrantCodec,
  type HostedBoardAuthenticatedIdentity,
  type HostedBoardCredential,
  type HostedBoardExchangeResult,
  type HostedBoardGrantIdentity,
} from "./hosted-board-access";
export {
  PersistenceConfigurationError,
  createConfiguredPersistenceRuntime,
  type ConfiguredPersistenceRuntime,
} from "./server-runtime";
