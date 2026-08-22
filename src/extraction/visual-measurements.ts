import {
  gameplayFrameObservationSchema,
  type FrameSource,
  type GameplayFrameObservation,
} from "../core";

export interface PixelSampleSize {
  readonly width: number;
  readonly height: number;
}

export interface PixelSampleRect extends PixelSampleSize {
  readonly x: number;
  readonly y: number;
}

export interface FramePixelSampleRequest extends PixelSampleSize {
  /** Intrinsic capture dimensions used to avoid non-uniform scaling. */
  readonly sourceWidth?: number;
  readonly sourceHeight?: number;
  readonly fit?: "stretch" | "contain";
}

export interface SampledPixelFrame extends PixelSampleSize {
  readonly rgba: Uint8ClampedArray;
  /** Non-letterboxed pixels when the sampler used `fit: "contain"`. */
  readonly contentRect?: PixelSampleRect;
}

export interface FramePixelSampler {
  sample(
    image: CanvasImageSource,
    size: FramePixelSampleRequest,
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

const MAX_VISUAL_MEASUREMENT_SAMPLE_PIXELS = 16_384;

// The calibrated Minecraft path retains at most one 640x360 RGBA sample
// (under 1 MiB). Keep the browser sampler aligned with the multi-game
// analyzer so a valid bounded request is not rejected before analysis.
export const MAX_BROWSER_CANVAS_SAMPLE_PIXELS = 262_144;

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

function assertSampleSize(
  size: PixelSampleSize,
  maxPixels = MAX_VISUAL_MEASUREMENT_SAMPLE_PIXELS,
): void {
  if (!Number.isInteger(size.width) || size.width <= 0) {
    throw new RangeError("sample width must be a positive integer");
  }
  if (!Number.isInteger(size.height) || size.height <= 0) {
    throw new RangeError("sample height must be a positive integer");
  }
  if (size.width * size.height > maxPixels) {
    throw new RangeError(`sample size must not exceed ${maxPixels} pixels`);
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
  return {
    width: sample.width,
    height: sample.height,
    rgba: new Uint8ClampedArray(sample.rgba),
    ...(sample.contentRect === undefined ? {} : { contentRect: sample.contentRect }),
  };
}

function containedContentRect(request: FramePixelSampleRequest): PixelSampleRect | null {
  if (request.fit !== "contain") return null;
  const sourceWidth = request.sourceWidth;
  const sourceHeight = request.sourceHeight;
  if (
    !Number.isFinite(sourceWidth) ||
    !Number.isFinite(sourceHeight) ||
    sourceWidth === undefined ||
    sourceHeight === undefined ||
    sourceWidth <= 0 ||
    sourceHeight <= 0
  ) {
    throw new RangeError("contain sampling requires positive source dimensions");
  }
  const scale = Math.min(request.width / sourceWidth, request.height / sourceHeight);
  const width = Math.max(1, Math.min(request.width, Math.round(sourceWidth * scale)));
  const height = Math.max(1, Math.min(request.height, Math.round(sourceHeight * scale)));
  return {
    x: Math.floor((request.width - width) / 2),
    y: Math.floor((request.height - height) / 2),
    width,
    height,
  };
}

function drawSample(
  context: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D,
  image: CanvasImageSource,
  request: FramePixelSampleRequest,
  contentRect: PixelSampleRect | null,
): void {
  if (contentRect === null) {
    context.drawImage(image, 0, 0, request.width, request.height);
    return;
  }
  context.clearRect(0, 0, request.width, request.height);
  context.drawImage(
    image,
    0,
    0,
    request.sourceWidth as number,
    request.sourceHeight as number,
    contentRect.x,
    contentRect.y,
    contentRect.width,
    contentRect.height,
  );
}

/** Removes sampler-added letterboxing while retaining the undistorted content. */
export function cropSampledPixelFrameToContent(frame: SampledPixelFrame): SampledPixelFrame {
  const rect = frame.contentRect;
  if (rect === undefined) return frame;
  if (
    !Number.isInteger(rect.x) ||
    !Number.isInteger(rect.y) ||
    !Number.isInteger(rect.width) ||
    !Number.isInteger(rect.height) ||
    rect.x < 0 ||
    rect.y < 0 ||
    rect.width <= 0 ||
    rect.height <= 0 ||
    rect.x + rect.width > frame.width ||
    rect.y + rect.height > frame.height
  ) {
    throw new RangeError("sample contentRect must be contained by the sampled frame");
  }
  if (rect.x === 0 && rect.y === 0 && rect.width === frame.width && rect.height === frame.height) {
    return { width: frame.width, height: frame.height, rgba: new Uint8ClampedArray(frame.rgba) };
  }
  const rgba = new Uint8ClampedArray(rect.width * rect.height * 4);
  for (let row = 0; row < rect.height; row += 1) {
    const sourceStart = ((rect.y + row) * frame.width + rect.x) * 4;
    const sourceEnd = sourceStart + rect.width * 4;
    rgba.set(frame.rgba.subarray(sourceStart, sourceEnd), row * rect.width * 4);
  }
  return { width: rect.width, height: rect.height, rgba };
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
  const maximumPixels = options.maximumPixels ?? MAX_VISUAL_MEASUREMENT_SAMPLE_PIXELS;
  let videoCanvas: HTMLCanvasElement | null = null;
  if (
    !Number.isInteger(maximumPixels) ||
    maximumPixels < 1 ||
    maximumPixels > MAX_BROWSER_CANVAS_SAMPLE_PIXELS
  ) {
    throw new RangeError(
      `maximumPixels must be an integer from 1 to ${MAX_BROWSER_CANVAS_SAMPLE_PIXELS}`,
    );
  }
  return {
    sample(image, size, signal) {
      throwIfAborted(signal);
      assertSampleSize(size, maximumPixels);

      // Safari/WebKit can present a live MediaStream in <video> while an
      // OffscreenCanvas redraw of that video remains stale. Route live video
      // through a reusable DOM canvas so the pixels analysed here continue to
      // match the operator-visible preview. Other CanvasImageSource types keep
      // the faster OffscreenCanvas path.
      if (
        typeof document !== "undefined" &&
        typeof HTMLVideoElement !== "undefined" &&
        image instanceof HTMLVideoElement
      ) {
        videoCanvas ??= document.createElement("canvas");
        if (videoCanvas.width !== size.width) videoCanvas.width = size.width;
        if (videoCanvas.height !== size.height) videoCanvas.height = size.height;
        const context = videoCanvas.getContext("2d", { willReadFrequently: true });
        if (context === null) throw canvasUnavailable();
        const contentRect = containedContentRect(size);
        drawSample(context, image, size, contentRect);
        const pixels = context.getImageData(0, 0, size.width, size.height).data;
        throwIfAborted(signal);
        return {
          width: size.width,
          height: size.height,
          rgba: new Uint8ClampedArray(pixels),
          ...(contentRect === null ? {} : { contentRect }),
        };
      }

      if (typeof OffscreenCanvas === "function") {
        const canvas = new OffscreenCanvas(size.width, size.height);
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (context === null) throw canvasUnavailable();
        const contentRect = containedContentRect(size);
        drawSample(context, image, size, contentRect);
        const pixels = context.getImageData(0, 0, size.width, size.height).data;
        throwIfAborted(signal);
        return {
          width: size.width,
          height: size.height,
          rgba: new Uint8ClampedArray(pixels),
          ...(contentRect === null ? {} : { contentRect }),
        };
      }

      if (typeof document !== "undefined") {
        const canvas = document.createElement("canvas");
        canvas.width = size.width;
        canvas.height = size.height;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (context === null) throw canvasUnavailable();
        const contentRect = containedContentRect(size);
        drawSample(context, image, size, contentRect);
        const pixels = context.getImageData(0, 0, size.width, size.height).data;
        throwIfAborted(signal);
        return {
          width: size.width,
          height: size.height,
          rgba: new Uint8ClampedArray(pixels),
          ...(contentRect === null ? {} : { contentRect }),
        };
      }

      throw canvasUnavailable();
    },
  };
}
