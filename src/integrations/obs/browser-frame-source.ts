import {
  CONTRACT_VERSION,
  gameplayFrameObservationSchema,
  type EphemeralGameplayFrame,
  type FrameSource,
  type GameplayFrameObservation,
} from "../../core";

type FrameEvidenceClass = "live" | "diagnostic" | "fixture";
type FrameMessageSource = "obs-virtual-camera" | "test-fixture";

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
    const evidenceClass = this.options.evidenceClass ?? "live";
    const source = this.options.source ?? "obs-virtual-camera";

    return gameplayFrameObservationSchema.parse({
      envelope: {
        contractVersion: CONTRACT_VERSION,
        sessionId: this.options.sessionId,
        questCycleId: this.options.questCycleId ?? null,
        messageId: this.idFactory(sequence),
        correlationId: this.options.correlationId,
        revision: this.options.revision ?? 0,
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
    throw new Error("Browser media devices are unavailable");
  }

  const devices = await mediaDevices.enumerateDevices();
  const obsDevice = findObsVirtualCameraDevice(devices, options.labelPattern);
  if (obsDevice !== null) {
    return mediaDevices.getUserMedia({
      audio: false,
      video: { deviceId: { exact: obsDevice.deviceId } },
    });
  }

  // Browsers commonly hide camera labels until the page receives permission.
  // Acquire a provisional stream only to unlock labels, then require OBS
  // explicitly so diagnostics cannot silently analyse the built-in webcam.
  const provisional = await mediaDevices.getUserMedia({ audio: false, video: true });
  const labelledDevices = await mediaDevices.enumerateDevices();
  const labelledObsDevice = findObsVirtualCameraDevice(labelledDevices, options.labelPattern);
  if (labelledObsDevice === null) {
    for (const track of provisional.getTracks()) track.stop();
    throw new Error("OBS Virtual Camera was not found. Start Virtual Camera in OBS, then retry.");
  }
  for (const track of provisional.getTracks()) track.stop();
  return mediaDevices.getUserMedia({
    audio: false,
    video: { deviceId: { exact: labelledObsDevice.deviceId } },
  });
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
