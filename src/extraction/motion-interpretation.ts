import type { SpatialMotionMeasurement } from "./spatial-motion";

export interface TimedSpatialMotion {
  readonly observedAt: number;
  readonly measurement: SpatialMotionMeasurement;
}

export type ObservableMotionState =
  | "stable"
  | "ordinary-motion"
  | "coherent-global-motion"
  | "rapid-coherent-global-motion"
  | "erratic-global-motion"
  | "mixed-local-action"
  | "scene-transition"
  | "unknown";

export interface MotionInterpretation {
  readonly status: "known" | "unknown";
  readonly state: ObservableMotionState;
  readonly confidence: number;
  readonly observedAt: number;
  readonly windowStartsAt: number;
  readonly sampleCount: number;
  readonly reasons: readonly string[];
}

export interface MotionInterpretationPolicy {
  readonly windowMs: number;
  readonly minimumSamples: number;
  readonly stableChangedPixelRatio: number;
  readonly coherentMotionShare: number;
  readonly minimumTranslationConfidence: number;
  readonly rapidTranslationMagnitude: number;
  readonly mixedResidualRatio: number;
  readonly broadActiveCellRatio: number;
  readonly transitionMeanLumaDelta: number;
  readonly transitionColorHistogramDistance: number;
  readonly reversalCosineThreshold: number;
}

export const defaultMotionInterpretationPolicy: MotionInterpretationPolicy = {
  windowMs: 2_000,
  minimumSamples: 3,
  stableChangedPixelRatio: 0.035,
  coherentMotionShare: 0.45,
  minimumTranslationConfidence: 0.16,
  rapidTranslationMagnitude: 1.5,
  mixedResidualRatio: 0.16,
  broadActiveCellRatio: 0.58,
  transitionMeanLumaDelta: 0.24,
  transitionColorHistogramDistance: 0.28,
  reversalCosineThreshold: -0.25,
};

