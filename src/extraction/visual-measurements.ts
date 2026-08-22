import {
  gameplayFrameObservationSchema,
  type FrameSource,
  type GameplayFrameObservation,
} from "../core";

export interface PixelSampleSize {
  readonly width: number;
  readonly height: number;
}

export interface SampledPixelFrame extends PixelSampleSize {
  readonly rgba: Uint8ClampedArray;
}

export interface FramePixelSampler {
  sample(
    image: CanvasImageSource,
    size: PixelSampleSize,
    signal?: AbortSignal,
  ): Promise<SampledPixelFrame> | SampledPixelFrame;
}

export interface PixelChangeMeasurement {
  readonly meanLumaDelta: number;
  readonly changedPixelRatio: number;
  readonly pixelCount: number;
}

export interface VisualFrameMeasurement {
  readonly frame: GameplayFrameObservation;
  readonly sampleWidth: number;
  readonly sampleHeight: number;
  readonly processingMs: number;
  readonly changedLumaThreshold: number;
  readonly meanLumaDelta: number | null;
  readonly changedPixelRatio: number | null;
}

export interface VisualMeasurementOptions extends PixelSampleSize {
  readonly sampler: FramePixelSampler;
  readonly changedLumaThreshold: number;
  readonly now?: () => number;
}

const MAX_SAMPLE_PIXELS = 16_384;
const MAX_BROWSER_SAMPLE_PIXELS = 262_144;

export interface BrowserCanvasPixelSamplerOptions {
  /**
   * Generic visual measurements retain the 16,384-pixel default. Calibrated
   * adapters may opt into a larger bounded sample when their detector needs
   * more spatial detail, up to the multi-game analyser's 262,144-pixel cap.
   */
  readonly maximumPixels?: number;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return;
  if (signal.reason instanceof Error) throw signal.reason;
  const error = new Error("Operation aborted");
  error.name = "AbortError";
  throw error;
}

function assertUnitInterval(name: string, value: number): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError(`${name} must be between 0 and 1`);
  }
}

function assertSampleSize(size: PixelSampleSize): void {
  if (!Number.isInteger(size.width) || size.width <= 0) {
    throw new RangeError("sample width must be a positive integer");
  }
  if (!Number.isInteger(size.height) || size.height <= 0) {
    throw new RangeError("sample height must be a positive integer");
  }
  if (size.width * size.height > MAX_SAMPLE_PIXELS) {
    throw new RangeError(`sample size must not exceed ${MAX_SAMPLE_PIXELS} pixels`);
  }
}

function assertSampleSizeWithin(size: PixelSampleSize, maximumPixels: number): void {
  if (!Number.isInteger(size.width) || size.width <= 0) {
    throw new RangeError("sample width must be a positive integer");
  }
  if (!Number.isInteger(size.height) || size.height <= 0) {
    throw new RangeError("sample height must be a positive integer");
  }
  if (size.width * size.height > maximumPixels) {
    throw new RangeError(`sample size must not exceed ${maximumPixels} pixels`);
  }
}

function copyAndValidateSample(
  sample: SampledPixelFrame,
  expected: PixelSampleSize,
): SampledPixelFrame {
  assertSampleSize(sample);
  if (sample.width !== expected.width || sample.height !== expected.height) {
    throw new RangeError("pixel sampler returned dimensions different from the requested sample");
  }
  const expectedBytes = sample.width * sample.height * 4;
  if (!(sample.rgba instanceof Uint8ClampedArray) || sample.rgba.length !== expectedBytes) {
    throw new RangeError(`pixel sampler must return exactly ${expectedBytes} RGBA bytes`);
  }
  return { width: sample.width, height: sample.height, rgba: new Uint8ClampedArray(sample.rgba) };
}

function normalizedLuma(rgba: Uint8ClampedArray, offset: number): number {
  const alpha = rgba[offset + 3] / 255;
  const luma =
    (rgba[offset] * 0.2126 + rgba[offset + 1] * 0.7152 + rgba[offset + 2] * 0.0722) /
    255;
  return luma * alpha;
}

