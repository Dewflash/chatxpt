/** Role 1 public boundary for platform and capture adapters. */
export {
  audienceEventSchema,
  gameplayFrameObservationSchema,
  platformEventSchema,
} from "../core";
export {
  buildChatFallbackPoll,
  buildChatFallbackResultAnnouncement,
  describeChatVoteReceipt,
} from "./chat-fallback";
export {
  BrowserMediaFrameSource,
  MediaStreamVideoFrameCapture,
  ObsVirtualCameraError,
  findObsVirtualCameraDevice,
  obsVirtualCameraFailureReason,
  requestBrowserDisplayCaptureStream,
  requestObsVirtualCameraStream,
} from "./obs/browser-frame-source";
export { LatestOnlyDelivery } from "./latest-only-delivery";
export {
  OBS_BROWSER_SOURCE_DEFAULT_HEIGHT,
  OBS_BROWSER_SOURCE_DEFAULT_WIDTH,
  LIVE_DIRECTOR_DOCK_DEFAULT_HEIGHT,
  LIVE_DIRECTOR_DOCK_DEFAULT_WIDTH,
  createLiveDirectorDesktopLinkUrl,
  createLiveDirectorDockDescriptor,
  createObsBrowserSourceDescriptor,
  parseObsBrowserSourceRequest,
  redactObsBrowserSourceUrl,
} from "./obs/browser-source";
export type {
  BrowserFrameCapture,
  BrowserDisplayCaptureRequestOptions,
  BrowserMediaFrameSourceOptions,
  MediaStreamVideoFrameCaptureOptions,
  ObsVirtualCameraFailureReason,
  ObsVirtualCameraRequestOptions,
} from "./obs/browser-frame-source";
export type { LatestOnlyDeliveryOptions } from "./latest-only-delivery";
export type {
  CreateObsBrowserSourceDescriptorInput,
  CreateLiveDirectorDockDescriptorInput,
  LiveDirectorDockDescriptor,
  ObsBrowserSourceDescriptor,
  ObsBrowserSourceRequest,
} from "./obs/browser-source";
export type {
  AudienceEvent,
  AudienceEventSource,
  EphemeralGameplayFrame,
  FrameSource,
  GameplayFrameObservation,
  PlatformEvent,
} from "../core";
export type {
  ChatFallbackChoice,
  ChatFallbackOption,
  ChatFallbackPoll,
  ChatFallbackResultAnnouncement,
  ChatVoteReceiptPresentation,
  ChatVoteReceiptStatus,
} from "./chat-fallback";
export * from "./twitch";