function clampUnit(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function validatePolicy(policy: MotionInterpretationPolicy): void {
  if (!Number.isInteger(policy.windowMs) || policy.windowMs < 250 || policy.windowMs > 10_000) {
    throw new RangeError("motion windowMs must be an integer from 250 to 10000");
  }
  if (!Number.isInteger(policy.minimumSamples) || policy.minimumSamples < 2 || policy.minimumSamples > 30) {
    throw new RangeError("motion minimumSamples must be an integer from 2 to 30");
  }
  for (const [name, value] of Object.entries({
    stableChangedPixelRatio: policy.stableChangedPixelRatio,
    coherentMotionShare: policy.coherentMotionShare,
    minimumTranslationConfidence: policy.minimumTranslationConfidence,
    mixedResidualRatio: policy.mixedResidualRatio,
    broadActiveCellRatio: policy.broadActiveCellRatio,
    transitionMeanLumaDelta: policy.transitionMeanLumaDelta,
    transitionColorHistogramDistance: policy.transitionColorHistogramDistance,
  })) {
    if (!Number.isFinite(value) || value < 0 || value > 1) {
      throw new RangeError(`${name} must be between 0 and 1`);
    }
  }
  if (!Number.isFinite(policy.rapidTranslationMagnitude) || policy.rapidTranslationMagnitude <= 0) {
    throw new RangeError("rapidTranslationMagnitude must be positive");
  }
  if (!Number.isFinite(policy.reversalCosineThreshold) || policy.reversalCosineThreshold < -1 || policy.reversalCosineThreshold > 1) {
    throw new RangeError("reversalCosineThreshold must be between -1 and 1");
  }
}

function mean(values: readonly number[]): number {
  return values.length === 0 ? 0 : values.reduce((total, value) => total + value, 0) / values.length;
}

function directionCosine(
  left: SpatialMotionMeasurement["translation"],
  right: SpatialMotionMeasurement["translation"],
): number | null {
  if (left.magnitude === 0 || right.magnitude === 0) return null;
  return (left.dx * right.dx + left.dy * right.dy) / (left.magnitude * right.magnitude);
}

function known(
  state: Exclude<ObservableMotionState, "unknown">,
  confidence: number,
  samples: readonly TimedSpatialMotion[],
  reasons: readonly string[],
): MotionInterpretation {
  return {
    status: "known",
    state,
    confidence: clampUnit(confidence),
    observedAt: samples[samples.length - 1].observedAt,
    windowStartsAt: samples[0].observedAt,
    sampleCount: samples.length,
    reasons,
  };
}

/**
 * Interprets observable motion only. It deliberately does not infer emotion,
 * intent, panic, or combat without separate supporting evidence.
 */
export function interpretMotionWindow(
  history: readonly TimedSpatialMotion[],
  policy: MotionInterpretationPolicy = defaultMotionInterpretationPolicy,
): MotionInterpretation {
  validatePolicy(policy);
  if (history.length === 0) {
    return {
      status: "unknown",
      state: "unknown",
      confidence: 0,
      observedAt: 0,
      windowStartsAt: 0,
      sampleCount: 0,
      reasons: ["No frame-pair motion measurements are available."],
    };
  }
  for (let index = 0; index < history.length; index += 1) {
    const observedAt = history[index].observedAt;
    if (!Number.isInteger(observedAt) || observedAt < 0) {
      throw new RangeError("motion observedAt must be a non-negative integer timestamp");
    }
    if (index > 0 && observedAt <= history[index - 1].observedAt) {
      throw new RangeError("motion history timestamps must be strictly increasing");
    }
  }
  const newestAt = history[history.length - 1].observedAt;
  const samples = history.filter(({ observedAt }) => observedAt >= newestAt - policy.windowMs);
  if (samples.length < policy.minimumSamples) {
    return {
      status: "unknown",
      state: "unknown",
      confidence: 0,
      observedAt: newestAt,
      windowStartsAt: samples[0].observedAt,
      sampleCount: samples.length,
      reasons: [`At least ${policy.minimumSamples} recent motion samples are required.`],
    };
  }

  const measurements = samples.map(({ measurement }) => measurement);
  const stableRatio =
    measurements.filter(
      ({ changedPixelRatio, colorChangedPixelRatio }) =>
        Math.max(changedPixelRatio, colorChangedPixelRatio) <= policy.stableChangedPixelRatio,
    ).length /
    measurements.length;
  if (stableRatio >= 0.75) {
    return known("stable", 0.75 + stableRatio * 0.2, samples, [
      "Most recent frames remain below the calibrated broad-change threshold.",
    ]);
  }

  const transitionIndexes = measurements
    .map((measurement, index) => ({ measurement, index }))
    .filter(({ measurement: {
      changedPixelRatio,
      colorChangedPixelRatio,
      meanLumaDelta,
      colorHistogramDistance,
      activeCellRatio,
      globalMotionShare,
    } }) =>
      Math.max(changedPixelRatio, colorChangedPixelRatio) >= 0.8 &&
      (
        meanLumaDelta >= policy.transitionMeanLumaDelta ||
        colorHistogramDistance >= policy.transitionColorHistogramDistance
      ) &&
      activeCellRatio >= policy.broadActiveCellRatio &&
      globalMotionShare < policy.coherentMotionShare,
    );
  const latestTransitionIndex = transitionIndexes.at(-1)?.index ?? -1;
  const afterTransition = latestTransitionIndex < 0 ? [] : measurements.slice(latestTransitionIndex + 1);
  const settledAfterTransition =
    afterTransition.length > 0 &&
    afterTransition.filter(
      ({ changedPixelRatio, colorChangedPixelRatio }) =>
        Math.max(changedPixelRatio, colorChangedPixelRatio) <= policy.stableChangedPixelRatio,
    ).length /
      afterTransition.length >= 0.75;
  if (transitionIndexes.length > 0 && settledAfterTransition) {
    return known(
      "scene-transition",
      0.78 + 0.17 * Math.min(1, afterTransition.length / 2),
      samples,
      ["A near-global luminance or colour discontinuity is followed by a stable new visual state."],
    );
  }

  const coherent = measurements.filter(
    ({ globalMotionShare, translation }) =>
      globalMotionShare >= policy.coherentMotionShare &&
      translation.confidence >= policy.minimumTranslationConfidence,
  );
  const directionPairs = coherent
    .slice(1)
    .map((measurement, index) => directionCosine(coherent[index].translation, measurement.translation))
    .filter((value): value is number => value !== null);
  const reversals = directionPairs.filter((cosine) => cosine <= policy.reversalCosineThreshold).length;
  const coherentRatio = coherent.length / measurements.length;
  const rapidRatio =
    coherent.filter(({ translation }) => translation.magnitude >= policy.rapidTranslationMagnitude).length /
    measurements.length;

  if (coherentRatio >= 0.6 && reversals >= 1) {
    return known("erratic-global-motion", 0.72 + Math.min(0.23, reversals * 0.08), samples, [
      "Whole-frame motion is coherent but reverses direction within the recent window.",
      "This observable pattern does not identify a camera action, game mechanic, or player emotion.",
    ]);
  }
  if (coherentRatio >= 0.6 && rapidRatio >= 0.5 && mean(directionPairs) >= 0.35) {
    return known("rapid-coherent-global-motion", 0.72 + 0.25 * Math.min(coherentRatio, rapidRatio), samples, [
      "Whole-frame motion is strong, coherent, and directionally consistent without asserting its cause.",
    ]);
  }
  if (coherentRatio >= 0.6) {
    return known("coherent-global-motion", 0.68 + 0.25 * coherentRatio, samples, [
      "A global translation explains most of the visible frame change without identifying a game-specific action.",
    ]);
  }

  const mixedFrames = measurements.filter(
    ({ residualChangedPixelRatio, activeCellRatio, globalMotionShare }) =>
      residualChangedPixelRatio >= policy.mixedResidualRatio &&
      activeCellRatio >= policy.broadActiveCellRatio &&
      globalMotionShare < policy.coherentMotionShare,
  );
  if (mixedFrames.length / measurements.length >= 0.5) {
    return known("mixed-local-action", 0.7 + 0.25 * (mixedFrames.length / measurements.length), samples, [
      "Substantial motion remains after compensating for global camera translation.",
      "A more specific activity label requires separate HUD or event evidence.",
    ]);
  }

  const meanChanged = mean(measurements.map(({ changedPixelRatio }) => changedPixelRatio));
  if (meanChanged > policy.stableChangedPixelRatio) {
    return known("ordinary-motion", 0.55 + 0.3 * clampUnit(meanChanged), samples, [
      "Visual change is present but does not meet a stronger observable-state pattern.",
    ]);
  }
  return {
    status: "unknown",
    state: "unknown",
    confidence: 0,
    observedAt: newestAt,
    windowStartsAt: samples[0].observedAt,
    sampleCount: samples.length,
    reasons: ["Recent motion evidence is ambiguous."],
  };
}
