import { ObsCaptureError, type ObsCaptureStatus } from "./browser-frame-source";

interface ObsCaptureControlInput {
  readonly permissionBusy: boolean;
  readonly running: boolean;
  readonly hasSelectedObsDevice: boolean;
  readonly rawGameConfirmed: boolean;
}

export interface ObsCaptureControlState {
  readonly busy: boolean;
  readonly canGrantPermission: boolean;
  readonly canRefreshDevices: boolean;
  readonly canEditSetup: boolean;
  readonly canStartCapture: boolean;
  readonly canStopCapture: boolean;
}

export function getObsCaptureControlState({
  permissionBusy,
  running,
  hasSelectedObsDevice,
  rawGameConfirmed,
}: ObsCaptureControlInput): ObsCaptureControlState {
  const busy = permissionBusy || running;
  return {
    busy,
    canGrantPermission: !busy,
    canRefreshDevices: !busy,
    canEditSetup: !busy,
    canStartCapture: !busy && hasSelectedObsDevice && rawGameConfirmed,
    canStopCapture: running,
  };
}

export function captureFailureStatus(reason: unknown, checkedAt: number): ObsCaptureStatus {
  const message =
    reason instanceof ObsCaptureError
      ? reason.message
      : "Camera permission could not be completed.";
  return {
    state: reason instanceof ObsCaptureError ? reason.state : "unavailable",
    checkedAt,
    deviceId: null,
    deviceLabel: null,
    message,
    retryable: reason instanceof ObsCaptureError ? reason.retryable : true,
  };
}
