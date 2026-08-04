"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  BrowserObsFrameSource,
  ObsCaptureError,
  listBrowserVideoInputs,
  requestBrowserVideoPermission,
  type ObsCaptureStatus,
  type ObsVideoInput,
} from "./browser-frame-source";
import styles from "./obs-capture-diagnostic.module.css";

interface CapturedFrameSummary {
  readonly capturedAt: number;
  readonly width: number;
  readonly height: number;
  readonly source: string;
  readonly evidenceClass: string;
}

const idleStatus: ObsCaptureStatus = {
  state: "idle",
  checkedAt: 0,
  deviceId: null,
  deviceLabel: null,
  message: "Grant camera permission to discover OBS Virtual Camera",
  retryable: true,
};

export function ObsCaptureDiagnostic() {
  const [devices, setDevices] = useState<ObsVideoInput[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [rawGameConfirmed, setRawGameConfirmed] = useState(false);
  const [captureStatus, setCaptureStatus] = useState<ObsCaptureStatus>(idleStatus);
  const [frameSummary, setFrameSummary] = useState<CapturedFrameSummary | null>(null);
  const [frameCount, setFrameCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [permissionBusy, setPermissionBusy] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const selectedDevice = useMemo(
    () => devices.find((device) => device.deviceId === selectedDeviceId) ?? null,
    [devices, selectedDeviceId],
  );
  const running =
    captureStatus.state === "requesting-permission" ||
    captureStatus.state === "ready" ||
    captureStatus.state === "stale";

  useEffect(() => {
    void refreshDevices(false);
    return () => controllerRef.current?.abort();
  }, []);

  async function refreshDevices(requireObs: boolean) {
    try {
      const nextDevices = await listBrowserVideoInputs();
      setDevices(nextDevices);
      const obsDevice = nextDevices.find((device) => device.isObsVirtualCamera) ?? null;
      if (obsDevice !== null) setSelectedDeviceId(obsDevice.deviceId);
      if (requireObs && obsDevice === null) {
        setError("OBS Virtual Camera was not found. Start it in OBS, then refresh devices.");
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Camera devices could not be listed.");
    }
  }

  async function grantPermission() {
    setPermissionBusy(true);
    setError(null);
    try {
      const nextDevices = await requestBrowserVideoPermission();
      setDevices(nextDevices);
      const obsDevice = nextDevices.find((device) => device.isObsVirtualCamera) ?? null;
      if (obsDevice === null) {
        setError("Permission was granted, but OBS Virtual Camera was not found or is not running.");
        return;
      }
      setSelectedDeviceId(obsDevice.deviceId);
      setCaptureStatus({
        state: "idle",
        checkedAt: Date.now(),
        deviceId: obsDevice.deviceId,
        deviceLabel: obsDevice.label,
        message: "OBS Virtual Camera is available and ready to start",
        retryable: true,
      });
    } catch (reason) {
      const message =
        reason instanceof ObsCaptureError
          ? reason.message
          : "Camera permission could not be completed.";
      setError(message);
      setCaptureStatus({
        state: reason instanceof ObsCaptureError ? reason.state : "unavailable",
        checkedAt: Date.now(),
        deviceId: null,
        deviceLabel: null,
        message,
        retryable: true,
      });
    } finally {
      setPermissionBusy(false);
    }
  }

  async function startCapture() {
    if (selectedDevice === null || !selectedDevice.isObsVirtualCamera) {
      setError("Select an identified OBS Virtual Camera before starting capture.");
      return;
    }
    if (!rawGameConfirmed) {
      setError("Confirm that the OBS Virtual Camera scene excludes the ChatXPT overlay.");
      return;
    }

    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setError(null);
    setFrameCount(0);
    setFrameSummary(null);

    const source = new BrowserObsFrameSource({
      sessionId: "diagnostic-obs-session",
      correlationId: "diagnostic-obs-capture",
      deviceId: selectedDevice.deviceId,
      deviceLabel: selectedDevice.label,
      evidenceClass: "diagnostic",
      sampleIntervalMs: 500,
      staleAfterMs: 3_000,
      width: 1280,
      height: 720,
      frameRate: 30,
    });
    const unsubscribe = source.subscribe(setCaptureStatus);

    try {
      for await (const frame of source.frames(controller.signal)) {
        try {
          const canvas = canvasRef.current;
          const context = canvas?.getContext("2d") ?? null;
          if (canvas !== null && context !== null) {
            canvas.width = frame.observation.width;
            canvas.height = frame.observation.height;
            context.drawImage(frame.image, 0, 0, canvas.width, canvas.height);
          }
          setFrameCount((count) => count + 1);
          setFrameSummary({
            capturedAt: frame.observation.capturedAt,
            width: frame.observation.width,
            height: frame.observation.height,
            source: frame.observation.envelope.source,
            evidenceClass: frame.observation.envelope.evidenceClass,
          });
        } finally {
          frame.release();
        }
      }
    } catch (reason) {
      if (!controller.signal.aborted) {
        setError(reason instanceof Error ? reason.message : "OBS capture stopped unexpectedly.");
      }
    } finally {
      unsubscribe();
      if (controllerRef.current === controller) controllerRef.current = null;
    }
  }

  function stopCapture() {
    controllerRef.current?.abort();
    controllerRef.current = null;
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <p className={styles.kicker}>ROLE 1 CAPTURE DIAGNOSTIC</p>
        <h1>Real OBS Virtual Camera frame source</h1>
        <p>
          This page captures real browser frames ephemerally. It does not run OCR, infer gameplay
          events, save raw video, or count as the final Twitch workflow.
        </p>
      </header>

      <section className={styles.grid}>
        <div className={styles.panel}>
          <h2>1. Connect the raw-game source</h2>
          <ol>
            <li>In OBS, create a scene containing only the game capture.</li>
            <li>Do not include the ChatXPT browser overlay in that Virtual Camera scene.</li>
            <li>Start OBS Virtual Camera, then grant browser camera permission here.</li>
          </ol>

          <button type="button" onClick={grantPermission} disabled={permissionBusy || running}>
            {permissionBusy ? "Requesting permission…" : "Grant permission and find OBS"}
          </button>
          <button type="button" onClick={() => void refreshDevices(true)} disabled={running}>
            Refresh devices
          </button>

          <label>
            OBS source
            <select
              value={selectedDeviceId}
              onChange={(event) => setSelectedDeviceId(event.target.value)}
              disabled={running}
            >
              <option value="">Select OBS Virtual Camera</option>
              {devices.map((device) => (
                <option
                  key={device.deviceId}
                  value={device.deviceId}
                  disabled={!device.isObsVirtualCamera}
                >
                  {device.label}
                  {device.isObsVirtualCamera ? " — eligible" : " — not used"}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.confirmation}>
            <input
              type="checkbox"
              checked={rawGameConfirmed}
              onChange={(event) => setRawGameConfirmed(event.target.checked)}
              disabled={running}
            />
            I confirm the Virtual Camera scene is raw gameplay and excludes the ChatXPT overlay.
          </label>

          <div className={styles.actions}>
            <button
              type="button"
              onClick={() => void startCapture()}
              disabled={running || selectedDevice === null || !rawGameConfirmed}
            >
              Start real capture
            </button>
            <button type="button" onClick={stopCapture} disabled={!running}>
              Stop and release camera
            </button>
          </div>

          <div className={styles.status} data-state={captureStatus.state} aria-live="polite">
            <strong>{captureStatus.state}</strong>
            <span>{captureStatus.message}</span>
          </div>
          {error !== null ? <p className={styles.error}>{error}</p> : null}
        </div>

        <div className={styles.panel}>
          <h2>2. Inspect ephemeral delivery</h2>
          <canvas ref={canvasRef} className={styles.preview} aria-label="Live OBS frame preview" />
          {frameSummary === null ? (
            <p className={styles.empty}>No frame has been received. Gameplay facts remain unknown.</p>
          ) : (
            <dl className={styles.metadata}>
              <div>
                <dt>Frames delivered</dt>
                <dd>{frameCount}</dd>
              </div>
              <div>
                <dt>Dimensions</dt>
                <dd>
                  {frameSummary.width} × {frameSummary.height}
                </dd>
              </div>
              <div>
                <dt>Captured</dt>
                <dd>{new Date(frameSummary.capturedAt).toLocaleTimeString()}</dd>
              </div>
              <div>
                <dt>Canonical source</dt>
                <dd>{frameSummary.source}</dd>
              </div>
              <div>
                <dt>Evidence class</dt>
                <dd>{frameSummary.evidenceClass}</dd>
              </div>
              <div>
                <dt>Raw frame storage</dt>
                <dd>None</dd>
              </div>
            </dl>
          )}
          <p className={styles.boundary}>
            Role 2 receives each frame through the public <code>FrameSource</code> boundary and owns
            all visual analysis. This diagnostic never creates health, kill, score, or match-state
            claims.
          </p>
        </div>
      </section>
    </main>
  );
}