export function measurePixelChange(
  previous: SampledPixelFrame,
  current: SampledPixelFrame,
  changedLumaThreshold: number,
): PixelChangeMeasurement {
  assertUnitInterval("changedLumaThreshold", changedLumaThreshold);
  assertSampleSize(previous);
  assertSampleSize(current);
  if (previous.width !== current.width || previous.height !== current.height) {
    throw new RangeError("pixel samples must have matching dimensions");
  }

  const expectedBytes = previous.width * previous.height * 4;
  if (previous.rgba.length !== expectedBytes || current.rgba.length !== expectedBytes) {
    throw new RangeError("pixel samples must contain one RGBA tuple per pixel");
  }

  let totalDelta = 0;
  let changedPixels = 0;
  const pixelCount = previous.width * previous.height;
  for (let offset = 0; offset < expectedBytes; offset += 4) {
    const delta = Math.abs(normalizedLuma(previous.rgba, offset) - normalizedLuma(current.rgba, offset));
    totalDelta += delta;
    if (delta >= changedLumaThreshold) changedPixels += 1;
  }

  return {
    meanLumaDelta: totalDelta / pixelCount,
    changedPixelRatio: changedPixels / pixelCount,
    pixelCount,
  };
}

function defaultNow(): number {
  return typeof performance === "undefined" ? Date.now() : performance.now();
}

function elapsedMilliseconds(startedAt: number, endedAt: number): number {
  if (!Number.isFinite(startedAt) || !Number.isFinite(endedAt)) {
    throw new RangeError("measurement clock must return finite numbers");
  }
  return Math.max(0, endedAt - startedAt);
}

/**
 * Consumes canonical ephemeral frames into game-neutral pixel-change measurements.
 * It deliberately does not classify action, quiet, or transitions: those thresholds
 * remain open under D2-07 through D2-10. Every frame is released before yielding.
 */
export async function* streamVisualFrameMeasurements(
  source: FrameSource,
  options: VisualMeasurementOptions,
  signal?: AbortSignal,
): AsyncGenerator<VisualFrameMeasurement> {
  const size = { width: options.width, height: options.height };
  assertSampleSize(size);
  assertUnitInterval("changedLumaThreshold", options.changedLumaThreshold);
  const now = options.now ?? defaultNow;
  let previous: SampledPixelFrame | null = null;

  for await (const ephemeralFrame of source.frames(signal)) {
    let frame: GameplayFrameObservation | null = null;
    let current: SampledPixelFrame | null = null;
    let startedAt = 0;
    try {
      startedAt = now();
      throwIfAborted(signal);
      frame = gameplayFrameObservationSchema.parse(ephemeralFrame.observation);
      if (frame.status !== "ready") continue;
      current = copyAndValidateSample(
        await options.sampler.sample(ephemeralFrame.image, size, signal),
        size,
      );
      throwIfAborted(signal);
    } finally {
      ephemeralFrame.release();
    }

    const difference =
      previous === null
        ? null
        : measurePixelChange(previous, current, options.changedLumaThreshold);
    previous = current;
    const processingMs = elapsedMilliseconds(startedAt, now());

    yield {
      frame,
      sampleWidth: current.width,
      sampleHeight: current.height,
      processingMs,
      changedLumaThreshold: options.changedLumaThreshold,
      meanLumaDelta: difference?.meanLumaDelta ?? null,
      changedPixelRatio: difference?.changedPixelRatio ?? null,
    };
  }
}

function canvasUnavailable(): Error {
  return new Error("Browser canvas sampling is unavailable in this environment");
}

/** Copies an ephemeral CanvasImageSource into a bounded RGBA sample. */
export function createBrowserCanvasPixelSampler(
  options: BrowserCanvasPixelSamplerOptions = {},
): FramePixelSampler {
  const maximumPixels = options.maximumPixels ?? MAX_SAMPLE_PIXELS;
  if (
    !Number.isInteger(maximumPixels) ||
    maximumPixels < 1 ||
    maximumPixels > MAX_BROWSER_SAMPLE_PIXELS
  ) {
    throw new RangeError(
      `maximumPixels must be an integer from 1 to ${MAX_BROWSER_SAMPLE_PIXELS}`,
    );
  }
  return {
    sample(image, size, signal) {
      throwIfAborted(signal);
      assertSampleSizeWithin(size, maximumPixels);

      if (typeof OffscreenCanvas === "function") {
        const canvas = new OffscreenCanvas(size.width, size.height);
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (context === null) throw canvasUnavailable();
        context.drawImage(image, 0, 0, size.width, size.height);
        const pixels = context.getImageData(0, 0, size.width, size.height).data;
        throwIfAborted(signal);
        return { ...size, rgba: new Uint8ClampedArray(pixels) };
      }

      if (typeof document !== "undefined") {
        const canvas = document.createElement("canvas");
        canvas.width = size.width;
        canvas.height = size.height;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (context === null) throw canvasUnavailable();
        context.drawImage(image, 0, 0, size.width, size.height);
        const pixels = context.getImageData(0, 0, size.width, size.height).data;
        throwIfAborted(signal);
        return { ...size, rgba: new Uint8ClampedArray(pixels) };
      }

      throw canvasUnavailable();
    },
  };
}
