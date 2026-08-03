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
  SupabaseCandidateBatchRepository,
  SupabaseChatXptDataApi,
  SupabaseDataError,
  SupabaseRoleSnapshotPublisher,
  SupabaseRealtimeAccessGrantStore,
  SupabaseSessionLifecycleStore,
  SupabaseSessionStateRepository,
  createSupabasePersistenceRuntime,
  createSupabaseServerClient,
} from "./supabase";
export {
  PersistenceConfigurationError,
  createConfiguredPersistenceRuntime,
  type ConfiguredPersistenceRuntime,
} from "./server-runtime";
