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
  readonly yellowPixelRatio: number;
  readonly neutralPixelRatio: number;
  readonly silverPixelRatio: number;
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
  /** Time this value was last supported by pixels, not merely carried forward. */
  readonly observedAt?: number;
  readonly expiresAt?: number;
}

export type MinecraftHudTrackingStatus =
  | "acquiring"
  | "confirmed"
  | "reconfirming"
  | "stale"
  | "unknown";

export interface MinecraftHudFacts {
  readonly healthHearts: MinecraftHudFact<number>;
  readonly hungerShanks: MinecraftHudFact<number>;
  readonly airBubbles: MinecraftHudFact<number>;
  readonly submerged: MinecraftHudFact<boolean>;
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
  readonly trackingStatus?: MinecraftHudTrackingStatus;
  readonly lastConfirmedAt?: number | null;
  readonly locatedRegions?: {
    readonly health: NormalizedVisualRegion;
    readonly hunger: NormalizedVisualRegion;
    readonly armor: NormalizedVisualRegion;
    readonly air: NormalizedVisualRegion;
    readonly hotbar: NormalizedVisualRegion;
  };
  readonly anchorScores?: {
    readonly health: number;
    readonly hunger: number;
    readonly armor: number;
    readonly air: number;
    readonly hotbar: number;
    readonly layout: number;
  };
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
  airBubbles: {
    status: "unknown",
    value: null,
    confidence: 0,
    reason: "No reliable Minecraft air-bubble band was detected.",
    sourceRegionIds: [],
  },
  submerged: {
    status: "unknown",
    value: null,
    confidence: 0,
    reason: "Submersion is not confirmed without a reliable air-bubble band.",
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
  let yellowPixels = 0;
  let neutralPixels = 0;
  let silverPixels = 0;
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
        pixel.red >= 110 &&
        pixel.green >= 90 &&
        pixel.blue <= pixel.red * 0.78 &&
        pixel.blue <= pixel.green * 0.82 &&
        pixel.red <= pixel.green * 1.45
      ) {
        yellowPixels += 1;
      }
      if (
        pixel.alpha >= 96 &&
        Math.max(pixel.red, pixel.green, pixel.blue) - Math.min(pixel.red, pixel.green, pixel.blue) <= 18 &&
        value >= 0.12 &&
        value <= 0.82
      ) {
        neutralPixels += 1;
      }
      if (
        pixel.alpha >= 96 &&
        Math.max(pixel.red, pixel.green, pixel.blue) - Math.min(pixel.red, pixel.green, pixel.blue) <= 24 &&
        value >= 0.36 &&
        value <= 0.92
      ) {
        silverPixels += 1;
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
    yellowPixelRatio: pixelCount === 0 ? 0 : yellowPixels / pixelCount,
    neutralPixelRatio: pixelCount === 0 ? 0 : neutralPixels / pixelCount,
    silverPixelRatio: pixelCount === 0 ? 0 : silverPixels / pixelCount,
    warmPixelRatio: pixelCount === 0 ? 0 : warmPixels / pixelCount,
    bluePixelRatio: pixelCount === 0 ? 0 : bluePixels / pixelCount,
    darkPixelRatio: pixelCount === 0 ? 0 : darkPixels / pixelCount,
    brightPixelRatio: pixelCount === 0 ? 0 : brightPixels / pixelCount,
  };
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

interface FastFeatureIntegral {
  readonly stride: number;
  readonly red: Uint32Array;
  readonly green: Uint32Array;
  readonly silver: Uint32Array;
  readonly warm: Uint32Array;
  readonly blue: Uint32Array;
  readonly dark: Uint32Array;
  readonly bright: Uint32Array;
  readonly edge: Uint32Array;
}

interface FastRegionFeatures {
  readonly pixelCount: number;
  readonly redPixelRatio: number;
  readonly greenPixelRatio: number;
  readonly silverPixelRatio: number;
  readonly warmPixelRatio: number;
  readonly bluePixelRatio: number;
  readonly darkPixelRatio: number;
  readonly brightPixelRatio: number;
  readonly edgeDensity: number;
}

type HealthColourRatio = "redPixelRatio" | "greenPixelRatio" | "bluePixelRatio" | "warmPixelRatio";

function healthColourFamily(features: Pick<FastRegionFeatures, HealthColourRatio>): HealthColourRatio {
  // Ordinary hearts remain red even when the surrounding scene is strongly
  // green (XP/grass) or blue (underwater). Prefer that direct heart evidence
  // before considering supported status-effect palettes.
  if (features.redPixelRatio >= 0.008) return "redPixelRatio";
  const alternatives: readonly Exclude<HealthColourRatio, "redPixelRatio">[] = [
    "greenPixelRatio",
    "bluePixelRatio",
    "warmPixelRatio",
  ];
  return alternatives.reduce((best, candidate) =>
    features[candidate] > features[best] ? candidate : best,
  );
}

interface MinecraftHudLayoutSearchResult {
  readonly score: number;
  readonly healthScore: number;
  readonly hungerScore: number;
  readonly armorScore: number;
  readonly airScore: number;
  readonly hotbarScore: number;
  readonly healthRegion: NormalizedVisualRegion;
  readonly hungerRegion: NormalizedVisualRegion;
  readonly armorRegion: NormalizedVisualRegion;
  readonly airRegion: NormalizedVisualRegion;
  readonly hotbarRegion: NormalizedVisualRegion;
}

function buildFastFeatureIntegral(frame: SampledPixelFrame): FastFeatureIntegral {
  const stride = frame.width + 1;
  const length = stride * (frame.height + 1);
  const red = new Uint32Array(length);
  const green = new Uint32Array(length);
  const silver = new Uint32Array(length);
  const warm = new Uint32Array(length);
  const blue = new Uint32Array(length);
  const dark = new Uint32Array(length);
  const bright = new Uint32Array(length);
  const edge = new Uint32Array(length);

  for (let y = 0; y < frame.height; y += 1) {
    let rowRed = 0;
    let rowGreen = 0;
    let rowSilver = 0;
    let rowWarm = 0;
    let rowBlue = 0;
    let rowDark = 0;
    let rowBright = 0;
    let rowEdge = 0;
    for (let x = 0; x < frame.width; x += 1) {
      const pixel = rgbaAt(frame, x, y);
      const luma = normalizedLuma(pixel.red, pixel.green, pixel.blue, pixel.alpha);
      const opaque = pixel.alpha >= 96;
      rowRed += Number(
        opaque &&
        pixel.red >= 80 &&
        pixel.green <= pixel.red * 0.5 &&
        pixel.blue <= pixel.red * 0.5,
      );
      rowGreen += Number(
        opaque &&
        pixel.green >= 75 &&
        pixel.green >= pixel.red * 1.12 &&
        pixel.green >= pixel.blue * 1.12,
      );
      rowSilver += Number(
        opaque &&
        Math.max(pixel.red, pixel.green, pixel.blue) - Math.min(pixel.red, pixel.green, pixel.blue) <= 24 &&
        luma >= 0.36 &&
        luma <= 0.92,
      );
      rowWarm += Number(
        opaque &&
        pixel.red >= 75 &&
        pixel.green >= 35 &&
        pixel.red >= pixel.green * 1.2 &&
        pixel.green >= pixel.blue * 1.15,
      );
      rowBlue += Number(
        opaque &&
        pixel.blue >= 70 &&
        pixel.blue >= pixel.red * 1.2 &&
        pixel.blue >= pixel.green * 1.08,
      );
      rowDark += Number(luma <= 0.2);
      rowBright += Number(luma >= 0.72);
      let isEdge = false;
      if (x > 0) {
        const left = rgbaAt(frame, x - 1, y);
        isEdge ||= Math.abs(luma - normalizedLuma(left.red, left.green, left.blue, left.alpha)) >= EDGE_DELTA;
      }
      if (y > 0) {
        const above = rgbaAt(frame, x, y - 1);
        isEdge ||= Math.abs(luma - normalizedLuma(above.red, above.green, above.blue, above.alpha)) >= EDGE_DELTA;
      }
      rowEdge += Number(isEdge);

      const index = (y + 1) * stride + x + 1;
      const aboveIndex = index - stride;
      red[index] = red[aboveIndex] + rowRed;
      green[index] = green[aboveIndex] + rowGreen;
      silver[index] = silver[aboveIndex] + rowSilver;
      warm[index] = warm[aboveIndex] + rowWarm;
      blue[index] = blue[aboveIndex] + rowBlue;
      dark[index] = dark[aboveIndex] + rowDark;
      bright[index] = bright[aboveIndex] + rowBright;
      edge[index] = edge[aboveIndex] + rowEdge;
    }
  }
  return { stride, red, green, silver, warm, blue, dark, bright, edge };
}

function integralCount(
  integral: Uint32Array,
  stride: number,
  bounds: ReturnType<typeof pixelBounds>,
): number {
  const topLeft = bounds.top * stride + bounds.left;
  const topRight = bounds.top * stride + bounds.right;
  const bottomLeft = bounds.bottom * stride + bounds.left;
  const bottomRight = bounds.bottom * stride + bounds.right;
  return integral[bottomRight] - integral[topRight] - integral[bottomLeft] + integral[topLeft];
}

function fastRegionFeatures(
  frame: SampledPixelFrame,
  integral: FastFeatureIntegral,
  region: NormalizedVisualRegion,
): FastRegionFeatures {
  const bounds = pixelBounds(frame, region);
  const pixelCount = Math.max(1, (bounds.right - bounds.left) * (bounds.bottom - bounds.top));
  const ratio = (values: Uint32Array) => integralCount(values, integral.stride, bounds) / pixelCount;
  return {
    pixelCount,
    redPixelRatio: ratio(integral.red),
    greenPixelRatio: ratio(integral.green),
    silverPixelRatio: ratio(integral.silver),
    warmPixelRatio: ratio(integral.warm),
    bluePixelRatio: ratio(integral.blue),
    darkPixelRatio: ratio(integral.dark),
    brightPixelRatio: ratio(integral.bright),
    edgeDensity: ratio(integral.edge),
  };
}

function ramp(value: number, minimum: number, full: number): number {
  if (value <= minimum) return 0;
  if (value >= full) return 1;
  return (value - minimum) / (full - minimum);
}

function independentlySupportedVitalFacts(facts: MinecraftHudFacts): MinecraftHudFacts {
  const pairKnown =
    facts.healthHearts.status === "known" &&
    facts.healthHearts.value !== null &&
    facts.hungerShanks.status === "known" &&
    facts.hungerShanks.value !== null;
  if (!pairKnown) return UNKNOWN_HUD_FACTS;
  return {
    ...UNKNOWN_HUD_FACTS,
    healthHearts: facts.healthHearts,
    hungerShanks: facts.hungerShanks,
  };
}

function fastSlotRegion(
  regionId: string,
  band: NormalizedVisualRegion,
  slotIndex: number,
  slotCount: number,
): NormalizedVisualRegion {
  const width = band.width / slotCount;
  return dynamicRegion(regionId, band.x + width * slotIndex, band.y, width, band.height);
}

function slotStructureScore(input: {
  readonly frame: SampledPixelFrame;
  readonly integral: FastFeatureIntegral;
  readonly region: NormalizedVisualRegion;
  readonly slotCount: number;
}): number {
  let structured = 0;
  for (let slotIndex = 0; slotIndex < input.slotCount; slotIndex += 1) {
    const slot = fastRegionFeatures(
      input.frame,
      input.integral,
      fastSlotRegion(`minecraft-fast-slot-${slotIndex}`, input.region, slotIndex, input.slotCount),
    );
    if (slot.edgeDensity >= 0.045 && slot.darkPixelRatio + slot.brightPixelRatio >= 0.18) {
      structured += 1;
    }
  }
  return structured / input.slotCount;
}

function iconBandScore(input: {
  readonly frame: SampledPixelFrame;
  readonly integral: FastFeatureIntegral;
  readonly region: NormalizedVisualRegion;
  readonly colour: "health" | "hunger";
}): number {
  const features = fastRegionFeatures(input.frame, input.integral, input.region);
  const healthFamily = healthColourFamily(features);
  const targetRatio = (value: FastRegionFeatures) =>
    input.colour === "health"
      ? value[healthFamily]
      : clampUnit(value.redPixelRatio + value.warmPixelRatio);
  const target = targetRatio(features);
  const structure = slotStructureScore({
    frame: input.frame,
    integral: input.integral,
    region: input.region,
    slotCount: 10,
  });
  const slotTargets: number[] = [];
  for (let slotIndex = 0; slotIndex < 10; slotIndex += 1) {
    const slot = fastRegionFeatures(
      input.frame,
      input.integral,
      fastSlotRegion(`minecraft-colour-slot-${slotIndex}`, input.region, slotIndex, 10),
    );
    const slotTarget = targetRatio(slot);
    slotTargets.push(slotTarget);
  }
  // Judge a filled sprite against the other nine sprites in the same HUD row,
  // not against one fixed pixel ratio. GUI scale, browser downsampling and
  // translucent scene pixels all change the absolute ratio. The robust row
  // reference keeps a dark/empty outline empty while retaining smaller filled
  // sprites at another resolution.
  const strongestSlots = [...slotTargets].sort((left, right) => right - left).slice(0, 5);
  const robustTarget = strongestSlots[Math.floor(strongestSlots.length / 2)] ?? target;
  const occupiedThreshold = Math.max(0.012, robustTarget * 0.24);
  const occupiedSlots = slotTargets.map((value) => value >= occupiedThreshold);
  const colouredSlots = occupiedSlots.filter(Boolean).length;
  const colourCoverage = colouredSlots / 10;
  const directionalConsistency = Math.max(
    ...Array.from({ length: 11 }, (_, filledCount) => {
      const matches = occupiedSlots.filter((occupied, slotIndex) => {
        const expected = input.colour === "health"
          ? slotIndex < filledCount
          : slotIndex >= 10 - filledCount;
        return occupied === expected;
      }).length;
      return matches / 10;
    }),
  );
  // Health empties from right to left; hunger empties from left to right.
  // A candidate that leaves an empty margin on the filled edge is normally a
  // too-wide or shifted search band, not a different HUD scale.
  const filledEdgeAligned = colouredSlots === 0
    ? 0.5
    : input.colour === "health"
      ? Number(occupiedSlots[0])
      : Number(occupiedSlots[9]);
  const outsideWidth = Math.max(input.region.width / 10, 2 / input.frame.width);
  const outsideTargetRatio = (region: NormalizedVisualRegion): number => {
    const outside = fastRegionFeatures(input.frame, input.integral, region);
    return targetRatio(outside);
  };
  const leftOutsideTarget = outsideTargetRatio(dynamicRegion(
    "minecraft-icon-left-exterior",
    input.region.x - outsideWidth,
    input.region.y,
    outsideWidth,
    input.region.height,
  ));
  const rightOutsideTarget = outsideTargetRatio(dynamicRegion(
    "minecraft-icon-right-exterior",
    input.region.x + input.region.width,
    input.region.y,
    outsideWidth,
    input.region.height,
  ));
  const containment = 1 - ramp(Math.max(leftOutsideTarget, rightOutsideTarget), 0.008, 0.12);
  const patternScore =
    ramp(target, 0.008, 0.035) * 0.2 +
    ramp(features.edgeDensity, 0.035, 0.2) * 0.2 +
    structure * 0.25 +
    colourCoverage * 0.1 +
    directionalConsistency * 0.15 +
    filledEdgeAligned * 0.1;
  // The HUD sprites are transparent, so grass and water remain visible inside
  // the same crop. Score the expected fill directly and use repeated slots,
  // direction and exterior containment to reject scenery; comparing red to
  // every background colour incorrectly rejects valid bright/underwater HUDs.
  const targetStrengthScore = input.colour === "health"
    ? ramp(target, 0.008, 0.06)
    : ramp(target, 0.012, 0.08);
  const filledEdgeFactor = 0.45 + filledEdgeAligned * 0.55;
  return clampUnit(
    patternScore *
    targetStrengthScore *
    (0.55 + containment * 0.45) *
    filledEdgeFactor,
  );
}

function iconBandFilledCoverage(input: {
  readonly frame: SampledPixelFrame;
  readonly integral: FastFeatureIntegral;
  readonly region: NormalizedVisualRegion;
  readonly colour: "health" | "hunger";
}): number {
  const band = fastRegionFeatures(input.frame, input.integral, input.region);
  const healthFamily = healthColourFamily(band);
  const ratios = Array.from({ length: 10 }, (_, slotIndex) => {
    const slot = fastRegionFeatures(
      input.frame,
      input.integral,
      fastSlotRegion(`minecraft-fill-coverage-slot-${slotIndex}`, input.region, slotIndex, 10),
    );
    return input.colour === "health"
      ? slot[healthFamily]
      : clampUnit(slot.redPixelRatio + slot.warmPixelRatio);
  });
  const strongest = [...ratios].sort((left, right) => right - left).slice(0, 5);
  const reference = strongest[Math.floor(strongest.length / 2)] ?? 0;
  if (reference < 0.012) return 0;
  const threshold = Math.max(0.012, reference * 0.24);
  return ratios.filter((ratio) => ratio >= threshold).length / 10;
}

function hotbarBandScore(input: {
  readonly frame: SampledPixelFrame;
  readonly integral: FastFeatureIntegral;
  readonly region: NormalizedVisualRegion;
}): number {
  const features = fastRegionFeatures(input.frame, input.integral, input.region);
  const structure = slotStructureScore({
    frame: input.frame,
    integral: input.integral,
    region: input.region,
    slotCount: 9,
  });
  const slotWidth = input.region.width / 9;
  const stripWidth = Math.min(slotWidth * 0.18, Math.max(1 / input.frame.width, 0.002));
  const stripY = input.region.y + input.region.height * 0.18;
  const stripHeight = input.region.height * 0.64;
  const boundarySignals: number[] = [];
  const interiorSignals: number[] = [];
  for (let boundary = 0; boundary <= 9; boundary += 1) {
    const centerX = input.region.x + slotWidth * boundary;
    const x = Math.max(
      input.region.x,
      Math.min(input.region.x + input.region.width - stripWidth, centerX - stripWidth / 2),
    );
    const boundaryFeatures = fastRegionFeatures(
      input.frame,
      input.integral,
      dynamicRegion("minecraft-hotbar-boundary", x, stripY, stripWidth, stripHeight),
    );
    boundarySignals.push(boundaryFeatures.edgeDensity * 0.8 + boundaryFeatures.brightPixelRatio * 0.2);
  }
  for (let slot = 0; slot < 9; slot += 1) {
    const centerX = input.region.x + slotWidth * (slot + 0.5);
    const interiorFeatures = fastRegionFeatures(
      input.frame,
      input.integral,
      dynamicRegion(
        "minecraft-hotbar-interior",
        centerX - stripWidth / 2,
        stripY,
        stripWidth,
        stripHeight,
      ),
    );
    interiorSignals.push(interiorFeatures.edgeDensity * 0.8 + interiorFeatures.brightPixelRatio * 0.2);
  }
  const boundaryAverage = boundarySignals.reduce((total, value) => total + value, 0) / boundarySignals.length;
  const interiorAverage = interiorSignals.reduce((total, value) => total + value, 0) / interiorSignals.length;
  const boundaryCoverage = boundarySignals.filter((value) => value >= interiorAverage + 0.02).length / boundarySignals.length;
  const boundaryScore = clampUnit(
    ramp(boundaryAverage - interiorAverage, 0.015, 0.18) * 0.7 + boundaryCoverage * 0.3,
  );
  const contrast = Math.min(
    ramp(features.darkPixelRatio, 0.1, 0.55),
    ramp(features.brightPixelRatio, 0.015, 0.18),
  );
  const visualScore =
    ramp(features.edgeDensity, 0.045, 0.22) * 0.4 +
    structure * 0.4 +
    contrast * 0.1 +
    boundaryScore * 0.1;
  const outsideWidth = Math.max(slotWidth, 2 / input.frame.width);
  const exteriorScore = (x: number) => {
    const exterior = fastRegionFeatures(
      input.frame,
      input.integral,
      dynamicRegion(
        "minecraft-hotbar-exterior",
        x,
        input.region.y,
        outsideWidth,
        input.region.height,
      ),
    );
    const exteriorContrast = Math.min(
      ramp(exterior.darkPixelRatio, 0.1, 0.55),
      ramp(exterior.brightPixelRatio, 0.015, 0.18),
    );
    return ramp(exterior.edgeDensity, 0.045, 0.22) * 0.7 + exteriorContrast * 0.3;
  };
  const exteriorContinuation = Math.max(
    exteriorScore(input.region.x - outsideWidth),
    exteriorScore(input.region.x + input.region.width),
  );
  const containment = 1 - ramp(exteriorContinuation, 0.35, 0.78);
  // Minecraft's GUI border is often mid-grey rather than near-white, so a
  // valid nine-slot bar can have little `brightPixelRatio`. Repeated slot
  // structure and edge density are the primary evidence; periodic boundary
  // contrast is supporting evidence instead of a hard gate.
  return clampUnit((visualScore * 0.85 + boundaryScore * 0.15) * (0.65 + containment * 0.35));
}

function airBandScore(input: {
  readonly frame: SampledPixelFrame;
  readonly integral: FastFeatureIntegral;
  readonly region: NormalizedVisualRegion;
}): number {
  const features = fastRegionFeatures(input.frame, input.integral, input.region);
  const structure = slotStructureScore({
    frame: input.frame,
    integral: input.integral,
    region: input.region,
    slotCount: 10,
  });
  let visibleSlots = 0;
  for (let slotIndex = 0; slotIndex < 10; slotIndex += 1) {
    const slot = fastRegionFeatures(
      input.frame,
      input.integral,
      fastSlotRegion(`minecraft-air-slot-${slotIndex}`, input.region, slotIndex, 10),
    );
    if (slot.bluePixelRatio >= 0.01 || slot.brightPixelRatio >= 0.08) visibleSlots += 1;
  }
  const visual = Math.max(features.bluePixelRatio, features.brightPixelRatio * 0.35);
  return clampUnit(
    ramp(visual, 0.008, 0.055) * 0.3 +
    ramp(features.edgeDensity, 0.035, 0.2) * 0.2 +
    structure * 0.3 +
    (visibleSlots / 10) * 0.2,
  );
}

function armorBandScore(input: {
  readonly frame: SampledPixelFrame;
  readonly integral: FastFeatureIntegral;
  readonly region: NormalizedVisualRegion;
}): number {
  const features = fastRegionFeatures(input.frame, input.integral, input.region);
  const structure = slotStructureScore({
    frame: input.frame,
    integral: input.integral,
    region: input.region,
    slotCount: 10,
  });
  const slotSilver = Array.from({ length: 10 }, (_, slotIndex) =>
    fastRegionFeatures(
      input.frame,
      input.integral,
      fastSlotRegion(`minecraft-armor-slot-${slotIndex}`, input.region, slotIndex, 10),
    ).silverPixelRatio,
  );
  const reference = Math.max(...slotSilver);
  const visibleThreshold = Math.max(0.012, reference * 0.3);
  const visibleSlots = reference < 0.018
    ? 0
    : slotSilver.filter((ratio) => ratio >= visibleThreshold).length;
  const leftAligned = visibleSlots === 0 ? 0 : Number(slotSilver[0] >= visibleThreshold);
  return clampUnit(
    ramp(features.silverPixelRatio, 0.012, 0.13) * 0.42 +
    ramp(features.edgeDensity, 0.035, 0.18) * 0.18 +
    structure * 0.2 +
    (visibleSlots / 10) * 0.12 +
    leftAligned * 0.08,
  );
}

function searchMinecraftHudLayout(
  frame: SampledPixelFrame,
  integral: FastFeatureIntegral,
  previous?: MinecraftHudFingerprint["locatedRegions"],
): MinecraftHudLayoutSearchResult {
  const aspectRatio = frame.width / frame.height;
  const healthWidths = [0.055, 0.075, 0.095, 0.12, 0.135, 0.15, 0.16, 0.165, 0.185, 0.205, 0.225];
  const centers = [0.25, 0.33, 0.42, 0.5, 0.58, 0.67, 0.75];
  const bottoms = [0.64, 0.72, 0.78, 0.83, 0.87, 0.91, 0.95, 0.98, 0.995];
  const geometryModels = [
    {
      healthAspectDivisor: 7.8,
      hotbarWidthMultiplier: 2.25,
      hotbarAspectDivisor: 8.5,
      vitalsOffsetMultiplier: 1.18,
      upperRowOffsetMultiplier: 1.05,
    },
    // Minecraft GUI scale and capture resampling do not preserve one exact
    // synthetic ratio. This model covers the narrower 10:1 heart strip and
    // roughly 2:1 hotbar-to-health geometry seen after common 16:9 sampling.
    {
      healthAspectDivisor: 10,
      hotbarWidthMultiplier: 2.05,
      hotbarAspectDivisor: 8.25,
      vitalsOffsetMultiplier: 1.18,
      upperRowOffsetMultiplier: 1.05,
    },
    // Windowed/full-display captures can leave title/menu/dock chrome around
    // an otherwise default HUD. This model covers the taller source-scale
    // hotbar and larger vitals-to-hotbar gap without assuming one OS.
    {
      healthAspectDivisor: 7.4,
      hotbarWidthMultiplier: 2.25,
      hotbarAspectDivisor: 7.1,
      vitalsOffsetMultiplier: 1.65,
      upperRowOffsetMultiplier: 0.9,
    },
  ] as const;
  let best: MinecraftHudLayoutSearchResult | null = null;

  for (const geometry of geometryModels) {
    for (const healthWidth of healthWidths) {
    const healthHeight = Math.max(
      0.008,
      Math.min(0.085, healthWidth * aspectRatio / geometry.healthAspectDivisor),
    );
    const hotbarWidth = healthWidth * geometry.hotbarWidthMultiplier;
    const hotbarHeight = Math.max(
      0.02,
      Math.min(0.13, hotbarWidth * aspectRatio / geometry.hotbarAspectDivisor),
    );
    for (const center of centers) {
      const hotbarX = center - hotbarWidth / 2;
      if (hotbarX < 0 || hotbarX + hotbarWidth > 1) continue;
      for (const bottom of bottoms) {
        const hotbarY = bottom - hotbarHeight;
        const vitalsY = hotbarY - healthHeight * geometry.vitalsOffsetMultiplier;
        const armorY = vitalsY - healthHeight * geometry.upperRowOffsetMultiplier;
        if (armorY < 0 || bottom > 1) continue;
        const healthRegion = dynamicRegion(
          "minecraft-health-search",
          hotbarX,
          vitalsY,
          healthWidth,
          healthHeight,
        );
        const hungerRegion = dynamicRegion(
          "minecraft-hunger-search",
          hotbarX + hotbarWidth - healthWidth,
          vitalsY,
          healthWidth,
          healthHeight,
        );
        const armorRegion = dynamicRegion(
          "minecraft-armor-search",
          hotbarX,
          armorY,
          healthWidth,
          healthHeight,
        );
        const airRegion = dynamicRegion(
          "minecraft-air-search",
          hotbarX + hotbarWidth - healthWidth,
          armorY,
          healthWidth,
          healthHeight,
        );
        const hotbarRegion = dynamicRegion(
          "minecraft-hotbar-search",
          hotbarX,
          hotbarY,
          hotbarWidth,
          hotbarHeight,
        );
        const healthScore = iconBandScore({ frame, integral, region: healthRegion, colour: "health" });
        const hungerScore = iconBandScore({ frame, integral, region: hungerRegion, colour: "hunger" });
        const maximumVitalFillCoverage = Math.max(
          iconBandFilledCoverage({ frame, integral, region: healthRegion, colour: "health" }),
          iconBandFilledCoverage({ frame, integral, region: hungerRegion, colour: "hunger" }),
        );
        const hotbarScore = hotbarBandScore({ frame, integral, region: hotbarRegion });
        const armorScore = armorBandScore({ frame, integral, region: armorRegion });
        const airScore = airBandScore({ frame, integral, region: airRegion });
        const weakestRequiredAnchor = Math.min(healthScore, hungerScore, hotbarScore);
        const slotResolution = Math.min(
          ramp((healthWidth * frame.width) / 10, 2, 4.5),
          ramp(healthHeight * frame.height, 2, 5),
          ramp((hotbarWidth * frame.width) / 9, 3, 7),
        );
        const geometryPrior = clampUnit(
          1 - Math.abs(center - 0.5) * 1.5 - Math.max(0, 0.96 - bottom) * 0.25,
        );
        // Repeated half-bands can imitate ten tiny slots (for example five
        // hearts interpreted as ten). Prefer a complete default-scale lower
        // HUD when its visual evidence is otherwise comparable, while still
        // allowing genuinely small GUI scales to win on evidence.
        const completeBandPrior = ramp(healthWidth, 0.075, 0.15);
        const fullLayoutEvidence = clampUnit(
          (healthScore * 0.4 + hungerScore * 0.4 + hotbarScore * 0.2) *
          ramp(weakestRequiredAnchor, 0.28, 0.58) *
          slotResolution *
          (0.55 + ramp(maximumVitalFillCoverage, 0.1, 0.6) * 0.45),
        );
        // Health and hunger are a mirrored ten-slot pair and remain useful
        // even when a window crop, transparent hotbar, or selected item makes
        // the nine-slot hotbar anchor weak. Keep that paired colour/structure
        // evidence in candidate selection; the full-layout status below still
        // requires the hotbar independently.
        const weakestVitalAnchor = Math.min(healthScore, hungerScore);
        const vitalPairEvidence = clampUnit(
          (healthScore * 0.5 + hungerScore * 0.5) *
          ramp(weakestVitalAnchor, 0.32, 0.58) *
          slotResolution *
          ramp(maximumVitalFillCoverage, 0.1, 0.6),
        );
        const evidenceScore = Math.max(fullLayoutEvidence, vitalPairEvidence * 0.94);
        const previousPrior = previous === undefined
          ? 0
          : clampUnit(
              1 -
              Math.abs(previous.hotbar.x - hotbarRegion.x) * 3 -
              Math.abs(previous.hotbar.y - hotbarRegion.y) * 3 -
              Math.abs(previous.hotbar.width - hotbarRegion.width) * 2,
            );
        const score = previous === undefined
          ? clampUnit(evidenceScore * 0.91 + geometryPrior * 0.02 + completeBandPrior * 0.07)
          : clampUnit(
              evidenceScore * 0.86 +
              geometryPrior * 0.02 +
              completeBandPrior * 0.04 +
              previousPrior * 0.08,
            );
        if (best === null || score > best.score) {
          best = {
            score,
            healthScore,
            hungerScore,
            armorScore,
            airScore,
            hotbarScore,
            healthRegion,
            hungerRegion,
            armorRegion,
            airRegion,
            hotbarRegion,
          };
        }
      }
    }
  }
  }
  if (best === null) throw new Error("Minecraft HUD layout search produced no candidates");
  return refineMinecraftHudLayout(frame, integral, best);
}

type HudPixelFamily = "health" | "hunger" | "armor";

interface HorizontalColourRun {
  readonly start: number;
  readonly end: number;
}

function hudPixelMatches(
  family: HudPixelFamily,
  pixel: ReturnType<typeof rgbaAt>,
): boolean {
  if (pixel.alpha < 96) return false;
  if (family === "health") {
    return pixel.red >= 80 && pixel.green <= pixel.red * 0.5 && pixel.blue <= pixel.red * 0.5;
  }
  if (family === "hunger") {
    return pixel.red >= 75 &&
      pixel.green >= 35 &&
      pixel.red >= pixel.green * 1.2 &&
      pixel.green >= pixel.blue * 1.15;
  }
  const luma = normalizedLuma(pixel.red, pixel.green, pixel.blue, pixel.alpha);
  return Math.max(pixel.red, pixel.green, pixel.blue) - Math.min(pixel.red, pixel.green, pixel.blue) <= 32 &&
    luma >= 0.3 &&
    luma <= 0.96;
}

function colourColumnRuns(
  frame: SampledPixelFrame,
  region: NormalizedVisualRegion,
  family: HudPixelFamily,
): readonly HorizontalColourRun[] {
  const bounds = pixelBounds(frame, region);
  const minimumPixels = Math.max(1, Math.floor((bounds.bottom - bounds.top) * 0.12));
  const runs: HorizontalColourRun[] = [];
  let start: number | null = null;
  for (let x = bounds.left; x < bounds.right; x += 1) {
    let matching = 0;
    for (let y = bounds.top; y < bounds.bottom; y += 1) {
      matching += Number(hudPixelMatches(family, rgbaAt(frame, x, y)));
    }
    if (matching >= minimumPixels) {
      start ??= x;
    } else if (start !== null) {
      runs.push({ start, end: x - 1 });
      start = null;
    }
  }
  if (start !== null) runs.push({ start, end: bounds.right - 1 });
  return runs;
}

function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
    : sorted[middle] ?? null;
}

