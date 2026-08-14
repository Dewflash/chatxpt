import type { GameCalibrationProfile } from "./game-profiles";
import { measureRegionVisualFeatures, type RegionVisualFeatures } from "./minecraft-hud";
import type { SampledPixelFrame } from "./visual-measurements";

export type BrawlHudFingerprintStatus =
  | "standard-like"
  | "candidate-unconfirmed"
  | "modified-or-unknown"
  | "hud-hidden"
  | "insufficient-resolution";

export interface BrawlHudFingerprint {
  readonly status: BrawlHudFingerprintStatus;
  readonly confidence: number;
  readonly detectedAnchors: readonly string[];
  readonly missingAnchors: readonly string[];
  readonly supportedSignals: readonly string[];
  readonly reasons: readonly string[];
  readonly features: readonly RegionVisualFeatures[];
}

const MINIMUM_WIDTH = 120;
const MINIMUM_HEIGHT = 68;

function clampUnit(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function anchorScore(values: readonly [number, number][]): number {
  let total = 0;
  for (const [value, threshold] of values) {
    if (value < threshold) return 0;
    total += clampUnit(0.72 + 0.28 * ((value - threshold) / Math.max(Number.EPSILON, 1 - threshold)));
  }
  return values.length === 0 ? 0 : total / values.length;
}

/**
 * Confirms only the standard Brawl match HUD layout. Timer digits, score, mode,
 * and outcome still require separately confirmed parsers or OCR readings.
 */
export function fingerprintBrawlHud(
  frame: SampledPixelFrame,
  profile: GameCalibrationProfile,
): BrawlHudFingerprint {
  if (profile.gameId !== "brawl-stars") {
    throw new RangeError("Brawl HUD fingerprinting requires a Brawl Stars game profile");
  }
  const regions = profile.regions.filter(({ purpose }) => purpose === "hud-anchor");
  if (regions.length < 3) throw new RangeError("Brawl profile requires three HUD anchors");
  if (frame.width < MINIMUM_WIDTH || frame.height < MINIMUM_HEIGHT) {
    return {
      status: "insufficient-resolution",
      confidence: 0,
      detectedAnchors: [],
      missingAnchors: regions.map(({ regionId }) => regionId),
      supportedSignals: profile.universalSignals,
      reasons: [`Brawl HUD fingerprinting requires at least ${MINIMUM_WIDTH}x${MINIMUM_HEIGHT} sampled pixels.`],
      features: [],
    };
  }

  const features = regions.map((region) => measureRegionVisualFeatures(frame, region));
  const byId = new Map(features.map((feature) => [feature.regionId, feature]));
  const left = byId.get("brawl-left-score");
  const right = byId.get("brawl-right-score");
  const timer = byId.get("brawl-timer-anchor");
  const anchors = [
    {
      id: "brawl-left-score",
      score: anchorScore([
        [left?.bluePixelRatio ?? 0, 0.08],
        [left?.edgeDensity ?? 0, 0.035],
      ]),
    },
    {
      id: "brawl-right-score",
      score: anchorScore([
        [right?.redPixelRatio ?? 0, 0.018],
        [right?.edgeDensity ?? 0, 0.035],
      ]),
    },
    {
      id: "brawl-timer-anchor",
      score: anchorScore([
        [timer?.darkPixelRatio ?? 0, 0.06],
        [timer?.edgeDensity ?? 0, 0.08],
      ]),
    },
  ];
  const detected = anchors.filter(({ score }) => score >= 0.6);
  const detectedAnchors = detected.map(({ id }) => id);
  const missingAnchors = anchors.filter(({ score }) => score < 0.6).map(({ id }) => id);
  const confidence = detected.length === 0
    ? 0
    : clampUnit(detected.reduce((total, anchor) => total + anchor.score, 0) / anchors.length);
  if (detected.length === anchors.length) {
    return {
      status: "standard-like",
      confidence,
      detectedAnchors,
      missingAnchors,
      supportedSignals: [...profile.universalSignals, "brawl-hud-layout", "match-active"],
      reasons: [
        "Blue score, red score, and centre-timer anchors match the configured standard HUD.",
        "Timer digits, score values, and outcomes remain unknown until dedicated parsers confirm them.",
      ],
      features,
    };
  }
  const totalStructure = features.reduce((total, feature) => total + feature.edgeDensity, 0);
  if (detected.length === 0 && totalStructure < 0.06) {
    return {
      status: "hud-hidden",
      confidence: 0.75,
      detectedAnchors,
      missingAnchors,
      supportedSignals: profile.universalSignals,
      reasons: ["Configured Brawl HUD anchors contain too little structure for an active match HUD."],
      features,
    };
  }
  return {
    status: "modified-or-unknown",
    confidence: clampUnit(1 - confidence),
    detectedAnchors,
    missingAnchors,
    supportedSignals: profile.universalSignals,
    reasons: [
      "The sampled frame does not confirm all three standard Brawl match-HUD anchors.",
      "Universal motion remains available while match timer, score, and outcome are unknown.",
    ],
    features,
  };
}

export function parseBrawlTimerText(text: string): number | null {
  const normalized = text.trim().replace(/\s+/g, "");
  const match = /^(\d{1,2}):(\d{2})$/.exec(normalized);
  if (match === null) return null;
  const minutes = Number(match[1]);
  const seconds = Number(match[2]);
  if (seconds > 59 || minutes > 15) return null;
  return minutes * 60 + seconds;
}

export function parseBrawlOutcomeText(text: string): "match-over" | "victory" | "defeat" | null {
  const normalized = text.toLocaleLowerCase().replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ").trim();
  if (/\bvictory\b|\byou win\b/.test(normalized)) return "victory";
  if (/\bdefeat\b|\byou lose\b/.test(normalized)) return "defeat";
  if (/\bmatch over\b/.test(normalized)) return "match-over";
  return null;
}
