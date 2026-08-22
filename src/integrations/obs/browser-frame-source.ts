import {
  CONTRACT_VERSION,
  gameplayFrameObservationSchema,
  type EphemeralGameplayFrame,
  type FrameSource,
  type GameplayFrameObservation,
} from "../../core";

type FrameEvidenceClass = "live" | "diagnostic" | "fixture";
type FrameMessageSource = "obs-virtual-camera" | "browser-display-capture" | "test-fixture";

export interface BrowserFrameCapture {
  readonly width: number;
  readonly height: number;
  start(): Promise<void> | void;
  captureFrame(): Promise<CanvasImageSource> | CanvasImageSource;
  releaseFrame?(image: CanvasImageSource): void;
  stop?(): void;
}

export interface BrowserMediaFrameSourceOptions {
  readonly sessionId: string;
  readonly correlationId: string;
  readonly capture: BrowserFrameCapture;
  readonly questCycleId?: string | null;
  readonly revision?: number;
  readonly evidenceClass?: FrameEvidenceClass;
  /** Reads the latest realtime authority before each frame is stamped. */
  readonly authority?: () => {
    readonly questCycleId: string | null;
    readonly revision: number;
    readonly evidenceClass?: FrameEvidenceClass;
  };
  readonly source?: FrameMessageSource;
  readonly frameIntervalMs?: number;
  readonly now?: () => number;
  readonly idFactory?: (sequence: number) => string;
  readonly sleep?: (durationMs: number, signal?: AbortSignal) => Promise<void>;
}

export class BrowserMediaFrameSource implements FrameSource {
  private readonly frameIntervalMs: number;
  private readonly now: () => number;
  private readonly idFactory: (sequence: number) => string;
  private readonly sleep: (durationMs: number, signal?: AbortSignal) => Promise<void>;

  constructor(private readonly options: BrowserMediaFrameSourceOptions) {
    this.frameIntervalMs = options.frameIntervalMs ?? 250;
    this.now = options.now ?? Date.now;
    this.idFactory = options.idFactory ?? ((sequence) => `obs-frame-${sequence}`);
    this.sleep = options.sleep ?? sleep;
  }

  async *frames(signal?: AbortSignal): AsyncIterable<EphemeralGameplayFrame> {
    let sequence = 0;
    await this.options.capture.start();

    try {
      while (!signal?.aborted) {
        sequence += 1;
        const capturedAt = this.now();
        const image = await this.options.capture.captureFrame();
        const observation = this.observation(sequence, capturedAt);
        let released = false;

        yield {
          observation,
          image,
          release: () => {
            if (released) return;
            released = true;
            this.options.capture.releaseFrame?.(image);
          },
        };

        if (signal?.aborted) break;
        await this.sleep(this.frameIntervalMs, signal);
      }
    } finally {
      this.options.capture.stop?.();
    }
  }

  private observation(sequence: number, capturedAt: number): GameplayFrameObservation {
    const authority = this.options.authority?.();
    const evidenceClass = authority?.evidenceClass ?? this.options.evidenceClass ?? "live";
    const source = this.options.source ?? "obs-virtual-camera";

    return gameplayFrameObservationSchema.parse({
      envelope: {
        contractVersion: CONTRACT_VERSION,
        sessionId: this.options.sessionId,
        questCycleId: authority?.questCycleId ?? this.options.questCycleId ?? null,
        messageId: this.idFactory(sequence),
        correlationId: this.options.correlationId,
        revision: authority?.revision ?? this.options.revision ?? 0,
        occurredAt: capturedAt,
        receivedAt: capturedAt,
        source,
        evidenceClass,
      },
      frameId: this.idFactory(sequence),
      capturedAt,
      width: this.options.capture.width,
      height: this.options.capture.height,
      status: "ready",
    });
  }
}

export interface ObsVirtualCameraRequestOptions {
  readonly mediaDevices?: Pick<MediaDevices, "enumerateDevices" | "getUserMedia">;
  readonly labelPattern?: RegExp;
}

