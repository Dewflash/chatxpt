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
  buildEmergencyClearCommand,
  buildLiveDirectorCueCommand,
  buildLiveDirectorIntentCommand,
  buildProfileSettingsCommand,
  buildQuestCommand,
  buildQuestProgressCommand,
  buildSetupCommand,
  defaultStreamerCommandFactory,
  DEFAULT_LIVE_DIRECTOR_INTENT_LIFETIME_MILLISECONDS,
  editableDefaultsFromView,
  profileDefaultsChanged,
} from "./streamer-commands";
export type {
  EditableProfileDefaults,
  LiveDirectorIntentDraft,
  StreamerCommandFactory,
  StreamerUiCommand,
} from "./streamer-commands";
