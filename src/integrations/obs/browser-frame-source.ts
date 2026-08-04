import {
  CONTRACT_VERSION,
  gameplayFrameObservationSchema,
  type EphemeralGameplayFrame,
  type FrameSource,
  type GameplayFrameObservation,
} from "../../core";

export type ObsCaptureState =
  | "idle"
  | "requesting-permission"
  | "ready"
  | "stale"
  | "permission-denied"
  | "unavailable"
  | "ended";

export interface ObsCaptureStatus {
  readonly state: ObsCaptureState;
  readonly checkedAt: number;
  readonly deviceId: string | null;
  readonly deviceLabel: string | null;
  readonly message: string;
  readonly retryable: boolean;
}

export interface ObsVideoInput {
  readonly deviceId: string;
  readonly label: string;
  readonly isObsVirtualCamera: boolean;
}

type BrowserMediaDevices = Pick<MediaDevices, "enumerateDevices" | "getUserMedia">;

export interface BrowserObsFrameSourceOptions {
  readonly sessionId: string;
  readonly correlationId: string;
  readonly deviceId: string;
  readonly deviceLabel?: string;
  readonly evidenceClass: "live" | "diagnostic";
  readonly revision?: number;
  readonly sampleIntervalMs?: number;
  readonly staleAfterMs?: number;
  readonly width?: number;
  readonly height?: number;
  readonly frameRate?: number;
  readonly permissionTimeoutMs?: number;
}

interface BrowserObsFrameSourceDependencies {
  readonly mediaDevices?: BrowserMediaDevices;
  readonly createVideo?: () => HTMLVideoElement;
  readonly captureImage?: (source: CanvasImageSource) => Promise<ImageBitmap>;
  readonly now?: () => number;
  readonly idFactory?: () => string;
  readonly delay?: (milliseconds: number, signal?: AbortSignal) => Promise<void>;
}

type CaptureFailureState = "permission-denied" | "unavailable";

export class ObsCaptureError extends Error {
  readonly state: CaptureFailureState;
  readonly retryable: boolean;

  constructor(state: CaptureFailureState, message: string, retryable: boolean, cause?: unknown) {
    super(message, { cause });
    this.name = "ObsCaptureError";
    this.state = state;
    this.retryable = retryable;
  }
}

function getBrowserMediaDevices(): BrowserMediaDevices {
  if (typeof navigator === "undefined" || navigator.mediaDevices === undefined) {
    throw new ObsCaptureError(
      "unavailable",
      "Browser media devices are unavailable in this environment",
      false,
    );
  }
  return navigator.mediaDevices;
}

function createBrowserVideo(): HTMLVideoElement {
  if (typeof document === "undefined") {
    throw new ObsCaptureError(
      "unavailable",
      "Browser video capture requires a document environment",
      false,
    );
  }
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.setAttribute("aria-hidden", "true");
  return video;
}

async function captureBrowserImage(source: CanvasImageSource): Promise<ImageBitmap> {
  if (typeof createImageBitmap !== "function") {
    throw new ObsCaptureError(
      "unavailable",
      "This browser cannot create ephemeral frame images",
      false,
    );
  }
  return createImageBitmap(source);
}

