import { describe, expect, it } from "vitest";

import { CONTRACT_VERSION } from "../../src/core";
import {
  OBS_CAPTURE_LIFECYCLE_DECISION_ID,
  OBS_CAPTURE_MAX_STALE_FRAME_MS,
  OBS_CAPTURE_MIN_HEIGHT,
  OBS_CAPTURE_MIN_WIDTH,
  OBS_CAPTURE_SAMPLE_INTERVAL_MS,
  resolveObsCaptureSetup,
  type ObsCaptureBrowserReport,
} from "../../src/integrations";

const CHECKED_AT = 1_786_320_000_000;

function frame(overrides: Partial<NonNullable<ObsCaptureBrowserReport["lastFrameObservation"]>> = {}) {
  return {
    envelope: {
      contractVersion: CONTRACT_VERSION,
      sessionId: "fixture-session",
      questCycleId: null,
      messageId: "fixture-frame-message",
      correlationId: "fixture-correlation",
      revision: 1,
      occurredAt: CHECKED_AT - 500,
      receivedAt: CHECKED_AT - 400,
      source: "obs-virtual-camera" as const,
      evidenceClass: "diagnostic" as const,
    },
    frameId: "fixture-frame",
    capturedAt: CHECKED_AT - 500,
    width: 1280,
    height: 720,
    status: "ready" as const,
    ...overrides,
  };
}

function report(overrides: Partial<ObsCaptureBrowserReport> = {}): ObsCaptureBrowserReport {
  return {
    checkedAt: CHECKED_AT,
    permissionState: "granted",
    selectedSource: {
      kind: "obs-virtual-camera",
      label: "OBS Virtual Camera",
    },
    rawGameSceneConfirmed: true,
    overlayExcludedConfirmed: true,
    lastFrameObservation: frame(),
    ...overrides,
  };
}

describe("OBS capture setup lifecycle", () => {
  it("accepts a fresh OBS Virtual Camera raw-game frame without claiming live evidence", () => {
    const result = resolveObsCaptureSetup(report());

    expect(result).toMatchObject({
      ok: true,
      decisionId: OBS_CAPTURE_LIFECYCLE_DECISION_ID,
      lifecycleStatus: "ready",
      service: {
        service: "obs-capture",
        configured: true,
        health: {
          service: "obs-capture",
          status: "ready",
          checkedAt: CHECKED_AT,
          retryable: false,
        },
        allowedActions: [],
      },
      blockerCodes: [],
      framePolicy: {
        sampleIntervalMs: OBS_CAPTURE_SAMPLE_INTERVAL_MS,
        maxStaleFrameMs: OBS_CAPTURE_MAX_STALE_FRAME_MS,
        minWidth: OBS_CAPTURE_MIN_WIDTH,
        minHeight: OBS_CAPTURE_MIN_HEIGHT,
        rawFramesPersisted: false,
        exposeOnlyEphemeralFrameSource: true,
      },
    });
    expect(result.limitations.join(" ")).toContain("does not prove a live OBS capture run");
  });

  it("requires browser camera permission before capture can be ready", () => {
    const denied = resolveObsCaptureSetup(report({ permissionState: "denied" }));
    expect(denied.ok).toBe(false);
    expect(denied.lifecycleStatus).toBe("needs-permission");
    expect(denied.service.health.status).toBe("permission-denied");
    expect(denied.service.allowedActions).toEqual(["request-capture-permission", "select-capture-source"]);
    expect(denied.blockerCodes).toEqual(["obs-capture-permission-denied"]);

    const prompt = resolveObsCaptureSetup(report({ permissionState: "prompt" }));
    expect(prompt.lifecycleStatus).toBe("needs-permission");
    expect(prompt.service.health.status).toBe("unavailable");
    expect(prompt.blockerCodes).toEqual(["obs-capture-permission-required"]);
  });

  it("requires OBS Virtual Camera instead of another browser-visible source", () => {
    const result = resolveObsCaptureSetup(report({
      selectedSource: { kind: "other-camera", label: "FaceTime HD Camera" },
    }));

    expect(result.ok).toBe(false);
    expect(result.lifecycleStatus).toBe("needs-source");
    expect(result.service.health.status).toBe("misconfigured");
    expect(result.service.allowedActions).toEqual(["select-capture-source"]);
    expect(result.blockerCodes).toEqual(["obs-capture-source-not-selected"]);
  });

  it("blocks capture when the OBS source could recursively include ChatXPT overlay output", () => {
    const result = resolveObsCaptureSetup(report({
      rawGameSceneConfirmed: true,
      overlayExcludedConfirmed: false,
    }));

    expect(result.ok).toBe(false);
    expect(result.lifecycleStatus).toBe("recursion-risk");
    expect(result.service.health.status).toBe("misconfigured");
    expect(result.service.allowedActions).toEqual(["select-capture-source", "open-diagnostics"]);
    expect(result.blockerCodes).toEqual(["obs-capture-recursion-risk"]);
  });

  it("waits for a usable frame, then rejects stale, ended, or undersized observations", () => {
    const missing = resolveObsCaptureSetup(report({ lastFrameObservation: null }));
    expect(missing.lifecycleStatus).toBe("waiting-for-frame");
    expect(missing.blockerCodes).toEqual(["obs-capture-frame-missing"]);

    const stale = resolveObsCaptureSetup(report({
      lastFrameObservation: frame({ capturedAt: CHECKED_AT - OBS_CAPTURE_MAX_STALE_FRAME_MS - 1 }),
    }));
    expect(stale.lifecycleStatus).toBe("stale");
    expect(stale.blockerCodes).toEqual(["obs-capture-frame-stale"]);

    const ended = resolveObsCaptureSetup(report({
      lastFrameObservation: frame({ status: "ended" }),
    }));
    expect(ended.lifecycleStatus).toBe("ended");
    expect(ended.blockerCodes).toEqual(["obs-capture-ended"]);

    const undersized = resolveObsCaptureSetup(report({
      lastFrameObservation: frame({ width: OBS_CAPTURE_MIN_WIDTH - 1 }),
    }));
    expect(undersized.lifecycleStatus).toBe("stale");
    expect(undersized.blockerCodes).toEqual(["obs-capture-frame-too-small"]);
  });

  it("rejects impossible browser reports before they become setup readiness", () => {
    expect(() =>
      resolveObsCaptureSetup(report({
        selectedSource: { kind: "none", label: "not allowed" },
      })),
    ).toThrow("A missing capture source cannot carry a label");

    expect(() =>
      resolveObsCaptureSetup(report({
        lastFrameObservation: frame({ capturedAt: CHECKED_AT + 1 }),
      })),
    ).toThrow("Last captured frame cannot be newer than the browser report");
  });
});
