import { describe, expect, it } from "vitest";

import {
  BrowserMediaFrameSource,
  ObsVirtualCameraError,
  findObsVirtualCameraDevice,
  obsVirtualCameraFailureReason,
  requestObsVirtualCameraStream,
  type BrowserFrameCapture,
} from "./browser-frame-source";

describe("OBS browser frame source", () => {
  it("stamps each frame with the latest realtime session authority", async () => {
    let revision = 4;
    let cycleId = "cycle-4";
    const capture: BrowserFrameCapture = {
      width: 1280,
      height: 720,
      start: () => undefined,
      captureFrame: () => ({} as CanvasImageSource),
    };
    const source = new BrowserMediaFrameSource({
      sessionId: "session-live",
      correlationId: "capture-live",
      capture,
      authority: () => ({ questCycleId: cycleId, revision, evidenceClass: "live" }),
      frameIntervalMs: 0,
      sleep: async () => undefined,
      now: (() => {
        let now = 100;
        return () => ++now;
      })(),
    });
    const controller = new AbortController();
    const observations: Array<{ envelope: { questCycleId: string | null; revision: number } }> = [];

    for await (const frame of source.frames(controller.signal)) {
      observations.push(frame.observation);
      frame.release();
      if (observations.length === 1) {
        revision = 5;
        cycleId = "cycle-5";
      } else {
        controller.abort();
      }
    }

    expect(observations.map((observation) => [
      observation.envelope.questCycleId,
      observation.envelope.revision,
    ])).toEqual([
      ["cycle-4", 4],
      ["cycle-5", 5],
    ]);
  });

  it("selects the OBS Virtual Camera when the browser exposes it", async () => {
    const devices = [
      { deviceId: "webcam", groupId: "group-a", kind: "videoinput", label: "FaceTime HD Camera", toJSON: () => ({}) },
      { deviceId: "obs", groupId: "group-b", kind: "videoinput", label: "OBS Virtual Camera", toJSON: () => ({}) },
    ] satisfies MediaDeviceInfo[];
    let requested: MediaStreamConstraints | undefined;
    const stream = { getTracks: () => [] } as unknown as MediaStream;

    const selected = findObsVirtualCameraDevice(devices);
    const requestedStream = await requestObsVirtualCameraStream({
      mediaDevices: {
        enumerateDevices: async () => devices,
        getUserMedia: async (constraints) => {
          requested = constraints;
          return stream;
        },
      },
    });

    expect(selected?.deviceId).toBe("obs");
    expect(requestedStream).toBe(stream);
    expect(requested).toEqual({
      audio: false,
      video: { deviceId: { exact: "obs" } },
    });
  });

  it("uses generic video only to unlock labels, then reselects OBS exactly", async () => {
    const hiddenDevices = [
      { deviceId: "camera", groupId: "group-a", kind: "videoinput", label: "", toJSON: () => ({}) },
    ] satisfies MediaDeviceInfo[];
    const labelledDevices = [
      { deviceId: "camera", groupId: "group-a", kind: "videoinput", label: "FaceTime HD Camera", toJSON: () => ({}) },
      { deviceId: "obs", groupId: "group-b", kind: "videoinput", label: "OBS Virtual Camera", toJSON: () => ({}) },
    ] satisfies MediaDeviceInfo[];
    const requests: MediaStreamConstraints[] = [];
    let enumerations = 0;
    let stopped = 0;
    const provisional = {
      getTracks: () => [{ stop: () => { stopped += 1; } }],
    } as unknown as MediaStream;
    const obsStream = { getTracks: () => [] } as unknown as MediaStream;

    const selected = await requestObsVirtualCameraStream({
      mediaDevices: {
        enumerateDevices: async () => {
          enumerations += 1;
          return enumerations === 1 ? hiddenDevices : labelledDevices;
        },
        getUserMedia: async (constraints) => {
          requests.push(constraints ?? {});
          return requests.length === 1 ? provisional : obsStream;
        },
      },
    });

    expect(selected).toBe(obsStream);
    expect(requests).toEqual([
      { audio: false, video: true },
      { audio: false, video: { deviceId: { exact: "obs" } } },
    ]);
    expect(stopped).toBe(1);
  });

  it("stops the provisional webcam and fails when OBS remains unavailable", async () => {
    const devices = [
      { deviceId: "camera", groupId: "group-a", kind: "videoinput", label: "FaceTime HD Camera", toJSON: () => ({}) },
    ] satisfies MediaDeviceInfo[];
    let stopped = 0;

    const result = requestObsVirtualCameraStream({
      mediaDevices: {
        enumerateDevices: async () => devices,
        getUserMedia: async () => ({
          getTracks: () => [{ stop: () => { stopped += 1; } }],
        } as unknown as MediaStream),
      },
    });
    await expect(result).rejects.toMatchObject({
      reason: "not-found",
    });
    await expect(result).rejects.toThrow("fully restart the browser");
    expect(stopped).toBe(1);
  });

  it("stops the provisional stream when device re-enumeration fails", async () => {
    let enumerations = 0;
    let stopped = 0;

    const result = requestObsVirtualCameraStream({
      mediaDevices: {
        enumerateDevices: async () => {
          enumerations += 1;
          if (enumerations === 1) return [];
          throw Object.assign(new Error("device enumeration failed"), { name: "NotReadableError" });
        },
        getUserMedia: async () => ({
          getTracks: () => [{ stop: () => { stopped += 1; } }],
        } as unknown as MediaStream),
      },
    });

    await expect(result).rejects.toMatchObject({ reason: "device-unavailable" });
    expect(stopped).toBe(1);
  });

  it("classifies cross-realm browser camera errors without platform-specific copy", async () => {
    const denied = Object.assign(new Error("denied"), { name: "NotAllowedError" });
    const result = requestObsVirtualCameraStream({
      mediaDevices: {
        enumerateDevices: async () => [],
        getUserMedia: async () => { throw denied; },
      },
    });

    await expect(result).rejects.toBeInstanceOf(ObsVirtualCameraError);
    await expect(result).rejects.toMatchObject({
      reason: "permission-denied",
      message: "Camera access is blocked. Allow camera access for this browser, then retry.",
    });
    expect(obsVirtualCameraFailureReason(denied)).toBe("permission-denied");
  });

  it("emits canonical ephemeral frame observations and releases captured images", async () => {
    const image = {} as CanvasImageSource;
    const releaseCalls: CanvasImageSource[] = [];
    let started = 0;
    let stopped = 0;
    const capture: BrowserFrameCapture = {
      width: 1280,
      height: 720,
      start: () => {
        started += 1;
      },
      captureFrame: () => image,
      releaseFrame: (releasedImage) => {
        releaseCalls.push(releasedImage);
      },
      stop: () => {
        stopped += 1;
      },
    };
    const source = new BrowserMediaFrameSource({
      sessionId: "fixture-session",
      correlationId: "fixture-correlation",
      capture,
      evidenceClass: "fixture",
      source: "test-fixture",
      now: () => 1_786_200_000_000,
      idFactory: (sequence) => `fixture-frame-${sequence}`,
      sleep: async () => undefined,
    });

    const iterator = source.frames()[Symbol.asyncIterator]();
    const first = await iterator.next();
    first.value?.release();
    first.value?.release();
    await iterator.return?.();

    expect(started).toBe(1);
    expect(stopped).toBe(1);
    expect(first.done).toBe(false);
    expect(first.value?.image).toBe(image);
    expect(first.value?.observation).toMatchObject({
      frameId: "fixture-frame-1",
      capturedAt: 1_786_200_000_000,
      width: 1280,
      height: 720,
      status: "ready",
      envelope: {
        sessionId: "fixture-session",
        source: "test-fixture",
        evidenceClass: "fixture",
      },
    });
    expect(releaseCalls).toEqual([image]);
  });
});
