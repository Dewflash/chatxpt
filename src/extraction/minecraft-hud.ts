import type { GameCalibrationProfile, NormalizedVisualRegion } from "./game-profiles";
import type { SampledPixelFrame } from "./visual-measurements";

export interface RegionVisualFeatures {
  readonly regionId: string;
  readonly pixelCount: number;
  readonly meanLuma: number;
  readonly lumaStandardDeviation: number;
  readonly edgeDensity: number;
  readonly horizontalRepeatScore: number;
  readonly redPixelRatio: number;
  readonly warmPixelRatio: number;
  readonly bluePixelRatio: number;
  readonly darkPixelRatio: number;
  readonly brightPixelRatio: number;
}

export type MinecraftHudFingerprintStatus =
  | "vanilla-like"
  | "candidate-unconfirmed"
  | "modified-or-unknown"
  | "hud-hidden"
  | "insufficient-resolution";

export interface MinecraftHudFingerprint {
  readonly status: MinecraftHudFingerprintStatus;
  readonly confidence: number;
  readonly detectedAnchors: readonly string[];
  readonly missingAnchors: readonly string[];
  readonly supportedSignals: readonly string[];
  readonly reasons: readonly string[];
  readonly features: readonly RegionVisualFeatures[];
}

const MINIMUM_WIDTH = 80;
const MINIMUM_HEIGHT = 45;
const EDGE_DELTA = 0.14;

function assertFrame(frame: SampledPixelFrame): void {
  if (!Number.isInteger(frame.width) || frame.width <= 0 || !Number.isInteger(frame.height) || frame.height <= 0) {
    throw new RangeError("HUD frame dimensions must be positive integers");
  }
  if (!(frame.rgba instanceof Uint8ClampedArray) || frame.rgba.length !== frame.width * frame.height * 4) {
    throw new RangeError("HUD frame must contain one RGBA tuple per pixel");
  }
}

function clampUnit(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function pixelBounds(frame: SampledPixelFrame, region: NormalizedVisualRegion) {
  const left = Math.max(0, Math.floor(region.x * frame.width));
  const top = Math.max(0, Math.floor(region.y * frame.height));
  const right = Math.min(frame.width, Math.max(left + 1, Math.ceil((region.x + region.width) * frame.width)));
  const bottom = Math.min(frame.height, Math.max(top + 1, Math.ceil((region.y + region.height) * frame.height)));
  return { left, top, right, bottom };
}

function rgbaAt(frame: SampledPixelFrame, x: number, y: number) {
  const offset = (y * frame.width + x) * 4;
  return {
    red: frame.rgba[offset],
    green: frame.rgba[offset + 1],
    blue: frame.rgba[offset + 2],
    alpha: frame.rgba[offset + 3],
  };
}

function normalizedLuma(red: number, green: number, blue: number, alpha: number): number {
  return ((red * 0.2126 + green * 0.7152 + blue * 0.0722) / 255) * (alpha / 255);
}

function horizontalRepeatScore(lumas: readonly number[], width: number, height: number): number {
  if (width < 6 || height < 1) return 0;
  let best = 0;
  for (let shift = 2; shift <= Math.min(6, Math.floor(width / 3)); shift += 1) {
    let totalDifference = 0;
    let comparisons = 0;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x + shift < width; x += 1) {
        totalDifference += Math.abs(lumas[y * width + x] - lumas[y * width + x + shift]);
        comparisons += 1;
      }
    }
    if (comparisons > 0) best = Math.max(best, 1 - totalDifference / comparisons);
  }
  return clampUnit(best);
}

export function measureRegionVisualFeatures(
  frame: SampledPixelFrame,
  region: NormalizedVisualRegion,
): RegionVisualFeatures {
  assertFrame(frame);
  const bounds = pixelBounds(frame, region);
  const lumas: number[] = [];
  let edges = 0;
  let edgeComparisons = 0;
  let redPixels = 0;
  let warmPixels = 0;
  let bluePixels = 0;
  let darkPixels = 0;
  let brightPixels = 0;
  for (let y = bounds.top; y < bounds.bottom; y += 1) {
    for (let x = bounds.left; x < bounds.right; x += 1) {
      const pixel = rgbaAt(frame, x, y);
      const value = normalizedLuma(pixel.red, pixel.green, pixel.blue, pixel.alpha);
      lumas.push(value);
      if (value <= 0.2) darkPixels += 1;
      if (value >= 0.72) brightPixels += 1;
      if (
        pixel.alpha >= 96 &&
        pixel.red >= 80 &&
        pixel.green <= pixel.red * 0.5 &&
        pixel.blue <= pixel.red * 0.5
      ) {
        redPixels += 1;
      }
      if (
        pixel.alpha >= 96 &&
        pixel.red >= 75 &&
        pixel.green >= 35 &&
        pixel.red >= pixel.green * 1.2 &&
        pixel.green >= pixel.blue * 1.15
      ) {
        warmPixels += 1;
      }
      if (
        pixel.alpha >= 96 &&
        pixel.blue >= 70 &&
        pixel.blue >= pixel.red * 1.2 &&
        pixel.blue >= pixel.green * 1.08
      ) {
        bluePixels += 1;
      }
      if (x + 1 < bounds.right) {
        const right = rgbaAt(frame, x + 1, y);
        if (Math.abs(value - normalizedLuma(right.red, right.green, right.blue, right.alpha)) >= EDGE_DELTA) {
          edges += 1;
        }
        edgeComparisons += 1;
      }
      if (y + 1 < bounds.bottom) {
        const below = rgbaAt(frame, x, y + 1);
        if (Math.abs(value - normalizedLuma(below.red, below.green, below.blue, below.alpha)) >= EDGE_DELTA) {
          edges += 1;
        }
        edgeComparisons += 1;
      }
    }
  }
  const pixelCount = lumas.length;
  const regionWidth = bounds.right - bounds.left;
  const regionHeight = bounds.bottom - bounds.top;
  const meanLuma = pixelCount === 0 ? 0 : lumas.reduce((total, value) => total + value, 0) / pixelCount;
  const variance =
    pixelCount === 0
      ? 0
      : lumas.reduce((total, value) => total + (value - meanLuma) ** 2, 0) / pixelCount;
  return {
    regionId: region.regionId,
    pixelCount,
    meanLuma,
    lumaStandardDeviation: Math.sqrt(variance),
    edgeDensity: edgeComparisons === 0 ? 0 : edges / edgeComparisons,
    horizontalRepeatScore: horizontalRepeatScore(lumas, regionWidth, regionHeight),
    redPixelRatio: pixelCount === 0 ? 0 : redPixels / pixelCount,
    warmPixelRatio: pixelCount === 0 ? 0 : warmPixels / pixelCount,
    bluePixelRatio: pixelCount === 0 ? 0 : bluePixels / pixelCount,
    darkPixelRatio: pixelCount === 0 ? 0 : darkPixels / pixelCount,
    brightPixelRatio: pixelCount === 0 ? 0 : brightPixels / pixelCount,
  };
}

