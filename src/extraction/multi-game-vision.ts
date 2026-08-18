import {
  decideAdaptiveSampling,
  initialAdaptiveSamplingState,
  type AdaptiveSamplingDecision,
  type AdaptiveSamplingPolicy,
  type AdaptiveSamplingState,
} from "./adaptive-sampling";
import { fingerprintBrawlHud, type BrawlHudFingerprint } from "./brawl-hud";
import {
  createDefaultGameProfileRegistry,
  type GameCalibrationProfile,
  type GameProfileRegistry,
  type GameProfileSelection,
  type ResolvedGameProfile,
} from "./game-profiles";
import { fingerprintMinecraftHud, type MinecraftHudFingerprint } from "./minecraft-hud";
import {
  defaultMotionInterpretationPolicy,
  interpretMotionWindow,
  type MotionInterpretation,
  type MotionInterpretationPolicy,
  type TimedSpatialMotion,
} from "./motion-interpretation";
import { measureSpatialMotion, type SpatialMotionMeasurement, type SpatialMotionOptions } from "./spatial-motion";
import {
  createMultiGameVisionEvidencePolicy,
  type MultiGameVisionEvidencePolicy,
} from "./vision-evidence-policy";
import {
  gameplayFrameObservationSchema,
  type FrameSource,
  type GameplayFrameObservation,
} from "../core";
import type { FramePixelSampler, SampledPixelFrame } from "./visual-measurements";

export interface GameVisionExplanation {
  readonly code: string;
  readonly message: string;
  readonly confidence: number;
}

export interface MultiGameVisionAssessment {
  readonly observedAt: number;
  readonly profile: GameCalibrationProfile;
  readonly profileMatch: ResolvedGameProfile["match"];
  readonly evidencePolicyStatus: "approved" | "missing" | "evidence-class-mismatch";
  readonly evidencePolicyId: string | null;
  readonly supportTier: "universal-visual" | "calibrated-hud";
  readonly supportedSignals: readonly string[];
  readonly motion: SpatialMotionMeasurement | null;
  readonly interpretation: MotionInterpretation;
  readonly brawlHud: BrawlHudFingerprint | null;
  readonly minecraftHud: MinecraftHudFingerprint | null;
  readonly sampling: AdaptiveSamplingDecision;
  readonly explanations: readonly GameVisionExplanation[];
}

export interface MultiGameVisionAnalyzerOptions {
  readonly registry?: GameProfileRegistry;
  readonly motion?: Omit<SpatialMotionOptions, "excludedRegions">;
  readonly evidencePolicy?: MultiGameVisionEvidencePolicy;
  readonly sampling?: AdaptiveSamplingPolicy;
  readonly maximumHistorySamples?: number;
}

export type MultiGameVisionStreamOutput =
  | {
      readonly status: "ready";
      readonly frame: GameplayFrameObservation;
      readonly assessment: MultiGameVisionAssessment;
    }
  | {
      readonly status: "capture-unavailable";
      readonly frame: GameplayFrameObservation;
      readonly reason: "stale" | "permission-denied" | "unavailable" | "ended";
    };

export interface MultiGameVisionStreamOptions {
  readonly sampler: FramePixelSampler;
  readonly sampleWidth: number;
  readonly sampleHeight: number;
  readonly selection: GameProfileSelection | ((frame: GameplayFrameObservation) => GameProfileSelection);
  readonly analyzer?: MultiGameVisionAnalyzer;
  readonly evidencePolicy?: MultiGameVisionEvidencePolicy;
}

interface HudEvidenceReading<Status extends string> {
  readonly status: Status;
  readonly confidence: number;
  readonly observedAt: number;
}

const MAX_RETAINED_SAMPLE_PIXELS = 16_384;

function copyFrame(frame: SampledPixelFrame): SampledPixelFrame {
  if (!Number.isInteger(frame.width) || frame.width <= 0 || !Number.isInteger(frame.height) || frame.height <= 0) {
    throw new RangeError("vision frame dimensions must be positive integers");
  }
  if (!(frame.rgba instanceof Uint8ClampedArray) || frame.rgba.length !== frame.width * frame.height * 4) {
    throw new RangeError("vision frame must contain one RGBA tuple per pixel");
  }
  if (frame.width * frame.height > MAX_RETAINED_SAMPLE_PIXELS) {
    throw new RangeError(`vision frame must not exceed ${MAX_RETAINED_SAMPLE_PIXELS} sampled pixels`);
  }
  return { width: frame.width, height: frame.height, rgba: new Uint8ClampedArray(frame.rgba) };
}

