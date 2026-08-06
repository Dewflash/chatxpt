import type { ExtractionEvidenceClass, ExtractionEvidenceRun } from "./real-input-evidence";
import type { VisualFrameMeasurement } from "./visual-measurements";

export interface VisualActivityPolicy {
  readonly calibrationEvidenceClass: ExtractionEvidenceClass;
  readonly quietMaxChangedPixelRatio: number;
  readonly actionMinChangedPixelRatio: number;
  readonly transitionMinMeanLumaDelta: number;
  readonly minimumConfidence: number;
  readonly conflictConfidenceDelta: number;
  readonly staleAfterMs: number;
  readonly ocrBurstMinimumIntervalMs: number;
  readonly ocrBurstFrameCount: number;
}

export type VisualActivityClassification =
  | {
      readonly status: "known";
      readonly label: "quiet" | "action" | "transition";
      readonly confidence: number;
      readonly observedAt: number;
      readonly expiresAt: number;
      readonly method: "universal-visual";
      readonly requestOcrBurst: boolean;
    }
  | {
      readonly status: "unknown";
      readonly reason: "not-observed" | "low-confidence" | "conflicting";
      readonly confidence: number;
      readonly observedAt: number;
      readonly expiresAt: number;
      readonly method: "universal-visual";
      readonly requestOcrBurst: boolean;
    }
  | {
      readonly status: "stale";
      readonly reason: "expired";
      readonly confidence: 0;
      readonly observedAt: number;
      readonly expiresAt: number;
      readonly method: "universal-visual";
      readonly requestOcrBurst: false;
    };

export interface OcrBurstDecision {
  readonly start: boolean;
  readonly frameCount: number;
  readonly reason: "meaningful-change" | "no-change" | "rate-limited";
}

const DEFAULT_MINIMUM_CONFIDENCE = 0.75;
const DEFAULT_CONFLICT_DELTA = 0.1;
const DEFAULT_STALE_AFTER_MS = 3_000;
const DEFAULT_OCR_BURST_INTERVAL_MS = 1_000;
const DEFAULT_OCR_BURST_FRAME_COUNT = 3;

function assertUnitInterval(name: string, value: number): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError(`${name} must be between 0 and 1`);
  }
}

