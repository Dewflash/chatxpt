export type GameplayCaptureSource = "screen-window" | "obs-virtual-camera";

const DISPLAY_SURFACE_LABELS: Readonly<Record<string, string>> = {
  monitor: "Entire screen",
  window: "Application window",
  browser: "Browser tab",
};

const PREVIEW_READY_EVENTS = [
  "loadedmetadata",
  "loadeddata",
  "canplay",
  "playing",
  "resize",
] as const;

export class GameplayCapturePreviewError extends Error {
  override readonly name = "GameplayCapturePreviewError";

  constructor(options?: ErrorOptions) {
    super(
      "The selected feed opened, but ChatXPT could not display a live preview. Stop sharing and select the gameplay screen again.",
      options,
    );
  }
}

export function describeSelectedGameplaySource(
  track: Pick<MediaStreamTrack, "getSettings" | "label">,
  source: GameplayCaptureSource,
): string {
  const trackLabel = track.label.trim();
  if (source === "obs-virtual-camera") {
    return trackLabel || "OBS Virtual Camera";
  }

  const displaySurface = (track.getSettings() as MediaTrackSettings & {
    readonly displaySurface?: string;
  }).displaySurface;
  const surfaceLabel = displaySurface === undefined
    ? "Screen or window"
    : DISPLAY_SURFACE_LABELS[displaySurface] ?? "Screen or window";

  return trackLabel
    ? `${trackLabel} · ${surfaceLabel}`
    : `${surfaceLabel} selected (browser did not expose its name)`;
}

export interface ConnectGameplayCapturePreviewOptions {
  readonly timeoutMs?: number;
}

/**
 * Makes the operator-visible video a required part of capture readiness.
 * The caller may pass this same element to the frame sampler so displayed and
 * analysed pixels cannot silently come from different playback elements.
 */
export async function connectGameplayCapturePreview(
  video: HTMLVideoElement,
  stream: MediaStream,
  options: ConnectGameplayCapturePreviewOptions = {},
): Promise<void> {
  const timeoutMs = options.timeoutMs ?? 5_000;
  video.muted = true;
  video.autoplay = true;
  video.playsInline = true;
  video.srcObject = stream;

  try {
    await new Promise<void>((resolve, reject) => {
      let settled = false;
      let playbackStarted = false;
      let timeout: ReturnType<typeof globalThis.setTimeout> | null = null;

      const cleanup = () => {
        for (const eventName of PREVIEW_READY_EVENTS) {
          video.removeEventListener(eventName, handleReady);
        }
        video.removeEventListener("error", handleError);
        if (timeout !== null) globalThis.clearTimeout(timeout);
      };
      const settle = (action: () => void) => {
        if (settled) return;
        settled = true;
        cleanup();
        action();
      };
      const hasVisibleFrame = () =>
        video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0;
      const handleReady = () => {
        if (playbackStarted && hasVisibleFrame()) settle(resolve);
      };
      const handleError = () => settle(() => reject(new GameplayCapturePreviewError()));

      for (const eventName of PREVIEW_READY_EVENTS) {
        video.addEventListener(eventName, handleReady);
      }
      video.addEventListener("error", handleError, { once: true });
      timeout = globalThis.setTimeout(
        () => settle(() => reject(new GameplayCapturePreviewError())),
        timeoutMs,
      );

      void video.play().then(() => {
        playbackStarted = true;
        handleReady();
      }, (caught: unknown) => {
        settle(() => reject(new GameplayCapturePreviewError({ cause: caught })));
      });
      handleReady();
    });
  } catch (caught) {
    video.pause();
    video.srcObject = null;
    if (caught instanceof GameplayCapturePreviewError) throw caught;
    throw new GameplayCapturePreviewError({ cause: caught });
  }
}