function inferIconPitch(
  runs: readonly HorizontalColourRun[],
  candidatePitch: number,
): number | null {
  const centers = runs.map(({ start, end }) => (start + end) / 2);
  const plausibleSteps = centers.slice(1).map((center, index) => center - (centers[index] ?? center))
    .filter((step) => step >= candidatePitch * 0.65 && step <= candidatePitch * 1.45);
  if (plausibleSteps.length < 2) return null;
  const pitch = median(plausibleSteps);
  if (pitch === null) return null;
  const matchingSteps = plausibleSteps.filter((step) => Math.abs(step - pitch) <= pitch * 0.22);
  return matchingSteps.length >= 2 ? pitch : null;
}

function bestVerticalOffset(input: {
  readonly frame: SampledPixelFrame;
  readonly regions: readonly NormalizedVisualRegion[];
  readonly families: readonly HudPixelFamily[];
}): number {
  const reference = input.regions[0];
  if (reference === undefined) return 0;
  const heightPixels = Math.max(2, Math.round(reference.height * input.frame.height));
  const maximumShift = Math.max(1, Math.round(heightPixels * 0.8));
  let bestShift = 0;
  let bestCount = -1;
  for (let shift = -maximumShift; shift <= maximumShift; shift += 1) {
    let count = 0;
    input.regions.forEach((candidate, index) => {
      const shifted = dynamicRegion(
        `${candidate.regionId}-vertical-probe`,
        candidate.x,
        Math.max(0, Math.min(1 - candidate.height, candidate.y + shift / input.frame.height)),
        candidate.width,
        candidate.height,
      );
      const bounds = pixelBounds(input.frame, shifted);
      for (let y = bounds.top; y < bounds.bottom; y += 1) {
        for (let x = bounds.left; x < bounds.right; x += 1) {
          count += Number(hudPixelMatches(input.families[index] ?? input.families[0] ?? "health", rgbaAt(input.frame, x, y)));
        }
      }
    });
    if (count > bestCount || (count === bestCount && Math.abs(shift) < Math.abs(bestShift))) {
      bestCount = count;
      bestShift = shift;
    }
  }
  return bestShift / input.frame.height;
}

