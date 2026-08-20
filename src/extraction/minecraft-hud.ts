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
  readonly greenPixelRatio: number;
  readonly warmPixelRatio: number;
  readonly bluePixelRatio: number;
  readonly darkPixelRatio: number;
  readonly brightPixelRatio: number;
}

export type MinecraftHudFingerprintStatus =
  | "vanilla-like"
  | "minecraft-like"
  | "candidate-unconfirmed"
  | "modified-or-unknown"
  | "hud-hidden"
  | "insufficient-resolution";

export type MinecraftHudFactStatus = "known" | "unknown";

export interface MinecraftHudFact<T extends string | number | boolean> {
  readonly status: MinecraftHudFactStatus;
  readonly value: T | null;
  readonly confidence: number;
  readonly reason: string;
  readonly sourceRegionIds: readonly string[];
}

export interface MinecraftHudFacts {
  readonly healthHearts: MinecraftHudFact<number>;
  readonly hungerShanks: MinecraftHudFact<number>;
  readonly armorPoints: MinecraftHudFact<number>;
  readonly hotbarVisible: MinecraftHudFact<boolean>;
  readonly selectedHotbarCategory: MinecraftHudFact<"tool" | "weapon" | "food" | "block" | "empty">;
}

export interface MinecraftHudFingerprint {
  readonly status: MinecraftHudFingerprintStatus;
  readonly confidence: number;
  readonly detectedAnchors: readonly string[];
  readonly missingAnchors: readonly string[];
  readonly supportedSignals: readonly string[];
  readonly reasons: readonly string[];
  readonly features: readonly RegionVisualFeatures[];
  readonly facts: MinecraftHudFacts;
}

