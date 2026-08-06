import { describe, expect, it } from "vitest";

import { CONTRACT_VERSION } from "../core";
import { createExtractionEvidenceRun } from "./real-input-evidence";
import {
  classifyVisualActivity,
  decideOcrBurst,
  deriveVisualActivityPolicy,
} from "./visual-classification";
import type { VisualFrameMeasurement } from "./visual-measurements";

const START = 1_786_200_000_000;

function measurement(
  frameId: string,
  capturedAt: number,
  meanLumaDelta: number | null,
  changedPixelRatio: number | null,
): VisualFrameMeasurement {
  return {
    frame: {
      envelope: {
        contractVersion: CONTRACT_VERSION,
        sessionId: "visual-classification-diagnostic",
        questCycleId: null,
        messageId: `${frameId}-message`,
        correlationId: "visual-classification-correlation",
        revision: 0,
        occurredAt: capturedAt,
        receivedAt: capturedAt,
        source: "obs-virtual-camera",
        evidenceClass: "diagnostic",
      },
      frameId,
      capturedAt,
      width: 1280,
      height: 720,
      status: "ready",
    },
    sampleWidth: 64,
    sampleHeight: 36,
    processingMs: 3,
    changedLumaThreshold: 0.2,
    meanLumaDelta,
    changedPixelRatio,
  };
}

function calibrationRuns() {
  const firstMeasurements = [
    measurement("quiet-1", START, null, null),
    measurement("quiet-2", START + 500, 0.04, 0.08),
    measurement("quiet-3", START + 1_000, 0.05, 0.1),
    measurement("transition-1", START + 2_000, 0.75, 0.65),
    measurement("transition-2", START + 2_500, 0.85, 0.7),
  ];
  const secondMeasurements = [
    measurement("action-1", START + 3_000, null, null),
    measurement("action-2", START + 3_500, 0.2, 0.55),
    measurement("action-3", START + 4_000, 0.25, 0.65),
  ];
  return [
    createExtractionEvidenceRun({
      runId: "calibration-run-quiet-transition",
      sampleId: "calibration-sample-quiet-transition",
      authorization: "team-owned",
      evidenceClass: "diagnostic",
      measurements: firstMeasurements,
      annotations: [
        { label: "quiet", startsAt: START, endsAt: START + 1_000 },
        { label: "transition", startsAt: START + 2_000, endsAt: START + 2_500 },
      ],
    }),
    createExtractionEvidenceRun({
      runId: "calibration-run-action",
      sampleId: "calibration-sample-action",
      authorization: "explicitly-authorized",
      evidenceClass: "diagnostic",
      measurements: secondMeasurements,
      annotations: [
        { label: "action", startsAt: START + 3_000, endsAt: START + 4_000 },
      ],
    }),
  ];
}

describe("approved universal visual policy", () => {
  it("derives conservative thresholds while preserving diagnostic provenance", () => {
    expect(deriveVisualActivityPolicy(calibrationRuns())).toEqual({
      calibrationEvidenceClass: "diagnostic",
      quietMaxChangedPixelRatio: 0.1,
      actionMinChangedPixelRatio: 0.55,
      transitionMinMeanLumaDelta: 0.75,
      minimumConfidence: 0.75,
      conflictConfidenceDelta: 0.1,
      staleAfterMs: 3_000,
      ocrBurstMinimumIntervalMs: 1_000,
      ocrBurstFrameCount: 3,
    });
  });

  it("classifies strong quiet and action measurements but keeps the gap unknown", () => {
    const policy = deriveVisualActivityPolicy(calibrationRuns());
    const quiet = classifyVisualActivity({
      measurement: measurement("quiet-now", START + 5_000, 0.02, 0.02),
      policy,
      now: START + 5_000,
    });
    const action = classifyVisualActivity({
      measurement: measurement("action-now", START + 5_500, 0.2, 0.8),
      policy,
      now: START + 5_500,
    });
    const ambiguous = classifyVisualActivity({
      measurement: measurement("gap-now", START + 6_000, 0.2, 0.3),
      policy,
      now: START + 6_000,
    });

    expect(quiet).toMatchObject({ status: "known", label: "quiet", requestOcrBurst: false });
    expect(action).toMatchObject({ status: "known", label: "action", requestOcrBurst: true });
    expect(ambiguous).toMatchObject({
      status: "unknown",
      reason: "low-confidence",
      requestOcrBurst: false,
    });
  });

  it("returns conflicting instead of guessing between action and transition", () => {
    const policy = deriveVisualActivityPolicy(calibrationRuns());
    const classification = classifyVisualActivity({
      measurement: measurement("conflict-now", START + 7_000, 0.85, 0.8),
      policy,
      now: START + 7_000,
    });

    expect(classification).toMatchObject({
      status: "unknown",
      reason: "conflicting",
      requestOcrBurst: true,
    });
  });

  it("expires classifications after three seconds and rate-limits OCR bursts", () => {
    const policy = deriveVisualActivityPolicy(calibrationRuns());
    const current = classifyVisualActivity({
      measurement: measurement("burst-now", START + 8_000, 0.2, 0.8),
      policy,
      now: START + 8_000,
    });
    expect(decideOcrBurst({ classification: current, policy, lastBurstAt: null })).toEqual({
      start: true,
      frameCount: 3,
      reason: "meaningful-change",
    });
    expect(
      decideOcrBurst({ classification: current, policy, lastBurstAt: START + 7_500 }),
    ).toEqual({ start: false, frameCount: 0, reason: "rate-limited" });

    expect(
      classifyVisualActivity({
        measurement: measurement("stale-now", START + 8_000, 0.2, 0.8),
        policy,
        now: START + 11_001,
      }),
    ).toMatchObject({ status: "stale", reason: "expired", requestOcrBurst: false });
  });

  it("rejects overlapping quiet/action calibration instead of inventing a threshold", () => {
    const runs = calibrationRuns();
    const overlapping = createExtractionEvidenceRun({
      runId: "overlap-run",
      sampleId: "overlap-sample",
      authorization: "team-owned",
      evidenceClass: "diagnostic",
      measurements: [
        measurement("overlap-1", START + 9_000, null, null),
        measurement("overlap-2", START + 9_500, 0.1, 0.08),
      ],
      annotations: [{ label: "action", startsAt: START + 9_000, endsAt: START + 9_500 }],
    });

    expect(() => deriveVisualActivityPolicy([runs[0], overlapping])).toThrow(
      "quiet and action calibration overlap",
    );
  });

  it("does not apply diagnostic calibration to a measurement labelled live", () => {
    const policy = deriveVisualActivityPolicy(calibrationRuns());
    const diagnostic = measurement("live-shaped", START + 10_000, 0.2, 0.8);
    const liveShaped: VisualFrameMeasurement = {
      ...diagnostic,
      frame: {
        ...diagnostic.frame,
        envelope: { ...diagnostic.frame.envelope, evidenceClass: "live" },
      },
    };

    expect(() =>
      classifyVisualActivity({ measurement: liveShaped, policy, now: START + 10_000 }),
    ).toThrow("measurement evidence class must match the calibration policy");
  });
});