export type ObsVirtualCameraFailureReason =
  | "browser-unavailable"
  | "permission-denied"
  | "not-found"
  | "device-unavailable";

export class ObsVirtualCameraError extends Error {
  override readonly name = "ObsVirtualCameraError";

  constructor(
    readonly reason: ObsVirtualCameraFailureReason,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}

export function obsVirtualCameraFailureReason(
  caught: unknown,
): ObsVirtualCameraFailureReason | null {
  if (caught instanceof ObsVirtualCameraError) return caught.reason;
  const name = exceptionName(caught);
  if (name === "NotAllowedError" || name === "SecurityError") return "permission-denied";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "not-found";
  if (name === "NotReadableError" || name === "AbortError") return "device-unavailable";
  return null;
}

export interface BrowserDisplayCaptureRequestOptions {
  readonly mediaDevices?: Pick<MediaDevices, "getDisplayMedia">;
}

/** Opens the browser-native screen/window/tab picker from a direct user action. */
export async function requestBrowserDisplayCaptureStream(
  options: BrowserDisplayCaptureRequestOptions = {},
): Promise<MediaStream> {
  const mediaDevices = options.mediaDevices ?? globalThis.navigator?.mediaDevices;
  if (mediaDevices?.getDisplayMedia === undefined) {
    throw new Error("Screen and window capture are unavailable in this browser");
  }
  return mediaDevices.getDisplayMedia({ audio: false, video: true });
}

export function findObsVirtualCameraDevice(
  devices: readonly MediaDeviceInfo[],
  labelPattern: RegExp = /obs.*virtual camera|virtual camera.*obs/i,
): MediaDeviceInfo | null {
  return devices.find((device) => device.kind === "videoinput" && labelPattern.test(device.label)) ?? null;
}

export async function requestObsVirtualCameraStream(
  options: ObsVirtualCameraRequestOptions = {},
): Promise<MediaStream> {
  const mediaDevices = options.mediaDevices ?? globalThis.navigator?.mediaDevices;
  if (mediaDevices === undefined) {
    throw new ObsVirtualCameraError(
      "browser-unavailable",
      "Camera capture is unavailable in this browser. Open Gameplay Capture in a supported browser and retry.",
    );
  }

  let devices: MediaDeviceInfo[];
  try {
    devices = [...await mediaDevices.enumerateDevices()];
  } catch (caught) {
    throw toObsVirtualCameraError(caught, "browser-unavailable");
  }
  const obsDevice = findObsVirtualCameraDevice(devices, options.labelPattern);
  if (obsDevice !== null) {
    return requestExactObsDevice(mediaDevices, obsDevice.deviceId);
  }

  // Browsers commonly hide camera labels until the page receives permission.
  // Acquire a provisional stream only to unlock labels, then require OBS
  // explicitly so diagnostics cannot silently analyse the built-in webcam.
  let provisional: MediaStream;
  try {
    provisional = await mediaDevices.getUserMedia({ audio: false, video: true });
  } catch (caught) {
    throw toObsVirtualCameraError(caught, "device-unavailable");
  }

  let labelledObsDevice: MediaDeviceInfo | null;
  try {
    const labelledDevices = await mediaDevices.enumerateDevices();
    labelledObsDevice = findObsVirtualCameraDevice(labelledDevices, options.labelPattern);
  } catch (caught) {
    throw toObsVirtualCameraError(caught, "browser-unavailable");
  } finally {
    for (const track of provisional.getTracks()) track.stop();
  }

  if (labelledObsDevice === null) {
    throw new ObsVirtualCameraError(
      "not-found",
      "OBS Virtual Camera was not found. Start Virtual Camera in OBS. If OBS was installed or its virtual camera was registered after this browser opened, fully restart the browser and retry.",
    );
  }
  return requestExactObsDevice(mediaDevices, labelledObsDevice.deviceId);
}

async function requestExactObsDevice(
  mediaDevices: Pick<MediaDevices, "getUserMedia">,
  deviceId: string,
): Promise<MediaStream> {
  try {
    return await mediaDevices.getUserMedia({
      audio: false,
      video: { deviceId: { exact: deviceId } },
    });
  } catch (caught) {
    throw toObsVirtualCameraError(caught, "device-unavailable");
  }
}

function toObsVirtualCameraError(
  caught: unknown,
  fallbackReason: ObsVirtualCameraFailureReason,
): ObsVirtualCameraError {
  if (caught instanceof ObsVirtualCameraError) return caught;
  const reason = obsVirtualCameraFailureReason(caught) ?? fallbackReason;
  if (reason === "permission-denied") {
    return new ObsVirtualCameraError(
      reason,
      "Camera access is blocked. Allow camera access for this browser, then retry.",
      { cause: caught },
    );
  }
  if (reason === "not-found") {
    return new ObsVirtualCameraError(
      reason,
      "OBS Virtual Camera was not found. Start Virtual Camera in OBS, then retry.",
      { cause: caught },
    );
  }
  if (reason === "device-unavailable") {
    return new ObsVirtualCameraError(
      reason,
      "OBS Virtual Camera is visible but could not be opened. Restart Virtual Camera in OBS, close other apps using it, then retry.",
      { cause: caught },
    );
  }
  return new ObsVirtualCameraError(
    reason,
    "Camera devices could not be read by this browser. Reload Gameplay Capture and retry.",
    { cause: caught },
  );
}

function exceptionName(caught: unknown): string | null {
  if (typeof caught !== "object" || caught === null || !("name" in caught)) return null;
  const name = (caught as { readonly name?: unknown }).name;
  return typeof name === "string" ? name : null;
}

export interface MediaStreamVideoFrameCaptureOptions {
  readonly document?: Document;
  readonly stopStreamOnEnd?: boolean;
}

export class MediaStreamVideoFrameCapture implements BrowserFrameCapture {
  private video: HTMLVideoElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private context: CanvasRenderingContext2D | null = null;