/**
 * The coarse layout search intentionally spans many GUI scales. Once a
 * repeated hunger cadence is visible, use its right-aligned vanilla geometry
 * to remove the one-slot horizontal drift that otherwise turns 9 hunger into
 * 8 and a half armor icon into a single point.
 */
function refineMinecraftHudLayout(
  frame: SampledPixelFrame,
  integral: FastFeatureIntegral,
  layout: MinecraftHudLayoutSearchResult,
): MinecraftHudLayoutSearchResult {
  if (layout.hungerScore < 0.48) return layout;
  // Do not perturb an already strong paired lock. The refinement exists for
  // real resampled feeds where one coloured row is strong but the mirrored
  // row is clipped by a fraction of an icon.
  if (layout.healthScore >= 0.82 && layout.hungerScore >= 0.82) return layout;
  const candidatePitch = layout.hungerRegion.width * frame.width / 10;
  if (candidatePitch < 2) return layout;
  const horizontalPadding = candidatePitch * 1.5 / frame.width;
  const verticalPadding = layout.hungerRegion.height * 0.65;
  const hungerProbe = dynamicRegion(
    "minecraft-hunger-cadence-probe",
    Math.max(0, layout.hungerRegion.x - horizontalPadding),
    Math.max(0, layout.hungerRegion.y - verticalPadding),
    Math.min(
      1 - Math.max(0, layout.hungerRegion.x - horizontalPadding),
      layout.hungerRegion.width + horizontalPadding * 2,
    ),
    Math.min(
      1 - Math.max(0, layout.hungerRegion.y - verticalPadding),
      layout.hungerRegion.height + verticalPadding * 2,
    ),
  );
  const runs = colourColumnRuns(frame, hungerProbe, "hunger");
  const pitch = inferIconPitch(runs, candidatePitch);
  if (pitch === null) return layout;
  const lastRun = runs.at(-1);
  if (lastRun === undefined) return layout;
  const candidateRight = (layout.hungerRegion.x + layout.hungerRegion.width) * frame.width;
  const typicalFillWidth = median(
    runs.map(({ start, end }) => end - start + 1).filter((width) => width >= pitch * 0.25),
  ) ?? pitch * 0.5;
  const outlinePadding = Math.max(
    pitch * 0.15,
    Math.min(pitch * 0.5, (pitch - typicalFillWidth) / 2 + 0.75),
  );
  const inferredRight = lastRun.end + 1 + outlinePadding;
  if (Math.abs(inferredRight - candidateRight) > pitch * 1.75) return layout;

  const rowWidth = pitch * 10 / frame.width;
  const hotbarMultiplier = layout.hotbarRegion.width / layout.healthRegion.width;
  const hotbarWidth = rowWidth * hotbarMultiplier;
  const right = inferredRight / frame.width;
  const hotbarX = right - hotbarWidth;
  const hungerX = right - rowWidth;
  if (hotbarX < 0 || right > 1 || hungerX < 0) return layout;

  let healthRegion = dynamicRegion(
    layout.healthRegion.regionId,
    hotbarX,
    layout.healthRegion.y,
    rowWidth,
    layout.healthRegion.height,
  );
  let hungerRegion = dynamicRegion(
    layout.hungerRegion.regionId,
    hungerX,
    layout.hungerRegion.y,
    rowWidth,
    layout.hungerRegion.height,
  );
  const vitalOffset = bestVerticalOffset({
    frame,
    regions: [healthRegion, hungerRegion],
    families: ["health", "hunger"],
  });
  healthRegion = dynamicRegion(
    healthRegion.regionId,
    healthRegion.x,
    Math.max(0, Math.min(1 - healthRegion.height, healthRegion.y + vitalOffset)),
    healthRegion.width,
    healthRegion.height,
  );
  hungerRegion = dynamicRegion(
    hungerRegion.regionId,
    hungerRegion.x,
    Math.max(0, Math.min(1 - hungerRegion.height, hungerRegion.y + vitalOffset)),
    hungerRegion.width,
    hungerRegion.height,
  );
  const armorRegion = dynamicRegion(
    layout.armorRegion.regionId,
    hotbarX,
    layout.armorRegion.y + vitalOffset,
    rowWidth,
    layout.armorRegion.height,
  );
  const airRegion = dynamicRegion(
    layout.airRegion.regionId,
    hungerX,
    armorRegion.y,
    rowWidth,
    layout.airRegion.height,
  );
  const hotbarRegion = dynamicRegion(
    layout.hotbarRegion.regionId,
    hotbarX,
    layout.hotbarRegion.y,
    hotbarWidth,
    layout.hotbarRegion.height,
  );
  const healthScore = iconBandScore({ frame, integral, region: healthRegion, colour: "health" });
  const hungerScore = iconBandScore({ frame, integral, region: hungerRegion, colour: "hunger" });
  if (healthScore < 0.5 || hungerScore < 0.48) return layout;
  return {
    ...layout,
    score: Math.max(layout.score, Math.min(healthScore, hungerScore) * 0.72),
    healthScore,
    hungerScore,
    armorScore: armorBandScore({ frame, integral, region: armorRegion }),
    airScore: airBandScore({ frame, integral, region: airRegion }),
    hotbarScore: hotbarBandScore({ frame, integral, region: hotbarRegion }),
    healthRegion,
    hungerRegion,
    armorRegion,
    airRegion,
    hotbarRegion,
  };
}

