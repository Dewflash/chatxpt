import { describe, expect, it } from "vitest";

import {
  CONTRACT_VERSION,
  type GameplayFrameObservation,
} from "../core";
import {
  assessExtractionEvidenceBundle,
  createExtractionEvidenceRun,
  summariseNumericMetrics,
  type ExtractionEvidenceRunInput,
} from "./real-input-evidence";
import type { VisualFrameMeasurement } from "./visual-measurements";

const START = 1_786_200_000_000;

function measurement(
  frameId: string,
  capturedAt: number,
  values: {
    meanLumaDelta: number | null;
    changedPixelRatio: number | null;
    processingMs: number;
  },
  source: GameplayFrameObservation["envelope"]["source"] = "obs-virtual-camera",
): VisualFrameMeasurement {
  return {
    frame: {
      envelope: {
        contractVersion: CONTRACT_VERSION,
        sessionId: "diagnostic-evidence-session",
        questCycleId: null,
        messageId: `${frameId}-message`,
        correlationId: "diagnostic-evidence-correlation",
        revision: 0,
        occurredAt: capturedAt,
        receivedAt: capturedAt,
        source,
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
    changedLumaThreshold: 0.2,
    ...values,
  };
}

function diagnosticRun(
  overrides: Partial<ExtractionEvidenceRunInput> = {},
) {
  return createExtractionEvidenceRun({
    runId: "diagnostic-run-a",
    sampleId: "diagnostic-sample-a",
    authorization: "team-owned",
    evidenceClass: "diagnostic",
    measurements: [
      measurement("frame-a", START, {
        meanLumaDelta: null,
        changedPixelRatio: null,
        processingMs: 2,
      }),
      measurement("frame-b", START + 1_000, {
        meanLumaDelta: 0.1,
        changedPixelRatio: 0.2,
        processingMs: 4,
      }),
      measurement("frame-c", START + 2_000, {
        meanLumaDelta: 0.7,
        changedPixelRatio: 0.8,
        processingMs: 6,
      }),
    ],
    annotations: [
      { label: "quiet", startsAt: START, endsAt: START + 1_000 },
      { label: "transition", startsAt: START + 2_000, endsAt: START + 2_000 },
    ],
    unknownObservations: [
      { signalKind: "health", reason: "unsupported", frameId: "frame-c" },
    ],
    ...overrides,
  });
}

describe("real-input evidence metrics", () => {
  it("summarises bounded latency percentiles", () => {
    expect(summariseNumericMetrics([4, 1, 9, 2])).toEqual({
      count: 4,
      min: 1,
      mean: 4,
      p50: 2,
      p95: 9,
      max: 9,
    });
    expect(summariseNumericMetrics([])).toEqual({
      count: 0,
      min: null,
      mean: null,
      p50: null,
      p95: null,
      max: null,
    });
  });

  it("keeps human annotations separate while aggregating diagnostic measurements", () => {
    const report = diagnosticRun();

    expect(report).toMatchObject({
      evidenceClass: "diagnostic",
      inputSource: "obs-virtual-camera",
      rawFramesPersisted: false,
      annotationSource: "separate-human-review",
      frameCount: 3,
      differentialFrameCount: 2,
      unannotatedFrameCount: 0,
      processingMs: { count: 3, min: 2, mean: 4, p50: 4, p95: 6, max: 6 },
      labels: {
        quiet: {
          annotatedFrameCount: 2,
          differentialFrameCount: 1,
          meanLumaDelta: { count: 1, mean: 0.1 },
          changedPixelRatio: { count: 1, mean: 0.2 },
        },
        action: { annotatedFrameCount: 0, differentialFrameCount: 0 },
        transition: {
          annotatedFrameCount: 1,
          differentialFrameCount: 1,
          meanLumaDelta: { count: 1, mean: 0.7 },
          changedPixelRatio: { count: 1, mean: 0.8 },
        },
      },
    });
    expect(report.measurements).toHaveLength(3);
    expect(report.measurements[0]).not.toHaveProperty("rgba");
  });

  it("rejects non-OBS, mismatched, unordered, overlapping, or dangling evidence", () => {
    expect(() =>
      diagnosticRun({
        measurements: [
          measurement(
            "wrong-source",
            START,
            { meanLumaDelta: null, changedPixelRatio: null, processingMs: 1 },
            "test-fixture",
          ),
        ],
      }),
    ).toThrow("must originate from OBS Virtual Camera");

    expect(() => diagnosticRun({ evidenceClass: "live" })).toThrow(
      "measurement evidence class must match",
    );
    expect(() =>
      diagnosticRun({
        measurements: [
          measurement("late", START + 1, {
            meanLumaDelta: null,
            changedPixelRatio: null,
            processingMs: 1,
          }),
          measurement("early", START, {
            meanLumaDelta: 0,
            changedPixelRatio: 0,
            processingMs: 1,
          }),
        ],
      }),
    ).toThrow("ordered by capturedAt");
    expect(() =>
      diagnosticRun({
        annotations: [
          { label: "quiet", startsAt: START, endsAt: START + 1_000 },
          { label: "action", startsAt: START + 1_000, endsAt: START + 2_000 },
        ],
      }),
    ).toThrow("must not overlap");
    expect(() =>
      diagnosticRun({
        annotations: [
          {
            label: "invented" as "quiet",
            startsAt: START,
            endsAt: START + 2_000,
          },
        ],
      }),
    ).toThrow("annotation label must be quiet, action, or transition");
    expect(() =>
      diagnosticRun({
        ocrObservations: [
          {
            frameId: "missing-frame",
            regionId: "timer",
            status: "unknown",
            confidence: null,
            processingMs: 3,
            parserResult: "not-run",
            signalKind: null,
          },
        ],
      }),
    ).toThrow("references unknown frame");
  });

  it("proves diagnostic structural coverage without promoting it to real evidence", () => {
    const first = diagnosticRun({
      ocrObservations: [
        {
          frameId: "frame-c",
          regionId: "timer",
          status: "recognized",
          confidence: 0.84,
          processingMs: 12,
          parserResult: "matched",
          signalKind: "match-timer",
        },
      ],
    });
    const second = diagnosticRun({
      runId: "diagnostic-run-b",
      sampleId: "diagnostic-sample-b",
      annotations: [
        { label: "action", startsAt: START, endsAt: START + 2_000 },
      ],
    });

    const assessment = assessExtractionEvidenceBundle({
      runs: [first, second],
      audienceFixtures: [
        {
          fixtureId: "diagnostic-chat",
          evidenceClass: "diagnostic",
          source: "twitch",
          sourceEventCount: 8,
          privacyReviewed: true,
          viewerIdentifiersRemoved: true,
          messageTextSanitised: true,
          rawInputPersisted: false,
        },
      ],
    });

    expect(assessment).toEqual({
      structurallyComplete: true,
      realEvidenceReady: false,
      sampleCount: 2,
      labelsCovered: ["quiet", "action", "transition"],
      selectiveOcrCovered: true,
      latencyCovered: true,
      honestUnknownCovered: true,
      sanitisedAudienceCovered: true,
      missing: ["all completed inputs must be live before this becomes real evidence"],
    });
  });

  it("lists missing inputs instead of overstating an incomplete pass", () => {
    const assessment = assessExtractionEvidenceBundle({ runs: [diagnosticRun()] });

    expect(assessment.realEvidenceReady).toBe(false);
    expect(assessment.missing).toEqual([
      "two separately identified gameplay samples",
      "action annotation coverage",
      "one selective OCR observation",
      "a privacy-reviewed sanitised audience fixture",
    ]);
  });
});
