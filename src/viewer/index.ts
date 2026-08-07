/** Role 5 public boundary for viewer participation and read-only overlay rendering. */
export { ChatFallbackInstructions, ChatFallbackInstructionsDemo } from "./chat-fallback";
export { createOverlayDemoView, createViewerDemoView } from "./demo-fixtures";
export { ViewerOverlayDemo, ViewerOverlayVisual } from "./overlay-visual";
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
export { ViewerQuestBoard, ViewerQuestBoardDemo } from "./viewer-quest-board";
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
