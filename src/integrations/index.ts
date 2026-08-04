/** Role 1 public boundary for platform and capture adapters. */
export {
  audienceEventSchema,
  gameplayFrameObservationSchema,
  platformEventSchema,
} from "../core";
export type {
  AudienceEvent,
  AudienceEventSource,
  EphemeralGameplayFrame,
  FrameSource,
  GameplayFrameObservation,
  PlatformEvent,
} from "../core";
export {
  BrowserObsFrameSource,
  ObsCaptureError,
  isObsVirtualCameraLabel,
  listBrowserVideoInputs,
  requestBrowserVideoPermission,
} from "./obs/browser-frame-source";
export type {
  BrowserObsFrameSourceOptions,
  ObsCaptureState,
  ObsCaptureStatus,
  ObsVideoInput,
} from "./obs/browser-frame-source";
export { ObsCaptureDiagnostic } from "./obs/obs-capture-diagnostic";