function estimateTenIconValue(input: {
  readonly frame: SampledPixelFrame;
  readonly region: NormalizedVisualRegion;
  readonly confidence: number;
  readonly colour: "health" | "hunger";
}): MinecraftHudFact<number> {
  // The red health band in an unmodified vanilla HUD can be less saturated
  // than the adjacent hunger band after browser/OBS downscaling. The layout
  // gate below still requires health, hunger, and hotbar geometry to agree,
  // so this lower per-band floor recovers real hearts without accepting an
  // isolated red patch as a HUD.
  const minimumConfidence = input.colour === "health" ? 0.54 : 0.5;
  if (input.confidence < minimumConfidence) {
    return unknownHudFact(
      "The icon band did not meet the confidence threshold.",
      input.confidence,
      [input.region.regionId],
    );
  }
  const band = measureRegionVisualFeatures(input.frame, input.region);
  const healthFamily = healthColourFamily(band);
  const ratios = Array.from({ length: 10 }, (_, slotIndex) => {
    const features = measureRegionVisualFeatures(
      input.frame,
      fastSlotRegion(
        `${input.region.regionId}-slot-${slotIndex + 1}`,
        input.region,
        slotIndex,
        10,
      ),
    );
    return input.colour === "health"
      ? features[healthFamily]
      : clampUnit(features.redPixelRatio + features.warmPixelRatio);
  });
  const reference = Math.max(...ratios);
  if (reference < 0.025) {
    return unknownHudFact(
      "The icon band was visible but no reliable filled icons were found.",
      input.confidence,
      [input.region.regionId],
    );
  }
  const strongest = [...ratios].sort((left, right) => right - left).slice(0, 5);
  const robustReference = strongest[Math.floor(strongest.length / 2)] ?? reference;
  const fullThreshold = Math.max(0.018, robustReference * 0.4);
  const halfThreshold = Math.max(0.008, robustReference * 0.22);
  // Minecraft fills health from the left and hunger from the right. Counting
  // inward from that filled edge prevents a shifted/wide band from treating
  // scenery or the empty black icon outlines as extra health or hunger.
  const ordered = input.colour === "health" ? ratios : [...ratios].reverse();
  let value = 0;
  for (const ratio of ordered) {
    if (ratio >= fullThreshold) {
      value += 1;
      continue;
    }
    if (ratio >= halfThreshold) value += 0.5;
    break;
  }
  return knownHudFact(
    Math.max(0, Math.min(10, value)),
    Math.max(input.confidence, 0.7 + 0.3 * Math.min(1, reference / 0.18)),
    "Ten Minecraft-like HUD slots were measured from a scale-matched icon band.",
    [input.region.regionId],
  );
}

