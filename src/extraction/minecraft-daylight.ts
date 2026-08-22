import type { NormalizedVisualRegion } from "./game-profiles";
import {
  measureRegionVisualFeatures,
  type MinecraftHudFact,
} from "./minecraft-hud";
import type { SampledPixelFrame } from "./visual-measurements";

export type MinecraftDayNightState = "day" | "night";

export interface MinecraftDaylightMeasurement {
  readonly meanLuma: number;
  readonly darkPixelRatio: number;
  readonly brightPixelRatio: number;
  readonly sourceRegionIds: readonly string[];
}

export interface MinecraftDaylightTrackerOptions {
  readonly dayLumaThreshold?: number;
  readonly nightLumaThreshold?: number;
  readonly dayConfirmationMs?: number;
  readonly nightConfirmationMs?: number;
  readonly abruptDarkeningDelta?: number;
  readonly abruptDarkeningWindowMs?: number;
  readonly occlusionRecoveryMargin?: number;
}

interface TimedMeasurement {
  readonly observedAt: number;
  readonly measurement: MinecraftDaylightMeasurement;
}

interface CandidateState {
  readonly value: MinecraftDayNightState;
  readonly startedAt: number;
  readonly samples: number;
}

interface StableState {
  readonly value: MinecraftDayNightState;
  readonly confidence: number;
  readonly referenceLuma: number;
}

interface OcclusionState {
  readonly baselineLuma: number;
  readonly detectedAt: number;
}

const DEFAULT_DAY_LUMA_THRESHOLD = 0.48;
const DEFAULT_NIGHT_LUMA_THRESHOLD = 0.3;
const DEFAULT_DAY_CONFIRMATION_MS = 2_000;
const DEFAULT_NIGHT_CONFIRMATION_MS = 10_000;
const DEFAULT_ABRUPT_DARKENING_DELTA = 0.16;
const DEFAULT_ABRUPT_DARKENING_WINDOW_MS = 2_500;
const DEFAULT_OCCLUSION_RECOVERY_MARGIN = 0.07;
const DAY_MINIMUM_SAMPLES = 3;
const NIGHT_MINIMUM_SAMPLES = 6;
const SIGNAL_FRESHNESS_MS = 3_000;

