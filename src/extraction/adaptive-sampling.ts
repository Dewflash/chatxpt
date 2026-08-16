import type { MotionInterpretation, ObservableMotionState } from "./motion-interpretation";
import type { SpatialMotionMeasurement } from "./spatial-motion";

export type AnalysisCadenceMode = "baseline" | "burst" | "unavailable";

export interface AdaptiveSamplingPolicy {
  readonly baselineIntervalMs: number;
  readonly burstIntervalMs: number;
  readonly burstDurationMs: number;
  readonly maximumBurstDurationMs: number;
  readonly burstCooldownMs: number;
  readonly motionSpikeChangedPixelRatio: number;
  readonly motionSpikeResidualRatio: number;
}

export interface AdaptiveSamplingState {
  readonly mode: AnalysisCadenceMode;
  readonly burstStartedAt: number | null;
  readonly burstUntil: number | null;
  readonly cooldownUntil: number | null;
}

export interface AdaptiveSamplingDecision extends AdaptiveSamplingState {
  readonly intervalMs: number | null;
  readonly reason:
    | "baseline"
    | "motion-spike"
    | "ambiguous-motion"
    | "scene-change"
    | "burst-active"
    | "burst-cooldown"
    | "capture-unavailable";
}

export const defaultAdaptiveSamplingPolicy: AdaptiveSamplingPolicy = {
  baselineIntervalMs: 500,
  burstIntervalMs: 100,
  burstDurationMs: 1_500,
  maximumBurstDurationMs: 3_000,
  burstCooldownMs: 750,
  motionSpikeChangedPixelRatio: 0.28,
  motionSpikeResidualRatio: 0.16,
};

export const initialAdaptiveSamplingState: AdaptiveSamplingState = {
  mode: "baseline",
  burstStartedAt: null,
  burstUntil: null,
  cooldownUntil: null,
};

function validatePolicy(policy: AdaptiveSamplingPolicy): void {
  for (const [name, value] of Object.entries({
    baselineIntervalMs: policy.baselineIntervalMs,
    burstIntervalMs: policy.burstIntervalMs,
    burstDurationMs: policy.burstDurationMs,
    maximumBurstDurationMs: policy.maximumBurstDurationMs,
    burstCooldownMs: policy.burstCooldownMs,
  })) {
    if (!Number.isInteger(value) || value <= 0) throw new RangeError(`${name} must be a positive integer`);
  }
  if (policy.burstIntervalMs >= policy.baselineIntervalMs) {
    throw new RangeError("burstIntervalMs must be lower than baselineIntervalMs");
  }
  if (policy.maximumBurstDurationMs < policy.burstDurationMs) {
    throw new RangeError("maximumBurstDurationMs cannot be shorter than burstDurationMs");
  }
  for (const [name, value] of Object.entries({
    motionSpikeChangedPixelRatio: policy.motionSpikeChangedPixelRatio,
    motionSpikeResidualRatio: policy.motionSpikeResidualRatio,
  })) {
    if (!Number.isFinite(value) || value < 0 || value > 1) {
      throw new RangeError(`${name} must be between 0 and 1`);
    }
  }
}

function burstReason(
  measurement: SpatialMotionMeasurement | null,
  interpretation: MotionInterpretation | null,
  policy: AdaptiveSamplingPolicy,
): "motion-spike" | "ambiguous-motion" | "scene-change" | null {
  if (interpretation?.state === "scene-transition") return "scene-change";
  if (
    interpretation?.state === "unknown" ||
    interpretation?.state === "erratic-global-motion"
  ) {
    return "ambiguous-motion";
  }
  if (
    measurement !== null &&
    (measurement.changedPixelRatio >= policy.motionSpikeChangedPixelRatio ||
      measurement.colorChangedPixelRatio >= policy.motionSpikeChangedPixelRatio ||
      measurement.residualChangedPixelRatio >= policy.motionSpikeResidualRatio)
  ) {
    return "motion-spike";
  }
  return null;
}

/**
 * Chooses analysis cadence without owning capture. A caller may use the returned
 * interval to configure a dynamic FrameSource or to skip frames at baseline.
 */
export function decideAdaptiveSampling(input: {
  readonly now: number;
  readonly state: AdaptiveSamplingState;
  readonly captureReady: boolean;
  readonly measurement: SpatialMotionMeasurement | null;
  readonly interpretation: MotionInterpretation | null;
  readonly policy?: AdaptiveSamplingPolicy;
}): AdaptiveSamplingDecision {
  const policy = input.policy ?? defaultAdaptiveSamplingPolicy;
  validatePolicy(policy);
  if (!Number.isInteger(input.now) || input.now < 0) {
    throw new RangeError("sampling now must be a non-negative integer timestamp");
  }
  if (!input.captureReady) {
    return {
      mode: "unavailable",
      intervalMs: null,
      burstStartedAt: null,
      burstUntil: null,
      cooldownUntil: null,
      reason: "capture-unavailable",
    };
  }

  const trigger = burstReason(input.measurement, input.interpretation, policy);
  if (
    input.state.mode === "burst" &&
    input.state.burstStartedAt !== null &&
    input.state.burstUntil !== null &&
    input.now < input.state.burstUntil
  ) {
    const hardStop = input.state.burstStartedAt + policy.maximumBurstDurationMs;
    const extendedUntil =
      trigger === null
        ? input.state.burstUntil
        : Math.min(hardStop, Math.max(input.state.burstUntil, input.now + policy.burstDurationMs));
    return {
      mode: "burst",
      intervalMs: policy.burstIntervalMs,
      burstStartedAt: input.state.burstStartedAt,
      burstUntil: extendedUntil,
      cooldownUntil: null,
      reason: "burst-active",
    };
  }

  const previousBurstEndedAt = input.state.burstUntil;
  const cooldownUntil =
    input.state.mode === "burst" && previousBurstEndedAt !== null
      ? previousBurstEndedAt + policy.burstCooldownMs
      : input.state.cooldownUntil;
  if (cooldownUntil !== null && input.now < cooldownUntil) {
    return {
      mode: "baseline",
      intervalMs: policy.baselineIntervalMs,
      burstStartedAt: null,
      burstUntil: null,
      cooldownUntil,
      reason: "burst-cooldown",
    };
  }

  if (trigger !== null) {
    return {
      mode: "burst",
      intervalMs: policy.burstIntervalMs,
      burstStartedAt: input.now,
      burstUntil: input.now + policy.burstDurationMs,
      cooldownUntil: null,
      reason: trigger,
    };
  }
  return {
    mode: "baseline",
    intervalMs: policy.baselineIntervalMs,
    burstStartedAt: null,
    burstUntil: null,
    cooldownUntil: null,
    reason: "baseline",
  };
}

export function cadenceNeedsBurst(state: ObservableMotionState): boolean {
  return state === "unknown" || state === "erratic-global-motion" || state === "scene-transition";
}