function confidenceForAnchor(score: number, minimum: number): number {
  if (score < minimum) return 0;
  return clampUnit(0.7 + 0.3 * ((score - minimum) / Math.max(Number.EPSILON, 1 - minimum)));
}

/**
 * Detects whether the configured vanilla HUD anchors are visually plausible.
 * It does not infer health/hunger values; those require separately calibrated
 * parsers or templates. Unknown/modded layouts retain universal motion support.
 */
export function fingerprintMinecraftHud(
  frame: SampledPixelFrame,
  profile: GameCalibrationProfile,
): MinecraftHudFingerprint {
  assertFrame(frame);
  if (profile.gameId !== "minecraft") {
    throw new RangeError("Minecraft HUD fingerprinting requires a Minecraft game profile");
  }
  const regions = profile.regions.filter(({ purpose }) => purpose === "hud-anchor");
  if (regions.length < 3) {
    throw new RangeError("Minecraft profile requires at least three HUD anchor regions");
  }
  if (frame.width < MINIMUM_WIDTH || frame.height < MINIMUM_HEIGHT) {
    return {
      status: "insufficient-resolution",
      confidence: 0,
      detectedAnchors: [],
      missingAnchors: regions.map(({ regionId }) => regionId),
      supportedSignals: profile.universalSignals,
      reasons: [`HUD fingerprinting requires at least ${MINIMUM_WIDTH}x${MINIMUM_HEIGHT} sampled pixels.`],
      features: [],
    };
  }

  const features = regions.map((region) => measureRegionVisualFeatures(frame, region));
  const byId = new Map(features.map((feature) => [feature.regionId, feature]));
  const anchors = [
    {
      id: "minecraft-health",
      score:
        confidenceForAnchor(byId.get("minecraft-health")?.redPixelRatio ?? 0, 0.08) *
        confidenceForAnchor(byId.get("minecraft-health")?.horizontalRepeatScore ?? 0, 0.82),
    },
    {
      id: "minecraft-hunger",
      score:
        confidenceForAnchor(byId.get("minecraft-hunger")?.warmPixelRatio ?? 0, 0.08) *
        confidenceForAnchor(byId.get("minecraft-hunger")?.horizontalRepeatScore ?? 0, 0.82),
    },
    {
      id: "minecraft-hotbar",
      score:
        confidenceForAnchor(byId.get("minecraft-hotbar")?.edgeDensity ?? 0, 0.12) *
        confidenceForAnchor(byId.get("minecraft-hotbar")?.horizontalRepeatScore ?? 0, 0.82),
    },
    {
      id: "minecraft-crosshair",
      score: confidenceForAnchor(byId.get("minecraft-crosshair")?.edgeDensity ?? 0, 0.035),
    },
  ].filter(({ id }) => byId.has(id));
  const detected = anchors.filter(({ score }) => score >= 0.65);
  const detectedAnchors = detected.map(({ id }) => id);
  const missingAnchors = anchors.filter(({ score }) => score < 0.65).map(({ id }) => id);
  const averageConfidence =
    detected.length === 0 ? 0 : detected.reduce((total, anchor) => total + anchor.score, 0) / detected.length;
  const anchorCoverage = detected.length / Math.max(1, anchors.length);
  const confidence = clampUnit(averageConfidence * anchorCoverage);
  const totalEdgeDensity = features.reduce((total, feature) => total + feature.edgeDensity, 0);

  if (
    detectedAnchors.includes("minecraft-health") &&
    detectedAnchors.includes("minecraft-hunger") &&
    detectedAnchors.includes("minecraft-hotbar")
  ) {
    return {
      status: "vanilla-like",
      confidence,
      detectedAnchors,
      missingAnchors,
      supportedSignals: [...profile.universalSignals, "minecraft-hud-layout"],
      reasons: [
        "At least three configured vanilla HUD anchors are visually plausible.",
        "Health and hunger values remain unavailable until their dedicated parsers confirm them.",
      ],
      features,
    };
  }
  if (totalEdgeDensity < 0.035 && detected.length === 0) {
    return {
      status: "hud-hidden",
      confidence: 0.75,
      detectedAnchors,
      missingAnchors,
      supportedSignals: profile.universalSignals,
      reasons: ["Configured HUD anchor regions contain too little structure for a visible HUD."],
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
      "The sampled HUD does not match enough vanilla anchors.",
      "Universal motion analysis remains available; calibrated health and hunger facts are unknown.",
    ],
    features,
  };
}
