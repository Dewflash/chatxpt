import { describe, expect, it } from "vitest";

import {
  CONTRACT_VERSION,
  type EphemeralGameplayFrame,
  type FrameSource,
  type GameplayFrameObservation,
} from "../core";

import {
  decideAdaptiveSampling,
  defaultAdaptiveSamplingPolicy,
  initialAdaptiveSamplingState,
} from "./adaptive-sampling";
import {
  createDefaultGameProfileRegistry,
  gameCalibrationProfileSchema,
  GameProfileRegistry,
  genericActionGameProfile,
  minecraftJavaGameProfile,
} from "./game-profiles";
import { buildMultiGameGameplaySnapshot } from "./game-vision-snapshot";
import { fingerprintMinecraftHud } from "./minecraft-hud";
import {
  interpretMotionWindow,
  toGameplayActivity,
  type TimedSpatialMotion,
} from "./motion-interpretation";
import { MultiGameVisionAnalyzer, streamMultiGameVisionAssessments } from "./multi-game-vision";
import { measureSpatialMotion } from "./spatial-motion";
import type { SampledPixelFrame } from "./visual-measurements";

const WIDTH = 96;
const HEIGHT = 54;

function selection(requestedGameId: string | null) {
  return {
    requestedGameId,
    source: "streamer-config" as const,
    confidence: 1,
  };
}

function frameFromPixel(
  pixel: (x: number, y: number) => readonly [number, number, number],
  width = WIDTH,
  height = HEIGHT,
): SampledPixelFrame {
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      const [red, green, blue] = pixel(x, y);
      rgba[offset] = red;
      rgba[offset + 1] = green;
      rgba[offset + 2] = blue;
      rgba[offset + 3] = 255;
    }
  }
  return { width, height, rgba };
}

function texturedFrame(): SampledPixelFrame {
  return frameFromPixel((x, y) => {
    const value = (x * 37 + y * 61 + ((x * y * 13) % 97)) % 256;
    return [value, (value * 3 + 17) % 256, (value * 5 + 31) % 256];
  });
}

function solidFrame(value = 0): SampledPixelFrame {
  return frameFromPixel(() => [value, value, value]);
}

function brightDaylightFrame(): SampledPixelFrame {
  return frameFromPixel((x, y) => {
    const red = 100 + ((x * 37 + y * 61 + x * y * 13) % 156);
    const green = 100 + ((x * 53 + y * 29 + x * y * 17) % 156);
    const blue = 100 + ((x * 19 + y * 47 + x * y * 23) % 156);
    return [red, green, blue];
  });
}

function shifted(source: SampledPixelFrame, dx: number, dy: number): SampledPixelFrame {
  return frameFromPixel((x, y) => {
    const sourceX = x - dx;
    const sourceY = y - dy;
    if (sourceX < 0 || sourceX >= source.width || sourceY < 0 || sourceY >= source.height) {
      return [0, 0, 0];
    }
    const offset = (sourceY * source.width + sourceX) * 4;
    return [source.rgba[offset], source.rgba[offset + 1], source.rgba[offset + 2]];
  }, source.width, source.height);
}

function dimmed(source: SampledPixelFrame, factor: number): SampledPixelFrame {
  const rgba = new Uint8ClampedArray(source.rgba);
  for (let offset = 0; offset < rgba.length; offset += 4) {
    rgba[offset] = Math.round(rgba[offset] * factor);
    rgba[offset + 1] = Math.round(rgba[offset + 1] * factor);
    rgba[offset + 2] = Math.round(rgba[offset + 2] * factor);
  }
  return { width: source.width, height: source.height, rgba };
}

function localAction(source: SampledPixelFrame, phase: number): SampledPixelFrame {
  return frameFromPixel((x, y) => {
    const offset = (y * source.width + x) * 4;
    const base = source.rgba[offset];
    const active = (x + y + phase) % 3 !== 0;
    const delta = active ? (phase % 2 === 0 ? 70 : -70) : 0;
    const value = Math.max(0, Math.min(255, base + delta));
    return [value, value, value];
  }, source.width, source.height);
}

function paintNormalizedRegion(
  frame: SampledPixelFrame,
  regionId: string,
  pixel: (x: number, y: number) => readonly [number, number, number],
): void {
  const region = minecraftJavaGameProfile.regions.find((candidate) => candidate.regionId === regionId);
  if (region === undefined) throw new Error(`Unknown fixture region ${regionId}`);
  const left = Math.floor(region.x * frame.width);
  const top = Math.floor(region.y * frame.height);
  const right = Math.min(frame.width, Math.ceil((region.x + region.width) * frame.width));
  const bottom = Math.min(frame.height, Math.ceil((region.y + region.height) * frame.height));
  for (let y = top; y < bottom; y += 1) {
    for (let x = left; x < right; x += 1) {
      const offset = (y * frame.width + x) * 4;
      const [red, green, blue] = pixel(x - left, y - top);
      frame.rgba[offset] = red;
      frame.rgba[offset + 1] = green;
      frame.rgba[offset + 2] = blue;
      frame.rgba[offset + 3] = 255;
    }
  }
}

function paintNormalizedBox(
  frame: SampledPixelFrame,
  box: { readonly x: number; readonly y: number; readonly width: number; readonly height: number },
  pixel: (x: number, y: number) => readonly [number, number, number],
): void {
  const left = Math.floor(box.x * frame.width);
  const top = Math.floor(box.y * frame.height);
  const right = Math.min(frame.width, Math.ceil((box.x + box.width) * frame.width));
  const bottom = Math.min(frame.height, Math.ceil((box.y + box.height) * frame.height));
  for (let y = top; y < bottom; y += 1) {
    for (let x = left; x < right; x += 1) {
      const offset = (y * frame.width + x) * 4;
      const [red, green, blue] = pixel(x - left, y - top);
      frame.rgba[offset] = red;
      frame.rgba[offset + 1] = green;
      frame.rgba[offset + 2] = blue;
      frame.rgba[offset + 3] = 255;
    }
  }
}

