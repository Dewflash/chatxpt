"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  buildMultiGameGameplaySnapshot,
  MultiGameVisionAnalyzer,
  createBrowserCanvasPixelSampler,
  streamMultiGameVisionAssessments,
  toGameplayActivity,
  type GameProfileSelection,
} from "@/extraction";
import {
  BrowserMediaFrameSource,
  MediaStreamVideoFrameCapture,
  obsVirtualCameraFailureReason,
  requestObsVirtualCameraStream,
  type ObsVirtualCameraFailureReason,
} from "@/integrations";

import styles from "./page.module.css";

type DiagnosticGame = "brawl-stars" | "minecraft" | "generic";

interface LatestDiagnostic {
  readonly frameCount: number;
  readonly capturedAt: number;
  readonly gameProfile: string;
  readonly supportTier: string;
  readonly gameplayActivity: string;
  readonly evidenceState: string;
  readonly confidence: number;
  readonly cadence: string;
  readonly cadenceReason: string;
  readonly hudStatus: string;
  readonly supportedSignals: readonly string[];
  readonly detectedFacts: readonly string[];
}

interface GameplayIngressAuthority {
  readonly sessionId: string;
  readonly broadcasterId: string;
  readonly questCycleId: string | null;
  readonly revision: number;
  readonly evidenceClass: "live" | "diagnostic" | "fixture";
}

interface GameplayIngressPayload {
  readonly ok: boolean;
  readonly grant?: {
    readonly token: string;
    readonly expiresAt: number;
    readonly authority: GameplayIngressAuthority;
  };
  readonly authority?: GameplayIngressAuthority;
  readonly result?: { readonly status: string; readonly reason?: string };
  readonly liveDirector?: { readonly status: string; readonly reason?: string };
  readonly error?: { readonly message?: string; readonly retryable?: boolean };
}

function diagnosticError(caught: unknown): string {
  if (caught instanceof DOMException && caught.name === "NotAllowedError") {
    return "Camera access is blocked. Allow camera access for the browser running this diagnostic, then retry.";
  }
  return caught instanceof Error ? caught.message : "OBS extraction diagnostic failed.";
}

function captureHealthCopy(
  running: boolean,
  hasObservation: boolean,
  error: string | null,
  failureReason: ObsVirtualCameraFailureReason | null,
): string {
  if (running) return hasObservation ? "Observed" : "Starting";
  if (error === null) return "Unavailable";
  if (failureReason === "permission-denied") return "Permission denied";
  if (failureReason === "not-found") return "Camera not found";
  if (failureReason === "device-unavailable") return "Camera unavailable";
  return "Unavailable";
}