function assertPositiveInteger(name: string, value: number): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive integer`);
  }
}

function nearestRank(values: readonly number[], percentile: number): number {
  if (values.length === 0) throw new RangeError("calibration requires labelled measurements");
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.max(0, Math.ceil(sorted.length * percentile) - 1);
  return sorted[Math.min(index, sorted.length - 1)];
}

function valuesFor(
  runs: readonly ExtractionEvidenceRun[],
  label: "quiet" | "action" | "transition",
  metric: "changedPixelRatio" | "meanLumaDelta",
): number[] {
  return runs.flatMap((run) =>
    run.measurements
      .filter((measurement) =>
        run.annotations.some(
          (annotation) =>
            annotation.label === label &&
            measurement.capturedAt >= annotation.startsAt &&
            measurement.capturedAt <= annotation.endsAt,
        ),
      )
      .map((measurement) => measurement[metric])
      .filter((value): value is number => value !== null),
  );
}

/**
 * Derives conservative visual thresholds from separately annotated evidence.
 * The policy retains the input evidence class so diagnostic calibration cannot
 * be presented later as a live-calibrated policy.
 */
export function deriveVisualActivityPolicy(
  runs: readonly ExtractionEvidenceRun[],
): VisualActivityPolicy {
  if (runs.length < 2 || new Set(runs.map(({ sampleId }) => sampleId)).size < 2) {
    throw new RangeError("visual calibration requires two distinct gameplay samples");
  }
  const evidenceClasses = new Set(runs.map(({ evidenceClass }) => evidenceClass));
  if (evidenceClasses.size !== 1) {
    throw new RangeError("visual calibration runs must use one evidence class");
  }

  const quietRatios = valuesFor(runs, "quiet", "changedPixelRatio");
  const actionRatios = valuesFor(runs, "action", "changedPixelRatio");
  const transitionDeltas = valuesFor(runs, "transition", "meanLumaDelta");
  const quietMaxChangedPixelRatio = nearestRank(quietRatios, 0.95);
  const actionMinChangedPixelRatio = nearestRank(actionRatios, 0.5);
  const transitionMinMeanLumaDelta = nearestRank(transitionDeltas, 0.5);
  if (quietMaxChangedPixelRatio >= actionMinChangedPixelRatio) {
    throw new RangeError(
      "quiet and action calibration overlap; keep ambiguous activity unknown and collect more evidence",
    );
  }

  return {
    calibrationEvidenceClass: runs[0].evidenceClass,
    quietMaxChangedPixelRatio,
    actionMinChangedPixelRatio,
    transitionMinMeanLumaDelta,
    minimumConfidence: DEFAULT_MINIMUM_CONFIDENCE,
    conflictConfidenceDelta: DEFAULT_CONFLICT_DELTA,
    staleAfterMs: DEFAULT_STALE_AFTER_MS,
    ocrBurstMinimumIntervalMs: DEFAULT_OCR_BURST_INTERVAL_MS,
    ocrBurstFrameCount: DEFAULT_OCR_BURST_FRAME_COUNT,
  };
}

function validatePolicy(policy: VisualActivityPolicy): void {
  assertUnitInterval("quietMaxChangedPixelRatio", policy.quietMaxChangedPixelRatio);
  assertUnitInterval("actionMinChangedPixelRatio", policy.actionMinChangedPixelRatio);
  assertUnitInterval("transitionMinMeanLumaDelta", policy.transitionMinMeanLumaDelta);
  assertUnitInterval("minimumConfidence", policy.minimumConfidence);
  assertUnitInterval("conflictConfidenceDelta", policy.conflictConfidenceDelta);
  if (policy.quietMaxChangedPixelRatio >= policy.actionMinChangedPixelRatio) {
    throw new RangeError("quiet threshold must be lower than the action threshold");
  }
  assertPositiveInteger("staleAfterMs", policy.staleAfterMs);
  assertPositiveInteger("ocrBurstMinimumIntervalMs", policy.ocrBurstMinimumIntervalMs);
  assertPositiveInteger("ocrBurstFrameCount", policy.ocrBurstFrameCount);
}

function clampUnit(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function scoreAbove(value: number, threshold: number, minimum: number): number {
  if (value < threshold) return 0;
  const range = Math.max(Number.EPSILON, 1 - threshold);
  return clampUnit(minimum + (1 - minimum) * ((value - threshold) / range));
}

function scoreBelow(value: number, threshold: number, minimum: number): number {
  if (value > threshold) return 0;
  const range = Math.max(Number.EPSILON, threshold);
  return clampUnit(minimum + (1 - minimum) * ((threshold - value) / range));
}

export function classifyVisualActivity(input: {
  readonly measurement: VisualFrameMeasurement;
  readonly policy: VisualActivityPolicy;
  readonly now: number;
}): VisualActivityClassification {
  validatePolicy(input.policy);
  if (!Number.isInteger(input.now) || input.now < 0) {
    throw new RangeError("now must be a non-negative integer timestamp");
  }
  if (input.measurement.frame.envelope.evidenceClass !== input.policy.calibrationEvidenceClass) {
    throw new RangeError("measurement evidence class must match the calibration policy");
  }
  const observedAt = input.measurement.frame.capturedAt;
  const expiresAt = observedAt + input.policy.staleAfterMs;
  if (input.now > expiresAt) {
    return {
      status: "stale",
      reason: "expired",
      confidence: 0,
      observedAt,
      expiresAt,
      method: "universal-visual",
      requestOcrBurst: false,
    };
  }

  const { changedPixelRatio, meanLumaDelta } = input.measurement;
  if (changedPixelRatio === null || meanLumaDelta === null) {
    return {
      status: "unknown",
      reason: "not-observed",
      confidence: 0,
      observedAt,
      expiresAt,
      method: "universal-visual",
      requestOcrBurst: false,
    };
  }
  assertUnitInterval("changedPixelRatio", changedPixelRatio);
  assertUnitInterval("meanLumaDelta", meanLumaDelta);

  const requestOcrBurst =
    changedPixelRatio >= input.policy.actionMinChangedPixelRatio ||
    meanLumaDelta >= input.policy.transitionMinMeanLumaDelta;
  const candidates = [
    {
      label: "quiet" as const,
      confidence: scoreBelow(
        changedPixelRatio,
        input.policy.quietMaxChangedPixelRatio,
        input.policy.minimumConfidence,
      ),
    },
    {
      label: "action" as const,
      confidence: scoreAbove(
        changedPixelRatio,
        input.policy.actionMinChangedPixelRatio,
        input.policy.minimumConfidence,
      ),
    },
    {
      label: "transition" as const,
      confidence: scoreAbove(
        meanLumaDelta,
        input.policy.transitionMinMeanLumaDelta,
        input.policy.minimumConfidence,
      ),
    },
  ]
    .filter(({ confidence }) => confidence >= input.policy.minimumConfidence)
    .sort((left, right) => right.confidence - left.confidence);

  const strongest = candidates[0];
  if (strongest === undefined) {
    return {
      status: "unknown",
      reason: "low-confidence",
      confidence: 0,
      observedAt,
      expiresAt,
      method: "universal-visual",
      requestOcrBurst,
    };
  }
  const runnerUp = candidates[1];
  if (
    runnerUp !== undefined &&
    strongest.confidence - runnerUp.confidence <= input.policy.conflictConfidenceDelta
  ) {
    return {
      status: "unknown",
      reason: "conflicting",
      confidence: strongest.confidence,
      observedAt,
      expiresAt,
      method: "universal-visual",
      requestOcrBurst,
    };
  }

  return {
    status: "known",
    label: strongest.label,
    confidence: strongest.confidence,
    observedAt,
    expiresAt,
    method: "universal-visual",
    requestOcrBurst,
  };
}

export function decideOcrBurst(input: {
  readonly classification: VisualActivityClassification;
  readonly policy: VisualActivityPolicy;
  readonly lastBurstAt: number | null;
}): OcrBurstDecision {
  validatePolicy(input.policy);
  if (!input.classification.requestOcrBurst) {
    return { start: false, frameCount: 0, reason: "no-change" };
  }
  if (
    input.lastBurstAt !== null &&
    (!Number.isInteger(input.lastBurstAt) || input.lastBurstAt < 0)
  ) {
    throw new RangeError("lastBurstAt must be null or a non-negative integer timestamp");
  }
  if (
    input.lastBurstAt !== null &&
    input.classification.observedAt - input.lastBurstAt < input.policy.ocrBurstMinimumIntervalMs
  ) {
    return { start: false, frameCount: 0, reason: "rate-limited" };
  }
  return {
    start: true,
    frameCount: input.policy.ocrBurstFrameCount,
    reason: "meaningful-change",
  };
}