function minecraftHudFrame(input: {
  readonly health?: number;
  readonly hunger?: number;
  readonly armor?: number;
  readonly air?: number;
  readonly selectedBlock?: boolean;
  readonly center?: number;
  readonly bottom?: number;
  readonly healthWidth?: number;
  readonly width?: number;
  readonly height?: number;
  readonly healthAspectDivisor?: number;
  readonly hotbarWidthMultiplier?: number;
  readonly hotbarAspectDivisor?: number;
  readonly healthPalette?: "red" | "poisoned" | "frozen" | "absorbing";
  readonly hotbar?: boolean;
  readonly brightness?: number;
} = {}): SampledPixelFrame {
  const frame = frameFromPixel((x, y) => {
    const value = Math.max(0, Math.min(237, (input.brightness ?? 28) + ((x * 7 + y * 11) % 18)));
    return [value, value + 4, value + 2];
  }, input.width ?? 320, input.height ?? 180);
  const health = input.health ?? 10;
  const hunger = input.hunger ?? 10;
  const armor = input.armor ?? 0;
  const air = input.air;
  const center = input.center ?? 0.5;
  const bottom = input.bottom ?? 0.98;
  const healthWidth = input.healthWidth ?? 0.15;
  const aspectRatio = frame.width / frame.height;
  const healthHeight = healthWidth * aspectRatio / (input.healthAspectDivisor ?? 7.8);
  const hotbarWidth = healthWidth * (input.hotbarWidthMultiplier ?? 2.25);
  const hotbarHeight = hotbarWidth * aspectRatio / (input.hotbarAspectDivisor ?? 8.5);
  const hotbarX = center - hotbarWidth / 2;
  const hotbarY = bottom - hotbarHeight;
  const vitalsY = hotbarY - healthHeight * 1.18;
  const armorY = vitalsY - healthHeight * 1.05;
  const slotWidth = healthWidth / 10;
  const healthFillColors: Record<
    NonNullable<typeof input.healthPalette>,
    readonly [number, number, number]
  > = {
    red: [225, 28, 32],
    poisoned: [70, 190, 58],
    frozen: [52, 126, 225],
    absorbing: [232, 174, 42],
  };
  const healthFillColor = healthFillColors[input.healthPalette ?? "red"];

  for (let slot = 0; slot < 10; slot += 1) {
    const healthFill = Math.max(0, Math.min(1, health - slot));
    paintNormalizedBox(frame, {
      x: hotbarX + slot * slotWidth,
      y: vitalsY,
      width: slotWidth,
      height: healthHeight,
    }, (x, y) => {
      const edge = x === 0 || y === 0 || y >= Math.max(1, Math.round(healthHeight * frame.height) - 2);
      if (edge) return [210, 210, 210];
      const localWidth = Math.max(1, Math.round(slotWidth * frame.width));
      return x / localWidth < healthFill ? healthFillColor : [24, 8, 8];
    });
    // Minecraft depletes hunger from the left, so the remaining drumsticks
    // form a filled suffix on screen (the inverse direction from health).
    const hungerFill = Math.max(0, Math.min(1, hunger - (9 - slot)));
    paintNormalizedBox(frame, {
      x: hotbarX + hotbarWidth - healthWidth + slot * slotWidth,
      y: vitalsY,
      width: slotWidth,
      height: healthHeight,
    }, (x, y) => {
      const edge = x === 0 || y === 0 || y >= Math.max(1, Math.round(healthHeight * frame.height) - 2);
      if (edge) return [205, 205, 205];
      const localWidth = Math.max(1, Math.round(slotWidth * frame.width));
      return x / localWidth < hungerFill ? [188, 102, 24] : [36, 18, 6];
    });
    const armorFill = Math.max(0, Math.min(1, armor - slot));
    if (armorFill > 0) {
      paintNormalizedBox(frame, {
        x: hotbarX + slot * slotWidth,
        y: armorY,
        width: slotWidth,
        height: healthHeight,
      }, (x, y) => {
        const localWidth = Math.max(1, Math.round(slotWidth * frame.width));
        if (x === 0 || y === 0 || y >= Math.max(1, Math.round(healthHeight * frame.height) - 2)) {
          return [78, 82, 86];
        }
        return x / localWidth < armorFill ? [202, 208, 214] : [34, 36, 38];
      });
    }
    if (air !== undefined) {
      const airFill = Math.max(0, Math.min(1, air - slot));
      paintNormalizedBox(frame, {
        x: hotbarX + hotbarWidth - healthWidth + slot * slotWidth,
        y: armorY,
        width: slotWidth,
        height: healthHeight,
      }, (x, y) => {
        const edge = x === 0 || y === 0 || y >= Math.max(1, Math.round(healthHeight * frame.height) - 2);
        if (edge) return [210, 225, 235];
        const localWidth = Math.max(1, Math.round(slotWidth * frame.width));
        return x / localWidth < airFill ? [48, 146, 226] : [28, 42, 54];
      });
    }
  }

  if (input.hotbar !== false) {
    const hotbarSlotWidth = hotbarWidth / 9;
    for (let slot = 0; slot < 9; slot += 1) {
      paintNormalizedBox(frame, {
        x: hotbarX + slot * hotbarSlotWidth,
        y: hotbarY,
        width: hotbarSlotWidth,
        height: hotbarHeight,
      }, (x, y) => {
        const pixelWidth = Math.max(2, Math.round(hotbarSlotWidth * frame.width));
        const pixelHeight = Math.max(2, Math.round(hotbarHeight * frame.height));
        const border = x <= 1 || y <= 1 || x >= pixelWidth - 2 || y >= pixelHeight - 2;
        if (border) return slot === 0 && input.selectedBlock === true ? [248, 248, 248] : [120, 120, 120];
        if (slot === 0 && input.selectedBlock === true) {
          return (x + y) % 2 === 0 ? [210, 210, 205] : [8, 8, 8];
        }
        return [22, 22, 22];
      });
    }
  } else {
    paintNormalizedBox(frame, {
      x: hotbarX,
      y: hotbarY,
      width: hotbarWidth,
      height: hotbarHeight,
    }, () => [30, 30, 30]);
  }
  paintNormalizedBox(frame, { x: 0.492, y: 0.485, width: 0.016, height: 0.03 }, (x, y) =>
    x === 1 || y === 2 ? [240, 240, 240] : [25, 25, 25]);
  return frame;
}

function vanillaLikeMinecraftFrame(): SampledPixelFrame {
  return minecraftHudFrame();
}

function lowerHealthMinecraftFrame(): SampledPixelFrame {
  return minecraftHudFrame({ health: 5 });
}

function armoredSelectedBlockMinecraftFrame(): SampledPixelFrame {
  return minecraftHudFrame({ armor: 8, selectedBlock: true });
}

function submergedMinecraftFrame(): SampledPixelFrame {
  return minecraftHudFrame({ air: 7 });
}

function containerMinecraftFrame(): SampledPixelFrame {
  const frame = minecraftHudFrame();
  paintNormalizedBox(frame, { x: 0.24, y: 0.16, width: 0.52, height: 0.58 }, (x, y) => {
    if (x % 6 === 0 || y % 6 === 0) return [232, 232, 232];
    return (x + y) % 2 === 0 ? [165, 165, 165] : [95, 95, 95];
  });
  return frame;
}

function sleepingMinecraftFrame(): SampledPixelFrame {
  const frame = frameFromPixel((x, y) => {
    const value = (x + y) % 11 === 0 ? 35 : 8;
    return [value, value, value];
  });
  paintNormalizedBox(frame, { x: 0.24, y: 0.72, width: 0.52, height: 0.12 }, (x, y) => {
    if (y < 2 || y > 4 || x % 9 === 0) return [220, 220, 220];
    return [55, 55, 55];
  });
  return frame;
}

function pauseMinecraftFrame(input: { readonly health?: number; readonly hunger?: number } = {}): SampledPixelFrame {
  const frame = minecraftHudFrame({
    width: 640,
    height: 360,
    healthWidth: 0.15625,
    health: input.health ?? 10,
    hunger: input.hunger ?? 9,
    armor: 7.5,
  });
  for (let offset = 0; offset < frame.rgba.length; offset += 4) {
    frame.rgba[offset] = Math.round(frame.rgba[offset] * 0.58);
    frame.rgba[offset + 1] = Math.round(frame.rgba[offset + 1] * 0.58);
    frame.rgba[offset + 2] = Math.round(frame.rgba[offset + 2] * 0.58);
  }
  for (const y of [0.2, 0.34, 0.48]) {
    paintNormalizedBox(frame, { x: 0.24, y, width: 0.52, height: 0.075 }, (x, row) =>
      x <= 2 || row <= 2 ? [205, 205, 205] : [82, 82, 82]);
  }
  return frame;
}

