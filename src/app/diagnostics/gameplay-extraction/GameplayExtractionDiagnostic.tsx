"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  MultiGameVisionAnalyzer,
  createBrowserCanvasPixelSampler,
  streamMultiGameVisionAssessments,
  type GameProfileSelection,
} from "@/extraction";
import {
  BrowserMediaFrameSource,
  MediaStreamVideoFrameCapture,
  requestObsVirtualCameraStream,
} from "@/integrations";

import styles from "./page.module.css";

type DiagnosticGame = "brawl-stars" | "minecraft" | "generic";

interface LatestDiagnostic {
  readonly frameCount: number;
  readonly capturedAt: number;
  readonly supportTier: string;
  readonly visualState: string;
  readonly confidence: number;
  readonly cadence: string;
  readonly cadenceReason: string;
  readonly hudStatus: string;
  readonly supportedSignals: readonly string[];
}

function diagnosticError(caught: unknown): string {
  if (caught instanceof DOMException && caught.name === "NotAllowedError") {
    return "Camera access is blocked by macOS. Allow camera access for the browser running this diagnostic, then retry.";
  }
  return caught instanceof Error ? caught.message : "OBS extraction diagnostic failed.";
}

function selectionFor(game: DiagnosticGame): GameProfileSelection {
  if (game === "generic") {
    return {
      requestedGameId: null,
      requestedProfileId: null,
      source: "unknown",
      confidence: 0,
    };
  }
  return {
    requestedGameId: game,
    requestedProfileId:
      game === "brawl-stars" ? "brawl-stars-standard-v1" : "minecraft-java-vanilla-v1",
    source: "streamer-config",
    confidence: 1,
  };
}

export function GameplayExtractionDiagnostic() {
  const [game, setGame] = useState<DiagnosticGame>("brawl-stars");
  const [running, setRunning] = useState(false);
  const [latest, setLatest] = useState<LatestDiagnostic | null>(null);
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const selectedProfile = useMemo(() => selectionFor(game), [game]);

  function stop() {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setRunning(false);
  }

  useEffect(() => () => controllerRef.current?.abort(), []);

  async function start() {
    if (running) return;
    const controller = new AbortController();
    controllerRef.current = controller;
    setError(null);
    setLatest(null);
    setRunning(true);
    let mediaStream: MediaStream | null = null;
    try {
      mediaStream = await requestObsVirtualCameraStream();
      const capture = new MediaStreamVideoFrameCapture(mediaStream, { stopStreamOnEnd: true });
      const source = new BrowserMediaFrameSource({
        sessionId: "obs-extraction-diagnostic",
        correlationId: "obs-extraction-diagnostic",
        capture,
        evidenceClass: "diagnostic",
        source: "obs-virtual-camera",
        frameIntervalMs: 100,
      });
      const analyzer = new MultiGameVisionAnalyzer();
      let frameCount = 0;
      for await (const output of streamMultiGameVisionAssessments(source, {
        sampler: createBrowserCanvasPixelSampler(),
        sampleWidth: 160,
        sampleHeight: 90,
        selection: selectedProfile,
        analyzer,
      }, controller.signal)) {
        if (output.status !== "ready") continue;
        frameCount += 1;
        const assessment = output.assessment;
        setLatest({
          frameCount,
          capturedAt: output.frame.capturedAt,
          supportTier: assessment.supportTier,
          visualState: assessment.interpretation.state,
          confidence: assessment.interpretation.confidence,
          cadence: assessment.sampling.mode,
          cadenceReason: assessment.sampling.reason,
          hudStatus:
            assessment.brawlHud?.status ?? assessment.minecraftHud?.status ?? "not-applicable",
          supportedSignals: assessment.supportedSignals,
        });
      }
    } catch (caught) {
      if (!controller.signal.aborted) {
        setError(diagnosticError(caught));
        for (const track of mediaStream?.getTracks() ?? []) track.stop();
      }
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null;
      setRunning(false);
    }
  }

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>Local diagnostic only</p>
        <h1>OBS gameplay extraction</h1>
        <p>
          Reads the OBS Virtual Camera at burst-capable cadence and runs the bounded multi-game
          analyzer locally. No frame, camera image, or player identity is uploaded or persisted.
        </p>
      </header>

      <section className={styles.panel} aria-labelledby="setup-heading">
        <h2 id="setup-heading">Before starting</h2>
        <ol>
          <li>In OBS, show the game or a team-owned recording in the active scene.</li>
          <li>Click <strong>Start Virtual Camera</strong> in OBS.</li>
          <li>Select the matching game profile below, then allow camera access.</li>
        </ol>
        <label className={styles.field}>
          Game profile
          <select value={game} disabled={running} onChange={(event) => setGame(event.target.value as DiagnosticGame)}>
            <option value="brawl-stars">Brawl Stars — calibrated when HUD confirms</option>
            <option value="minecraft">Minecraft Java — vanilla HUD calibration</option>
            <option value="generic">Generic — universal visual signals only</option>
          </select>
        </label>
        <div className={styles.actions}>
          <button type="button" disabled={running} onClick={() => void start()}>Start diagnostic</button>
          <button type="button" disabled={!running} onClick={stop}>Stop</button>
        </div>
        <p className={styles.boundary}>
          This route produces diagnostic input, not judged live-extraction evidence and not
          authoritative quest progress.
        </p>
      </section>

      {error !== null ? <p className={styles.error} role="alert">{error}</p> : null}

      <section className={styles.grid} aria-live="polite" aria-label="Extraction status">
        <article className={styles.metric}><span>Status</span><strong>{running ? "Capturing" : "Stopped"}</strong></article>
        <article className={styles.metric}><span>Frames analyzed</span><strong>{latest?.frameCount ?? 0}</strong></article>
        <article className={styles.metric}><span>Support tier</span><strong>{latest?.supportTier ?? "Waiting"}</strong></article>
        <article className={styles.metric}><span>HUD calibration</span><strong>{latest?.hudStatus ?? "Waiting"}</strong></article>
        <article className={styles.metric}><span>Visual state</span><strong>{latest?.visualState ?? "Waiting"}</strong></article>
        <article className={styles.metric}><span>Confidence</span><strong>{latest === null ? "—" : latest.confidence.toFixed(2)}</strong></article>
        <article className={styles.metric}><span>Cadence</span><strong>{latest === null ? "Waiting" : `${latest.cadence} · ${latest.cadenceReason}`}</strong></article>
        <article className={styles.metric}><span>Last frame</span><strong>{latest === null ? "—" : new Date(latest.capturedAt).toLocaleTimeString()}</strong></article>
      </section>

      <section className={styles.panel}>
        <h2>Currently supported observations</h2>
        <p>{latest?.supportedSignals.join(", ") || "Waiting for OBS frames."}</p>
      </section>
    </main>
  );
}
