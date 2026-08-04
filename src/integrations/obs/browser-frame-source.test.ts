import { describe, expect, it, vi } from "vitest";

import {
  BrowserObsFrameSource,
  ObsCaptureError,
  isObsVirtualCameraLabel,
  listBrowserVideoInputs,
  requestBrowserVideoPermission,
} from "./browser-frame-source";

function mediaDevice(kind: MediaDeviceKind, deviceId: string, label: string): MediaDeviceInfo {
  return { kind, deviceId, label, groupId: "fixture-group", toJSON: () => ({}) };
}

function captureStream() {
  const stop = vi.fn();
  const track = { readyState: "live", stop } as unknown as MediaStreamTrack;
  const stream = {
    getVideoTracks: () => [track],
    getTracks: () => [track],
  } as unknown as MediaStream;
  return { stop, stream, track };
}

function captureVideo(overrides: Partial<HTMLVideoElement> = {}): HTMLVideoElement {
  return {
    muted: false,
    playsInline: false,
    readyState: 4,
    videoWidth: 1280,
    videoHeight: 720,
    srcObject: null,
    play: vi.fn(async () => undefined),
    pause: vi.fn(),
    setAttribute: vi.fn(),
    ...overrides,
  } as unknown as HTMLVideoElement;
}

describe("OBS Virtual Camera device discovery", () => {
  it("recognises OBS labels without accepting unrelated cameras", () => {
    expect(isObsVirtualCameraLabel("OBS Virtual Camera")).toBe(true);
    expect(isObsVirtualCameraLabel("OBS   Virtual Camera")).toBe(true);
    expect(isObsVirtualCameraLabel("FaceTime HD Camera")).toBe(false);
  });

  it("returns video inputs with privacy-safe hidden labels", async () => {
    const inputs = await listBrowserVideoInputs({
      getUserMedia: vi.fn(),
      enumerateDevices: vi.fn(async () => [
        mediaDevice("videoinput", "obs-device", "OBS Virtual Camera"),
        mediaDevice("videoinput", "hidden-device", ""),
        mediaDevice("audioinput", "microphone", "Microphone"),
      ]),
    });

    expect(inputs).toEqual([
      { deviceId: "obs-device", label: "OBS Virtual Camera", isObsVirtualCamera: true },
      {
        deviceId: "hidden-device",
        label: "Camera label hidden until permission is granted",
        isObsVirtualCamera: false,
      },
    ]);
  });

  it("fails a browser permission request that remains pending", async () => {
    const request = requestBrowserVideoPermission(
      {
        getUserMedia: vi.fn(() => new Promise<MediaStream>(() => undefined)),
        enumerateDevices: vi.fn(async () => []),
      },
      1,
    );

    await expect(request).rejects.toMatchObject({
      name: "ObsCaptureError",
      state: "unavailable",
      retryable: true,
    });
  });
});

