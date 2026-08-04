import { describe, expect, it } from "vitest";

import { ObsCaptureError } from "./browser-frame-source";
import { captureFailureStatus, getObsCaptureControlState } from "./obs-capture-diagnostic-state";

describe("OBS capture diagnostic state", () => {
  it("serialises permission discovery and capture controls", () => {
    const controls = getObsCaptureControlState({
      permissionBusy: true,
      running: false,
      hasSelectedObsDevice: true,
      rawGameConfirmed: true,
    });

    expect(controls).toMatchObject({
      busy: true,
      canGrantPermission: false,
      canRefreshDevices: false,
      canEditSetup: false,
      canStartCapture: false,
      canStopCapture: false,
    });
  });

  it("preserves a typed capture failure's retryability", () => {
    const status = captureFailureStatus(
      new ObsCaptureError("unavailable", "Browser capture is unsupported", false),
      1_786_200_000_000,
    );

    expect(status).toMatchObject({
      state: "unavailable",
      checkedAt: 1_786_200_000_000,
      message: "Browser capture is unsupported",
      retryable: false,
    });
  });
});