function shiftedMinecraftLikeFrame(): SampledPixelFrame {
  return minecraftHudFrame({ center: 0.42, bottom: 0.87, healthWidth: 0.12 });
}

function histories(frames: readonly SampledPixelFrame[]): TimedSpatialMotion[] {
  return frames.slice(1).map((frame, index) => ({
    observedAt: 1_000 + index * 200,
    measurement: measureSpatialMotion(frames[index], frame),
  }));
}

function observation(
  sequence: number,
  capturedAt: number,
  status: GameplayFrameObservation["status"] = "ready",
): GameplayFrameObservation {
  return {
    envelope: {
      contractVersion: CONTRACT_VERSION,
      sessionId: "multigame-session",
      questCycleId: null,
      messageId: `multigame-frame-${sequence}`,
      correlationId: "multigame-correlation",
      revision: 0,
      occurredAt: capturedAt,
      receivedAt: capturedAt,
      source: "test-fixture",
      evidenceClass: "fixture",
    },
    frameId: `multigame-frame-${sequence}`,
    capturedAt,
    width: 1920,
    height: 1080,
    status,
  };
}

function sourceFor(
  entries: readonly { readonly capturedAt: number; readonly status?: GameplayFrameObservation["status"]; readonly pixels: SampledPixelFrame }[],
  released: number[],
): FrameSource {
  return {
    async *frames(): AsyncIterable<EphemeralGameplayFrame> {
      for (const [index, entry] of entries.entries()) {
        yield {
          observation: observation(index, entry.capturedAt, entry.status),
          image: entry.pixels as unknown as CanvasImageSource,
          release: () => {
            released.push(index);
          },
        };
      }
    },
  };
}

describe("game calibration registry", () => {
  it("selects Minecraft explicitly and falls back to universal analysis for unknown games", () => {
    const registry = createDefaultGameProfileRegistry();
    expect(registry.resolve(selection("minecraft"))).toMatchObject({
      match: "game-default",
      profile: { profileId: "minecraft-java-vanilla-v1" },
    });
    expect(registry.resolve(selection("unknown-modded-game"))).toMatchObject({
      match: "generic-fallback",
      profile: { profileId: "generic-action-v1" },
    });
  });

  it("does not activate a game-specific adapter from visual inference or a mismatched profile", () => {
    const registry = createDefaultGameProfileRegistry();
    expect(registry.resolve({
      requestedGameId: "minecraft",
      source: "visual-inference",
      confidence: 1,
    })).toMatchObject({
      match: "identity-unverified",
      identityTrusted: false,
      profile: { profileId: "generic-action-v1" },
    });
    expect(registry.resolve({
      ...selection("minecraft"),
      requestedProfileId: "brawl-stars-standard-v1",
    })).toMatchObject({
      match: "game-default",
      profile: { profileId: "minecraft-java-vanilla-v1" },
    });
  });

  it("rejects duplicate profiles, invalid normalized regions, and generic calibrated claims", () => {
    expect(() => new GameProfileRegistry([genericActionGameProfile, genericActionGameProfile])).toThrow(
      "duplicate game profile",
    );
    expect(() => gameCalibrationProfileSchema.parse({
      ...genericActionGameProfile,
      profileId: "invalid-region",
      regions: [{ regionId: "outside", x: 0.9, y: 0, width: 0.2, height: 1, purpose: "ocr" }],
    })).toThrow();
    expect(() => gameCalibrationProfileSchema.parse({
      ...genericActionGameProfile,
      profileId: "invalid-generic",
      calibratedSignalCandidates: ["health"],
    })).toThrow();
  });
});

describe("spatial and temporal motion analysis", () => {
  it("maps private analyzer states to the stable gameplay-activity vocabulary", () => {
    expect(toGameplayActivity({ status: "known", state: "stable" })).toBe("quiet");
    expect(toGameplayActivity({ status: "known", state: "scene-transition" })).toBe(
      "transition",
    );
    expect(toGameplayActivity({ status: "known", state: "mixed-local-action" })).toBe(
      "active",
    );
    expect(toGameplayActivity({ status: "unknown", state: "unknown" })).toBe("unknown");
  });

  it("estimates coherent global translation and removes it from local residual motion", () => {
    const previous = texturedFrame();
    const measurement = measureSpatialMotion(previous, shifted(previous, 2, 0));
    expect(measurement.translation).toMatchObject({ dx: 2, dy: 0 });
    expect(measurement.translation.confidence).toBeGreaterThan(0.5);
    expect(measurement.globalMotionShare).toBeGreaterThan(0.55);
    expect(measurement.residualChangedPixelRatio).toBeLessThan(measurement.changedPixelRatio);
  });

  it("distinguishes rapid coherent global motion from erratic reversals without naming their cause", () => {
    const base = texturedFrame();
    const rotation = histories([base, shifted(base, 2, 0), shifted(base, 4, 0), shifted(base, 6, 0)]);
    const coherent = interpretMotionWindow(rotation);
    expect(coherent).toMatchObject({
      status: "known",
      state: "rapid-coherent-global-motion",
    });
    expect(JSON.stringify(coherent)).not.toMatch(/camera|rotation|panic|combat/i);

    const erratic = histories([base, shifted(base, 2, 0), base, shifted(base, 2, 0)]);
    expect(interpretMotionWindow(erratic)).toMatchObject({
      status: "known",
      state: "erratic-global-motion",
    });
  });

  it("keeps mixed local action separate from coherent global motion and psychological intent", () => {
    const base = texturedFrame();
    const interpretation = interpretMotionWindow(
      histories([base, localAction(base, 1), localAction(base, 2), localAction(base, 3)]),
    );
    expect(interpretation).toMatchObject({ status: "known", state: "mixed-local-action" });
    expect(JSON.stringify(interpretation)).not.toMatch(/panic|combat/i);
  });

  it("recognizes stable windows and broad scene transitions", () => {
    const base = texturedFrame();
    expect(interpretMotionWindow(histories([base, base, base, base]))).toMatchObject({
      state: "stable",
    });
    const inverted = frameFromPixel((x, y) => {
      const offset = (y * base.width + x) * 4;
      return [255 - base.rgba[offset], 255 - base.rgba[offset + 1], 255 - base.rgba[offset + 2]];
    });
    expect(interpretMotionWindow(histories([base, inverted, inverted, inverted]))).toMatchObject({
      state: "scene-transition",
    });

    const redAtMatchingLuma = frameFromPixel(() => [255, 0, 0]);
    const greenAtMatchingLuma = frameFromPixel(() => [0, 76, 0]);
    const colourTransition = histories([
      redAtMatchingLuma,
      greenAtMatchingLuma,
      greenAtMatchingLuma,
      greenAtMatchingLuma,
    ]);
    expect(colourTransition[0].measurement.changedPixelRatio).toBe(0);
    expect(colourTransition[0].measurement.colorChangedPixelRatio).toBe(1);
    expect(colourTransition[0].measurement.colorHistogramDistance).toBe(1);
    expect(interpretMotionWindow(colourTransition)).toMatchObject({ state: "scene-transition" });
  });

  it("returns unknown until enough recent frame pairs exist", () => {
    const base = texturedFrame();
    expect(interpretMotionWindow(histories([base, shifted(base, 2, 0)]))).toMatchObject({
      status: "unknown",
      state: "unknown",
      sampleCount: 1,
    });
  });
});

