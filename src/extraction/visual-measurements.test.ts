import { describe, expect, it, vi } from "vitest";

import {
  CONTRACT_VERSION,
  type EphemeralGameplayFrame,
  type FrameSource,
} from "../core";
import {
  createBrowserCanvasPixelSampler,
  cropSampledPixelFrameToContent,
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

  it("accepts the bounded 640x360 Minecraft browser sample", async () => {
    const drawImage = vi.fn();
    const getImageData = vi.fn(() => ({
      data: new Uint8ClampedArray(640 * 360 * 4),
    }));
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ({ drawImage, getImageData }),
    } as unknown as HTMLCanvasElement;
    vi.stubGlobal("document", {
      createElement: vi.fn(() => canvas),
    });

    try {
      const image = {} as CanvasImageSource;
      const sample = await createBrowserCanvasPixelSampler({
        maximumPixels: 640 * 360,
      }).sample(image, { width: 640, height: 360 });

      expect(sample).toMatchObject({ width: 640, height: 360 });
      expect(sample.rgba).toHaveLength(640 * 360 * 4);
      expect(drawImage).toHaveBeenCalledWith(image, 0, 0, 640, 360);
      expect(getImageData).toHaveBeenCalledWith(0, 0, 640, 360);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("contains a desktop-shaped capture without stretching the game pixels", async () => {
    const drawImage = vi.fn();
    const clearRect = vi.fn();
    const getImageData = vi.fn(() => ({
      data: new Uint8ClampedArray(640 * 360 * 4),
    }));
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ({ drawImage, clearRect, getImageData }),
    } as unknown as HTMLCanvasElement;
    vi.stubGlobal("document", {
      createElement: vi.fn(() => canvas),
    });

    try {
      const image = {} as CanvasImageSource;
      const sample = await createBrowserCanvasPixelSampler({
        maximumPixels: 640 * 360,
      }).sample(image, {
        width: 640,
        height: 360,
        sourceWidth: 3024,
        sourceHeight: 1964,
        fit: "contain",
      });

      expect(sample.contentRect).toEqual({ x: 43, y: 0, width: 554, height: 360 });
      expect(clearRect).toHaveBeenCalledWith(0, 0, 640, 360);
      expect(drawImage).toHaveBeenCalledWith(
        image,
        0,
        0,
        3024,
        1964,
        43,
        0,
        554,
        360,
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("crops sampler letterboxing before game-specific analysis", () => {
    const rgba = new Uint8ClampedArray(6 * 2 * 4);
    for (let y = 0; y < 2; y += 1) {
      for (let x = 1; x < 5; x += 1) {
        const offset = (y * 6 + x) * 4;
        rgba.set([x * 10, y * 20, 50, 255], offset);
      }
    }
    const cropped = cropSampledPixelFrameToContent({
      width: 6,
      height: 2,
      rgba,
      contentRect: { x: 1, y: 0, width: 4, height: 2 },
    });

    expect(cropped).toMatchObject({ width: 4, height: 2 });
    expect([...cropped.rgba]).toEqual([
      10, 0, 50, 255, 20, 0, 50, 255, 30, 0, 50, 255, 40, 0, 50, 255,
      10, 20, 50, 255, 20, 20, 50, 255, 30, 20, 50, 255, 40, 20, 50, 255,
    ]);
  });

  it("still rejects browser samples above the multi-game processing ceiling", () => {
    expect(() =>
      createBrowserCanvasPixelSampler({ maximumPixels: 262_144 }).sample(
        {} as CanvasImageSource,
        { width: 640, height: 480 },
      ),
    ).toThrow("sample size must not exceed 262144 pixels");
  });

  it("keeps generic sampling small while allowing an explicit bounded calibrated sample", () => {
    expect(() =>
      createBrowserCanvasPixelSampler().sample(
        {} as CanvasImageSource,
        { width: 640, height: 360 },
      ),
    ).toThrow("sample size must not exceed 16384 pixels");

    expect(() =>
      createBrowserCanvasPixelSampler({ maximumPixels: 640 * 360 }).sample(
        {} as CanvasImageSource,
        { width: 640, height: 360 },
      ),
    ).toThrow("Browser canvas sampling is unavailable");
  });
});