function liveDirectorStatusCopy(payload: GameplayIngressPayload): string {
  if (payload.liveDirector === undefined) return "Not reported";
  if (payload.liveDirector.status === "submitted") return "Context refreshed";
  if (payload.liveDirector.status === "duplicate") return "Context already current";
  if (payload.liveDirector.status === "failed") return "Context refresh failed";
  if (payload.liveDirector.reason === "proposal-submitted") return "Skipped; proposal used snapshot";
  if (payload.liveDirector.reason === "runtime-unavailable") return "Runtime unavailable";
  if (payload.liveDirector.reason === "duplicate-snapshot") return "Duplicate snapshot";
  return "Not refreshed";
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

export function GameplayExtractionDiagnostic({ initialSessionId = "" }: { readonly initialSessionId?: string }) {
  const [game, setGame] = useState<DiagnosticGame>("brawl-stars");
  const [running, setRunning] = useState(false);
  const [latest, setLatest] = useState<LatestDiagnostic | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [failureReason, setFailureReason] = useState<ObsVirtualCameraFailureReason | null>(null);
  const [sessionId, setSessionId] = useState(initialSessionId);
  const [ingressStatus, setIngressStatus] = useState("Diagnostic only");
  const [liveDirectorStatus, setLiveDirectorStatus] = useState("Not connected");
  const [acceptedSnapshots, setAcceptedSnapshots] = useState(0);
  const controllerRef = useRef<AbortController | null>(null);
  const selectedProfile = useMemo(() => selectionFor(game), [game]);

  function stop() {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setRunning(false);
  }

  useEffect(() => {
    return () => controllerRef.current?.abort();
  }, []);

  async function start(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (running) return;
    const data = new FormData(event.currentTarget);
    const requestedSessionId = sessionId.trim();
    const setupKey = String(data.get("gameplaySetupKey") ?? "");
    const controller = new AbortController();
    controllerRef.current = controller;
    setError(null);
    setFailureReason(null);
    setLatest(null);
    setAcceptedSnapshots(0);
    setLiveDirectorStatus(requestedSessionId.length > 0 ? "Waiting for accepted facts" : "Diagnostic only");
    setRunning(true);
    let mediaStream: MediaStream | null = null;
    let ingressGrant: { token: string; expiresAt: number } | null = null;
    let ingressAuthority: GameplayIngressAuthority | null = null;
    try {
      const issueIngressGrant = async (): Promise<{
        readonly grant: { readonly token: string; readonly expiresAt: number };
        readonly authority: GameplayIngressAuthority;
      }> => {
        const response = await fetch("/api/gameplay/ingress/grant", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-chatxpt-gameplay-setup-key": setupKey,
          },
          cache: "no-store",
          signal: controller.signal,
          body: JSON.stringify({ sessionId: requestedSessionId }),
        });
        const payload = (await response.json()) as GameplayIngressPayload;
        if (!response.ok || !payload.ok || payload.grant === undefined) {
          throw new Error(payload.error?.message ?? "Gameplay Capture authorization failed.");
        }
        setIngressStatus("Authorized; waiting for OBS Virtual Camera");
        return {
          grant: { token: payload.grant.token, expiresAt: payload.grant.expiresAt },
          authority: payload.grant.authority,
        };
      };

      if (requestedSessionId.length > 0) {
        if (setupKey.trim().length === 0) {
          throw new Error("Enter the server-only Gameplay Capture setup key.");
        }
        const issued = await issueIngressGrant();
        ingressGrant = issued.grant;
        ingressAuthority = issued.authority;
      } else {
        setIngressStatus("Diagnostic only; no authoritative session selected");
      }
      mediaStream = await requestObsVirtualCameraStream();
      const capture = new MediaStreamVideoFrameCapture(mediaStream, { stopStreamOnEnd: true });
      const source = new BrowserMediaFrameSource({
        sessionId: requestedSessionId || "obs-extraction-diagnostic",
        correlationId: `obs-gameplay-capture-${Date.now()}`,
        capture,
        evidenceClass: ingressAuthority?.evidenceClass ?? "diagnostic",
        authority: requestedSessionId.length === 0
          ? undefined
          : () => ({
              questCycleId: ingressAuthority?.questCycleId ?? null,
              revision: ingressAuthority?.revision ?? 0,
              evidenceClass: ingressAuthority?.evidenceClass ?? "diagnostic",
            }),
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
        if (requestedSessionId.length > 0) {
          if (ingressGrant === null || ingressGrant.expiresAt <= Date.now() + 30_000) {
            const issued = await issueIngressGrant();
            ingressGrant = issued.grant;
            ingressAuthority = issued.authority;
          }
          const currentGrant = ingressGrant;
          if (currentGrant === null) throw new Error("Gameplay Capture grant is unavailable.");
          const snapshot = buildMultiGameGameplaySnapshot(output);
          const response = await fetch("/api/gameplay/ingress/snapshot", {
            method: "POST",
            headers: {
              authorization: `Bearer ${currentGrant.token}`,
              "content-type": "application/json",
            },
            cache: "no-store",
            signal: controller.signal,
            body: JSON.stringify(snapshot),
          });
          const payload = (await response.json()) as GameplayIngressPayload;
          if (payload.authority !== undefined) ingressAuthority = payload.authority;
          if (!response.ok || !payload.ok) {
            if (payload.result?.reason === "state-mismatch") {
              setIngressStatus("Session changed; capture authority refreshed");
              setLiveDirectorStatus("Waiting for current session state");
            } else if (response.status === 429) {
              setIngressStatus("Capture cadence throttled; retrying safely");
            } else {
              throw new Error(payload.error?.message ?? "Gameplay snapshot was rejected.");
            }
          } else {
            setAcceptedSnapshots((count) => count + (payload.result?.status === "duplicate" ? 0 : 1));
            setLiveDirectorStatus(liveDirectorStatusCopy(payload));
            setIngressStatus(
              payload.result?.status === "duplicate"
                ? "Connected; duplicate safely ignored"
                : "Connected; normalized game facts accepted",
            );
          }
        }
        setLatest({
          frameCount,
          capturedAt: output.frame.capturedAt,
          gameProfile: assessment.profile.displayName,
          supportTier: assessment.supportTier,
          gameplayActivity: toGameplayActivity(assessment.interpretation),
          evidenceState:
            assessment.interpretation.status !== "known"
              ? "Unknown"
              : assessment.interpretation.confidence >= 0.75
                ? "Observed"
                : "Low confidence",
          confidence: assessment.interpretation.confidence,
          cadence: assessment.sampling.mode,
          cadenceReason: assessment.sampling.reason,
          hudStatus:
            assessment.brawlHud?.status ?? assessment.minecraftHud?.status ?? "not-applicable",
          supportedSignals: assessment.supportedSignals,
          detectedFacts: assessment.supportedSignals.filter(
            (signal) =>
              ![
                "activity-intensity",
                "visual-state",
                "global-motion-pattern",
                "scene-transition",
              ].includes(signal),
          ),
        });
      }
    } catch (caught) {
      if (!controller.signal.aborted) {
        setFailureReason(obsVirtualCameraFailureReason(caught));
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
        <p className={styles.eyebrow}>{sessionId.trim() ? "Authoritative session input" : "Local diagnostic only"}</p>
        <h1>Gameplay Capture</h1>
        <p>
          Reads the OBS Virtual Camera at a bounded cadence and runs game-neutral analysis locally.
          No frame, camera image, or player identity is uploaded or persisted. When connected to a
          session, only normalized game facts and their confidence are sent to ChatXPT Core.
        </p>
      </header>

      <section className={styles.panel} aria-labelledby="setup-heading">
        <h2 id="setup-heading">Before starting</h2>
        <ol>
          <li>In OBS, show the game or a team-owned recording in the active scene.</li>
          <li>Click <strong>Start Virtual Camera</strong> in OBS.</li>
          <li>Select the matching game profile below, then allow camera access.</li>
        </ol>
        <form onSubmit={(event) => void start(event)}>
          <label className={styles.field}>
            ChatXPT session ID (leave empty for diagnostic-only analysis)
            <input value={sessionId} disabled={running} autoComplete="off" onChange={(event) => setSessionId(event.target.value)} />
          </label>
          {sessionId.trim() ? (
            <label className={styles.field}>
              Server-only Gameplay Capture setup key
              <input name="gameplaySetupKey" type="password" disabled={running} required autoComplete="off" />
            </label>
          ) : null}
          <label className={styles.field}>
            Game Profile
            <select value={game} disabled={running} onChange={(event) => setGame(event.target.value as DiagnosticGame)}>
              <option value="brawl-stars">Brawl Stars — calibrated when HUD confirms</option>
              <option value="minecraft">Minecraft Java — vanilla HUD calibration</option>
              <option value="generic">Generic — universal visual signals only</option>
            </select>
          </label>
          <div className={styles.actions}>
            <button type="submit" disabled={running}>{sessionId.trim() ? "Connect Gameplay Capture" : "Start diagnostic"}</button>
            <button type="button" disabled={!running} onClick={stop}>Stop</button>
          </div>
        </form>
        <p className={styles.boundary}>
          Diagnostic-only analysis is not judged live-extraction evidence. A connected session
          uses real OBS Virtual Camera frames and the authoritative ingress boundary; it still
          does not claim what game fact exists when confidence is insufficient.
        </p>
      </section>

      {error !== null ? <p className={styles.error} role="alert">{error}</p> : null}

      <section className={styles.grid} aria-live="polite" aria-label="Extraction status">
        <article className={styles.metric}><span>Capture Health</span><strong>{captureHealthCopy(running, latest !== null, error, failureReason)}</strong></article>
        <article className={styles.metric}><span>Core ingress</span><strong>{ingressStatus}</strong></article>
        <article className={styles.metric}><span>Live Director</span><strong>{liveDirectorStatus}</strong></article>
        <article className={styles.metric}><span>Snapshots accepted</span><strong>{acceptedSnapshots}</strong></article>
        <article className={styles.metric}><span>Frames analyzed</span><strong>{latest?.frameCount ?? 0}</strong></article>
        <article className={styles.metric}><span>Game Profile</span><strong>{latest?.gameProfile ?? "Waiting"}</strong></article>
        <article className={styles.metric}><span>Support tier</span><strong>{latest?.supportTier ?? "Waiting"}</strong></article>
        <article className={styles.metric}><span>Detected Game Facts</span><strong>{latest?.hudStatus ?? "Waiting"}</strong></article>
        <article className={styles.metric}><span>Gameplay Activity</span><strong>{latest === null ? "Unknown" : `${latest.gameplayActivity[0].toUpperCase()}${latest.gameplayActivity.slice(1)}`}</strong></article>
        <article className={styles.metric}><span>Evidence state</span><strong>{latest?.evidenceState ?? "Unavailable"}</strong></article>
        <article className={styles.metric}><span>Signal Confidence</span><strong>{latest === null ? "—" : latest.confidence.toFixed(2)}</strong></article>
        <article className={styles.metric}><span>Cadence</span><strong>{latest === null ? "Waiting" : `${latest.cadence} · ${latest.cadenceReason}`}</strong></article>
        <article className={styles.metric}><span>Last observation</span><strong>{latest === null ? "—" : new Date(latest.capturedAt).toLocaleTimeString()}</strong></article>
      </section>

      <section className={styles.panel}>
        <h2>Detected Game Facts</h2>
        <p>
          {latest === null
            ? "Waiting for Gameplay Capture."
            : latest.detectedFacts.length === 0
              ? "No calibrated game fact is currently observed. Universal Gameplay Activity remains available."
              : latest.detectedFacts.join(", ")}
        </p>
        <details>
          <summary>Supported observations</summary>
          <p>{latest?.supportedSignals.join(", ") || "None available."}</p>
        </details>
      </section>
    </main>
  );
}
