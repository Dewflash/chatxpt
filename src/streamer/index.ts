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
export type {
  TwitchConfigSurfaceProps,
  TwitchLiveConfigSurfaceProps,
} from "./twitch-config";
export {
  buildEmergencyClearCommand,
  buildProfileSettingsCommand,
  buildQuestCommand,
  buildQuestProgressCommand,
  buildSetupCommand,
  defaultStreamerCommandFactory,
  editableDefaultsFromView,
  profileDefaultsChanged,
} from "./streamer-commands";
export type {
  EditableProfileDefaults,
  StreamerCommandFactory,
  StreamerUiCommand,
} from "./streamer-commands";