function clampUnit(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function region(
  regionId: string,
  x: number,
  y: number,
  width: number,
  height: number,
): NormalizedVisualRegion {
  return { regionId, x, y, width, height, purpose: "template" };
}

function known(
  value: MinecraftDayNightState,
  confidence: number,
  reason: string,
  sourceRegionIds: readonly string[],
  observedAt: number,
): MinecraftHudFact<MinecraftDayNightState> {
  return {
    status: "known",
    value,
    confidence: clampUnit(confidence),
    reason,
    sourceRegionIds,
    observedAt,
    expiresAt: observedAt + SIGNAL_FRESHNESS_MS,
  };
}

function unknown(
  reason: string,
  confidence = 0,
  sourceRegionIds: readonly string[] = [],
): MinecraftHudFact<MinecraftDayNightState> {
  return {
    status: "unknown",
    value: null,
    confidence: clampUnit(confidence),
    reason,
    sourceRegionIds,
  };
}

function confidenceFor(
  value: MinecraftDayNightState,
  measurement: MinecraftDaylightMeasurement,
  dayThreshold: number,
  nightThreshold: number,
): number {
  const margin = value === "day"
    ? Math.max(0, measurement.meanLuma - dayThreshold)
    : Math.max(0, nightThreshold - measurement.meanLuma);
  const supportingPixels = value === "day"
    ? measurement.brightPixelRatio
    : measurement.darkPixelRatio;
  return Math.min(0.93, 0.76 + margin * 0.28 + supportingPixels * 0.12);
}

/**
 * Measures broad upper/central gameplay brightness. This is deliberately a
 * cheap local pixel measurement, not a direct time-of-day claim; the temporal
 * tracker below owns promotion to day or night.
 */
export function measureMinecraftDaylight(frame: SampledPixelFrame): MinecraftDaylightMeasurement {
  const upper = measureRegionVisualFeatures(
    frame,
    region("minecraft-daylight-upper", 0.08, 0.06, 0.84, 0.28),
  );
  const center = measureRegionVisualFeatures(
    frame,
    region("minecraft-daylight-center", 0.18, 0.3, 0.64, 0.3),
  );
  return {
    meanLuma: clampUnit(upper.meanLuma * 0.72 + center.meanLuma * 0.28),
    darkPixelRatio: clampUnit(upper.darkPixelRatio * 0.72 + center.darkPixelRatio * 0.28),
    brightPixelRatio: clampUnit(upper.brightPixelRatio * 0.72 + center.brightPixelRatio * 0.28),
    sourceRegionIds: [upper.regionId, center.regionId],
  };
}

/**
 * Converts local brightness into a conservative world-time estimate. A fast
 * brightness drop while day is known is treated as a camera/indoor occlusion
 * and holds day until the prior brightness returns. Night requires a much
 * longer uninterrupted dark window, so entering a building cannot flip the
 * published state.
 */
export class MinecraftDaylightTracker {
  private readonly dayLumaThreshold: number;
  private readonly nightLumaThreshold: number;
  private readonly dayConfirmationMs: number;
  private readonly nightConfirmationMs: number;
  private readonly abruptDarkeningDelta: number;
  private readonly abruptDarkeningWindowMs: number;
  private readonly occlusionRecoveryMargin: number;
  private history: TimedMeasurement[] = [];
  private candidate: CandidateState | null = null;
  private stable: StableState | null = null;
  private occlusion: OcclusionState | null = null;
  private lastObservedAt: number | null = null;

  constructor(options: MinecraftDaylightTrackerOptions = {}) {
    this.dayLumaThreshold = options.dayLumaThreshold ?? DEFAULT_DAY_LUMA_THRESHOLD;
    this.nightLumaThreshold = options.nightLumaThreshold ?? DEFAULT_NIGHT_LUMA_THRESHOLD;
    this.dayConfirmationMs = options.dayConfirmationMs ?? DEFAULT_DAY_CONFIRMATION_MS;
    this.nightConfirmationMs = options.nightConfirmationMs ?? DEFAULT_NIGHT_CONFIRMATION_MS;
    this.abruptDarkeningDelta = options.abruptDarkeningDelta ?? DEFAULT_ABRUPT_DARKENING_DELTA;
    this.abruptDarkeningWindowMs = options.abruptDarkeningWindowMs ?? DEFAULT_ABRUPT_DARKENING_WINDOW_MS;
    this.occlusionRecoveryMargin = options.occlusionRecoveryMargin ?? DEFAULT_OCCLUSION_RECOVERY_MARGIN;
    if (this.nightLumaThreshold >= this.dayLumaThreshold) {
      throw new RangeError("Minecraft night luminance threshold must be below the day threshold");
    }
    for (const [name, value] of [
      ["dayLumaThreshold", this.dayLumaThreshold],
      ["nightLumaThreshold", this.nightLumaThreshold],
      ["abruptDarkeningDelta", this.abruptDarkeningDelta],
      ["occlusionRecoveryMargin", this.occlusionRecoveryMargin],
    ] as const) {
      if (!Number.isFinite(value) || value < 0 || value > 1) {
        throw new RangeError(`${name} must be between zero and one`);
      }
    }
  }

  reset(): void {
    this.history = [];
    this.candidate = null;
    this.stable = null;
    this.occlusion = null;
    this.lastObservedAt = null;
  }

  observe(input: {
    readonly observedAt: number;
    readonly measurement: MinecraftDaylightMeasurement | null;
    readonly blockedReason?: string | null;
  }): MinecraftHudFact<MinecraftDayNightState> {
    if (!Number.isInteger(input.observedAt) || input.observedAt < 0) {
      throw new RangeError("Minecraft daylight timestamps must be non-negative integers");
    }
    if (this.lastObservedAt !== null && input.observedAt <= this.lastObservedAt) {
      throw new RangeError("Minecraft daylight timestamps must be strictly increasing");
    }
    this.lastObservedAt = input.observedAt;

    if (input.measurement === null || input.blockedReason !== undefined && input.blockedReason !== null) {
      this.candidate = null;
      if (this.stable === null) {
        return unknown(
          input.blockedReason ?? "A visible Minecraft gameplay scene is required for day/night estimation.",
        );
      }
      return known(
        this.stable.value,
        Math.min(0.8, this.stable.confidence),
        `${input.blockedReason ?? "The daylight pixels are temporarily unavailable"} The last stable world-time state is retained.`,
        [],
        input.observedAt,
      );
    }

    const measurement = input.measurement;
    this.history.push({ observedAt: input.observedAt, measurement });
    this.history = this.history.filter(
      ({ observedAt }) => observedAt >= input.observedAt - this.abruptDarkeningWindowMs,
    );
    const recentPeakLuma = Math.max(...this.history.map(({ measurement: row }) => row.meanLuma));

    if (
      this.stable?.value === "day" &&
      this.occlusion === null &&
      recentPeakLuma - measurement.meanLuma >= this.abruptDarkeningDelta
    ) {
      this.occlusion = {
        baselineLuma: Math.max(this.stable.referenceLuma, recentPeakLuma),
        detectedAt: input.observedAt,
      };
      this.candidate = null;
    }

    if (
      this.occlusion !== null &&
      measurement.meanLuma >= this.occlusion.baselineLuma - this.occlusionRecoveryMargin
    ) {
      this.occlusion = null;
    }

    if (this.occlusion !== null && this.stable?.value === "day") {
      return known(
        "day",
        Math.min(0.82, this.stable.confidence),
        "Brightness fell too quickly for sunset, so ChatXPT treats the view as an indoor, shadowed, or camera-occluded scene and retains day.",
        measurement.sourceRegionIds,
        input.observedAt,
      );
    }

    const observedValue = measurement.meanLuma >= this.dayLumaThreshold
      ? "day" as const
      : measurement.meanLuma <= this.nightLumaThreshold
        ? "night" as const
        : null;

    if (observedValue === null) {
      this.candidate = null;
      if (this.stable === null) {
        return unknown(
          "Pixel brightness is between the conservative day and night thresholds.",
          0.5,
          measurement.sourceRegionIds,
        );
      }
      return known(
        this.stable.value,
        Math.min(0.82, this.stable.confidence),
        "Brightness is transitional, so the last stable day/night state is retained.",
        measurement.sourceRegionIds,
        input.observedAt,
      );
    }

    const confidence = confidenceFor(
      observedValue,
      measurement,
      this.dayLumaThreshold,
      this.nightLumaThreshold,
    );
    if (this.stable?.value === observedValue) {
      this.candidate = null;
      this.stable = {
        value: observedValue,
        confidence,
        referenceLuma: observedValue === "day"
          ? Math.max(this.stable.referenceLuma, measurement.meanLuma)
          : measurement.meanLuma,
      };
      return known(
        observedValue,
        confidence,
        `Sustained pixel brightness continues to support Minecraft ${observedValue}.`,
        measurement.sourceRegionIds,
        input.observedAt,
      );
    }

    this.candidate = this.candidate?.value === observedValue
      ? { ...this.candidate, samples: this.candidate.samples + 1 }
      : { value: observedValue, startedAt: input.observedAt, samples: 1 };
    const requiredDuration = observedValue === "day"
      ? this.dayConfirmationMs
      : this.nightConfirmationMs;
    const requiredSamples = observedValue === "day"
      ? DAY_MINIMUM_SAMPLES
      : NIGHT_MINIMUM_SAMPLES;
    const candidateDuration = input.observedAt - this.candidate.startedAt;
    if (candidateDuration >= requiredDuration && this.candidate.samples >= requiredSamples) {
      this.stable = {
        value: observedValue,
        confidence,
        referenceLuma: measurement.meanLuma,
      };
      this.candidate = null;
      return known(
        observedValue,
        confidence,
        observedValue === "night"
          ? "A long uninterrupted dark-pixel window supports Minecraft night; no quick indoor-darkening transition was observed."
          : "A sustained bright-pixel window supports Minecraft day.",
        measurement.sourceRegionIds,
        input.observedAt,
      );
    }

    if (this.stable !== null) {
      return known(
        this.stable.value,
        Math.min(0.82, this.stable.confidence),
        `A possible ${observedValue} transition is still being confirmed, so the last stable state is retained.`,
        measurement.sourceRegionIds,
        input.observedAt,
      );
    }
    return unknown(
      `${observedValue === "day" ? "Bright" : "Dark"} pixels are present, but the required temporal confirmation window is still being acquired.`,
      confidence,
      measurement.sourceRegionIds,
    );
  }
}
