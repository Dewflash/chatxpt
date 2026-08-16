import { describe, expect, it } from "vitest";

import { analyseRecordingReplay } from "./recording-replay";
import type { SampledPixelFrame } from "./visual-measurements";

function frame(value: number): SampledPixelFrame {
  const rgba = new Uint8ClampedArray(16 * 16 * 4);
  for (let index = 0; index < rgba.length; index += 4) {
    rgba[index] = value;
    rgba[index + 1] = value;
    rgba[index + 2] = value;
    rgba[index + 3] = 255;
  }
  return { width: 16, height: 16, rgba };
}

describe("recording replay calibration boundary", () => {
  it("summarises annotations and resets temporal state across decoded segment gaps", () => {
    const times = [0, 2, 4, 6, 8, 10, 12, 14];
    const result = analyseRecordingReplay({
      frames: [
        { relativeTimeMs: 1_000, pixels: frame(20) },
        { relativeTimeMs: 1_100, pixels: frame(20) },
        { relativeTimeMs: 5_000, pixels: frame(220), discontinuityBefore: true },
        { relativeTimeMs: 5_100, pixels: frame(220) },
      ],
      selection: { requestedGameId: null, source: "unknown", confidence: 0 },
      annotations: [
        { label: "quiet", startsAtMs: 1_000, endsAtMs: 1_100 },
        { label: "transition", startsAtMs: 5_000, endsAtMs: 5_100 },
      ],
      now: () => times.shift() ?? 14,
    });

    expect(result.summary).toMatchObject({
      frameCount: 4,
      p50ProcessingMs: 2,
      p95ProcessingMs: 2,
      supportTierCounts: { "universal-visual": 4 },
      annotationInterpretationCounts: {
        quiet: { unknown: 2 },
        transition: { unknown: 2 },
      },
    });
    expect(result.assessments[2].assessment.motion).toBeNull();
  });

  it("rejects overlapping time order and malformed annotations", () => {
    expect(() => analyseRecordingReplay({
      frames: [
        { relativeTimeMs: 1_000, pixels: frame(20) },
        { relativeTimeMs: 1_000, pixels: frame(20) },
      ],
      selection: { requestedGameId: null, source: "unknown", confidence: 0 },
    })).toThrow("strictly increasing");
    expect(() => analyseRecordingReplay({
      frames: [],
      selection: { requestedGameId: null, source: "unknown", confidence: 0 },
      annotations: [{ label: "action", startsAtMs: 100, endsAtMs: 50 }],
    })).toThrow("valid non-negative");
  });
});
