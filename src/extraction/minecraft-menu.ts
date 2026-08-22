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
  const midtonePixelRatio = 1 - features.darkPixelRatio - features.brightPixelRatio;
  // A Minecraft container is a dense, mostly grey panel. Bright, low-detail
  // gameplay (especially snow fields and sky) can be horizontally repetitive,
  // but it does not contain enough panel edges or midtones to support a menu.
  if (
    features.horizontalRepeatScore < 0.9 ||
    features.edgeDensity < 0.04 ||
    midtonePixelRatio < 0.2
  ) {
    return 0;
  }
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
  readonly buttonStack: RegionVisualFeatures;
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
  const scaledBrightButtons =
    input.center.edgeDensity >= 0.05 &&
    input.center.brightPixelRatio >= 0.12 &&
    input.center.horizontalRepeatScore >= 0.9 &&
    input.lower.edgeDensity < 0.02
      ? 0.82
      : 0;
  const structuredNeutralButtons =
    input.buttonStack.edgeDensity >= 0.06 &&
    input.buttonStack.lumaStandardDeviation >= 0.13 &&
    input.buttonStack.lumaStandardDeviation <= 0.23 &&
    input.buttonStack.horizontalRepeatScore >= 0.92 &&
    input.buttonStack.neutralPixelRatio >= 0.28 &&
    input.buttonStack.brightPixelRatio < 0.14 &&
    input.buttonStack.darkPixelRatio >= 0.3 &&
    input.buttonStack.darkPixelRatio <= 0.78
      ? 0.84
      : 0;
  const quietLowerHud = input.lower.edgeDensity < 0.08 ? 0.16 : 0;
  return Math.min(
    1,
    Math.max(verticalButtons, vanillaDarkButtons, scaledBrightButtons, structuredNeutralButtons) + quietLowerHud,
  );
}

function pixelLuma(frame: SampledPixelFrame, x: number, y: number): number {
  const offset = (y * frame.width + x) * 4;
  return (
    frame.rgba[offset] * 0.2126 +
    frame.rgba[offset + 1] * 0.7152 +
    frame.rgba[offset + 2] * 0.0722
  ) / 255;
}

function adaptivePauseButtonScore(frame: SampledPixelFrame): number {
  const widthCandidates = [0.32, 0.4, 0.5, 0.6];
  let best = 0;
  for (const normalizedWidth of widthCandidates) {
    const left = Math.floor((0.5 - normalizedWidth / 2) * frame.width);
    const right = Math.ceil((0.5 + normalizedWidth / 2) * frame.width);
    const sideWidth = Math.max(2, Math.round(frame.width * 0.045));
    const activeRows: boolean[] = [];
    const top = Math.floor(frame.height * 0.12);
    const bottom = Math.ceil(frame.height * 0.76);
    for (let y = top; y < bottom; y += 1) {
      let neutral = 0;
      let bright = 0;
      let centerPixels = 0;
      for (let x = left; x < right; x += 1) {
        const offset = (y * frame.width + x) * 4;
        const red = frame.rgba[offset];
        const green = frame.rgba[offset + 1];
        const blue = frame.rgba[offset + 2];
        const luma = pixelLuma(frame, x, y);
        neutral += Number(
          Math.max(red, green, blue) - Math.min(red, green, blue) <= 34 &&
          luma >= 0.12 &&
          luma <= 0.9,
        );
        bright += Number(luma >= 0.58);
        centerPixels += 1;
      }
      let sideNeutral = 0;
      let sidePixels = 0;
      for (const [sideLeft, sideRight] of [
        [Math.max(0, left - sideWidth), left],
        [right, Math.min(frame.width, right + sideWidth)],
      ] as const) {
        for (let x = sideLeft; x < sideRight; x += 1) {
          const offset = (y * frame.width + x) * 4;
          const red = frame.rgba[offset];
          const green = frame.rgba[offset + 1];
          const blue = frame.rgba[offset + 2];
          const luma = pixelLuma(frame, x, y);
          sideNeutral += Number(
            Math.max(red, green, blue) - Math.min(red, green, blue) <= 34 &&
            luma >= 0.12 &&
            luma <= 0.9,
          );
          sidePixels += 1;
        }
      }
      const neutralRatio = centerPixels === 0 ? 0 : neutral / centerPixels;
      const brightRatio = centerPixels === 0 ? 0 : bright / centerPixels;
      const sideNeutralRatio = sidePixels === 0 ? 0 : sideNeutral / sidePixels;
      activeRows.push(
        neutralRatio >= 0.42 &&
        neutralRatio - sideNeutralRatio >= 0.12 &&
        brightRatio >= 0.008,
      );
    }

    const minimumBandHeight = Math.max(1, Math.floor(frame.height * 0.008));
    const maximumBandHeight = Math.max(minimumBandHeight, Math.ceil(frame.height * 0.12));
    const bands: { readonly start: number; readonly end: number }[] = [];
    let start: number | null = null;
    activeRows.forEach((active, index) => {
      if (active) start ??= index;
      else if (start !== null) {
        const height = index - start;
        if (height >= minimumBandHeight && height <= maximumBandHeight) {
          bands.push({ start, end: index - 1 });
        }
        start = null;
      }
    });
    if (start !== null) {
      const height = activeRows.length - start;
      if (height >= minimumBandHeight && height <= maximumBandHeight) {
        bands.push({ start, end: activeRows.length - 1 });
      }
    }
    const usefulBands = bands.filter((band, index) =>
      index === 0 || band.start - (bands[index - 1]?.end ?? band.start) >= minimumBandHeight,
    );
    if (usefulBands.length >= 3) {
      const span = (usefulBands.at(-1)!.end - usefulBands[0].start + 1) / Math.max(1, activeRows.length);
      best = Math.max(best, Math.min(0.96, 0.72 + usefulBands.length * 0.045 + Math.min(0.08, span * 0.12)));
    }
  }
  return best;
}