describe("Minecraft vanilla and modded HUD capability detection", () => {
  it("enables only the calibrated HUD-layout fact after multiple vanilla anchors agree", () => {
    const fingerprint = fingerprintMinecraftHud(vanillaLikeMinecraftFrame(), minecraftJavaGameProfile);
    expect(fingerprint.status).toBe("vanilla-like");
    expect(fingerprint.detectedAnchors.length).toBeGreaterThanOrEqual(3);
    expect(fingerprint.supportedSignals).toContain("minecraft-hud-layout");
    expect(fingerprint.facts.healthHearts).toMatchObject({ status: "known", value: 10 });
    expect(fingerprint.facts.hungerShanks.status).toBe("known");
    expect(fingerprint.facts.hungerShanks.value).toBeGreaterThanOrEqual(8);
    expect(fingerprint.facts.hotbarVisible).toMatchObject({ status: "known", value: true });
    expect(fingerprint.supportedSignals).not.toContain("player-health");
    expect(fingerprint.supportedSignals).not.toContain("player-hunger");
  });

  it("detects a shifted Minecraft-like HUD through pixel search without vanilla anchors", () => {
    const fingerprint = fingerprintMinecraftHud(shiftedMinecraftLikeFrame(), minecraftJavaGameProfile);
    expect(fingerprint.status).toBe("minecraft-like");
    expect(fingerprint.detectedAnchors).toEqual(
      expect.arrayContaining([
        "minecraft-health-search",
        "minecraft-hunger-search",
        "minecraft-hotbar-search",
      ]),
    );
    expect(fingerprint.facts.healthHearts.status).toBe("known");
    expect(fingerprint.facts.hungerShanks.status).toBe("known");
    expect(fingerprint.facts.hotbarVisible).toMatchObject({ status: "known", value: true });
  });

  it("locates small and large default HUD scales in the retained browser sample", () => {
    const small = fingerprintMinecraftHud(minecraftHudFrame({
      width: 640,
      height: 360,
      healthWidth: 0.075,
      hunger: 7,
    }), minecraftJavaGameProfile);
    const large = fingerprintMinecraftHud(minecraftHudFrame({
      healthWidth: 0.225,
      hunger: 7,
    }), minecraftJavaGameProfile);


    expect(["vanilla-like", "minecraft-like"]).toContain(small.status);
    expect(small.facts.healthHearts).toMatchObject({ status: "known", value: 10 });
    expect(small.facts.hungerShanks).toMatchObject({ status: "known", value: 7 });
    expect(small.facts.hotbarVisible).toMatchObject({ status: "known", value: true });
    expect(["vanilla-like", "minecraft-like"]).toContain(large.status);
    expect(large.facts.healthHearts).toMatchObject({ status: "known", value: 10 });
    expect(large.facts.hungerShanks).toMatchObject({ status: "known", value: 7 });
    expect(large.facts.hotbarVisible).toMatchObject({ status: "known", value: true });
  });

  it("tolerates vanilla-like icon and hotbar geometry that differs from the synthetic search model", () => {
    const fingerprint = fingerprintMinecraftHud(minecraftHudFrame({
      width: 640,
      height: 360,
      healthWidth: 0.095,
      healthAspectDivisor: 10,
      hotbarWidthMultiplier: 2.05,
      hotbarAspectDivisor: 8.25,
    }), minecraftJavaGameProfile);

    expect(["vanilla-like", "minecraft-like"]).toContain(fingerprint.status);
    expect(fingerprint.facts.healthHearts).toMatchObject({ status: "known", value: 10 });
    expect(fingerprint.facts.hungerShanks).toMatchObject({ status: "known", value: 10 });
    expect(fingerprint.facts.hotbarVisible).toMatchObject({ status: "known", value: true });
  });

  it.each(["poisoned", "frozen", "absorbing"] as const)(
    "recognizes the repeated health slots when the HUD uses the %s heart palette",
    (healthPalette) => {
      const fingerprint = fingerprintMinecraftHud(
        minecraftHudFrame({ health: 7, healthPalette }),
        minecraftJavaGameProfile,
      );

      expect(["vanilla-like", "minecraft-like"]).toContain(fingerprint.status);
      expect(fingerprint.facts.healthHearts).toMatchObject({ status: "known", value: 7 });
      expect(fingerprint.facts.hungerShanks).toMatchObject({ status: "known", value: 10 });
    },
  );

  it("detects armor and a selected hotbar category only when visually distinct", () => {
    const plain = fingerprintMinecraftHud(vanillaLikeMinecraftFrame(), minecraftJavaGameProfile);
    expect(plain.facts.armorPoints).toMatchObject({ status: "known", value: 0 });
    expect(plain.facts.selectedHotbarCategory).toMatchObject({ status: "unknown" });

    const fingerprint = fingerprintMinecraftHud(armoredSelectedBlockMinecraftFrame(), minecraftJavaGameProfile);
    expect(["vanilla-like", "minecraft-like"]).toContain(fingerprint.status);
    expect(fingerprint.facts.armorPoints).toMatchObject({ status: "known", value: 8 });
    expect(fingerprint.facts.selectedHotbarCategory).toMatchObject({
      status: "known",
      value: "block",
    });
  });

  it("counts armor on the same ten-icon scale as hearts and hunger", () => {
    const fingerprint = fingerprintMinecraftHud(
      minecraftHudFrame({ armor: 5.5 }),
      minecraftJavaGameProfile,
    );

    expect(["vanilla-like", "minecraft-like"]).toContain(fingerprint.status);
    expect(fingerprint.facts.armorPoints).toMatchObject({ status: "known", value: 5.5 });
  });

  it("reports the maximum vanilla armor row as ten icons", () => {
    const fingerprint = fingerprintMinecraftHud(
      minecraftHudFrame({ armor: 10 }),
      minecraftJavaGameProfile,
    );

    expect(fingerprint.facts.armorPoints).toMatchObject({ status: "known", value: 10 });
  });

  it("keeps health, hunger, and armor aligned at a resampled GUI scale", () => {
    const fingerprint = fingerprintMinecraftHud(
      minecraftHudFrame({
        width: 640,
        height: 360,
        healthWidth: 0.15625,
        health: 10,
        hunger: 9,
        armor: 7.5,
      }),
      minecraftJavaGameProfile,
    );
    expect(fingerprint.facts.healthHearts).toMatchObject({ status: "known", value: 10 });
    expect(fingerprint.facts.hungerShanks).toMatchObject({ status: "known", value: 9 });
    expect(fingerprint.facts.armorPoints).toMatchObject({ status: "known", value: 7.5 });
  });

  it("detects the independent air row without confusing it with hunger or armor", () => {
    const fingerprint = fingerprintMinecraftHud(submergedMinecraftFrame(), minecraftJavaGameProfile);

    expect(["vanilla-like", "minecraft-like"]).toContain(fingerprint.status);
    expect(fingerprint.facts.submerged).toMatchObject({ status: "known", value: true });
    expect(fingerprint.facts.airBubbles).toMatchObject({ status: "known", value: 7 });
    expect(fingerprint.facts.hungerShanks).toMatchObject({ status: "known", value: 10 });
    expect(fingerprint.facts.armorPoints).toMatchObject({ status: "known", value: 0 });
  });

  it("keeps universal signals but withholds calibrated facts for hidden or modified HUDs", () => {
    const hidden = fingerprintMinecraftHud(solidFrame(20), minecraftJavaGameProfile);
    expect(hidden).toMatchObject({ status: "hud-hidden" });
    expect(hidden.supportedSignals).toEqual(minecraftJavaGameProfile.universalSignals);

    const modified = solidFrame(30);
    paintNormalizedRegion(modified, "minecraft-hotbar", (x, y) =>
      (x + y) % 2 === 0 ? [255, 255, 255] : [0, 0, 0]);
    const result = fingerprintMinecraftHud(modified, minecraftJavaGameProfile);
    expect(result.status).toBe("modified-or-unknown");
    expect(result.supportedSignals).not.toContain("minecraft-hud-layout");
  });

  it("does not mistake arbitrary high-detail pixels for a confirmed vanilla HUD", () => {
    const fingerprint = fingerprintMinecraftHud(texturedFrame(), minecraftJavaGameProfile);
    expect(fingerprint.status).not.toBe("vanilla-like");
    expect(fingerprint.supportedSignals).not.toContain("minecraft-hud-layout");
  });

  it("refuses HUD fingerprinting when the retained sample is too small", () => {
    expect(fingerprintMinecraftHud(
      frameFromPixel(() => [0, 0, 0], 32, 18),
      minecraftJavaGameProfile,
    )).toMatchObject({
      status: "insufficient-resolution",
      confidence: 0,
    });
  });
});

