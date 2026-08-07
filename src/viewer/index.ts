/** Role 5 public boundary for viewer participation and read-only overlay rendering. */
export {
  ChatFallbackInstructions,
  TwitchChatVoteInstructions,
} from "./chat-fallback";
export { createOverlayDemoView, createViewerDemoView } from "./demo-fixtures";
export { ChatFallbackInstructionsDemo, ViewerOverlayDemo, ViewerQuestBoardDemo } from "./demo-surfaces";
export { QuestOverlay, ViewerOverlayVisual } from "./overlay-visual";
export { ViewerOverlayInactive, ViewerRuntimeUnavailable } from "./runtime-unavailable";
export type { ViewerRuntimeSurface } from "./runtime-unavailable";
export {
  activeQuest,
  buildViewerVoteCommand,
  overlayPlacementClass,
  remainingSeconds,
  serviceStatusLabel,
  visibleQuestOptions,
  voteCountFor,
  voteShareFor,
} from "./surface-model";
export type { ViewerSurfaceMode, ViewerVoteDispatchResult, ViewerVoteDispatcher } from "./surface-model";
export type { ChatVoteAcknowledgement, HostedQuestBoardAccessState } from "./surface-model";
export {
  HostedQuestBoard,
  TwitchViewerPanel,
  ViewerQuestBoard,
} from "./viewer-quest-board";
export type { HostedQuestBoardProps, TwitchViewerPanelProps, ViewerQuestBoardProps } from "./viewer-quest-board";
export {
  overlayViewModelSchema,
  viewerReactionCommandSchema,
  viewerViewModelSchema,
  viewerVoteCommandSchema,
  voteSchema,
} from "../core";
export type {
  OverlayViewModel,
  ViewerReactionCommand,
  ViewerViewModel,
  ViewerVoteCommand,
  Vote,
} from "../core";
export { presentOverlay, presentViewer } from "./presentation";
export type {
  OverlayPresentation,
  OverlaySurfacePhase,
  QuestProgressPresentation,
  QuestResultPresentation,
  ViewerCommand,
  ViewerCommandSink,
  ViewerPresentation,
  ViewerQuestOptionPresentation,
  ViewerSurfacePhase,
} from "./presentation";
