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

function environmentFact(features: readonly RegionVisualFeatures[]): MinecraftHudFact<string> {
  const [upper, center, lower] = features;
  const sceneIds = features.map(({ regionId }) => regionId);
  const blue = Math.max(upper?.bluePixelRatio ?? 0, center?.bluePixelRatio ?? 0, lower?.bluePixelRatio ?? 0);
  const lava = Math.max(
    lower === undefined ? 0 : lower.warmPixelRatio * 0.65 + lower.redPixelRatio * 0.35,
    center === undefined ? 0 : center.warmPixelRatio * 0.55 + center.redPixelRatio * 0.45,
  );
  const green = Math.max(upper?.greenPixelRatio ?? 0, center?.greenPixelRatio ?? 0, lower?.greenPixelRatio ?? 0);
  const darkness = Math.max(upper?.darkPixelRatio ?? 0, center?.darkPixelRatio ?? 0);

  if (lava >= 0.22 && (lower?.warmPixelRatio ?? 0) >= 0.24) {
    return knownSceneFact(
      "lava-or-fire-nearby",
      Math.min(0.9, 0.72 + lava),
      "Large warm/red bright regions suggest nearby lava or fire; do not infer exact block or damage without corroboration.",
      sceneIds,
    );
  }
  // Blue coverage alone cannot distinguish water/rain from a blue-tinted
  // night, snow shadow, or shader. Water remains unknown here; the independent
  // air-bubble/submersion detector can establish it with HUD evidence.
  if (darkness >= 0.68 && (center?.edgeDensity ?? 0) >= 0.04) {
    return knownSceneFact(
      "dark-cave-or-night",
      Math.min(0.82, 0.55 + darkness * 0.35),
      "A dark, high-contrast scene suggests a cave, night, or another low-light Minecraft environment.",
      sceneIds,
    );
  }
  if (green >= 0.32 && blue < 0.28 && lava < 0.12) {
    return knownSceneFact(
      "grassy-overworld",
      Math.min(0.78, 0.58 + green * 0.35),
      "Broad green coverage suggests a grassy overworld scene.",
      sceneIds,
    );
  }
  return unknownSceneFact(
    "Scene colours are insufficient to classify a Minecraft biome or environment.",
    Math.max(blue, lava, green, darkness),
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
  if (input.environment.value === "lava-or-fire-nearby") {
    return unknownSceneFact(
      "Nearby warm/red scene evidence cannot distinguish lava from fire or prove the damage source.",
      input.environment.confidence,
      input.environment.sourceRegionIds,
    );
  }
  if (input.environment.value === "water-or-rain") {
    return unknownSceneFact(
      "Blue scene coverage cannot distinguish rain, surface water, or drowning.",
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