describe("adaptive cadence and integrated multi-game analyzer", () => {
  it("enters a bounded burst on a motion spike, then cooldown, and stops when capture is unavailable", () => {
    const base = texturedFrame();
    const spike = measureSpatialMotion(base, localAction(base, 1));
    const burst = decideAdaptiveSampling({
      now: 1_000,
      state: initialAdaptiveSamplingState,
      captureReady: true,
      measurement: spike,
      interpretation: null,
    });
    expect(burst).toMatchObject({ mode: "burst", intervalMs: 100, reason: "motion-spike" });
    const stillBurst = decideAdaptiveSampling({
      now: 2_000,
      state: burst,
      captureReady: true,
      measurement: spike,
      interpretation: null,
    });
    expect(stillBurst.burstUntil).toBeLessThanOrEqual(
      (burst.burstStartedAt ?? 0) + defaultAdaptiveSamplingPolicy.maximumBurstDurationMs,
    );
    const cooldown = decideAdaptiveSampling({
      now: (stillBurst.burstUntil ?? 0) + 1,
      state: stillBurst,
      captureReady: true,
      measurement: null,
      interpretation: null,
    });
    expect(cooldown).toMatchObject({ mode: "baseline", reason: "burst-cooldown" });
    expect(decideAdaptiveSampling({
      now: 10_000,
      state: cooldown,
      captureReady: false,
      measurement: null,
      interpretation: null,
    })).toMatchObject({ mode: "unavailable", intervalMs: null });
  });

  it("resets temporal evidence when the game profile changes and degrades unknown games safely", () => {
    const analyzer = new MultiGameVisionAnalyzer();
    const base = texturedFrame();
    analyzer.analyse({ frame: base, observedAt: 1_000, selection: selection("minecraft") });
    analyzer.analyse({ frame: shifted(base, 2, 0), observedAt: 1_200, selection: selection("minecraft") });
    const changed = analyzer.analyse({
      frame: base,
      observedAt: 1_400,
      selection: selection("unsupported-modded-game"),
    });
    expect(changed).toMatchObject({
      profileMatch: "generic-fallback",
      supportTier: "universal-visual",
      motion: null,
      interpretation: { status: "unknown", sampleCount: 0 },
    });
  });

  it("advertises calibrated Minecraft support only when the fingerprint is recognized", () => {
    const recognizedAnalyzer = new MultiGameVisionAnalyzer();
    const candidate = recognizedAnalyzer.analyse({
      frame: vanillaLikeMinecraftFrame(),
      observedAt: 1_000,
      selection: selection("minecraft"),
    });
    expect(candidate.supportTier).toBe("universal-visual");
    expect(candidate.minecraftHud?.status).toBe("candidate-unconfirmed");
    const recognized = recognizedAnalyzer.analyse({
      frame: vanillaLikeMinecraftFrame(),
      observedAt: 1_200,
      selection: selection("minecraft"),
    });
    expect(recognized.supportTier).toBe("calibrated-hud");
    expect(recognized.supportedSignals).toContain("minecraft-hud-layout");
    expect(recognized.motion).toBeNull();

    const modded = new MultiGameVisionAnalyzer().analyse({
      frame: solidFrame(20),
      observedAt: 1_000,
      selection: selection("minecraft"),
    });
    expect(modded.supportTier).toBe("universal-visual");
    expect(modded.minecraftHud?.status).toBe("hud-hidden");
  });

  it("never activates Minecraft calibration from a visual-only game guess", () => {
    const analyzer = new MultiGameVisionAnalyzer();
    const guessed = analyzer.analyse({
      frame: vanillaLikeMinecraftFrame(),
      observedAt: 1_000,
      selection: {
        requestedGameId: "minecraft",
        source: "visual-inference",
        confidence: 1,
      },
    });
    expect(guessed).toMatchObject({
      profileMatch: "identity-unverified",
      supportTier: "universal-visual",
      minecraftHud: null,
    });
  });

  it("keeps universal motion meaning invariant across generic and calibrated profiles", () => {
    const genericAnalyzer = new MultiGameVisionAnalyzer();
    const minecraftAnalyzer = new MultiGameVisionAnalyzer();
    const base = texturedFrame();
    const frames = [base, shifted(base, 2, 0), shifted(base, 4, 0), shifted(base, 6, 0)];
    let genericState = "unknown";
    let minecraftState = "unknown";
    frames.forEach((frame, index) => {
      genericState = genericAnalyzer.analyse({
        frame,
        observedAt: 1_000 + index * 200,
        selection: selection(null),
      }).interpretation.state;
      minecraftState = minecraftAnalyzer.analyse({
        frame,
        observedAt: 1_000 + index * 200,
        selection: selection("minecraft"),
      }).interpretation.state;
    });
    expect(genericState).toBe("rapid-coherent-global-motion");
    expect(minecraftState).toBe(genericState);
  });

  it("rejects out-of-order frames and clears retained bounded state on reset", () => {
    const analyzer = new MultiGameVisionAnalyzer();
    const base = texturedFrame();
    analyzer.analyse({ frame: base, observedAt: 1_000, selection: selection(null) });
    expect(() => analyzer.analyse({
      frame: base,
      observedAt: 1_000,
      selection: selection(null),
    })).toThrow("strictly increasing");
    analyzer.reset();
    expect(analyzer.analyse({
      frame: base,
      observedAt: 1_000,
      selection: selection(null),
    }).motion).toBeNull();
  });

  it("connects the canonical FrameSource, skips baseline frames before pixel sampling, and always releases", async () => {
    const released: number[] = [];
    let samples = 0;
    const base = texturedFrame();
    const source = sourceFor([
      { capturedAt: 1_000, pixels: base },
      { capturedAt: 1_100, pixels: shifted(base, 1, 0) },
      { capturedAt: 1_200, pixels: shifted(base, 2, 0) },
      { capturedAt: 1_500, pixels: shifted(base, 3, 0) },
    ], released);
    const outputs = [];
    for await (const output of streamMultiGameVisionAssessments(source, {
      sampler: {
        sample(image) {
          samples += 1;
          return image as unknown as SampledPixelFrame;
        },
      },
      sampleWidth: WIDTH,
      sampleHeight: HEIGHT,
      selection: selection(null),
    })) {
      outputs.push(output);
    }
    expect(outputs).toHaveLength(2);
    expect(samples).toBe(2);
    expect(released).toEqual([0, 1, 2, 3]);
  });

  it("emits capture loss without sampling pixels and resets temporal state", async () => {
    const released: number[] = [];
    let samples = 0;
    const outputs = [];
    for await (const output of streamMultiGameVisionAssessments(sourceFor([
      { capturedAt: 1_000, pixels: texturedFrame(), status: "permission-denied" },
    ], released), {
      sampler: {
        sample() {
          samples += 1;
          return texturedFrame();
        },
      },
      sampleWidth: WIDTH,
      sampleHeight: HEIGHT,
      selection: selection("minecraft"),
    })) {
      outputs.push(output);
    }
    expect(outputs).toEqual([
      expect.objectContaining({ status: "capture-unavailable", reason: "permission-denied" }),
    ]);
    expect(samples).toBe(0);
    expect(released).toEqual([0]);
  });

  it("resumes analysis immediately after capture loss even when the prior cadence would skip", async () => {
    const released: number[] = [];
    let samples = 0;
    const outputs = [];
    for await (const output of streamMultiGameVisionAssessments(sourceFor([
      { capturedAt: 1_000, pixels: texturedFrame() },
      { capturedAt: 1_100, pixels: texturedFrame(), status: "unavailable" },
      { capturedAt: 1_200, pixels: texturedFrame() },
    ], released), {
      sampler: {
        sample(image) {
          samples += 1;
          return image as unknown as SampledPixelFrame;
        },
      },
      sampleWidth: WIDTH,
      sampleHeight: HEIGHT,
      selection: selection(null),
    })) {
      outputs.push(output);
    }
    expect(outputs.map(({ status }) => status)).toEqual(["ready", "capture-unavailable", "ready"]);
    expect(samples).toBe(2);
    expect(released).toEqual([0, 1, 2]);
  });

  it("releases a canonical frame when pixel sampling fails", async () => {
    const released: number[] = [];
    const collect = async () => {
      for await (const output of streamMultiGameVisionAssessments(sourceFor([
        { capturedAt: 1_000, pixels: texturedFrame() },
      ], released), {
        sampler: {
          sample() {
            throw new Error("fixture sampler failure");
          },
        },
        sampleWidth: WIDTH,
        sampleHeight: HEIGHT,
        selection: selection(null),
      })) {
        void output;
      }
    };
    await expect(collect()).rejects.toThrow("fixture sampler failure");
    expect(released).toEqual([0]);
  });

  it("rejects retained samples above the bounded privacy and processing limit", () => {
    const analyzer = new MultiGameVisionAnalyzer();
    expect(() => analyzer.analyse({
      frame: frameFromPixel(() => [0, 0, 0], 640, 480),
      observedAt: 1_000,
      selection: selection(null),
    })).toThrow("must not exceed 262144 sampled pixels");
  });
});

