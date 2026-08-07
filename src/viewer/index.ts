/** Role 5 public boundary for viewer participation and read-only overlay rendering. */
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