function validateSampleSize(width: number, height: number): void {
  if (!Number.isInteger(width) || width <= 0 || !Number.isInteger(height) || height <= 0) {
    throw new RangeError("vision sample dimensions must be positive integers");
  }
  if (width * height > MAX_RETAINED_SAMPLE_PIXELS) {
    throw new RangeError(`vision sample must not exceed ${MAX_RETAINED_SAMPLE_PIXELS} pixels`);
  }
}

function bootstrapInterpretation(observedAt: number): MotionInterpretation {
  return {
    status: "unknown",
    state: "unknown",
    confidence: 0,
    observedAt,
    windowStartsAt: observedAt,
    sampleCount: 0,
    reasons: ["A previous sampled frame is required before motion can be measured."],
  };
}

function unknownInterpretation(
  interpretation: MotionInterpretation,
  observedAt: number,
  reason: string,
): MotionInterpretation {
  return {
    status: "unknown",
    state: "unknown",
    confidence: 0,
    observedAt,
    windowStartsAt: interpretation.windowStartsAt,
    sampleCount: interpretation.sampleCount,
    reasons: [reason],
  };
}

function recentConfirmation<Status extends string>(input: {
  readonly history: readonly HudEvidenceReading<Status>[];
  readonly expectedStatus: Status;
  readonly observedAt: number;
  readonly policy: MultiGameVisionEvidencePolicy | null;
}): boolean {
  if (input.policy === null) return false;
  return input.history.filter((reading) =>
    reading.status === input.expectedStatus &&
    reading.confidence >= input.policy!.minimumConfidence &&
    reading.observedAt >= input.observedAt - input.policy!.staleAfterMs,
  ).length >= 2;
}

function explanationsFor(input: {
  readonly resolved: ResolvedGameProfile;
  readonly interpretation: MotionInterpretation;
  readonly brawlHud: BrawlHudFingerprint | null;
  readonly hud: MinecraftHudFingerprint | null;
  readonly evidencePolicyStatus: MultiGameVisionAssessment["evidencePolicyStatus"];
}): GameVisionExplanation[] {
  const explanations: GameVisionExplanation[] = [
    {
      code: `evidence-policy-${input.evidencePolicyStatus}`,
      message: input.evidencePolicyStatus === "approved"
        ? "The injected calibration policy matches this frame's evidence class."
        : input.evidencePolicyStatus === "missing"
          ? "No evidence-approved policy is injected; observable classifications remain unknown."
          : "The injected calibration policy does not match this frame's evidence class; classifications remain unknown.",
      confidence: input.evidencePolicyStatus === "approved" ? 1 : 0,
    },
    {
      code: `profile-${input.resolved.match}`,
      message: `${input.resolved.reason} Active analysis profile: ${input.resolved.profile.displayName} (${input.resolved.profile.variant}).`,
      confidence: input.resolved.identityTrusted
        ? input.resolved.match === "exact-profile" ? 1 : 0.9
        : 0.7,
    },
    ...input.interpretation.reasons.map((message) => ({
      code: `motion-${input.interpretation.state}`,
      message,
      confidence: input.interpretation.confidence,
    })),
  ];
  if (input.hud !== null) {
    explanations.push(
      ...input.hud.reasons.map((message) => ({
        code: `minecraft-hud-${input.hud?.status ?? "unknown"}`,
        message,
        confidence: input.hud?.confidence ?? 0,
      })),
    );
  }
  if (input.brawlHud !== null) {
    explanations.push(
      ...input.brawlHud.reasons.map((message) => ({
        code: `brawl-hud-${input.brawlHud?.status ?? "unknown"}`,
        message,
        confidence: input.brawlHud?.confidence ?? 0,
      })),
    );
  }
  return explanations;
}

/**
 * Stateful, bounded analyser over downsampled pixels. It retains only the
 * previous bounded sample and a privacy-safe numeric motion window; raw OBS
 * frames remain owned and released by the upstream FrameSource consumer.
 */