function estimateArmorValue(input: {
  readonly frame: SampledPixelFrame;
  readonly region: NormalizedVisualRegion;
  readonly confidence: number;
  readonly confirmedVitalsConfidence: number;
}): MinecraftHudFact<number> {
  const ratios = Array.from({ length: 10 }, (_, slotIndex) =>
    measureRegionVisualFeatures(
      input.frame,
      fastSlotRegion(`${input.region.regionId}-slot-${slotIndex + 1}`, input.region, slotIndex, 10),
    ).silverPixelRatio,
  );
  const reference = Math.max(...ratios);
  if (reference < 0.018 && input.confirmedVitalsConfidence >= 0.65) {
    return knownHudFact(
      0,
      input.confirmedVitalsConfidence,
      "The confirmed Minecraft health and hunger rows are visible without any armor icons above the hearts.",
      [input.region.regionId],
    );
  }
  if (
    (input.confidence < 0.48 && input.confirmedVitalsConfidence < 0.65) ||
    reference < 0.018
  ) {
    return unknownHudFact(
      "No reliable silver Minecraft armor icons were detected above the heart row.",
      input.confidence,
      [input.region.regionId],
    );
  }
  const fullThreshold = Math.max(0.015, reference * 0.66);
  const halfThreshold = Math.max(0.008, reference * 0.24);
  let value = 0;
  for (const ratio of ratios) {
    if (ratio >= fullThreshold) {
      value += 1;
      continue;
    }
    if (ratio >= halfThreshold) value += 0.5;
    break;
  }
  if (value === 0) {
    if (input.confirmedVitalsConfidence >= 0.65) {
      return knownHudFact(
        0,
        input.confirmedVitalsConfidence,
        "The confirmed Minecraft HUD does not contain a left-aligned armor icon row.",
        [input.region.regionId],
      );
    }
    return unknownHudFact(
      "Silver pixels were present above the hearts, but they did not form a left-aligned Minecraft armor row.",
      input.confidence,
      [input.region.regionId],
    );
  }
  return knownHudFact(
    Math.max(0, Math.min(10, value)),
    Math.max(input.confidence, 0.72 + 0.28 * Math.min(1, reference / 0.18)),
    "Ten Minecraft armor icons were measured as one unit for a full icon and half a unit for a half icon.",
    [input.region.regionId],
  );
}