  constructor(
    private readonly stream: MediaStream,
    private readonly options: MediaStreamVideoFrameCaptureOptions = {},
  ) {}

  get width(): number {
    return this.video?.videoWidth || this.canvas?.width || 1;
  }

  get height(): number {
    return this.video?.videoHeight || this.canvas?.height || 1;
  }

  async start(): Promise<void> {
    const documentRef = this.options.document ?? globalThis.document;
    if (documentRef === undefined) {
      throw new Error("A browser document is required for frame capture");
    }

    const video = documentRef.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.srcObject = this.stream;
    await video.play();

    const canvas = documentRef.createElement("canvas");
    const width = video.videoWidth || 1;
    const height = video.videoHeight || 1;
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (context === null) {
      throw new Error("Canvas 2D context is unavailable");
    }

    this.video = video;
    this.canvas = canvas;
    this.context = context;
  }

  captureFrame(): CanvasImageSource {
    if (this.video === null || this.canvas === null || this.context === null) {
      throw new Error("Frame capture has not started");
    }

    const width = this.video.videoWidth || this.canvas.width || 1;
    const height = this.video.videoHeight || this.canvas.height || 1;
    if (this.canvas.width !== width) this.canvas.width = width;
    if (this.canvas.height !== height) this.canvas.height = height;
    this.context.drawImage(this.video, 0, 0, width, height);
    return this.canvas;
  }

  stop(): void {
    this.video?.pause();
    this.video = null;
    this.context = null;
    this.canvas = null;
    if (this.options.stopStreamOnEnd === true) {
      for (const track of this.stream.getTracks()) {
        track.stop();
      }
    }
  }
}

function sleep(durationMs: number, signal?: AbortSignal): Promise<void> {
  if (durationMs <= 0 || signal?.aborted) return Promise.resolve();

  return new Promise((resolve) => {
    const timeout = globalThis.setTimeout(resolve, durationMs);
    signal?.addEventListener(
      "abort",
      () => {
        globalThis.clearTimeout(timeout);
        resolve();
      },
      { once: true },
    );
  });
}
