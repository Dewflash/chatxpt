import { createWorker, PSM } from "tesseract.js";

import type { OcrReading, SelectiveOcrAdapter } from "./selective-ocr";
import type { SampledPixelFrame } from "./visual-measurements";

export interface TesseractWorkerPort {
  setParameters(parameters: Record<string, string>): Promise<unknown>;
  recognize(image: HTMLCanvasElement): Promise<{
    readonly data: { readonly text: string; readonly confidence: number };
  }>;
  terminate(): Promise<unknown>;
}

export interface BrowserTesseractOcrOptions {
  readonly document?: Document;
  readonly language?: string;
  readonly workerFactory?: (language: string) => Promise<TesseractWorkerPort>;
}

export interface BrowserTesseractOcrHandle {
  readonly adapter: SelectiveOcrAdapter;
  terminate(): Promise<void>;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return;
  if (signal.reason instanceof Error) throw signal.reason;
  const error = new Error("OCR operation aborted");
  error.name = "AbortError";
  throw error;
}

function frameCanvas(frame: SampledPixelFrame, documentRef: Document): HTMLCanvasElement {
  const canvas = documentRef.createElement("canvas");
  canvas.width = frame.width;
  canvas.height = frame.height;
  const context = canvas.getContext("2d");
  if (context === null) throw new Error("Canvas 2D context is unavailable for OCR");
  const image = context.createImageData(frame.width, frame.height);
  image.data.set(frame.rgba);
  context.putImageData(image, 0, 0);
  return canvas;
}

function parametersFor(regionId: string): Record<string, string> {
  if (regionId === "brawl-match-timer") {
    return {
      tessedit_pageseg_mode: String(PSM.SINGLE_LINE),
      tessedit_char_whitelist: "0123456789:",
      preserve_interword_spaces: "0",
    };
  }
  if (regionId === "brawl-center-overlay") {
    return {
      tessedit_pageseg_mode: String(PSM.SPARSE_TEXT),
      tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz !",
      preserve_interword_spaces: "1",
    };
  }
  return {
    tessedit_pageseg_mode: String(PSM.SINGLE_BLOCK),
    preserve_interword_spaces: "1",
  };
}

function confidence(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value / 100));
}

/**
 * Creates one reusable browser worker behind the injected selective-OCR port.
 * The worker sees only named, preprocessed crops supplied by the caller.
 */
export async function createBrowserTesseractOcr(
  options: BrowserTesseractOcrOptions = {},
): Promise<BrowserTesseractOcrHandle> {
  const language = options.language ?? "eng";
  if (language.trim().length === 0 || language.length > 20) {
    throw new RangeError("OCR language must contain 1 to 20 characters");
  }
  const documentRef = options.document ?? globalThis.document;
  if (documentRef === undefined) throw new Error("Browser OCR requires a document");
  const worker = await (options.workerFactory ?? (async (requestedLanguage) =>
    createWorker(requestedLanguage) as Promise<TesseractWorkerPort>))(language);
  let terminated = false;
  return {
    adapter: {
      async recognize(region, metadata, signal): Promise<OcrReading> {
        if (terminated) throw new Error("OCR worker has been terminated");
        throwIfAborted(signal);
        await worker.setParameters(parametersFor(metadata.regionId));
        throwIfAborted(signal);
        const result = await worker.recognize(frameCanvas(region, documentRef));
        throwIfAborted(signal);
        return {
          text: result.data.text.trim().slice(0, 1_000),
          confidence: confidence(result.data.confidence),
        };
      },
    },
    async terminate() {
      if (terminated) return;
      terminated = true;
      await worker.terminate();
    },
  };
}