function airFacts(input: {
  readonly frame: SampledPixelFrame;
  readonly region: NormalizedVisualRegion;
  readonly confidence: number;
}): Pick<MinecraftHudFacts, "airBubbles" | "submerged"> {
  const bandFeatures = measureRegionVisualFeatures(input.frame, input.region);
  if (input.confidence < 0.68 || bandFeatures.bluePixelRatio < 0.04) {
    return {
      airBubbles: unknownHudFact(
        "The air-bubble band did not meet the confidence threshold.",
        input.confidence,
        [input.region.regionId],
      ),
      submerged: unknownHudFact(
        "Submersion is not confirmed without a repeated air-bubble band.",
        input.confidence,
        [input.region.regionId],
      ),
    };
  }
  const blueRatios = Array.from({ length: 10 }, (_, slotIndex) =>
    measureRegionVisualFeatures(
      input.frame,
      fastSlotRegion(`${input.region.regionId}-slot-${slotIndex + 1}`, input.region, slotIndex, 10),
    ).bluePixelRatio,
  );
  const reference = Math.max(...blueRatios);
  const airBubbles = reference < 0.02
    ? unknownHudFact<number>(
        "An air-bubble row is visible, but filled bubbles are not distinct enough to count.",
        input.confidence,
        [input.region.regionId],
      )
    : knownHudFact(
        blueRatios.reduce((total, ratio) => {
          if (ratio >= Math.max(0.014, reference * 0.5)) return total + 1;
          if (ratio >= Math.max(0.006, reference * 0.2)) return total + 0.5;
          return total;
        }, 0),
        input.confidence,
        "Ten Minecraft-like air slots were measured above the hunger band.",
        [input.region.regionId],
      );
  return {
    airBubbles,
    submerged: knownHudFact(
      true,
      input.confidence,
      "A repeated Minecraft air-bubble row confirms that the player is submerged.",
      [input.region.regionId],
    ),
  };
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
      highlightScore: outer.brightPixelRatio * 0.9 + outer.edgeDensity * 0.1,
    };
  }).sort((left, right) => right.highlightScore - left.highlightScore);
  const [best, second] = slots;
  if (
    best === undefined ||
    second === undefined ||
    best.highlightScore < 0.1 ||
    best.highlightScore - second.highlightScore < 0.015
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
  readonly healthRegion: NormalizedVisualRegion;
  readonly hunger: RegionVisualFeatures;
  readonly hungerRegion: NormalizedVisualRegion;
  readonly hotbar: RegionVisualFeatures;
  readonly hotbarRegion: NormalizedVisualRegion;
  readonly armor: RegionVisualFeatures;
  readonly armorRegion: NormalizedVisualRegion;
  readonly airRegion: NormalizedVisualRegion;
  readonly healthScore: number;
  readonly hungerScore: number;
  readonly hotbarScore: number;
  readonly armorScore: number;
  readonly airScore: number;
}): MinecraftHudFacts {
  const health = estimateTenIconValue({
    frame: input.frame,
    region: input.healthRegion,
    confidence: input.healthScore,
    colour: "health",
  });
  const hunger = estimateTenIconValue({
    frame: input.frame,
    region: input.hungerRegion,
    confidence: input.hungerScore,
    colour: "hunger",
  });
  const air = airFacts({
    frame: input.frame,
    region: input.airRegion,
    confidence: input.airScore,
  });
  const armor = estimateArmorValue({
    frame: input.frame,
    region: input.armorRegion,
    confidence: input.armorScore,
    confirmedVitalsConfidence:
      health.status === "known" && hunger.status === "known"
        ? Math.min(health.confidence, hunger.confidence)
        : 0,
  });
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
    healthHearts: health,
    hungerShanks: hunger,
    airBubbles: air.airBubbles,
    submerged: air.submerged,
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
  previousLocatedRegions?: MinecraftHudFingerprint["locatedRegions"],
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
  const integral = buildFastFeatureIntegral(frame);
  const layout = searchMinecraftHudLayout(frame, integral, previousLocatedRegions);
  const searchedHealth = measureRegionVisualFeatures(frame, layout.healthRegion);
  const searchedHunger = measureRegionVisualFeatures(frame, layout.hungerRegion);
  const searchedArmor = measureRegionVisualFeatures(frame, layout.armorRegion);
  const searchedAir = measureRegionVisualFeatures(frame, layout.airRegion);
  const searchedHotbar = measureRegionVisualFeatures(frame, layout.hotbarRegion);
  const searchedFeatures = [searchedHealth, searchedHunger, searchedArmor, searchedAir, searchedHotbar];
  const anchors = [
    { id: "minecraft-health-search", score: layout.healthScore, threshold: 0.54 },
    { id: "minecraft-hunger-search", score: layout.hungerScore, threshold: 0.58 },
    { id: "minecraft-hotbar-search", score: layout.hotbarScore, threshold: 0.42 },
  ];
  const detectedAnchors = anchors.filter(({ score, threshold }) => score >= threshold).map(({ id }) => id);
  const missingAnchors = anchors.filter(({ score, threshold }) => score < threshold).map(({ id }) => id);
  const confidence = layout.score;
  const totalEdgeDensity = [...features, ...searchedFeatures].reduce((total, feature) => total + feature.edgeDensity, 0);
  const facts = minecraftHudFacts({
    frame,
    health: searchedHealth,
    healthRegion: layout.healthRegion,
    hunger: searchedHunger,
    hungerRegion: layout.hungerRegion,
    armor: searchedArmor,
    armorRegion: layout.armorRegion,
    airRegion: layout.airRegion,
    hotbar: searchedHotbar,
    hotbarRegion: layout.hotbarRegion,
    healthScore: layout.healthScore,
    hungerScore: layout.hungerScore,
    armorScore: layout.armorScore,
    airScore: layout.airScore,
    hotbarScore: layout.hotbarScore,
  });
  const locatedRegions = {
    health: layout.healthRegion,
    hunger: layout.hungerRegion,
    armor: layout.armorRegion,
    air: layout.airRegion,
    hotbar: layout.hotbarRegion,
  };
  const anchorScores = {
    health: layout.healthScore,
    hunger: layout.hungerScore,
    armor: layout.armorScore,
    air: layout.airScore,
    hotbar: layout.hotbarScore,
    layout: layout.score,
  };
  const hotbarCenter = layout.hotbarRegion.x + layout.hotbarRegion.width / 2;
  const hotbarBottom = layout.hotbarRegion.y + layout.hotbarRegion.height;
  const vanillaGeometry =
    Math.abs(hotbarCenter - 0.5) <= 0.1 &&
    hotbarBottom >= 0.94 &&
    layout.healthRegion.width >= 0.075 &&
    layout.healthRegion.width <= 0.225;
  const requiredLayoutAnchors =
    layout.healthScore >= 0.54 &&
    layout.hungerScore >= 0.5 &&
    layout.hotbarScore >= 0.5;
  const independentlySupportedFacts = independentlySupportedVitalFacts(facts);
  const independentVitalsKnown =
    independentlySupportedFacts.healthHearts.status === "known" &&
    independentlySupportedFacts.hungerShanks.status === "known";

  if (confidence >= 0.62 && requiredLayoutAnchors && vanillaGeometry) {
    return {
      status: "vanilla-like",
      confidence,
      detectedAnchors,
      missingAnchors,
      supportedSignals: [...profile.universalSignals, "minecraft-hud-layout"],
      reasons: [
        "Scale-matched health, hunger, and hotbar bands form the expected centered vanilla lower-HUD layout.",
        "Exact values remain available only when their individual icon bands and recent frames agree.",
      ],
      features: [...features, ...searchedFeatures],
      facts,
      locatedRegions,
      anchorScores,
    };
  }
  if (confidence >= 0.62 && requiredLayoutAnchors) {
    return {
      status: "minecraft-like",
      confidence,
      detectedAnchors,
      missingAnchors,
      supportedSignals: [...profile.universalSignals, "minecraft-hud-layout"],
      reasons: [
        "Scale-matched health, hunger, and hotbar bands were found in a consistent relative layout.",
        "The layout is shifted, windowed, or altered; only individually confident facts are exposed.",
      ],
      features: [...features, ...searchedFeatures],
      facts,
      locatedRegions,
      anchorScores,
    };
  }
  if (totalEdgeDensity < 0.035 && detectedAnchors.length === 0) {
    return {
      status: "hud-hidden",
      confidence: 0.75,
      detectedAnchors,
      missingAnchors,
      supportedSignals: profile.universalSignals,
      reasons: ["Configured HUD anchor regions contain too little structure for a visible HUD."],
      features: [...features, ...searchedFeatures],
      facts: UNKNOWN_HUD_FACTS,
      locatedRegions,
      anchorScores,
    };
  }
  return {
    status: "modified-or-unknown",
    confidence: clampUnit(1 - confidence),
    detectedAnchors,
    missingAnchors,
    supportedSignals: independentVitalsKnown
      ? [...profile.universalSignals, "minecraft-health-hearts", "minecraft-hunger-shanks"]
      : profile.universalSignals,
    reasons: [
      "No scale-matched health, hunger, and hotbar layout crossed the confidence boundary.",
      independentVitalsKnown
        ? "The paired ten-slot health and hunger colour bands remain candidates for temporal confirmation."
        : "Universal motion analysis remains available; calibrated health and hunger facts are unknown.",
    ],
    features: [...features, ...searchedFeatures],
    facts: independentlySupportedFacts,
    locatedRegions,
    anchorScores,
  };
}