describe("canonical multi-game snapshot projection", () => {
  it("publishes measured activity after the second frame while inferred state stays unknown", () => {
    const analyzer = new MultiGameVisionAnalyzer();
    const firstAssessment = analyzer.analyse({
      frame: texturedFrame(),
      observedAt: 1_000,
      selection: selection("minecraft"),
    });
    const firstSnapshot = buildMultiGameGameplaySnapshot({
      frame: observation(30, 1_000),
      assessment: firstAssessment,
    });
    expect(firstSnapshot.signals.find(({ signalId }) => signalId === "game-vision-activity")?.observation)
      .toMatchObject({ status: "unknown" });

    const secondAssessment = analyzer.analyse({
      frame: shifted(texturedFrame(), 2, 0),
      observedAt: 1_200,
      selection: selection("minecraft"),
    });
    expect(secondAssessment.interpretation).toMatchObject({ status: "unknown" });
    const secondSnapshot = buildMultiGameGameplaySnapshot({
      frame: observation(31, 1_200),
      assessment: secondAssessment,
    });

    expect(secondSnapshot.signals.find(({ signalId }) => signalId === "game-vision-activity")?.observation)
      .toMatchObject({
        status: "known",
        value: secondAssessment.motion?.changedPixelRatio,
        provenance: { confidence: 0.75 },
      });
    expect(secondSnapshot.signals.find(({ signalId }) => signalId === "game-vision-state")?.observation)
      .toMatchObject({ status: "unknown" });
    expect(secondSnapshot.signals.find(({ signalId }) => signalId === "minecraft-hud-layout")?.observation)
      .toMatchObject({ status: "unknown" });
  });

  it("keeps an unconfirmed Minecraft fingerprint universal and unknown", () => {
    const analyzer = new MultiGameVisionAnalyzer();
    const assessment = analyzer.analyse({
      frame: vanillaLikeMinecraftFrame(),
      observedAt: 1_000,
      selection: selection("minecraft"),
    });
    const snapshot = buildMultiGameGameplaySnapshot({
      frame: observation(1, 1_000),
      assessment,
    });
    expect(snapshot.capabilities).toMatchObject({
      tier: "universal-visual",
      gameId: "minecraft",
      adapterId: null,
    });
    expect(snapshot.capabilities.supportedSignals).not.toContain("minecraft-hud-layout");
    expect(snapshot.signals.find(({ signalId }) => signalId === "minecraft-hud-layout")?.observation)
      .toMatchObject({ status: "unknown" });
  });

  it("upgrades confirmed Minecraft HUD facts after temporal agreement", () => {
    const analyzer = new MultiGameVisionAnalyzer();
    analyzer.analyse({
      frame: vanillaLikeMinecraftFrame(),
      observedAt: 1_000,
      selection: selection("minecraft"),
    });
    const assessment = analyzer.analyse({
      frame: vanillaLikeMinecraftFrame(),
      observedAt: 1_200,
      selection: selection("minecraft"),
    });
    const snapshot = buildMultiGameGameplaySnapshot({
      frame: observation(2, 1_200),
      assessment,
    });
    expect(snapshot.capabilities).toMatchObject({
      tier: "calibrated-hud",
      adapterId: "minecraft-java-vanilla-v1",
    });
    expect(snapshot.capabilities.supportedSignals).toContain("minecraft-hud-layout");
    expect(snapshot.capabilities.supportedSignals).toContain("minecraft-health-hearts");
    expect(snapshot.capabilities.supportedSignals).toContain("minecraft-hunger-shanks");
    expect(snapshot.capabilities.supportedSignals).toContain("minecraft-hotbar-visible");
    expect(snapshot.capabilities.supportedSignals).not.toContain("player-health");
    expect(snapshot.signals.find(({ signalId }) => signalId === "minecraft-hud-layout")?.observation)
      .toMatchObject({ status: "known", value: "vanilla-like" });
    expect(snapshot.signals.find(({ signalId }) => signalId === "minecraft-health-hearts")?.observation)
      .toMatchObject({ status: "known", value: 10 });
    expect(snapshot.signals.find(({ signalId }) => signalId === "minecraft-menu-state")?.observation)
      .toMatchObject({ status: "unknown" });
  });

  it("publishes ten hearts and ten hunger icons after paired colour confirmation without a hotbar", () => {
    const analyzer = new MultiGameVisionAnalyzer();
    analyzer.analyse({
      frame: minecraftHudFrame({ hotbar: false }),
      observedAt: 1_000,
      selection: selection("minecraft"),
    });
    const assessment = analyzer.analyse({
      frame: minecraftHudFrame({ hotbar: false }),
      observedAt: 1_200,
      selection: selection("minecraft"),
    });
    const snapshot = buildMultiGameGameplaySnapshot({
      frame: observation(32, 1_200),
      assessment,
    });

    expect(snapshot.capabilities.supportedSignals).toContain("minecraft-health-hearts");
    expect(snapshot.capabilities.supportedSignals).toContain("minecraft-hunger-shanks");
    expect(snapshot.signals.find(({ signalId }) => signalId === "minecraft-health-hearts")?.observation)
      .toMatchObject({ status: "known", value: 10 });
    expect(snapshot.signals.find(({ signalId }) => signalId === "minecraft-hunger-shanks")?.observation)
      .toMatchObject({ status: "known", value: 10 });
  });

  it("projects a temporally confirmed Minecraft day/night signal", () => {
    const analyzer = new MultiGameVisionAnalyzer();
    for (const observedAt of [1_000, 2_000]) {
      analyzer.analyse({
        frame: brightDaylightFrame(),
        observedAt,
        selection: selection("minecraft"),
      });
    }
    const assessment = analyzer.analyse({
      frame: brightDaylightFrame(),
      observedAt: 3_000,
      selection: selection("minecraft"),
    });
    const snapshot = buildMultiGameGameplaySnapshot({
      frame: observation(33, 3_000),
      assessment,
    });
    expect(snapshot.capabilities.supportedSignals).toContain("minecraft-day-night");
    expect(snapshot.signals.find(({ signalId }) => signalId === "minecraft-day-night")?.observation)
      .toMatchObject({ status: "known", value: "day" });
  });

  it("projects supported Minecraft scene classifications through the snapshot confidence gate", () => {
    const assessment = new MultiGameVisionAnalyzer().analyse({
      frame: frameFromPixel(() => [55, 150, 45]),
      observedAt: 1_000,
      selection: selection("minecraft"),
    });
    const snapshot = buildMultiGameGameplaySnapshot({
      frame: observation(34, 1_000),
      assessment,
    });

    expect(snapshot.capabilities.supportedSignals).toContain("minecraft-environment");
    expect(snapshot.signals.find(({ signalId }) => signalId === "minecraft-environment")?.observation)
      .toMatchObject({ status: "known", value: "field" });
  });

  it("projects confirmed Minecraft armor and selected hotbar category after temporal agreement", () => {
    const analyzer = new MultiGameVisionAnalyzer();
    analyzer.analyse({
      frame: armoredSelectedBlockMinecraftFrame(),
      observedAt: 1_000,
      selection: selection("minecraft"),
    });
    const assessment = analyzer.analyse({
      frame: armoredSelectedBlockMinecraftFrame(),
      observedAt: 1_200,
      selection: selection("minecraft"),
    });
    const snapshot = buildMultiGameGameplaySnapshot({
      frame: observation(22, 1_200),
      assessment,
    });
    expect(snapshot.capabilities.supportedSignals).toContain("minecraft-armor-points");
    expect(snapshot.capabilities.supportedSignals).toContain("minecraft-selected-hotbar-category");
    expect(snapshot.signals.find(({ signalId }) => signalId === "minecraft-armor-points")?.observation)
      .toMatchObject({ status: "known", value: 8 });
    expect(snapshot.signals.find(({ signalId }) => signalId === "minecraft-selected-hotbar-category")?.observation)
      .toMatchObject({ status: "known", value: "block" });
  });

  it("requires a repeated lower-health observation before detecting damage", () => {
    const analyzer = new MultiGameVisionAnalyzer();
    analyzer.analyse({
      frame: vanillaLikeMinecraftFrame(),
      observedAt: 1_000,
      selection: selection("minecraft"),
    });
    analyzer.analyse({
      frame: vanillaLikeMinecraftFrame(),
      observedAt: 1_200,
      selection: selection("minecraft"),
    });
    const oneFrameChange = analyzer.analyse({
      frame: lowerHealthMinecraftFrame(),
      observedAt: 1_400,
      selection: selection("minecraft"),
    });
    const oneFrameSnapshot = buildMultiGameGameplaySnapshot({
      frame: observation(5, 1_400),
      assessment: oneFrameChange,
    });
    expect(oneFrameSnapshot.capabilities.supportedSignals).toContain("minecraft-health-hearts");
    expect(oneFrameSnapshot.capabilities.supportedSignals).not.toContain("minecraft-recent-damage");
    expect(oneFrameSnapshot.signals.find(({ signalId }) => signalId === "minecraft-health-hearts")?.observation)
      .toMatchObject({ status: "known", value: 10 });

    const assessment = analyzer.analyse({
      frame: lowerHealthMinecraftFrame(),
      observedAt: 1_600,
      selection: selection("minecraft"),
    });
    const snapshot = buildMultiGameGameplaySnapshot({
      frame: observation(6, 1_600),
      assessment,
    });

    expect(snapshot.capabilities.supportedSignals).toContain("minecraft-recent-damage");
    expect(snapshot.capabilities.supportedSignals).not.toContain("minecraft-likely-damage-cause");
    expect(snapshot.signals.find(({ signalId }) => signalId === "minecraft-recent-damage")?.observation)
      .toMatchObject({ status: "known", value: true });
    expect(snapshot.signals.find(({ signalId }) => signalId === "minecraft-health-trend")?.observation)
      .toMatchObject({ status: "known", value: "taking-damage" });
    expect(snapshot.signals.find(({ signalId }) => signalId === "minecraft-danger")?.observation)
      .toMatchObject({ status: "unknown" });
    expect(snapshot.signals.find(({ signalId }) => signalId === "minecraft-likely-damage-cause")?.observation)
      .toMatchObject({ status: "unknown" });
  });

  it("projects Minecraft sleep menu state even when the HUD is hidden", () => {
    const assessment = new MultiGameVisionAnalyzer().analyse({
      frame: sleepingMinecraftFrame(),
      observedAt: 1_000,
      selection: selection("minecraft"),
    });
    const snapshot = buildMultiGameGameplaySnapshot({
      frame: observation(6, 1_000),
      assessment,
    });

    expect(snapshot.capabilities.supportedSignals).toContain("minecraft-menu-state");
    expect(snapshot.capabilities.supportedSignals).toContain("minecraft-activity");
    expect(snapshot.capabilities.supportedSignals).toContain("minecraft-screen");
    expect(snapshot.capabilities.supportedSignals).toContain("minecraft-life");
    expect(snapshot.capabilities.supportedSignals).not.toContain("minecraft-hud-layout");
    expect(snapshot.signals.find(({ signalId }) => signalId === "minecraft-menu-state")?.observation)
      .toMatchObject({ status: "known", value: "sleeping" });
    expect(snapshot.signals.find(({ signalId }) => signalId === "minecraft-activity")?.observation)
      .toMatchObject({ status: "known", value: "sleeping" });
    expect(snapshot.signals.find(({ signalId }) => signalId === "minecraft-screen")?.observation)
      .toMatchObject({ status: "known", value: "sleeping" });
    expect(snapshot.signals.find(({ signalId }) => signalId === "minecraft-life")?.observation)
      .toMatchObject({ status: "known", value: "alive" });
  });

  it("gates newly parsed HUD values while a Minecraft container is open", () => {
    const analyzer = new MultiGameVisionAnalyzer();
    analyzer.analyse({
      frame: containerMinecraftFrame(),
      observedAt: 1_000,
      selection: selection("minecraft"),
    });
    const assessment = analyzer.analyse({
      frame: containerMinecraftFrame(),
      observedAt: 1_200,
      selection: selection("minecraft"),
    });
    const snapshot = buildMultiGameGameplaySnapshot({
      frame: observation(30, 1_200),
      assessment,
    });

    expect(snapshot.signals.find(({ signalId }) => signalId === "minecraft-menu-state")?.observation)
      .toMatchObject({ status: "known", value: "container" });
    expect(snapshot.signals.find(({ signalId }) => signalId === "minecraft-health-hearts")?.observation)
      .toMatchObject({ status: "unknown" });
    expect(snapshot.signals.find(({ signalId }) => signalId === "minecraft-recent-damage")?.observation)
      .toMatchObject({ status: "unknown" });
  });

  it("holds the last gameplay HUD while pause is open and reacquires after resume", () => {
    const analyzer = new MultiGameVisionAnalyzer();
    const gameplay = minecraftHudFrame({
      width: 640,
      height: 360,
      healthWidth: 0.15625,
      health: 10,
      hunger: 9,
      armor: 7.5,
    });
    analyzer.analyse({ frame: gameplay, observedAt: 1_000, selection: selection("minecraft") });
    analyzer.analyse({ frame: gameplay, observedAt: 1_200, selection: selection("minecraft") });

    const pausedAssessment = analyzer.analyse({
      frame: pauseMinecraftFrame({ health: 9, hunger: 8 }),
      observedAt: 1_400,
      selection: selection("minecraft"),
    });
    const pausedSnapshot = buildMultiGameGameplaySnapshot({
      frame: observation(31, 1_400),
      assessment: pausedAssessment,
    });
    expect(pausedSnapshot.signals.find(({ signalId }) => signalId === "minecraft-screen")?.observation)
      .toMatchObject({ status: "known", value: "pause" });
    expect(pausedSnapshot.signals.find(({ signalId }) => signalId === "minecraft-health-hearts")?.observation)
      .toMatchObject({ status: "known", value: 10 });
    expect(pausedSnapshot.signals.find(({ signalId }) => signalId === "minecraft-hunger-shanks")?.observation)
      .toMatchObject({ status: "known", value: 9 });

    const resumedAssessment = analyzer.analyse({
      frame: gameplay,
      observedAt: 1_800,
      selection: selection("minecraft"),
    });
    expect(resumedAssessment.minecraftBasicStateFacts?.screen)
      .toMatchObject({ status: "known", value: "gameplay" });
  });

  it("expires a disappeared menu instead of suppressing every detector indefinitely", () => {
    const analyzer = new MultiGameVisionAnalyzer();
    analyzer.analyse({
      frame: pauseMinecraftFrame(),
      observedAt: 1_000,
      selection: selection("minecraft"),
    });

    const ambiguous = frameFromPixel(() => [45, 45, 45], 640, 360);
    analyzer.analyse({ frame: ambiguous, observedAt: 1_500, selection: selection("minecraft") });
    const expired = analyzer.analyse({
      frame: ambiguous,
      observedAt: 2_100,
      selection: selection("minecraft"),
    });

    expect(expired.minecraftBasicStateFacts?.screen)
      .not.toMatchObject({ status: "known", value: "pause" });
  });

  it("does not suppress the HUD when the gameplay view merely becomes darker", () => {
    const analyzer = new MultiGameVisionAnalyzer();
    const gameplay = minecraftHudFrame({
      width: 640,
      height: 360,
      healthWidth: 0.15625,
      health: 10,
      hunger: 9,
      armor: 7.5,
      brightness: 110,
    });
    analyzer.analyse({ frame: gameplay, observedAt: 1_000, selection: selection("minecraft") });
    analyzer.analyse({ frame: gameplay, observedAt: 1_200, selection: selection("minecraft") });

    const darkerAssessment = analyzer.analyse({
      frame: dimmed(gameplay, 0.62),
      observedAt: 1_400,
      selection: selection("minecraft"),
    });
    const darkerSnapshot = buildMultiGameGameplaySnapshot({
      frame: observation(35, 1_400),
      assessment: darkerAssessment,
    });

    expect(darkerAssessment.minecraftBasicStateFacts?.screen)
      .not.toMatchObject({ status: "known", value: "pause" });
    expect(darkerSnapshot.signals.find(({ signalId }) => signalId === "minecraft-health-hearts")?.observation)
      .toMatchObject({ status: "known", value: 10 });
    expect(darkerSnapshot.signals.find(({ signalId }) => signalId === "minecraft-hunger-shanks")?.observation)
      .toMatchObject({ status: "known", value: 9 });
  });

  it("does not place Minecraft signals in a generic-game snapshot", () => {
    const analyzer = new MultiGameVisionAnalyzer();
    const assessment = analyzer.analyse({
      frame: texturedFrame(),
      observedAt: 1_000,
      selection: selection(null),
    });
    const snapshot = buildMultiGameGameplaySnapshot({
      frame: observation(3, 1_000),
      assessment,
    });
    expect(snapshot.capabilities.gameId).toBeNull();
    expect(snapshot.signals.some(({ signalId }) => signalId.startsWith("minecraft"))).toBe(false);
  });

  it("refuses to combine a frame with analysis from another timestamp", () => {
    const assessment = new MultiGameVisionAnalyzer().analyse({
      frame: texturedFrame(),
      observedAt: 1_000,
      selection: selection(null),
    });
    expect(() => buildMultiGameGameplaySnapshot({
      frame: observation(4, 1_200),
      assessment,
    })).toThrow("timestamps must match");
  });
});