export class MultiGameVisionAnalyzer {
  private readonly registry: GameProfileRegistry;
  private readonly maximumHistorySamples: number;
  private readonly motionOptions: Omit<SpatialMotionOptions, "excludedRegions">;
  private readonly interpretationPolicy: MotionInterpretationPolicy;
  private readonly evidencePolicy: MultiGameVisionEvidencePolicy | null;
  private readonly samplingPolicy: AdaptiveSamplingPolicy | undefined;
  private previous: SampledPixelFrame | null = null;
  private previousProfileId: string | null = null;
  private previousCalibrationConfirmed: boolean | null = null;
  private brawlHudHistory: HudEvidenceReading<BrawlHudFingerprint["status"]>[] = [];
  private minecraftHudHistory: HudEvidenceReading<MinecraftHudFingerprint["status"]>[] = [];
  private history: TimedSpatialMotion[] = [];
  private samplingState: AdaptiveSamplingState = initialAdaptiveSamplingState;
  private lastObservedAt: number | null = null;
  private lastEvidenceClass: GameplayFrameObservation["envelope"]["evidenceClass"] | null = null;

  constructor(options: MultiGameVisionAnalyzerOptions = {}) {
    this.registry = options.registry ?? createDefaultGameProfileRegistry();
    this.maximumHistorySamples = options.maximumHistorySamples ?? 20;
    if (!Number.isInteger(this.maximumHistorySamples) || this.maximumHistorySamples < 3 || this.maximumHistorySamples > 120) {
      throw new RangeError("maximumHistorySamples must be an integer from 3 to 120");
    }
    this.motionOptions = options.motion ?? {};
    this.evidencePolicy = options.evidencePolicy === undefined
      ? null
      : createMultiGameVisionEvidencePolicy(options.evidencePolicy);
    this.interpretationPolicy = this.evidencePolicy?.interpretation ?? defaultMotionInterpretationPolicy;
    this.samplingPolicy = options.sampling;
  }

  reset(): void {
    this.previous = null;
    this.previousProfileId = null;
    this.previousCalibrationConfirmed = null;
    this.brawlHudHistory = [];
    this.minecraftHudHistory = [];
    this.history = [];
    this.samplingState = initialAdaptiveSamplingState;
    this.lastObservedAt = null;
    this.lastEvidenceClass = null;
  }

  resolve(selection: GameProfileSelection): ResolvedGameProfile {
    return this.registry.resolve(selection);
  }

