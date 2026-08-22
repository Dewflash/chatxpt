import { describe, expect, it, vi } from "vitest";

import {
  GameplayCapturePreviewError,
  connectGameplayCapturePreview,
  describeSelectedGameplaySource,
} from "./gameplay-capture-preview";

function track(
  label: string,
  displaySurface?: string,
): Pick<MediaStreamTrack, "getSettings" | "label"> {
  return {
    label,
    getSettings: () => ({ displaySurface } as MediaTrackSettings),
  };
}

function previewVideo(input: {
  readonly play?: () => Promise<void>;
  readonly readyState?: number;
  readonly videoWidth?: number;
  readonly videoHeight?: number;
} = {}): HTMLVideoElement {
  const listeners = new Map<string, Set<EventListenerOrEventListenerObject>>();
  return {
    muted: false,
    autoplay: false,
    playsInline: false,
    srcObject: null,
    readyState: input.readyState ?? 4,
    videoWidth: input.videoWidth ?? 1920,
    videoHeight: input.videoHeight ?? 1080,
    play: input.play ?? (async () => undefined),
    pause: vi.fn(),
    addEventListener: (name: string, listener: EventListenerOrEventListenerObject) => {
      const registered = listeners.get(name) ?? new Set();
      registered.add(listener);
      listeners.set(name, registered);
    },
    removeEventListener: (name: string, listener: EventListenerOrEventListenerObject) => {
      listeners.get(name)?.delete(listener);
    },
  } as unknown as HTMLVideoElement;
}

describe("gameplay capture preview", () => {
  it("names the exact selected screen and its browser-provided surface type", () => {
    expect(describeSelectedGameplaySource(track("Screen 2", "monitor"), "screen-window"))
      .toBe("Screen 2 · Entire screen");
    expect(describeSelectedGameplaySource(track("Minecraft", "window"), "screen-window"))
      .toBe("Minecraft · Application window");
  });

  it("states the selected source type honestly when the browser hides its title", () => {
    expect(describeSelectedGameplaySource(track("", "browser"), "screen-window"))
      .toBe("Browser tab selected (browser did not expose its name)");
    expect(describeSelectedGameplaySource(track("", undefined), "screen-window"))
      .toBe("Screen or window selected (browser did not expose its name)");
    expect(describeSelectedGameplaySource(track("", undefined), "obs-virtual-camera"))
      .toBe("OBS Virtual Camera");
  });

  it("requires a visible playable frame before capture is considered connected", async () => {
    const stream = {} as MediaStream;
    const video = previewVideo();

    await connectGameplayCapturePreview(video, stream);

    expect(video.srcObject).toBe(stream);
    expect(video.muted).toBe(true);
    expect(video.autoplay).toBe(true);
    expect(video.playsInline).toBe(true);
  });

  it("clears the preview and rejects false success when playback fails", async () => {
    const denied = new DOMException("playback blocked", "NotAllowedError");
    const video = previewVideo({ play: async () => { throw denied; } });

    await expect(connectGameplayCapturePreview(video, {} as MediaStream))
      .rejects.toBeInstanceOf(GameplayCapturePreviewError);
    expect(video.pause).toHaveBeenCalledOnce();
    expect(video.srcObject).toBeNull();
  });
});
