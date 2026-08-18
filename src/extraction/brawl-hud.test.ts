import { describe, expect, it } from "vitest";

import { brawlStarsGameProfile } from "./game-profiles";
import {
  fingerprintBrawlHud,
  parseBrawlOutcomeText,
  parseBrawlTimerText,
} from "./brawl-hud";
import { MultiGameVisionAnalyzer } from "./multi-game-vision";
import { defaultMotionInterpretationPolicy } from "./motion-interpretation";
import type { SampledPixelFrame } from "./visual-measurements";
import { createMultiGameVisionEvidencePolicy } from "./vision-evidence-policy";

const WIDTH = 160;
const HEIGHT = 90;
const fixtureEvidencePolicy = createMultiGameVisionEvidencePolicy({
  policyId: "fixture-brawl-policy",
  calibrationEvidenceClass: "fixture",
  calibrationSourceIds: ["synthetic-brawl-one", "synthetic-brawl-two"],
  approvedProfileIds: ["brawl-stars-standard-v1"],
  minimumConfidence: 0.75,
  staleAfterMs: 3_000,
  interpretation: defaultMotionInterpretationPolicy,
});

function frameFromPixel(
  pixel: (x: number, y: number) => readonly [number, number, number],
): SampledPixelFrame {
  const rgba = new Uint8ClampedArray(WIDTH * HEIGHT * 4);
  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      const offset = (y * WIDTH + x) * 4;
      const [red, green, blue] = pixel(x, y);
      rgba[offset] = red;
      rgba[offset + 1] = green;
      rgba[offset + 2] = blue;
      rgba[offset + 3] = 255;
    }
  }
  return { width: WIDTH, height: HEIGHT, rgba };
}

function paint(
  frame: SampledPixelFrame,
  regionId: string,
  pixel: (x: number, y: number) => readonly [number, number, number],
): void {
  const region = brawlStarsGameProfile.regions.find((candidate) => candidate.regionId === regionId);
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
    }
  }
}

function standardBrawlHud(): SampledPixelFrame {
  const frame = frameFromPixel(() => [45, 35, 70]);
  paint(frame, "brawl-left-score", (x, y) =>
    (x + y) % 2 === 0 ? [15, 55, 220] : [8, 18, 65]);
  paint(frame, "brawl-right-score", (x, y) =>
    (x + y) % 2 === 0 ? [225, 30, 35] : [65, 8, 12]);
  paint(frame, "brawl-timer-anchor", (x, y) =>
    x % 3 === 0 || y % 3 === 0 ? [245, 245, 245] : [12, 12, 18]);
  return frame;
}

describe("Brawl standard HUD calibration", () => {
  it("requires the blue score, red score, and centre timer together", () => {
    const result = fingerprintBrawlHud(standardBrawlHud(), brawlStarsGameProfile);
    expect(result).toMatchObject({ status: "standard-like" });
    expect(result.detectedAnchors).toEqual([
      "brawl-left-score",
      "brawl-right-score",
      "brawl-timer-anchor",
    ]);
    expect(result.supportedSignals).toContain("brawl-hud-layout");
    expect(result.supportedSignals).toContain("match-active");
    expect(result.supportedSignals).not.toContain("match-timer");
    expect(result.supportedSignals).not.toContain("match-outcome");
  });

  it("does not promote arbitrary detail or a partial scoreboard", () => {
    const detailed = frameFromPixel((x, y) => {
      const value = (x * 47 + y * 31 + x * y) % 256;
      return [value, (value * 3) % 256, (value * 5) % 256];
    });
    expect(fingerprintBrawlHud(detailed, brawlStarsGameProfile).status).not.toBe("standard-like");

    const partial = standardBrawlHud();
    paint(partial, "brawl-timer-anchor", () => [45, 35, 70]);
    expect(fingerprintBrawlHud(partial, brawlStarsGameProfile)).toMatchObject({
      status: "modified-or-unknown",
      supportedSignals: brawlStarsGameProfile.universalSignals,
    });
  });

  it("requires temporal agreement before advertising calibrated Brawl capabilities", () => {
    const analyzer = new MultiGameVisionAnalyzer({ evidencePolicy: fixtureEvidencePolicy });
    const selection = {
      requestedGameId: "brawl-stars",
      source: "streamer-config" as const,
      confidence: 1,
    };
    const first = analyzer.analyse({ frame: standardBrawlHud(), observedAt: 1_000, selection });
    expect(first).toMatchObject({
      supportTier: "universal-visual",
      brawlHud: { status: "candidate-unconfirmed" },
    });
    const confirmed = analyzer.analyse({ frame: standardBrawlHud(), observedAt: 1_100, selection });
    expect(confirmed).toMatchObject({
      supportTier: "calibrated-hud",
      brawlHud: { status: "standard-like" },
    });
    expect(confirmed.supportedSignals).toContain("match-active");
    expect(confirmed.supportedSignals).not.toContain("match-timer");
  });

  it("parses only bounded timer and explicit outcome text", () => {
    expect(parseBrawlTimerText("2:28")).toBe(148);
    expect(parseBrawlTimerText(" 0 : 09 ")).toBe(9);
    expect(parseBrawlTimerText("2:99")).toBeNull();
    expect(parseBrawlTimerText("match over")).toBeNull();
    expect(parseBrawlOutcomeText("Match over")).toBe("match-over");
    expect(parseBrawlOutcomeText("VICTORY!")).toBe("victory");
    expect(parseBrawlOutcomeText("Ziqi scored")).toBeNull();
  });
});