const MINIMUM_WIDTH = 80;
const MINIMUM_HEIGHT = 45;
const EDGE_DELTA = 0.14;
const UNKNOWN_HUD_FACTS: MinecraftHudFacts = {
  healthHearts: {
    status: "unknown",
    value: null,
    confidence: 0,
    reason: "No reliable Minecraft health band was detected.",
    sourceRegionIds: [],
  },
  hungerShanks: {
    status: "unknown",
    value: null,
    confidence: 0,
    reason: "No reliable Minecraft hunger band was detected.",
    sourceRegionIds: [],
  },
  armorPoints: {
    status: "unknown",
    value: null,
    confidence: 0,
    reason: "Armor is not parsed by the current Minecraft HUD detector.",
    sourceRegionIds: [],
  },
  hotbarVisible: {
    status: "unknown",
    value: null,
    confidence: 0,
    reason: "No reliable Minecraft hotbar band was detected.",
    sourceRegionIds: [],
  },
  selectedHotbarCategory: {
    status: "unknown",
    value: null,
    confidence: 0,
    reason: "Selected hotbar item category is not parsed by the current detector.",
    sourceRegionIds: [],
  },
};

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
  let greenPixels = 0;
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
        pixel.green >= 75 &&
        pixel.green >= pixel.red * 1.12 &&
        pixel.green >= pixel.blue * 1.12
      ) {
        greenPixels += 1;
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
    greenPixelRatio: pixelCount === 0 ? 0 : greenPixels / pixelCount,
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

function knownHudFact<T extends string | number | boolean>(
  value: T,
  confidence: number,
  reason: string,
  sourceRegionIds: readonly string[],
): MinecraftHudFact<T> {
  return { status: "known", value, confidence: clampUnit(confidence), reason, sourceRegionIds };
}

function unknownHudFact<T extends string | number | boolean>(
  reason: string,
  confidence = 0,
  sourceRegionIds: readonly string[] = [],
): MinecraftHudFact<T> {
  return { status: "unknown", value: null, confidence: clampUnit(confidence), reason, sourceRegionIds };
}

function dynamicRegion(
  regionId: string,
  x: number,
  y: number,
  width: number,
  height: number,
): NormalizedVisualRegion {
  return { regionId, x, y, width, height, purpose: "hud-anchor" };
}

interface RegionSearchResult {
  readonly region: NormalizedVisualRegion;
  readonly features: RegionVisualFeatures;
  readonly score: number;
}

function searchBestRegion(input: {
  readonly frame: SampledPixelFrame;
  readonly regionId: string;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly score: (features: RegionVisualFeatures) => number;
}): RegionSearchResult {
  const candidates = [];
  for (let x = 0.18; x <= 0.62; x += 0.04) {
    const region = dynamicRegion(input.regionId, x, input.y, input.width, input.height);
    const features = measureRegionVisualFeatures(input.frame, region);
    candidates.push({ region, features, score: input.score(features) });
  }
  return candidates.sort((left, right) => right.score - left.score)[0];
}

function estimateTenIconValue(colourRatio: number, confidence: number): MinecraftHudFact<number> {
  if (confidence < 0.65 || colourRatio < 0.06) {
    return unknownHudFact("The icon band did not meet the confidence threshold.", confidence);
  }
  const calibratedFullBandRatio = 0.25;
  const factConfidence = Math.max(
    confidence,
    0.7 + 0.3 * Math.min(1, colourRatio / calibratedFullBandRatio),
  );
  return knownHudFact(
    Math.max(0, Math.min(10, Math.round((colourRatio / calibratedFullBandRatio) * 10))),
    factConfidence,
    "A repeated Minecraft-like HUD icon band was detected.",
    [],
  );
}

function estimateArmorValue(features: RegionVisualFeatures, confidence: number): MinecraftHudFact<number> {
  const armourPixelRatio = Math.max(features.bluePixelRatio, features.brightPixelRatio * 0.75);
  if (confidence < 0.68 || armourPixelRatio < 0.05) {
    return unknownHudFact(
      "The armor band did not meet the confidence threshold.",
      confidence,
      [features.regionId],
    );
  }
  const calibratedFullBandRatio = 0.22;
  return knownHudFact(
    Math.max(0, Math.min(10, Math.round((armourPixelRatio / calibratedFullBandRatio) * 10))),
    Math.max(confidence, 0.7 + 0.3 * Math.min(1, armourPixelRatio / calibratedFullBandRatio)),
    "A repeated Minecraft-like armor band was detected above the lower HUD.",
    [features.regionId],
  );
}

function slotRegion(
  regionId: string,
  hotbarRegion: NormalizedVisualRegion,
  slotIndex: number,
  inset = 0,
): NormalizedVisualRegion {
  const slotWidth = hotbarRegion.width / 9;
  const insetX = slotWidth * inset;
  const insetY = hotbarRegion.height * inset;
  return dynamicRegion(
    regionId,
    hotbarRegion.x + slotIndex * slotWidth + insetX,
    hotbarRegion.y + insetY,
    Math.max(0.001, slotWidth - insetX * 2),
    Math.max(0.001, hotbarRegion.height - insetY * 2),
  );
}

function selectedHotbarCategoryFact(input: {
  readonly frame: SampledPixelFrame;
  readonly hotbarRegion: NormalizedVisualRegion;
  readonly hotbarScore: number;
}): MinecraftHudFact<"tool" | "weapon" | "food" | "block" | "empty"> {
  if (input.hotbarScore < 0.65) {
    return unknownHudFact(
      "The hotbar must be visible before selected-slot contents can be classified.",
      input.hotbarScore,
      [input.hotbarRegion.regionId],
    );
  }

  const slots = Array.from({ length: 9 }, (_, slotIndex) => {
    const outer = measureRegionVisualFeatures(
      input.frame,
      slotRegion(`minecraft-hotbar-slot-${slotIndex + 1}`, input.hotbarRegion, slotIndex),
    );
    return {
      slotIndex,
      outer,
      highlightScore: outer.brightPixelRatio * 0.75 + outer.edgeDensity * 0.25,
    };
  }).sort((left, right) => right.highlightScore - left.highlightScore);
  const [best, second] = slots;
  if (
    best === undefined ||
    second === undefined ||
    best.highlightScore < 0.28 ||
    best.highlightScore - second.highlightScore < 0.08
  ) {
    return unknownHudFact(
      "No single selected hotbar slot was visually distinct enough to classify.",
      best?.highlightScore ?? 0,
      [input.hotbarRegion.regionId],
    );
  }

  const inner = measureRegionVisualFeatures(
    input.frame,
    slotRegion("minecraft-selected-hotbar-inner", input.hotbarRegion, best.slotIndex, 0.24),
  );
  const confidence = clampUnit(0.7 + Math.min(0.3, best.highlightScore - second.highlightScore));
  if (
    inner.darkPixelRatio >= 0.55 &&
    inner.brightPixelRatio < 0.12 &&
    inner.redPixelRatio < 0.06 &&
    inner.warmPixelRatio < 0.06 &&
    inner.bluePixelRatio < 0.06
  ) {
    return knownHudFact(
      "empty",
      confidence,
      "A selected Minecraft hotbar slot was visible and its inner area appeared empty.",
      [best.outer.regionId, inner.regionId],
    );
  }
  if (inner.warmPixelRatio >= 0.14 && inner.redPixelRatio < 0.12) {
    return knownHudFact(
      "food",
      confidence,
      "A selected Minecraft hotbar slot contained a warm food-like item color cluster.",
      [best.outer.regionId, inner.regionId],
    );
  }
  if (inner.brightPixelRatio >= 0.18 && inner.bluePixelRatio >= 0.08) {
    return knownHudFact(
      "tool",
      confidence,
      "A selected Minecraft hotbar slot contained a bright/blue tool-like item color cluster.",
      [best.outer.regionId, inner.regionId],
    );
  }
  if (inner.lumaStandardDeviation >= 0.18 && inner.warmPixelRatio < 0.08 && inner.bluePixelRatio < 0.08) {
    return knownHudFact(
      "block",
      confidence,
      "A selected Minecraft hotbar slot contained a block-like textured item cluster.",
      [best.outer.regionId, inner.regionId],
    );
  }

  return unknownHudFact(
    "The selected hotbar slot was visible, but the item category was not confidently classified.",
    confidence,
    [best.outer.regionId, inner.regionId],
  );
}

function minecraftHudFacts(input: {
  readonly frame: SampledPixelFrame;
  readonly health: RegionVisualFeatures;
  readonly hunger: RegionVisualFeatures;
  readonly hotbar: RegionVisualFeatures;
  readonly hotbarRegion: NormalizedVisualRegion;
  readonly armor: RegionVisualFeatures;
  readonly healthScore: number;
  readonly hungerScore: number;
  readonly hotbarScore: number;
  readonly armorScore: number;
}): MinecraftHudFacts {
  const health = estimateTenIconValue(input.health.redPixelRatio, input.healthScore);
  const hunger = estimateTenIconValue(input.hunger.warmPixelRatio, input.hungerScore);
  const armor = estimateArmorValue(input.armor, input.armorScore);
  const hotbar =
    input.hotbarScore >= 0.65
      ? knownHudFact(
          true,
          input.hotbarScore,
          "A repeated lower-screen hotbar structure was detected.",
          [input.hotbar.regionId],
        )
      : unknownHudFact<boolean>(
          "The hotbar band did not meet the confidence threshold.",
          input.hotbarScore,
          [input.hotbar.regionId],
        );
  const selectedHotbarCategory = selectedHotbarCategoryFact({
    frame: input.frame,
    hotbarRegion: input.hotbarRegion,
    hotbarScore: input.hotbarScore,
  });
  return {
    healthHearts: health.status === "known"
      ? { ...health, sourceRegionIds: [input.health.regionId] }
      : { ...health, sourceRegionIds: [input.health.regionId] },
    hungerShanks: hunger.status === "known"
      ? { ...hunger, sourceRegionIds: [input.hunger.regionId] }
      : { ...hunger, sourceRegionIds: [input.hunger.regionId] },
    armorPoints: armor,
    hotbarVisible: hotbar,
    selectedHotbarCategory,
  };
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
      facts: UNKNOWN_HUD_FACTS,
    };
  }

  const features = regions.map((region) => measureRegionVisualFeatures(frame, region));
  const byId = new Map(features.map((feature) => [feature.regionId, feature]));
  const searchedHealth = searchBestRegion({
    frame,
    regionId: "minecraft-health-search",
    y: 0.72,
    width: 0.22,
    height: 0.14,
    score: (candidate) =>
      confidenceForAnchor(candidate.redPixelRatio, 0.08) *
      confidenceForAnchor(candidate.horizontalRepeatScore, 0.78),
  });
  const searchedHunger = searchBestRegion({
    frame,
    regionId: "minecraft-hunger-search",
    y: 0.72,
    width: 0.22,
    height: 0.14,
    score: (candidate) =>
      confidenceForAnchor(candidate.warmPixelRatio, 0.08) *
      confidenceForAnchor(candidate.horizontalRepeatScore, 0.78),
  });
  const searchedArmor = searchBestRegion({
    frame,
    regionId: "minecraft-armor-search",
    y: 0.66,
    width: 0.22,
    height: 0.1,
    score: (candidate) =>
      confidenceForAnchor(Math.max(candidate.bluePixelRatio, candidate.brightPixelRatio * 0.75), 0.06) *
      confidenceForAnchor(candidate.horizontalRepeatScore, 0.76),
  });
  const searchedHotbar = searchBestRegion({
    frame,
    regionId: "minecraft-hotbar-search",
    y: 0.84,
    width: 0.44,
    height: 0.14,
    score: (candidate) =>
      confidenceForAnchor(candidate.edgeDensity, 0.1) *
      confidenceForAnchor(candidate.horizontalRepeatScore, 0.76),
  });
  const fixedAnchors = [
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
  const configuredHotbarRegion = regions.find(({ regionId }) => regionId === "minecraft-hotbar");
  const fixedHotbarScore = fixedAnchors.find(({ id }) => id === "minecraft-hotbar")?.score ?? 0;
  const searchAnchors = [
    { id: "minecraft-health-search", score: searchedHealth.score },
    { id: "minecraft-hunger-search", score: searchedHunger.score },
    { id: "minecraft-hotbar-search", score: searchedHotbar.score },
  ];
  const anchors = [...fixedAnchors, ...searchAnchors];
  const detected = anchors.filter(({ score }) => score >= 0.65);
  const detectedAnchors = detected.map(({ id }) => id);
  const missingAnchors = anchors.filter(({ score }) => score < 0.65).map(({ id }) => id);
  const averageConfidence =
    detected.length === 0 ? 0 : detected.reduce((total, anchor) => total + anchor.score, 0) / detected.length;
  const anchorCoverage = detected.length / Math.max(1, anchors.length);
  const confidence = clampUnit(averageConfidence * anchorCoverage);
  const searchConfidence = clampUnit((searchedHealth.score + searchedHunger.score + searchedHotbar.score) / 3);
  const searchedFeatures = [
    searchedHealth.features,
    searchedHunger.features,
    searchedArmor.features,
    searchedHotbar.features,
  ];
  const totalEdgeDensity = [...features, ...searchedFeatures].reduce((total, feature) => total + feature.edgeDensity, 0);
  const facts = minecraftHudFacts({
    frame,
    health: searchedHealth.features,
    hunger: searchedHunger.features,
    armor: searchedArmor.features,
    hotbar: searchedHotbar.features,
    hotbarRegion: fixedHotbarScore >= 0.4 && configuredHotbarRegion !== undefined
      ? configuredHotbarRegion
      : searchedHotbar.region,
    healthScore: searchedHealth.score,
    hungerScore: searchedHunger.score,
    armorScore: searchedArmor.score,
    hotbarScore: searchedHotbar.score,
  });

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
        "Minecraft-like health, hunger, and hotbar facts are available only when their pixel bands are confident.",
      ],
      features: [...features, ...searchedFeatures],
      facts,
    };
  }
  if (searchConfidence >= 0.65) {
    return {
      status: "minecraft-like",
      confidence: searchConfidence,
      detectedAnchors,
      missingAnchors,
      supportedSignals: [...profile.universalSignals, "minecraft-hud-layout"],
      reasons: [
        "Minecraft-like HUD icon bands were found through lower-screen pixel search.",
        "The layout may be shifted or modded; only confident detected facts should be used.",
      ],
      features: [...features, ...searchedFeatures],
      facts,
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
      features: [...features, ...searchedFeatures],
      facts: UNKNOWN_HUD_FACTS,
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
    features: [...features, ...searchedFeatures],
    facts: UNKNOWN_HUD_FACTS,
  };
}
