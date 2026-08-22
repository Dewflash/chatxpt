import type { NormalizedVisualRegion } from "./game-profiles";
import { measureRegionVisualFeatures } from "./minecraft-hud";
import type { SampledPixelFrame } from "./visual-measurements";

export interface MinecraftActionVisualMeasurement {
  readonly hitFlash: boolean;
  readonly eatingPose: boolean;
  readonly hitConfidence: number;
  readonly eatingConfidence: number;
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

const HIT_REGION = region("minecraft-action-hit-region", 0.25, 0.16, 0.5, 0.42);
const LOCAL_HIT_REGIONS = [
  region("minecraft-action-hit-upper-left", 0.06, 0.06, 0.3, 0.3),
  region("minecraft-action-hit-upper-center", 0.35, 0.06, 0.3, 0.3),
  region("minecraft-action-hit-upper-right", 0.64, 0.06, 0.3, 0.3),
  region("minecraft-action-hit-middle-left", 0.06, 0.3, 0.3, 0.34),
  region("minecraft-action-hit-middle-center", 0.35, 0.3, 0.3, 0.34),
  region("minecraft-action-hit-middle-right", 0.64, 0.3, 0.3, 0.34),
] as const;
const EATING_REGION = region("minecraft-action-eating-region", 0.38, 0.58, 0.34, 0.2);
const SCENE_REGION = region("minecraft-action-scene-region", 0, 0, 1, 0.75);

/**
 * Extracts two deliberately narrow vanilla-Java action cues. Successful hits
 * flash a target red near the crosshair. Eating repeatedly raises a warm or
 * red food item into the lower centre. Temporal confirmation remains the
 * responsibility of MinecraftBasicStateTracker.
 */
export function measureMinecraftActionVisuals(
  previous: SampledPixelFrame,
  current: SampledPixelFrame,
): MinecraftActionVisualMeasurement {
  const previousHit = measureRegionVisualFeatures(previous, HIT_REGION);
  const currentHit = measureRegionVisualFeatures(current, HIT_REGION);
  const currentScene = measureRegionVisualFeatures(current, SCENE_REGION);
  const previousEating = measureRegionVisualFeatures(previous, EATING_REGION);
  const currentEating = measureRegionVisualFeatures(current, EATING_REGION);
  const hitConcentration = currentHit.redPixelRatio - currentScene.redPixelRatio;
  const hitIncrease = currentHit.redPixelRatio - previousHit.redPixelRatio;
  const currentHitColour = currentHit.redPixelRatio + currentHit.warmPixelRatio;
  const previousHitColour = previousHit.redPixelRatio + previousHit.warmPixelRatio;
  const sceneHitColour = currentScene.redPixelRatio + currentScene.warmPixelRatio;
  const warmHitConcentration = currentHitColour - sceneHitColour;
  const warmHitIncrease = currentHitColour - previousHitColour;
  const localHitCandidates = LOCAL_HIT_REGIONS.map((candidateRegion) => {
    const before = measureRegionVisualFeatures(previous, candidateRegion);
    const after = measureRegionVisualFeatures(current, candidateRegion);
    const beforeColour = before.redPixelRatio + before.warmPixelRatio;
    const afterColour = after.redPixelRatio + after.warmPixelRatio;
    return {
      red: after.redPixelRatio,
      redIncrease: after.redPixelRatio - before.redPixelRatio,
      redConcentration: after.redPixelRatio - currentScene.redPixelRatio,
      colour: afterColour,
      colourIncrease: afterColour - beforeColour,
      colourConcentration: afterColour - sceneHitColour,
    };
  });
  const localizedHitFlash = localHitCandidates.some((candidate) =>
    candidate.red >= 0.06 &&
    candidate.redIncrease >= 0.04 &&
    candidate.redConcentration >= 0.045,
  );
  const rawHitFlash =
    (currentHit.redPixelRatio >= 0.18 && hitConcentration >= 0.18 && hitIncrease >= 0.06) ||
    (currentHitColour >= 0.22 && warmHitConcentration >= 0.15 && warmHitIncrease >= 0.05) ||
    localizedHitFlash;
  const previousFoodColour = previousEating.redPixelRatio + previousEating.warmPixelRatio;
  const currentFoodColour = currentEating.redPixelRatio + currentEating.warmPixelRatio;
  const eatingPose =
    currentEating.warmPixelRatio >= 0.1 &&
    currentFoodColour >= 0.38 &&
    Math.abs(currentFoodColour - previousFoodColour) >= 0.035;
  const hitFlash = rawHitFlash && !eatingPose;

  return {
    hitFlash,
    eatingPose,
    hitConfidence: hitFlash
      ? Math.max(0.76, Math.min(0.94, 0.72 + Math.max(
          hitConcentration,
          warmHitConcentration,
          ...localHitCandidates.map(({ redConcentration, colourConcentration }) =>
            Math.max(redConcentration, colourConcentration)),
        ) * 0.7 + Math.max(hitIncrease, warmHitIncrease) * 0.3))
      : 0,
    eatingConfidence: eatingPose
      ? Math.max(0.75, Math.min(0.92, 0.68 + currentFoodColour * 0.35))
      : 0,
  };
}
