import { describe, expect, it } from "vitest";

import {
  BrowserMediaFrameSource,
  findObsVirtualCameraDevice,
  requestObsVirtualCameraStream,
  type BrowserFrameCapture,
} from "./browser-frame-source";

describe("OBS browser frame source", () => {
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

    await expect(requestObsVirtualCameraStream({
      mediaDevices: {
        enumerateDevices: async () => devices,
        getUserMedia: async () => ({
          getTracks: () => [{ stop: () => { stopped += 1; } }],
        } as unknown as MediaStream),
      },
    })).rejects.toThrow("OBS Virtual Camera was not found");
    expect(stopped).toBe(1);
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
