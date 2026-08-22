import type { MinecraftHudFact } from "./minecraft-hud";
import { measureRegionVisualFeatures, type RegionVisualFeatures } from "./minecraft-hud";
import type { NormalizedVisualRegion } from "./game-profiles";
import type { SampledPixelFrame } from "./visual-measurements";

export type MinecraftMenuState = "inventory" | "crafting" | "container" | "sleeping" | "pause" | "death" | "none";

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
  readonly bedButton: RegionVisualFeatures;
}): number {
  const darkCoverage = input.full.darkPixelRatio >= 0.55 ? 0.42 : 0;
  const lowerControls =
    input.lower.edgeDensity >= 0.11 && input.lower.brightPixelRatio >= 0.12 ? 0.38 : 0;
  const calmCenter = input.center.edgeDensity < 0.16 ? 0.14 : 0;
  const focusedBedButton =
    input.bedButton.edgeDensity >= 0.09 &&
    input.bedButton.lumaStandardDeviation >= 0.15 &&
    input.bedButton.brightPixelRatio >= 0.018 &&
    input.bedButton.bluePixelRatio < 0.08 &&
    input.bedButton.darkPixelRatio >= 0.15 &&
    input.bedButton.darkPixelRatio <= 0.65
      ? 0.28
      : 0;
  return Math.min(
    1,
    darkCoverage +
      lowerControls +
      calmCenter +
      input.lower.horizontalRepeatScore * 0.12 +
      focusedBedButton,
  );
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
  // The vanilla Java pause buttons are mostly dark grey. At capture-scale
  // their thin white borders produce a lower edge/bright ratio than the old
  // high-detail rule expected. This geometry is deliberately paired with a
  // quiet lower HUD so ordinary gameplay is not promoted to a pause screen.
  const vanillaDarkButtons =
    input.center.edgeDensity >= 0.05 &&
    input.center.brightPixelRatio < 0.08 &&
    input.center.horizontalRepeatScore >= 0.9 &&
    input.lower.edgeDensity < 0.015
      ? 0.8
      : 0;
  const quietLowerHud = input.lower.edgeDensity < 0.08 ? 0.16 : 0;
  return Math.min(1, Math.max(verticalButtons, vanillaDarkButtons) + quietLowerHud);
}

function scoreDeathOverlay(input: {
  readonly full: RegionVisualFeatures;
  readonly lower: RegionVisualFeatures;
  readonly title: RegionVisualFeatures;
  readonly buttons: RegionVisualFeatures;
}): number {
  const redDeathTint =
    input.full.redPixelRatio >= 0.02 && input.full.warmPixelRatio >= 0.15 ? 0.28 : 0;
  const centeredTitle =
    input.title.edgeDensity >= 0.05 &&
    input.title.brightPixelRatio >= 0.025 &&
    input.title.horizontalRepeatScore >= 0.9
      ? 0.3
      : 0;
  const pairedButtons =
    input.buttons.edgeDensity >= 0.045 &&
    input.buttons.darkPixelRatio >= 0.55 &&
    input.buttons.horizontalRepeatScore >= 0.94
      ? 0.28
      : 0;
  const quietTintedHud = input.lower.edgeDensity < 0.02 && input.lower.warmPixelRatio >= 0.2 ? 0.14 : 0;
  return Math.min(1, redDeathTint + centeredTitle + pairedButtons + quietTintedHud);
}

export function detectMinecraftMenuState(frame: SampledPixelFrame): MinecraftHudFact<MinecraftMenuState> {
  const center = measureRegionVisualFeatures(frame, region("minecraft-menu-center", 0.24, 0.16, 0.52, 0.58));
  const lower = measureRegionVisualFeatures(frame, region("minecraft-menu-lower-controls", 0.2, 0.68, 0.6, 0.22));
  const full = measureRegionVisualFeatures(frame, region("minecraft-menu-full-frame", 0, 0, 1, 1));
  const bedButton = measureRegionVisualFeatures(
    frame,
    region("minecraft-sleep-button", 0.29, 0.79, 0.42, 0.09),
  );
  const deathTitle = measureRegionVisualFeatures(
    frame,
    region("minecraft-death-title", 0.28, 0.2, 0.44, 0.22),
  );
  const deathButtons = measureRegionVisualFeatures(
    frame,
    region("minecraft-death-buttons", 0.3, 0.49, 0.4, 0.18),
  );
  const centerPanelScore = scorePanelMenu(center);
  const sleepScore = scoreSleepOverlay({ full, lower, center, bedButton });
  const pauseScore = scorePauseOverlay({ center, lower });
  const deathScore = scoreDeathOverlay({ full, lower, title: deathTitle, buttons: deathButtons });

  if (centerPanelScore >= 0.88) {
    return knownMenuState(
      "container",
      centerPanelScore,
      "A centered Minecraft-like container screen was detected; the exact inventory, crafting, or furnace subtype remains unknown.",
      [center.regionId],
    );
  }

  if (sleepScore >= 0.78) {
    return knownMenuState(
      "sleeping",
      sleepScore,
      "A dark Minecraft-like sleep overlay with lower-screen controls was detected.",
      [full.regionId, lower.regionId, bedButton.regionId],
    );
  }

  if (deathScore >= 0.68) {
    return knownMenuState(
      "death",
      deathScore,
      "A red-tinted Minecraft death screen with centered title and respawn controls was detected.",
      [full.regionId, deathTitle.regionId, deathButtons.regionId],
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
      "container",
      centerPanelScore,
      "A centered Minecraft-like container screen was detected; the exact inventory, crafting, or furnace subtype remains unknown.",
      [center.regionId],
    );
  }

  return unknownMenuState(
    "No confident Minecraft inventory, crafting, sleep, or pause menu structure was detected.",
    Math.max(centerPanelScore, sleepScore, pauseScore, deathScore),
    [center.regionId, lower.regionId, full.regionId, deathTitle.regionId, deathButtons.regionId],
  );
}
