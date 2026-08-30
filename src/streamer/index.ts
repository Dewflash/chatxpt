/** Role 4 public boundary for streamer-facing rendering and typed commands. */
export { StudioSetupShell } from "./studio-setup-shell";
export type {
  StudioSection,
  StudioSetupExperience,
  StudioSetupShellProps,
  StudioSetupStep,
} from "./studio-setup-shell";
export {
  streamerQuestCommandSchema,
  streamerProfileSchema,
  streamerViewModelSchema,
} from "../core";
export type {
  StreamerProfile,
  StreamerQuestCommand,
  StreamerViewModel,
} from "../core";
export { StudioStatusSurface } from "./studio-status";
export type { StudioStatusSurfaceProps } from "./studio-status";
export { StudioManagementSurface } from "./studio-management";
export type { StudioManagementSurfaceProps } from "./studio-management";
export { StudioProductPageSurface } from "./studio-product-pages";
export type { StudioProductPage, StudioProductPageSurfaceProps } from "./studio-product-pages";
export { TwitchConfigSurface, TwitchLiveConfigSurface } from "./twitch-config";
export { LiveDirectorControls } from "./live-director-controls";
export { PersistentStreamOverlaySurface } from "./persistent-stream-overlay";
export type { LiveDirectorControlsProps } from "./live-director-controls";
export type { PersistentStreamOverlaySurfaceProps } from "./persistent-stream-overlay";
export type {
  TwitchConfigSurfaceProps,
  TwitchLiveConfigSurfaceProps,
} from "./twitch-config";
export {
  acceptLocalFallbackProfile,
  cacheCloudProfileForFallback,
  LOCAL_FALLBACK_ACCOUNT_ID,
  LOCAL_FALLBACK_MAX_BYTES,
  LOCAL_FALLBACK_PROFILE_KEY,
  localFallbackProfileEnvelopeSchema,
  localProfileCloudStatus,
  readLocalFallbackProfile,
  seedLocalFallbackProfile,
  updateLocalFallbackProfile,
  writeLocalFallbackProfile,
} from "./local-fallback-profile";
export type {
  LocalFallbackProfileEnvelope,
  LocalFallbackProfileRead,
  LocalFallbackStorage,
} from "./local-fallback-profile";
export {
  applyEditableDefaultsToProfile,
  buildEmergencyClearCommand,
  buildCurrentGameProfileSettingsCommand,
  buildCurrentStreamGameCommand,
  buildLiveDirectorCueCommand,
  buildLiveDirectorIntentCommand,
  buildLiveIntelligenceQuestGenerationCommand,
  buildProfileSettingsCommand,
  buildQuestGenerationCommand,
  buildQuestCommand,
  buildQuestProgressCommand,
  buildSetupCommand,
  defaultStreamerCommandFactory,
  DEFAULT_LIVE_DIRECTOR_INTENT_LIFETIME_MILLISECONDS,
  editableDefaultsFromProfile,
  editableDefaultsFromView,
  profileDefaultsChanged,
  resolveDesktopDirectorSetupMode,
} from "./streamer-commands";
export type {
  EditableProfileDefaults,
  LiveDirectorIntentDraft,
  StreamerCommandFactory,
  StreamerUiCommand,
} from "./streamer-commands";
export {
  STUDIO_GAME_PROFILE_OPTIONS,
  studioGameProfileIdFor,
  studioGameProfileOption,
} from "./game-profile-options";
export type { StudioGameProfileId } from "./game-profile-options";
export {
  GameplayCapturePreviewError,
  connectGameplayCapturePreview,
  describeSelectedGameplaySource,
} from "./gameplay-capture-preview";
export type {
  ConnectGameplayCapturePreviewOptions,
  GameplayCaptureSource,
} from "./gameplay-capture-preview";