  analyse(input: {
    readonly frame: SampledPixelFrame;
    readonly observedAt: number;
    readonly selection: GameProfileSelection;
    readonly evidenceClass?: GameplayFrameObservation["envelope"]["evidenceClass"];
    readonly captureReady?: boolean;
  }): MultiGameVisionAssessment {
    if (!Number.isInteger(input.observedAt) || input.observedAt < 0) {
      throw new RangeError("vision observedAt must be a non-negative integer timestamp");
    }
    if (this.lastObservedAt !== null && input.observedAt <= this.lastObservedAt) {
      throw new RangeError("vision frame timestamps must be strictly increasing");
    }
    const frame = copyFrame(input.frame);
    const resolved = this.registry.resolve(input.selection);
    const evidenceClass = input.evidenceClass ?? this.evidencePolicy?.calibrationEvidenceClass ?? "fixture";
    const evidencePolicyStatus = this.evidencePolicy === null
      ? "missing" as const
      : this.evidencePolicy.calibrationEvidenceClass === evidenceClass
        ? "approved" as const
        : "evidence-class-mismatch" as const;
    const approvedPolicy = evidencePolicyStatus === "approved" ? this.evidencePolicy : null;
    const dimensionsChanged =
      this.previous !== null &&
      (this.previous.width !== frame.width || this.previous.height !== frame.height);
    const profileChanged = this.previousProfileId !== null && this.previousProfileId !== resolved.profile.profileId;
    const evidenceClassChanged = this.lastEvidenceClass !== null && this.lastEvidenceClass !== evidenceClass;
    if (dimensionsChanged || profileChanged || evidenceClassChanged) {
      this.previous = null;
      this.history = [];
      this.samplingState = initialAdaptiveSamplingState;
      this.previousCalibrationConfirmed = null;
      this.brawlHudHistory = [];
      this.minecraftHudHistory = [];
    }

    const rawBrawlHud =
      resolved.profile.gameId === "brawl-stars"
        ? fingerprintBrawlHud(frame, resolved.profile)
        : null;
    if (rawBrawlHud !== null) {
      this.brawlHudHistory.push({
        status: rawBrawlHud.status,
        confidence: rawBrawlHud.confidence,
        observedAt: input.observedAt,
      });
      this.brawlHudHistory = this.brawlHudHistory.slice(-3);
    } else {
      this.brawlHudHistory = [];
    }
    const brawlProfileApproved = approvedPolicy?.approvedProfileIds.includes(resolved.profile.profileId) === true;
    const brawlCalibrationConfirmed = rawBrawlHud?.status === "standard-like" && brawlProfileApproved &&
      recentConfirmation({
        history: this.brawlHudHistory,
        expectedStatus: "standard-like",
        observedAt: input.observedAt,
        policy: approvedPolicy,
      });
    const brawlHud =
      rawBrawlHud?.status === "standard-like" && !brawlCalibrationConfirmed
        ? {
            ...rawBrawlHud,
            status: "candidate-unconfirmed" as const,
            supportedSignals: resolved.profile.universalSignals,
            reasons: [
              "A standard Brawl match HUD candidate requires two fresh, policy-approved fingerprints at the confidence floor.",
              "Timer, score, and match state remain unknown until matching evidence and profile approval are present.",
            ],
          }
        : rawBrawlHud;
    const rawMinecraftHud =
      resolved.profile.gameId === "minecraft"
        ? fingerprintMinecraftHud(frame, resolved.profile)
        : null;
    if (rawMinecraftHud !== null) {
      this.minecraftHudHistory.push({
        status: rawMinecraftHud.status,
        confidence: rawMinecraftHud.confidence,
        observedAt: input.observedAt,
      });
      this.minecraftHudHistory = this.minecraftHudHistory.slice(-3);
    } else {
      this.minecraftHudHistory = [];
    }
    const minecraftProfileApproved = approvedPolicy?.approvedProfileIds.includes(resolved.profile.profileId) === true;
    const minecraftCalibrationConfirmed = rawMinecraftHud?.status === "vanilla-like" && minecraftProfileApproved &&
      recentConfirmation({
        history: this.minecraftHudHistory,
        expectedStatus: "vanilla-like",
        observedAt: input.observedAt,
        policy: approvedPolicy,
      });
    const minecraftHud =
      rawMinecraftHud?.status === "vanilla-like" && !minecraftCalibrationConfirmed
        ? {
            ...rawMinecraftHud,
            status: "candidate-unconfirmed" as const,
            supportedSignals: resolved.profile.universalSignals,
            reasons: [
              "A vanilla-like HUD candidate requires two fresh, policy-approved fingerprints at the confidence floor.",
              "Calibrated facts remain unknown until matching evidence and profile approval are present.",
            ],
          }
        : rawMinecraftHud;
    const calibrationConfirmed = brawlCalibrationConfirmed || minecraftCalibrationConfirmed;
    if (
      this.previousCalibrationConfirmed !== null &&
      this.previousCalibrationConfirmed !== calibrationConfirmed
    ) {
      this.previous = null;
      this.history = [];
      this.samplingState = initialAdaptiveSamplingState;
    }
    const excludedRegions = calibrationConfirmed
      ? resolved.profile.regions.filter(({ purpose }) => purpose === "motion-exclusion")
      : [];
    const motion =
      this.previous === null
        ? null
        : measureSpatialMotion(this.previous, frame, {
            ...this.motionOptions,
            excludedRegions,
          });
    if (motion !== null) {
      this.history.push({ observedAt: input.observedAt, measurement: motion });
      this.history = this.history
        .filter(({ observedAt }) => observedAt >= input.observedAt - this.interpretationPolicy.windowMs)
        .slice(-this.maximumHistorySamples);
    }
    const rawInterpretation =
      motion === null
        ? bootstrapInterpretation(input.observedAt)
        : interpretMotionWindow(this.history, this.interpretationPolicy);
    const interpretation = approvedPolicy === null
      ? unknownInterpretation(
          rawInterpretation,
          input.observedAt,
          evidencePolicyStatus === "missing"
            ? "No evidence-approved motion policy is available for this frame."
            : "The motion policy evidence class does not match this frame.",
        )
      : rawInterpretation.status === "known" && rawInterpretation.confidence < approvedPolicy.minimumConfidence
        ? unknownInterpretation(
            rawInterpretation,
            input.observedAt,
            `Motion confidence is below the approved ${approvedPolicy.minimumConfidence} threshold.`,
          )
        : rawInterpretation;
    const supportedSignals = [
      ...resolved.profile.universalSignals,
      ...(brawlHud?.supportedSignals ?? []).filter(
        (signal) => !resolved.profile.universalSignals.includes(signal),
      ),
      ...(minecraftHud?.supportedSignals ?? []).filter(
        (signal) => !resolved.profile.universalSignals.includes(signal),
      ),
    ];
    const supportTier = supportedSignals.some(
      (signal) => !resolved.profile.universalSignals.includes(signal),
    )
      ? "calibrated-hud" as const
      : "universal-visual" as const;
    const sampling = decideAdaptiveSampling({
      now: input.observedAt,
      state: this.samplingState,
      captureReady: input.captureReady ?? true,
      measurement: motion,
      interpretation: motion === null ? null : interpretation,
      policy: this.samplingPolicy,
    });

    this.previous = frame;
    this.previousProfileId = resolved.profile.profileId;
    this.previousCalibrationConfirmed = calibrationConfirmed;
    this.samplingState = sampling;
    this.lastObservedAt = input.observedAt;
    this.lastEvidenceClass = evidenceClass;
    return {
      observedAt: input.observedAt,
      profile: resolved.profile,
      profileMatch: resolved.match,
      evidencePolicyStatus,
      evidencePolicyId: approvedPolicy?.policyId ?? null,
      supportTier,
      supportedSignals,
      motion,
      interpretation,
      brawlHud,
      minecraftHud,
      sampling,
      explanations: explanationsFor({
        resolved,
        interpretation,
        brawlHud,
        hud: minecraftHud,
        evidencePolicyStatus,
      }),
    };
  }
}

