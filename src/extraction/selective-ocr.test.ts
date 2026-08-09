import { describe, expect, it, vi } from "vitest";

import {
  confirmTemporalOcr,
  extractPixelRegion,
  preprocessOcrRegion,
  runSelectiveOcrExperiment,
  type SelectiveOcrAdapter,
} from "./selective-ocr";
import type { SampledPixelFrame } from "./visual-measurements";

function indexedPixels(width: number, height: number): SampledPixelFrame {
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let pixel = 0; pixel < width * height; pixel += 1) {
    rgba[pixel * 4] = pixel;
    rgba[pixel * 4 + 3] = 255;
  }
  return { width, height, rgba };
}

describe("selective OCR experiment plumbing", () => {
  it("copies only the configured pixel region", () => {
    const region = extractPixelRegion(indexedPixels(4, 2), {
      regionId: "score",
      x: 2,
      y: 0,
      width: 2,
      height: 2,
    });

    expect(region).toMatchObject({ width: 2, height: 2 });
    expect([region.rgba[0], region.rgba[4], region.rgba[8], region.rgba[12]]).toEqual([
      2, 3, 6, 7,
    ]);
  });

  it("runs one bounded adapter call per named region and records latency", async () => {
    const adapter: SelectiveOcrAdapter = {
      recognize: vi.fn((_pixels, { regionId }) => ({
        text: regionId === "score" ? "12" : "01:23",
        confidence: 0.8,
      })),
    };
    const times = [10, 13, 20, 27];

    await expect(
      runSelectiveOcrExperiment(
        indexedPixels(4, 2),
        [
          { regionId: "score", x: 0, y: 0, width: 2, height: 1 },
          { regionId: "timer", x: 2, y: 1, width: 2, height: 1 },
        ],
        adapter,
        { now: () => times.shift() ?? 27 },
      ),
    ).resolves.toEqual([
      { regionId: "score", text: "12", confidence: 0.8, processingMs: 3 },
      { regionId: "timer", text: "01:23", confidence: 0.8, processingMs: 7 },
    ]);
    expect(adapter.recognize).toHaveBeenCalledTimes(2);
  });

  it("preprocesses a named crop with bounded grayscale scaling and thresholding", () => {
    const source = indexedPixels(2, 1);
    source.rgba.set([20, 20, 20, 255, 230, 230, 230, 255]);

    const processed = preprocessOcrRegion(source, { scale: 2, contrast: 1, threshold: 128 });

    expect(processed).toMatchObject({ width: 4, height: 2 });
    expect(Array.from(processed.rgba)).toEqual([
      0, 0, 0, 255, 0, 0, 0, 255, 255, 255, 255, 255, 255, 255, 255, 255,
      0, 0, 0, 255, 0, 0, 0, 255, 255, 255, 255, 255, 255, 255, 255, 255,
    ]);
  });

  it("requires two matching high-confidence OCR readings out of three", () => {
    expect(
      confirmTemporalOcr([
        { text: "01:23", confidence: 0.82 },
        { text: "01:28", confidence: 0.91 },
        { text: " 01:23 ", confidence: 0.88 },
      ]),
    ).toEqual({
      status: "known",
      text: "01:23",
      confidence: 0.85,
      matchingReadings: 2,
    });
    expect(
      confirmTemporalOcr([
        { text: "01:23", confidence: 0.82 },
        { text: "01:24", confidence: 0.83 },
      ]),
    ).toMatchObject({ status: "unknown", reason: "conflicting", matchingReadings: 1 });
    expect(confirmTemporalOcr([{ text: "01:23", confidence: 0.5 }])).toEqual({
      status: "unknown",
      reason: "low-confidence",
      confidence: 0,
      matchingReadings: 0,
    });
  });

  it("rejects invalid regions and malformed adapter confidence", async () => {
    const frame = indexedPixels(2, 2);
    const adapter: SelectiveOcrAdapter = { recognize: () => ({ text: "12", confidence: 2 }) };

    await expect(
      runSelectiveOcrExperiment(
        frame,
        [{ regionId: "outside", x: 1, y: 1, width: 2, height: 1 }],
        adapter,
      ),
    ).rejects.toThrow("exceeds the sampled frame bounds");
    await expect(
      runSelectiveOcrExperiment(
        frame,
        [{ regionId: "score", x: 0, y: 0, width: 1, height: 1 }],
        adapter,
      ),
    ).rejects.toThrow("confidence must be between 0 and 1");
    expect(() => preprocessOcrRegion(frame, { scale: 5 })).toThrow(
      "scale must be an integer from 1 to 4",
    );
    expect(() => confirmTemporalOcr([], { requiredMatches: 3, windowSize: 2 })).toThrow(
      "requiredMatches must fit within windowSize",
    );
  });

  it("honours cancellation before invoking an OCR adapter", async () => {
    const controller = new AbortController();
    controller.abort(new Error("cancelled OCR fixture"));
    const adapter: SelectiveOcrAdapter = { recognize: vi.fn(() => ({ text: "", confidence: 0 })) };

    await expect(
      runSelectiveOcrExperiment(
        indexedPixels(2, 2),
        [{ regionId: "score", x: 0, y: 0, width: 1, height: 1 }],
        adapter,
        {},
        controller.signal,
      ),
    ).rejects.toThrow("cancelled OCR fixture");
    expect(adapter.recognize).not.toHaveBeenCalled();
  });
});