function randomId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `obs-frame-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

async function abortableDelay(milliseconds: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted || milliseconds <= 0) return;
  await new Promise<void>((resolve) => {
    const timeout = setTimeout(finish, milliseconds);
    function finish() {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", finish);
      resolve();
    }
    signal?.addEventListener("abort", finish, { once: true });
  });
}

function classifyCaptureError(error: unknown): ObsCaptureError {
  if (error instanceof ObsCaptureError) return error;
  const name = error instanceof Error ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return new ObsCaptureError(
      "permission-denied",
      "Camera permission was denied. Allow camera access and try again.",
      true,
      error,
    );
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") {
    return new ObsCaptureError(
      "unavailable",
      "The selected OBS Virtual Camera is unavailable.",
      true,
      error,
    );
  }
  return new ObsCaptureError(
    "unavailable",
    "OBS Virtual Camera capture could not start.",
    true,
    error,
  );
}

async function getUserMediaWithTimeout(
  mediaDevices: BrowserMediaDevices,
  constraints: MediaStreamConstraints,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<MediaStream> {
  let discardLateStream = false;
  let timeout: ReturnType<typeof setTimeout> | null = null;
  let abortRequest: (() => void) | null = null;
  const pendingStream = mediaDevices.getUserMedia(constraints);
  void pendingStream
    .then((lateStream) => {
      if (discardLateStream) {
        for (const track of lateStream.getTracks()) track.stop();
      }
    })
    .catch(() => undefined);

  const timeoutResult = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(() => {
      discardLateStream = true;
      reject(
        new ObsCaptureError(
          "unavailable",
          "Camera permission did not complete. Check the browser permission prompt and try again.",
          true,
        ),
      );
    }, Math.max(1, timeoutMs));
  });

  const abortResult = new Promise<never>((_resolve, reject) => {
    abortRequest = () => {
      discardLateStream = true;
      const error = new Error("OBS capture was stopped while camera permission was pending");
      error.name = "AbortError";
      reject(error);
    };
    if (signal?.aborted) {
      abortRequest();
      return;
    }
    signal?.addEventListener("abort", abortRequest, { once: true });
  });

  try {
    return await Promise.race([pendingStream, timeoutResult, abortResult]);
  } finally {
    if (timeout !== null) clearTimeout(timeout);
    if (abortRequest !== null) signal?.removeEventListener("abort", abortRequest);
  }
}

export function isObsVirtualCameraLabel(label: string): boolean {
  return /\bobs\b.*\bvirtual\s+camera\b/i.test(label.trim());
}

export async function listBrowserVideoInputs(
  mediaDevices: BrowserMediaDevices = getBrowserMediaDevices(),
): Promise<ObsVideoInput[]> {
  const devices = await mediaDevices.enumerateDevices();
  return devices
    .filter((device) => device.kind === "videoinput" && device.deviceId.trim() !== "")
    .map((device) => ({
      deviceId: device.deviceId,
      label: device.label.trim() || "Camera label hidden until permission is granted",
      isObsVirtualCamera: isObsVirtualCameraLabel(device.label),
    }));
}

export async function requestBrowserVideoPermission(
  mediaDevices: BrowserMediaDevices = getBrowserMediaDevices(),
  timeoutMs = 10_000,
): Promise<ObsVideoInput[]> {
  let stream: MediaStream | null = null;
  try {
    stream = await getUserMediaWithTimeout(
      mediaDevices,
      { audio: false, video: true },
      timeoutMs,
    );
    return await listBrowserVideoInputs(mediaDevices);
  } catch (error) {
    throw classifyCaptureError(error);
  } finally {
    for (const track of stream?.getTracks() ?? []) track.stop();
  }
}

export class BrowserObsFrameSource implements FrameSource {
  private readonly mediaDevices: BrowserMediaDevices;
  private readonly createVideo: () => HTMLVideoElement;
  private readonly captureImage: (source: CanvasImageSource) => Promise<ImageBitmap>;
  private readonly now: () => number;
  private readonly idFactory: () => string;
  private readonly delay: (milliseconds: number, signal?: AbortSignal) => Promise<void>;
  private readonly listeners = new Set<(status: ObsCaptureStatus) => void>();
  private currentStatus: ObsCaptureStatus;
  private running = false;

  constructor(
    private readonly options: BrowserObsFrameSourceOptions,
    dependencies: BrowserObsFrameSourceDependencies = {},
  ) {
    this.mediaDevices = dependencies.mediaDevices ?? getBrowserMediaDevices();
    this.createVideo = dependencies.createVideo ?? createBrowserVideo;
    this.captureImage = dependencies.captureImage ?? captureBrowserImage;
    this.now = dependencies.now ?? Date.now;
    this.idFactory = dependencies.idFactory ?? randomId;
    this.delay = dependencies.delay ?? abortableDelay;
    this.currentStatus = {
      state: "idle",
      checkedAt: this.now(),
      deviceId: options.deviceId,
      deviceLabel: options.deviceLabel ?? null,
      message: "OBS capture has not started",
      retryable: true,
    };
  }

  getStatus(): ObsCaptureStatus {
    return this.currentStatus;
  }

  subscribe(listener: (status: ObsCaptureStatus) => void): () => void {
    this.listeners.add(listener);
    listener(this.currentStatus);
    return () => this.listeners.delete(listener);
  }

  async *frames(signal?: AbortSignal): AsyncGenerator<EphemeralGameplayFrame> {
    if (this.running) {
      throw new ObsCaptureError("unavailable", "OBS capture is already running", false);
    }
    this.running = true;
    let stream: MediaStream | null = null;
    let video: HTMLVideoElement | null = null;
    let failed = false;

    try {
      this.publish("requesting-permission", "Requesting access to OBS Virtual Camera", true);
      stream = await getUserMediaWithTimeout(
        this.mediaDevices,
        {
          audio: false,
          video: {
            deviceId: { exact: this.options.deviceId },
            width: { ideal: this.options.width ?? 1280 },
            height: { ideal: this.options.height ?? 720 },
            frameRate: { ideal: this.options.frameRate ?? 30 },
          },
        },
        this.options.permissionTimeoutMs ?? 10_000,
        signal,
      );

      const track = stream.getVideoTracks()[0];
      if (track === undefined) {
        throw new ObsCaptureError(
          "unavailable",
          "The selected source did not provide a video track",
          true,
        );
      }

      video = this.createVideo();
      video.srcObject = stream;
      await video.play();

      const sampleIntervalMs = Math.max(50, this.options.sampleIntervalMs ?? 500);
      const staleAfterMs = Math.max(sampleIntervalMs, this.options.staleAfterMs ?? 3_000);
      let lastReadyAt = this.now();

      while (!signal?.aborted && track.readyState !== "ended") {
        if (video.readyState < 2 || video.videoWidth <= 0 || video.videoHeight <= 0) {
          if (this.now() - lastReadyAt >= staleAfterMs) {
            this.publish("stale", "OBS is connected but no current frame is available", true);
          }
          await this.delay(Math.min(sampleIntervalMs, 100), signal);
          continue;
        }

        const capturedAt = this.now();
        const image = await this.captureImage(video);
        const receivedAt = Math.max(capturedAt, this.now());
        let observation: GameplayFrameObservation;
        try {
          observation = gameplayFrameObservationSchema.parse({
            envelope: {
              contractVersion: CONTRACT_VERSION,
              sessionId: this.options.sessionId,
              questCycleId: null,
              messageId: this.idFactory(),
              correlationId: this.options.correlationId,
              revision: this.options.revision ?? 0,
              occurredAt: capturedAt,
              receivedAt,
              source: "obs-virtual-camera",
              evidenceClass: this.options.evidenceClass,
            },
            frameId: this.idFactory(),
            capturedAt,
            width: video.videoWidth,
            height: video.videoHeight,
            status: "ready",
          });
        } catch (error) {
          image.close();
          throw error;
        }
        lastReadyAt = capturedAt;
        this.publish("ready", "Receiving ephemeral frames from OBS Virtual Camera", true);

        let released = false;
        const release = () => {
          if (released) return;
          released = true;
          image.close();
        };
        try {
          yield { observation, image, release };
        } finally {
          release();
        }

        await this.delay(sampleIntervalMs, signal);
      }
    } catch (error) {
      if (signal?.aborted) return;
      failed = true;
      const captureError = classifyCaptureError(error);
      this.publish(captureError.state, captureError.message, captureError.retryable);
      throw captureError;
    } finally {
      video?.pause();
      if (video !== null) video.srcObject = null;
      for (const track of stream?.getTracks() ?? []) track.stop();
      this.running = false;
      if (!failed) {
        this.publish("ended", "OBS capture stopped and browser tracks were released", true);
      }
    }
  }

  private publish(state: ObsCaptureState, message: string, retryable: boolean): void {
    this.currentStatus = {
      state,
      checkedAt: this.now(),
      deviceId: this.options.deviceId,
      deviceLabel: this.options.deviceLabel ?? null,
      message,
      retryable,
    };
    for (const listener of this.listeners) {
      try {
        listener(this.currentStatus);
      } catch {
        // Capture must not fail because a diagnostic/status observer threw.
      }
    }
  }
}