/**
 * Connects the canonical ephemeral FrameSource to the bounded multi-game
 * analyser. Every upstream frame is released before an assessment is yielded.
 * A fast source may emit at burst cadence; baseline frames are skipped without
 * pixel copies according to the analyser's latest cadence decision.
 */
export async function* streamMultiGameVisionAssessments(
  source: FrameSource,
  options: MultiGameVisionStreamOptions,
  signal?: AbortSignal,
): AsyncGenerator<MultiGameVisionStreamOutput> {
  validateSampleSize(options.sampleWidth, options.sampleHeight);
  if (options.analyzer !== undefined && options.evidencePolicy !== undefined) {
    throw new RangeError("provide either analyzer or evidencePolicy, not both");
  }
  const analyzer = options.analyzer ?? new MultiGameVisionAnalyzer({ evidencePolicy: options.evidencePolicy });
  let nextAnalysisAt = 0;
  for await (const ephemeral of source.frames(signal)) {
    let output: MultiGameVisionStreamOutput | null = null;
    try {
      const frame = gameplayFrameObservationSchema.parse(ephemeral.observation);
      if (frame.status !== "ready") {
        analyzer.reset();
        nextAnalysisAt = 0;
        output = { status: "capture-unavailable", frame, reason: frame.status };
      } else if (frame.capturedAt >= nextAnalysisAt) {
        if (signal?.aborted) break;
        const sampled = await options.sampler.sample(
          ephemeral.image,
          { width: options.sampleWidth, height: options.sampleHeight },
          signal,
        );
        if (signal?.aborted) break;
        const selection =
          typeof options.selection === "function" ? options.selection(frame) : options.selection;
        const assessment = analyzer.analyse({
          frame: sampled,
          observedAt: frame.capturedAt,
          selection,
          evidenceClass: frame.envelope.evidenceClass,
          captureReady: true,
        });
        nextAnalysisAt =
          assessment.sampling.intervalMs === null
            ? Number.POSITIVE_INFINITY
            : frame.capturedAt + assessment.sampling.intervalMs;
        output = { status: "ready", frame, assessment };
      }
    } finally {
      ephemeral.release();
    }
    if (output !== null) yield output;
  }
}
