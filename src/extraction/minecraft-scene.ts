import type { NormalizedVisualRegion } from "./game-profiles";
import {
  measureRegionVisualFeatures,
  type MinecraftHudFact,
  type RegionVisualFeatures,
} from "./minecraft-hud";
import type { SampledPixelFrame } from "./visual-measurements";

export interface MinecraftSceneFacts {
  readonly visibleHostile: MinecraftHudFact<"skeleton" | "zombie" | "creeper" | "spider" | "unknown-hostile">;
  readonly biomeOrEnvironment: MinecraftHudFact<string>;
  readonly damageCauseHint: MinecraftHudFact<"mob" | "fire" | "drowning" | "lava">;
}

export type MinecraftSceneEnvironment =
  | "field"
  | "forest"
  | "water"
  | "sand"
  | "building"
  | "lava-or-fire-nearby";

function clampUnit(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function knownSceneFact<T extends string | number | boolean>(
  value: T,
  confidence: number,
  reason: string,
  sourceRegionIds: readonly string[],
): MinecraftHudFact<T> {
  return {
    status: "known",
    value,
    confidence: clampUnit(confidence),
    reason,
    sourceRegionIds,
  };
}

function unknownSceneFact<T extends string | number | boolean>(
  reason: string,
  confidence = 0,
  sourceRegionIds: readonly string[] = [],
): MinecraftHudFact<T> {
  return {
    status: "unknown",
    value: null,
    confidence: clampUnit(confidence),
    reason,
    sourceRegionIds,
  };
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

function environmentFact(features: readonly RegionVisualFeatures[]): MinecraftHudFact<MinecraftSceneEnvironment> {
  const [, center, lower] = features;
  const sceneIds = features.map(({ regionId }) => regionId);
  const centerBlue = center?.bluePixelRatio ?? 0;
  const lowerBlue = lower?.bluePixelRatio ?? 0;
  const centerGreen = center?.greenPixelRatio ?? 0;
  const lowerGreen = lower?.greenPixelRatio ?? 0;
  const centerDark = center?.darkPixelRatio ?? 0;
  const lowerDark = lower?.darkPixelRatio ?? 0;
  const centerYellow = center?.yellowPixelRatio ?? 0;
  const lowerYellow = lower?.yellowPixelRatio ?? 0;
  const centerNeutral = center?.neutralPixelRatio ?? 0;
  const lowerNeutral = lower?.neutralPixelRatio ?? 0;

  // Blue coverage alone cannot distinguish water/rain from a blue-tinted
  // night, snow shadow, or shader. Water remains unknown here; the independent
  // air-bubble/submersion detector can establish it with HUD evidence.
  const blueScore = centerBlue * 0.55 + lowerBlue * 0.45;
  const lavaScore = Math.max(
    lower === undefined ? 0 : lower.warmPixelRatio * 0.65 + lower.redPixelRatio * 0.35,
    center === undefined ? 0 : center.warmPixelRatio * 0.55 + center.redPixelRatio * 0.45,
  );
  if (lavaScore >= 0.22 && (lower?.warmPixelRatio ?? 0) >= 0.24) {
    return knownSceneFact(
      "lava-or-fire-nearby",
      Math.min(0.9, 0.72 + lavaScore),
      "Large warm/red bright regions suggest nearby lava or fire; do not infer exact block or damage without corroboration.",
      sceneIds,
    );
  }

  const greenScore = centerGreen * 0.35 + lowerGreen * 0.65;
  const forestDarkness = centerDark * 0.65 + lowerDark * 0.35;
  if (
    greenScore >= 0.22 &&
    (centerDark >= 0.55 || lowerDark >= 0.3) &&
    forestDarkness >= 0.42
  ) {
    return knownSceneFact(
      "forest",
      Math.min(0.9, 0.76 + greenScore * 0.18 + forestDarkness * 0.12),
      "Dark green coverage across the central scene and lower foreground supports a forest environment.",
      sceneIds,
    );
  }

  if (lowerGreen >= 0.25 && greenScore >= 0.2 && centerDark < 0.55 && lowerDark < 0.3) {
    return knownSceneFact(
      "field",
      Math.min(0.9, 0.76 + greenScore * 0.22),
      "Bright green coverage across the lower gameplay area supports an open field environment.",
      sceneIds,
    );
  }

  const sandScore = centerYellow * 0.35 + lowerYellow * 0.65;
  if (
    lowerYellow >= 0.22 &&
    sandScore >= 0.2 &&
    (lower?.meanLuma ?? 0) >= 0.38 &&
    lowerGreen < 0.18
  ) {
    return knownSceneFact(
      "sand",
      Math.min(0.9, 0.76 + sandScore * 0.22),
      "Broad bright yellow-beige coverage in the lower gameplay area supports a sandy environment.",
      sceneIds,
    );
  }

  const buildingScore = centerNeutral * 0.45 + lowerNeutral * 0.55;
  if (
    centerNeutral >= 0.22 &&
    lowerNeutral >= 0.22 &&
    buildingScore >= 0.26 &&
    Math.max(center?.edgeDensity ?? 0, lower?.edgeDensity ?? 0) >= 0.025
  ) {
    return knownSceneFact(
      "building",
      Math.min(0.88, 0.76 + buildingScore * 0.2),
      "Structured neutral-toned coverage across the central and lower scene supports a building or constructed interior.",
      sceneIds,
    );
  }

  return unknownSceneFact(
    "Scene pixels do not meet the supported field, forest, sand, building, or lava/fire rules; water requires independent HUD evidence.",
    Math.max(blueScore, lavaScore, greenScore, sandScore, buildingScore),
    sceneIds,
  );
}

function hostileFact(center: RegionVisualFeatures): MinecraftSceneFacts["visibleHostile"] {
  const contrast = center.edgeDensity + center.lumaStandardDeviation;
  const greenHostileScore = center.greenPixelRatio * 0.68 + contrast * 0.32;
  const skeletonScore = center.brightPixelRatio * 0.5 + center.darkPixelRatio * 0.2 + contrast * 0.3;
  const spiderScore = center.darkPixelRatio * 0.55 + center.redPixelRatio * 0.2 + contrast * 0.25;

  if (greenHostileScore >= 0.24 && center.edgeDensity >= 0.06) {
    return knownSceneFact(
      "unknown-hostile",
      Math.min(0.78, 0.56 + greenHostileScore * 0.45),
      "A central green high-contrast shape is hostile-like, but exact Minecraft mob identity is not calibrated.",
      [center.regionId],
    );
  }
  if (skeletonScore >= 0.42 && center.brightPixelRatio >= 0.24 && center.edgeDensity >= 0.09) {
    return knownSceneFact(
      "unknown-hostile",
      Math.min(0.76, 0.52 + skeletonScore * 0.42),
      "A central bright high-contrast shape is hostile-like, but exact Minecraft mob identity is not calibrated.",
      [center.regionId],
    );
  }
  if (spiderScore >= 0.45 && center.redPixelRatio >= 0.04 && center.edgeDensity >= 0.1) {
    return knownSceneFact(
      "unknown-hostile",
      Math.min(0.74, 0.5 + spiderScore * 0.4),
      "A dark central high-contrast shape with red accents is hostile-like, but exact Minecraft mob identity is not calibrated.",
      [center.regionId],
    );
  }
  if (Math.max(greenHostileScore, skeletonScore, spiderScore) >= 0.5 && center.edgeDensity >= 0.06) {
    return knownSceneFact(
      "unknown-hostile",
      Math.min(0.7, 0.48 + Math.max(greenHostileScore, skeletonScore, spiderScore) * 0.35),
      "A central high-contrast shape is hostile-like, but the detector cannot identify the Minecraft mob type.",
      [center.regionId],
    );
  }
  return unknownSceneFact(
    "No central hostile-like Minecraft shape met the conservative confidence threshold.",
    Math.max(greenHostileScore, skeletonScore, spiderScore),
    [center.regionId],
  );
}

function damageCauseHint(input: {
  readonly environment: MinecraftHudFact<string>;
  readonly visibleHostile: MinecraftSceneFacts["visibleHostile"];
}): MinecraftSceneFacts["damageCauseHint"] {
  if (input.visibleHostile.status === "known") {
    return knownSceneFact(
      "mob",
      Math.min(0.78, input.visibleHostile.confidence),
      "A visible hostile-like shape can support mob damage only when health recently dropped.",
      input.visibleHostile.sourceRegionIds,
    );
  }
  if (input.environment.status !== "known" || typeof input.environment.value !== "string") {
    return unknownSceneFact("No supported environment or hostile evidence can suggest a Minecraft damage cause.");
  }
  if (input.environment.value === "water") {
    return unknownSceneFact(
      "Water-like scene coverage does not by itself prove drowning damage.",
      input.environment.confidence,
      input.environment.sourceRegionIds,
    );
  }
  return unknownSceneFact(
    "The classified Minecraft environment does not support a specific damage cause.",
    input.environment.confidence,
    input.environment.sourceRegionIds,
  );
}

export function detectMinecraftSceneFacts(frame: SampledPixelFrame): MinecraftSceneFacts {
  const features = [
    measureRegionVisualFeatures(frame, region("minecraft-scene-upper", 0.12, 0.08, 0.76, 0.26)),
    measureRegionVisualFeatures(frame, region("minecraft-scene-center", 0.28, 0.22, 0.44, 0.38)),
    measureRegionVisualFeatures(frame, region("minecraft-scene-lower", 0.14, 0.58, 0.72, 0.22)),
  ];
  const environment = environmentFact(features);
  const visibleHostile = hostileFact(features[1]);
  return {
    visibleHostile,
    biomeOrEnvironment: environment,
    damageCauseHint: damageCauseHint({ environment, visibleHostile }),
  };
}