describe("BrowserObsFrameSource", () => {
  it("aborts immediately while browser permission is pending and cleans up a late stream", async () => {
    const { stop, stream } = captureStream();
    const controller = new AbortController();
    let resolvePermission: ((value: MediaStream) => void) | undefined;
    const getUserMedia = vi.fn(
      () =>
        new Promise<MediaStream>((resolve) => {
          resolvePermission = resolve;
        }),
    );
    const source = new BrowserObsFrameSource(
      {
        sessionId: "capture-session",
        correlationId: "capture-correlation",
        deviceId: "obs-device",
        evidenceClass: "diagnostic",
        permissionTimeoutMs: 60_000,
      },
      {
        mediaDevices: {
          getUserMedia,
          enumerateDevices: vi.fn(async () => []),
        },
        now: () => 1_786_100_000_000,
      },
    );

    const next = source.frames(controller.signal)[Symbol.asyncIterator]().next();
    await vi.waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(1));
    controller.abort();

    await expect(next).resolves.toEqual({ done: true, value: undefined });
    resolvePermission?.(stream);
    await vi.waitFor(() => expect(stop).toHaveBeenCalledTimes(1));
    expect(source.getStatus().state).toBe("ended");
  });

  it("yields a real-source ephemeral frame and releases browser resources", async () => {
    const { stop, stream } = captureStream();
    const video = captureVideo();
    const close = vi.fn();
    const bitmap = { close } as unknown as ImageBitmap;
    const statuses: string[] = [];
    const ids = ["frame-message", "frame-id"];
    const source = new BrowserObsFrameSource(
      {
        sessionId: "capture-session",
        correlationId: "capture-correlation",
        deviceId: "obs-device",
        deviceLabel: "OBS Virtual Camera",
        evidenceClass: "diagnostic",
      },
      {
        mediaDevices: {
          getUserMedia: vi.fn(async () => stream),
          enumerateDevices: vi.fn(async () => []),
        },
        createVideo: () => video,
        captureImage: vi.fn(async () => bitmap),
        now: () => 1_786_100_000_000,
        idFactory: () => ids.shift() ?? "extra-id",
        delay: vi.fn(async () => undefined),
      },
    );
    source.subscribe((status) => statuses.push(status.state));

    const iterator = source.frames()[Symbol.asyncIterator]();
    const next = await iterator.next();
    expect(next.done).toBe(false);
    if (next.done) return;

    expect(next.value.observation).toMatchObject({
      frameId: "frame-id",
      capturedAt: 1_786_100_000_000,
      width: 1280,
      height: 720,
      status: "ready",
      envelope: {
        messageId: "frame-message",
        source: "obs-virtual-camera",
        evidenceClass: "diagnostic",
      },
    });
    expect(next.value.image).toBe(bitmap);
    next.value.release();
    next.value.release();
    expect(close).toHaveBeenCalledTimes(1);

    await iterator.return?.(undefined as never);
    expect(stop).toHaveBeenCalledTimes(1);
    expect(video.pause).toHaveBeenCalledTimes(1);
    expect(video.srcObject).toBeNull();
    expect(statuses).toEqual(["idle", "requesting-permission", "ready", "ended"]);
  });

  it("reports a typed permission failure without fabricating a frame", async () => {
    const denied = new Error("denied");
    denied.name = "NotAllowedError";
    const source = new BrowserObsFrameSource(
      {
        sessionId: "capture-session",
        correlationId: "capture-correlation",
        deviceId: "obs-device",
        evidenceClass: "diagnostic",
      },
      {
        mediaDevices: {
          getUserMedia: vi.fn(async () => {
            throw denied;
          }),
          enumerateDevices: vi.fn(async () => []),
        },
        now: () => 1_786_100_000_000,
      },
    );

    const iterator = source.frames()[Symbol.asyncIterator]();
    const next = iterator.next();
    await expect(next).rejects.toBeInstanceOf(ObsCaptureError);
    await expect(next).rejects.toMatchObject({
      name: "ObsCaptureError",
      state: "permission-denied",
      retryable: true,
    });
    expect(source.getStatus().state).toBe("permission-denied");
  });

  it("closes an unreleased bitmap when the consumer stops iteration", async () => {
    const { stream } = captureStream();
    const close = vi.fn();
    const source = new BrowserObsFrameSource(
      {
        sessionId: "capture-session",
        correlationId: "capture-correlation",
        deviceId: "obs-device",
        evidenceClass: "diagnostic",
      },
      {
        mediaDevices: {
          getUserMedia: vi.fn(async () => stream),
          enumerateDevices: vi.fn(async () => []),
        },
        createVideo: () => captureVideo(),
        captureImage: vi.fn(async () => ({ close }) as unknown as ImageBitmap),
        now: () => 1_786_100_000_000,
        idFactory: () => "capture-id",
      },
    );

    const iterator = source.frames()[Symbol.asyncIterator]();
    const next = await iterator.next();
    expect(next.done).toBe(false);
    await iterator.return?.(undefined as never);

    expect(close).toHaveBeenCalledTimes(1);
  });

  it("surfaces stale capture and stops cleanly when aborted", async () => {
    const { stop, stream } = captureStream();
    const video = captureVideo({ readyState: 0, videoWidth: 0, videoHeight: 0 });
    const controller = new AbortController();
    const statuses: string[] = [];
    let currentTime = 0;
    const source = new BrowserObsFrameSource(
      {
        sessionId: "capture-session",
        correlationId: "capture-correlation",
        deviceId: "obs-device",
        evidenceClass: "diagnostic",
        sampleIntervalMs: 100,
        staleAfterMs: 500,
      },
      {
        mediaDevices: {
          getUserMedia: vi.fn(async () => stream),
          enumerateDevices: vi.fn(async () => []),
        },
        createVideo: () => video,
        now: () => {
          currentTime += 1_000;
          return currentTime;
        },
        delay: vi.fn(async () => controller.abort()),
      },
    );
    source.subscribe((status) => statuses.push(status.state));

    const result = await source.frames(controller.signal)[Symbol.asyncIterator]().next();

    expect(result.done).toBe(true);
    expect(statuses).toContain("stale");
    expect(statuses.at(-1)).toBe("ended");
    expect(stop).toHaveBeenCalledTimes(1);
  });
});
