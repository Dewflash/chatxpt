import type { MinecraftHudFact } from "./minecraft-hud";
import { measureRegionVisualFeatures, type RegionVisualFeatures } from "./minecraft-hud";
import type { NormalizedVisualRegion } from "./game-profiles";
import type { SampledPixelFrame } from "./visual-measurements";

export type MinecraftMenuState = "inventory" | "crafting" | "sleeping" | "pause" | "none";

function region(
  regionId: string,
  x: number,
  y: number,
  width: number,
  height: number,
): NormalizedVisualRegion {
  return { regionId, x, y, width, height, purpose: "template" };
}

function knownMenuState(
  value: MinecraftMenuState,
  confidence: number,
  reason: string,
  sourceRegionIds: readonly string[],
): MinecraftHudFact<MinecraftMenuState> {
  return {
    status: "known",
    value,
    confidence: Math.max(0, Math.min(1, confidence)),
    reason,
    sourceRegionIds,
  };
}

function unknownMenuState(
  reason: string,
  confidence = 0,
  sourceRegionIds: readonly string[] = [],
): MinecraftHudFact<MinecraftMenuState> {
  return {
    status: "unknown",
    value: null,
    confidence: Math.max(0, Math.min(1, confidence)),
    reason,
    sourceRegionIds,
  };
}

function scorePanelMenu(features: RegionVisualFeatures): number {
  if (features.horizontalRepeatScore < 0.9) return 0;
  return Math.max(
    0,
    Math.min(
      1,
      features.edgeDensity * 2.2 +
        features.lumaStandardDeviation * 1.4 +
        features.horizontalRepeatScore * 0.4 +
        features.brightPixelRatio * 0.7 -
        features.darkPixelRatio * 0.35,
    ),
  );
}

function scoreSleepOverlay(input: {
  readonly full: RegionVisualFeatures;
  readonly lower: RegionVisualFeatures;
  readonly center: RegionVisualFeatures;
}): number {
  const darkCoverage = input.full.darkPixelRatio >= 0.55 ? 0.42 : 0;
  const lowerControls =
    input.lower.edgeDensity >= 0.11 && input.lower.brightPixelRatio >= 0.12 ? 0.38 : 0;
  const calmCenter = input.center.edgeDensity < 0.16 ? 0.14 : 0;
  return Math.min(1, darkCoverage + lowerControls + calmCenter + input.lower.horizontalRepeatScore * 0.12);
}

function scorePauseOverlay(input: {
  readonly center: RegionVisualFeatures;
  readonly lower: RegionVisualFeatures;
}): number {
  const verticalButtons =
    input.center.edgeDensity >= 0.14 &&
    input.center.brightPixelRatio >= 0.16 &&
    input.center.horizontalRepeatScore >= 0.72
      ? 0.72
      : 0;
  const quietLowerHud = input.lower.edgeDensity < 0.08 ? 0.16 : 0;
  return Math.min(1, verticalButtons + quietLowerHud);
}

export function detectMinecraftMenuState(frame: SampledPixelFrame): MinecraftHudFact<MinecraftMenuState> {
  const center = measureRegionVisualFeatures(frame, region("minecraft-menu-center", 0.24, 0.16, 0.52, 0.58));
  const lower = measureRegionVisualFeatures(frame, region("minecraft-menu-lower-controls", 0.2, 0.68, 0.6, 0.22));
  const full = measureRegionVisualFeatures(frame, region("minecraft-menu-full-frame", 0, 0, 1, 1));
  const centerPanelScore = scorePanelMenu(center);
  const sleepScore = scoreSleepOverlay({ full, lower, center });
  const pauseScore = scorePauseOverlay({ center, lower });

  if (sleepScore >= 0.78) {
    return knownMenuState(
      "sleeping",
      sleepScore,
      "A dark Minecraft-like sleep overlay with lower-screen controls was detected.",
      [full.regionId, lower.regionId],
    );
  }

  if (pauseScore >= 0.78 && centerPanelScore < 0.88) {
    return knownMenuState(
      "pause",
      pauseScore,
      "A centered Minecraft-like pause menu structure was detected.",
      [center.regionId],
    );
  }

  if (centerPanelScore >= 0.82) {
    return knownMenuState(
      "inventory",
      centerPanelScore,
      "A centered Minecraft-like inventory or crafting panel was detected.",
      [center.regionId],
    );
  }

  return unknownMenuState(
    "No confident Minecraft inventory, crafting, sleep, or pause menu structure was detected.",
    Math.max(centerPanelScore, sleepScore, pauseScore),
    [center.regionId, lower.regionId, full.regionId],
  );
}
