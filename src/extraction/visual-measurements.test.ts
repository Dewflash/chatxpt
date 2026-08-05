import { describe, expect, it, vi } from "vitest";

import {
  CONTRACT_VERSION,
  type EphemeralGameplayFrame,
  type FrameSource,
} from "../core";
import {
  createBrowserCanvasPixelSampler,
  measurePixelChange,
  streamVisualFrameMeasurements,
  type FramePixelSampler,
  type SampledPixelFrame,
} from "./visual-measurements";

const NOW = 1_786_200_000_000;

function pixels(values: readonly number[], width = values.length, height = 1): SampledPixelFrame {
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (const [index, value] of values.entries()) {
    rgba[index * 4] = value;
    rgba[index * 4 + 1] = value;
    rgba[index * 4 + 2] = value;
    rgba[index * 4 + 3] = 255;
  }
  return { width, height, rgba };
}

function frame(frameId: string, status: EphemeralGameplayFrame["observation"]["status"] = "ready") {
  const release = vi.fn();
  return {
    value: {
      observation: {
        envelope: {
          contractVersion: CONTRACT_VERSION,
          sessionId: "visual-spike-session",
          questCycleId: null,
          messageId: `${frameId}-message`,
          correlationId: "visual-spike-correlation",
          revision: 0,
          occurredAt: NOW,
          receivedAt: NOW,
          source: "test-fixture",
          evidenceClass: "fixture",
        },
        frameId,
        capturedAt: NOW,
        width: 1280,
        height: 720,
        status,
      },
      image: { frameId } as unknown as CanvasImageSource,
      release,
    } satisfies EphemeralGameplayFrame,
    release,
  };
}

function source(frames: readonly EphemeralGameplayFrame[]): FrameSource {
  return {
    async *frames() {
      for (const value of frames) yield value;
    },
  };
}

describe("pixel-change measurement", () => {
  it("distinguishes identical samples from a broad visual change without classifying gameplay", () => {
    const black = pixels([0, 0, 0, 0]);
    const halfWhite = pixels([255, 255, 0, 0]);

    expect(measurePixelChange(black, black, 0.2)).toEqual({
      meanLumaDelta: 0,
      changedPixelRatio: 0,
      pixelCount: 4,
    });
    const changed = measurePixelChange(black, halfWhite, 0.2);
    expect(changed.meanLumaDelta).toBeCloseTo(0.5);
    expect(changed.changedPixelRatio).toBe(0.5);
    expect(changed.pixelCount).toBe(4);
  });

  it("rejects unbounded or incompatible samples", () => {
    expect(() => measurePixelChange(pixels([0]), pixels([0, 0]), 0.2)).toThrow(
      "matching dimensions",
    );
    expect(() => measurePixelChange(pixels([0]), pixels([0]), 1.1)).toThrow(
      "between 0 and 1",
    );
  });
});

describe("FrameSource visual measurement stream", () => {
  it("copies bounded pixels, preserves provenance, and releases each frame before yielding", async () => {
    const first = frame("frame-1");
    const second = frame("frame-2");
    const samples = new Map([
      ["frame-1", pixels([0, 0, 0, 0])],
      ["frame-2", pixels([255, 255, 0, 0])],
    ]);
    const sampler: FramePixelSampler = {
      sample(image) {
        const frameId = (image as unknown as { frameId: string }).frameId;
        const sample = samples.get(frameId);
        if (sample === undefined) throw new Error("missing fixture sample");
        return sample;
      },
    };
    let clock = 0;
    const iterator = streamVisualFrameMeasurements(
      source([first.value, second.value]),
      { sampler, width: 4, height: 1, changedLumaThreshold: 0.2, now: () => clock++ },
    );

    const baseline = await iterator.next();
    expect(first.release).toHaveBeenCalledTimes(1);
    expect(baseline.value).toMatchObject({
      frame: { frameId: "frame-1", envelope: { evidenceClass: "fixture" } },
      meanLumaDelta: null,
      changedPixelRatio: null,
      processingMs: 1,
    });

    const measured = await iterator.next();
    expect(second.release).toHaveBeenCalledTimes(1);
    expect(measured.value).toMatchObject({
      frame: { frameId: "frame-2", envelope: { evidenceClass: "fixture" } },
      changedPixelRatio: 0.5,
      processingMs: 1,
    });
    expect(measured.value?.meanLumaDelta).toBeCloseTo(0.5);
  });

  it("releases skipped and failed frames without fabricating measurements", async () => {
    const skipped = frame("stale-frame", "stale");
    const failed = frame("failed-frame");
    const sampler: FramePixelSampler = {
      sample: vi.fn(() => {
        throw new Error("fixture decoder failed");
      }),
    };
    const iterator = streamVisualFrameMeasurements(
      source([skipped.value, failed.value]),
      { sampler, width: 2, height: 2, changedLumaThreshold: 0.2 },
    );

    await expect(iterator.next()).rejects.toThrow("fixture decoder failed");
    expect(skipped.release).toHaveBeenCalledTimes(1);
    expect(failed.release).toHaveBeenCalledTimes(1);
    expect(sampler.sample).toHaveBeenCalledTimes(1);
  });

  it("releases a yielded frame when cancellation is already requested", async () => {
    const pending = frame("cancelled-frame");
    const controller = new AbortController();
    controller.abort(new Error("cancelled visual fixture"));
    const sampler: FramePixelSampler = { sample: vi.fn(() => pixels([0, 0, 0, 0], 2, 2)) };
    const iterator = streamVisualFrameMeasurements(
      source([pending.value]),
      { sampler, width: 2, height: 2, changedLumaThreshold: 0.2 },
      controller.signal,
    );

    await expect(iterator.next()).rejects.toThrow("cancelled visual fixture");
    expect(pending.release).toHaveBeenCalledTimes(1);
    expect(sampler.sample).not.toHaveBeenCalled();
  });

  it("reports browser canvas sampling as unavailable in a non-browser test runtime", () => {
    expect(() =>
      createBrowserCanvasPixelSampler().sample({} as CanvasImageSource, { width: 2, height: 2 }),
    ).toThrow("Browser canvas sampling is unavailable");
  });
});
