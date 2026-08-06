import type { SampledPixelFrame } from "./visual-measurements";

export interface PixelRegion {
  readonly regionId: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface OcrReading {
  readonly text: string;
  readonly confidence: number;
}

export interface SelectiveOcrAdapter {
  recognize(
    region: SampledPixelFrame,
    metadata: { readonly regionId: string },
    signal?: AbortSignal,
  ): Promise<OcrReading> | OcrReading;
}

export interface SelectiveOcrMeasurement extends OcrReading {
  readonly regionId: string;
  readonly processingMs: number;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return;
  if (signal.reason instanceof Error) throw signal.reason;
  const error = new Error("Operation aborted");
  error.name = "AbortError";
  throw error;
}

function assertRegion(frame: SampledPixelFrame, region: PixelRegion): void {
  if (region.regionId.trim() === "" || region.regionId.length > 80) {
    throw new RangeError("OCR regionId must contain 1 to 80 characters");
  }
  for (const [name, value] of Object.entries({
    x: region.x,
    y: region.y,
    width: region.width,
    height: region.height,
  })) {
    if (!Number.isInteger(value) || value < 0 || ((name === "width" || name === "height") && value === 0)) {
      throw new RangeError(`OCR region ${name} must be a valid integer`);
    }
  }
  if (region.x + region.width > frame.width || region.y + region.height > frame.height) {
    throw new RangeError(`OCR region ${region.regionId} exceeds the sampled frame bounds`);
  }
}

function assertFrame(frame: SampledPixelFrame): void {
  if (!Number.isInteger(frame.width) || frame.width <= 0 || !Number.isInteger(frame.height) || frame.height <= 0) {
    throw new RangeError("OCR input frame dimensions must be positive integers");
  }
  if (
    !(frame.rgba instanceof Uint8ClampedArray) ||
    frame.rgba.length !== frame.width * frame.height * 4
  ) {
    throw new RangeError("OCR input frame must contain one RGBA tuple per pixel");
  }
}

export function extractPixelRegion(
  frame: SampledPixelFrame,
  region: PixelRegion,
): SampledPixelFrame {
  assertFrame(frame);
  assertRegion(frame, region);
  const rgba = new Uint8ClampedArray(region.width * region.height * 4);
  for (let row = 0; row < region.height; row += 1) {
    const sourceStart = ((region.y + row) * frame.width + region.x) * 4;
    const sourceEnd = sourceStart + region.width * 4;
    rgba.set(frame.rgba.subarray(sourceStart, sourceEnd), row * region.width * 4);
  }
  return { width: region.width, height: region.height, rgba };
}

function validateReading(reading: OcrReading): OcrReading {
  if (typeof reading.text !== "string" || reading.text.length > 1_000) {
    throw new RangeError("OCR text must be a string of at most 1000 characters");
  }
  if (!Number.isFinite(reading.confidence) || reading.confidence < 0 || reading.confidence > 1) {
    throw new RangeError("OCR confidence must be between 0 and 1");
  }
  return { text: reading.text, confidence: reading.confidence };
}

function defaultNow(): number {
  return typeof performance === "undefined" ? Date.now() : performance.now();
}

/**
 * Runs an injected OCR adapter only on named regions. Results remain raw
 * measurements; temporal confirmation and canonical confidence thresholds are
 * intentionally deferred to the Phase 3 decision gate.
 */
export async function runSelectiveOcrExperiment(
  frame: SampledPixelFrame,
  regions: readonly PixelRegion[],
  adapter: SelectiveOcrAdapter,
  options: { readonly now?: () => number } = {},
  signal?: AbortSignal,
): Promise<SelectiveOcrMeasurement[]> {
  assertFrame(frame);
  if (regions.length === 0 || regions.length > 16) {
    throw new RangeError("selective OCR requires between 1 and 16 regions");
  }
  const regionIds = regions.map(({ regionId }) => regionId);
  if (new Set(regionIds).size !== regionIds.length) {
    throw new RangeError("selective OCR region IDs must be distinct");
  }

  const now = options.now ?? defaultNow;
  const measurements: SelectiveOcrMeasurement[] = [];
  for (const region of regions) {
    throwIfAborted(signal);
    const pixels = extractPixelRegion(frame, region);
    const startedAt = now();
    const reading = validateReading(await adapter.recognize(pixels, { regionId: region.regionId }, signal));
    throwIfAborted(signal);
    const endedAt = now();
    if (!Number.isFinite(startedAt) || !Number.isFinite(endedAt)) {
      throw new RangeError("OCR measurement clock must return finite numbers");
    }
    measurements.push({
      regionId: region.regionId,
      ...reading,
      processingMs: Math.max(0, endedAt - startedAt),
    });
  }
  return measurements;
}
