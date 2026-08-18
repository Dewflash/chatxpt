import { describe, expect, it, vi } from "vitest";

import { createBrowserTesseractOcr, type TesseractWorkerPort } from "./tesseract-ocr";
import type { SampledPixelFrame } from "./visual-measurements";

function frame(): SampledPixelFrame {
  return { width: 2, height: 2, rgba: new Uint8ClampedArray(16).fill(255) };
}

function fakeDocument() {
  const imageData = { data: new Uint8ClampedArray(16) };
  const context = {
    createImageData: vi.fn(() => imageData),
    putImageData: vi.fn(),
  };
  const canvas = {
    width: 0,
    height: 0,
    getContext: vi.fn(() => context),
  };
  return {
    document: { createElement: vi.fn(() => canvas) } as unknown as Document,
    context,
  };
}

describe("browser Tesseract selective adapter", () => {
  it("reuses one worker and applies a timer-only character policy", async () => {
    const browser = fakeDocument();
    const worker: TesseractWorkerPort = {
      setParameters: vi.fn(async () => undefined),
      recognize: vi.fn(async () => ({ data: { text: " 2:28\n", confidence: 88 } })),
      terminate: vi.fn(async () => undefined),
    };
    const workerFactory = vi.fn(async () => worker);
    const handle = await createBrowserTesseractOcr({
      document: browser.document,
      workerFactory,
    });

    await expect(handle.adapter.recognize(frame(), { regionId: "brawl-match-timer" })).resolves.toEqual({
      text: "2:28",
      confidence: 0.88,
    });
    expect(workerFactory).toHaveBeenCalledTimes(1);
    expect(worker.setParameters).toHaveBeenCalledWith(expect.objectContaining({
      tessedit_char_whitelist: "0123456789:",
    }));
    expect(browser.context.putImageData).toHaveBeenCalledTimes(1);
    await handle.terminate();
    await handle.terminate();
    expect(worker.terminate).toHaveBeenCalledTimes(1);
    await expect(handle.adapter.recognize(frame(), { regionId: "brawl-match-timer" })).rejects.toThrow(
      "terminated",
    );
  });

  it("preserves cancellation before worker recognition", async () => {
    const browser = fakeDocument();
    const worker: TesseractWorkerPort = {
      setParameters: vi.fn(async () => undefined),
      recognize: vi.fn(async () => ({ data: { text: "ignored", confidence: 100 } })),
      terminate: vi.fn(async () => undefined),
    };
    const handle = await createBrowserTesseractOcr({
      document: browser.document,
      workerFactory: async () => worker,
    });
    const controller = new AbortController();
    controller.abort(new Error("fixture abort"));
    await expect(handle.adapter.recognize(
      frame(),
      { regionId: "brawl-center-overlay" },
      controller.signal,
    )).rejects.toThrow("fixture abort");
    expect(worker.recognize).not.toHaveBeenCalled();
  });
});