interface UniformLumaChange {
  readonly ratio: number;
  readonly deviation: number;
  readonly sampleCount: number;
}

function median(values: readonly number[]): number {
  if (values.length === 0) return 1;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)] ?? 1;
}

function uniformBorderLumaChange(
  previous: SampledPixelFrame,
  current: SampledPixelFrame,
): UniformLumaChange | null {
  if (previous.width !== current.width || previous.height !== current.height) return null;
  const ratios: number[] = [];
  const step = Math.max(1, Math.floor(Math.min(current.width, current.height) / 90));
  for (let y = 0; y < current.height * 0.86; y += step) {
    for (let x = 0; x < current.width; x += step) {
      if (x > current.width * 0.18 && x < current.width * 0.82 && y > current.height * 0.1) continue;
      const before = pixelLuma(previous, x, y);
      const after = pixelLuma(current, x, y);
      if (before < 0.08 || after < 0.03) continue;
      ratios.push(after / before);
    }
  }
  if (ratios.length < 80) return null;
  const ratio = median(ratios);
  const deviation = median(ratios.map((value) => Math.abs(value - ratio)));
  return { ratio, deviation, sampleCount: ratios.length };
}

/** Detects the uniform world dimming that occurs when a pause overlay opens. */
export function detectMinecraftPauseTransition(
  previous: SampledPixelFrame,
  current: SampledPixelFrame,
): MinecraftHudFact<MinecraftMenuState> {
  const change = uniformBorderLumaChange(previous, current);
  const currentMenu = detectMinecraftMenuState(current);
  if (
    change !== null &&
    change.ratio >= 0.38 &&
    change.ratio <= 0.86 &&
    change.deviation <= 0.12 &&
    currentMenu.status === "known" &&
    currentMenu.value === "pause"
  ) {
    const confidence = Math.min(
      0.94,
      Math.max(
        currentMenu.confidence,
        0.8 + (0.86 - change.ratio) * 0.22 + (0.12 - change.deviation) * 0.35,
      ),
    );
    return knownMenuState(
      "pause",
      confidence,
      "The same Minecraft world view dimmed uniformly while a pause-menu structure appeared.",
      [...new Set(["minecraft-pause-transition-border", ...currentMenu.sourceRegionIds])],
    );
  }
  return unknownMenuState(
    "No uniform dimming plus Minecraft pause-menu structure was detected.",
    0,
    ["minecraft-pause-transition-border"],
  );
}

/** Detects the inverse uniform brightening when a held menu overlay closes. */
export function detectMinecraftGameplayResumeTransition(
  previous: SampledPixelFrame,
  current: SampledPixelFrame,
): boolean {
  const change = uniformBorderLumaChange(previous, current);
  return change !== null && change.ratio >= 1.16 && change.ratio <= 2.7 && change.deviation <= 0.28;
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
  const buttonStack = measureRegionVisualFeatures(
    frame,
    region("minecraft-pause-button-stack", 0.28, 0.18, 0.44, 0.4),
  );
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
  const adaptivePauseScore = adaptivePauseButtonScore(frame);
  const pauseScore = Math.max(scorePauseOverlay({ center, buttonStack, lower }), adaptivePauseScore);
  const deathScore = scoreDeathOverlay({ full, lower, title: deathTitle, buttons: deathButtons });

  if (deathScore >= 0.68) {
    return knownMenuState(
      "death",
      deathScore,
      "A red-tinted Minecraft death screen with centered title and respawn controls was detected.",
      [full.regionId, deathTitle.regionId, deathButtons.regionId],
    );
  }

  // A real inventory is a bright, high-variance centered panel with a dense
  // lower slot grid. That lower grid is absent from the quiet pause overlay,
  // so prefer the container interpretation before the broad button rule.
  if (
    centerPanelScore >= 0.78 &&
    center.lumaStandardDeviation >= 0.2 &&
    center.brightPixelRatio >= 0.12 &&
    center.neutralPixelRatio >= 0.45 &&
    lower.edgeDensity >= 0.03
  ) {
    return knownMenuState(
      "container",
      centerPanelScore,
      "A centered Minecraft-like container screen was detected; the exact inventory, crafting, or furnace subtype remains unknown.",
      [center.regionId, lower.regionId],
    );
  }

  if (pauseScore >= 0.78) {
    return knownMenuState(
      "pause",
      pauseScore,
      "A centered Minecraft-like pause menu structure was detected.",
      [
        center.regionId,
        buttonStack.regionId,
        ...(adaptivePauseScore >= 0.78 ? ["minecraft-pause-adaptive-button-stack"] : []),
      ],
    );
  }

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
