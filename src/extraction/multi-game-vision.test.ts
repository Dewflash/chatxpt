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

function vanillaLikeMinecraftFrame(): SampledPixelFrame {
  const frame = solidFrame(45);
  paintNormalizedRegion(frame, "minecraft-health", (x, y) =>
    (x + y) % 2 === 0 ? [220, 25, 25] : [35, 5, 5]);
  paintNormalizedRegion(frame, "minecraft-hunger", (x, y) =>
    (x + y) % 2 === 0 ? [190, 105, 25] : [40, 20, 5]);
  paintNormalizedRegion(frame, "minecraft-hotbar", (x, y) =>
    (x + y) % 2 === 0 ? [220, 220, 220] : [30, 30, 30]);
  paintNormalizedRegion(frame, "minecraft-crosshair", (x, y) =>
    x % 2 === 0 || y % 2 === 0 ? [240, 240, 240] : [20, 20, 20]);
  return frame;
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
    expect(fingerprint.supportedSignals).not.toContain("player-health");
    expect(fingerprint.supportedSignals).not.toContain("player-hunger");
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
      frame: frameFromPixel(() => [0, 0, 0], 256, 128),
      observedAt: 1_000,
      selection: selection(null),
    })).toThrow("must not exceed 16384 sampled pixels");
  });
});

describe("canonical multi-game snapshot projection", () => {
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

  it("upgrades only the confirmed Minecraft layout capability after temporal agreement", () => {
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
    expect(snapshot.capabilities.supportedSignals).not.toContain("player-health");
    expect(snapshot.signals.find(({ signalId }) => signalId === "minecraft-hud-layout")?.observation)
      .toMatchObject({ status: "known", value: "vanilla-like" });
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
