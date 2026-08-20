"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";

import type { StreamerReadinessView, StreamerViewModel } from "@/core";
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
  requestObsVirtualCameraStream,
} from "@/integrations";

import styles from "./studio-gameplay-capture.module.css";

type CaptureGame = "brawl-stars" | "minecraft" | "generic";

const CAPTURE_PREFERENCE_KEY = "chatxpt.studio.gameplayCapture.v1";

interface StudioSessionPayload {
  readonly ok: boolean;
  readonly view?: StreamerViewModel;
  readonly readiness?: StreamerReadinessView;
  readonly error?: { readonly message?: string; readonly retryable?: boolean };
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
  readonly error?: { readonly message?: string; readonly retryable?: boolean };
}

interface LatestCapture {
  readonly frameCount: number;
  readonly capturedAt: number;
  readonly gameProfile: string;
  readonly supportTier: string;
  readonly gameplayActivity: string;
  readonly confidenceLabel: string;
  readonly confidence: number;
  readonly cadence: string;
  readonly cadenceReason: string;
  readonly hudStatus: string;
  readonly supportedSignals: readonly string[];
  readonly detectedFacts: readonly string[];
}

interface CapturePreference {
  readonly game: CaptureGame;
  readonly sessionId: string | null;
  readonly savedAt: number;
  readonly lastConnectedAt: number | null;
}

function captureError(caught: unknown): string {
  if (caught instanceof DOMException && caught.name === "NotAllowedError") {
    return "Camera access is blocked. Allow camera access for this browser, then retry.";
  }
  return caught instanceof Error ? caught.message : "Gameplay Capture could not start.";
}

function isCaptureGame(value: unknown): value is CaptureGame {
  return value === "brawl-stars" || value === "minecraft" || value === "generic";
}

function readCapturePreference(): CapturePreference | null {
  try {
    const raw = window.localStorage.getItem(CAPTURE_PREFERENCE_KEY);
    if (raw === null) return null;
    const parsed = JSON.parse(raw) as Partial<CapturePreference>;
    if (!isCaptureGame(parsed.game) || typeof parsed.savedAt !== "number") return null;
    return {
      game: parsed.game,
      sessionId: typeof parsed.sessionId === "string" ? parsed.sessionId : null,
      savedAt: parsed.savedAt,
      lastConnectedAt: typeof parsed.lastConnectedAt === "number" ? parsed.lastConnectedAt : null,
    };
  } catch {
    return null;
  }
}

function writeCapturePreference(input: CapturePreference): void {
  try {
    window.localStorage.setItem(CAPTURE_PREFERENCE_KEY, JSON.stringify(input));
  } catch {
    // Capture still works when private browsing or storage policy blocks local preferences.
  }
}

function customerSafeLabel(label: string | null | undefined, fallback: string): string {
  if (label === null || label === undefined || /\bfixture\b/iu.test(label)) {
    return fallback;
  }
  return label;
}

function gameFromProfile(view: StreamerViewModel | null): CaptureGame {
  const gameId = view?.profile.gameId?.toLowerCase() ?? "";
  const gameName = view?.profile.gameName?.toLowerCase() ?? "";
  if (gameId.includes("minecraft") || gameName.includes("minecraft")) return "minecraft";
  if (gameId.includes("brawl") || gameName.includes("brawl")) return "brawl-stars";
  return "generic";
}

function selectionFor(game: CaptureGame): GameProfileSelection {
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

function assertCaptureSession(authority: GameplayIngressAuthority) {
  if (authority.evidenceClass === "fixture") {
    throw new Error("Start a broadcaster session before connecting Gameplay Capture.");
  }
}

export function StudioGameplayCaptureClient() {
  const [view, setView] = useState<StreamerViewModel | null>(null);
  const [readiness, setReadiness] = useState<StreamerReadinessView | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [game, setGame] = useState<CaptureGame>("generic");
  const [running, setRunning] = useState(false);
  const [latest, setLatest] = useState<LatestCapture | null>(null);
  const [capturePreference, setCapturePreference] = useState<CapturePreference | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ingressStatus, setIngressStatus] = useState("Waiting for Studio session");
  const [acceptedSnapshots, setAcceptedSnapshots] = useState(0);
  const controllerRef = useRef<AbortController | null>(null);
  const selectedProfile = useMemo(() => selectionFor(game), [game]);

  useEffect(() => {
    let active = true;
    async function loadSession() {
      try {
        const response = await fetch("/api/studio/session", {
          credentials: "include",
          cache: "no-store",
        });
        const payload = (await response.json()) as StudioSessionPayload;
        if (!active) return;
        if (!response.ok || !payload.ok || payload.view === undefined || payload.readiness === undefined) {
          setSessionError(payload.error?.message ?? "Open Studio first so Gameplay Capture can find the stream session.");
          return;
        }
        const savedPreference = readCapturePreference();
        setView(payload.view);
        setReadiness(payload.readiness);
        setCapturePreference(savedPreference);
        setGame(savedPreference?.game ?? gameFromProfile(payload.view));
        setIngressStatus("Studio session ready");
        setSessionError(null);
      } catch {
        if (active) setSessionError("Studio session could not be loaded.");
      }
    }
    void loadSession();
    return () => {
      active = false;
      controllerRef.current?.abort();
    };
  }, []);

  function stop() {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setRunning(false);
  }

  function rememberCapturePreference(input: {
    readonly game: CaptureGame;
    readonly connected: boolean;
  }) {
    const now = Date.now();
    const next = {
      game: input.game,
      sessionId: view?.session.sessionId ?? null,
      savedAt: now,
      lastConnectedAt: input.connected ? now : capturePreference?.lastConnectedAt ?? null,
    } satisfies CapturePreference;
    setCapturePreference(next);
    writeCapturePreference(next);
  }

  async function start(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (running || view === null) return;
    const currentView = view;
    const data = new FormData(event.currentTarget);
    const setupKey = String(data.get("gameplaySetupKey") ?? "");
    const controller = new AbortController();
    controllerRef.current = controller;
    setError(null);
    setLatest(null);
    setAcceptedSnapshots(0);
    setRunning(true);
    let mediaStream: MediaStream | null = null;
    let ingressGrant: { token: string; expiresAt: number } | null = null;
    let ingressAuthority: GameplayIngressAuthority | null = null;

    async function issueIngressGrant(): Promise<{
      readonly grant: { readonly token: string; readonly expiresAt: number };
      readonly authority: GameplayIngressAuthority;
    }> {
      const response = await fetch("/api/gameplay/ingress/grant", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-chatxpt-gameplay-setup-key": setupKey,
        },
        cache: "no-store",
        signal: controller.signal,
        body: JSON.stringify({ sessionId: currentView.session.sessionId }),
      });
      const payload = (await response.json()) as GameplayIngressPayload;
      if (!response.ok || !payload.ok || payload.grant === undefined) {
        throw new Error(payload.error?.message ?? "Gameplay Capture authorization failed.");
      }
      assertCaptureSession(payload.grant.authority);
      setIngressStatus("Connected to Studio; waiting for OBS Virtual Camera");
      return {
        grant: { token: payload.grant.token, expiresAt: payload.grant.expiresAt },
        authority: payload.grant.authority,
      };
    }

    try {
      if (setupKey.trim().length === 0) {
        throw new Error("Enter the server-only Gameplay Capture setup key.");
      }
      const issued = await issueIngressGrant();
      ingressGrant = issued.grant;
      ingressAuthority = issued.authority;
      mediaStream = await requestObsVirtualCameraStream();
      rememberCapturePreference({ game, connected: true });
      const capture = new MediaStreamVideoFrameCapture(mediaStream, { stopStreamOnEnd: true });
      const source = new BrowserMediaFrameSource({
        sessionId: currentView.session.sessionId,
        correlationId: `studio-gameplay-capture-${Date.now()}`,
        capture,
        evidenceClass: ingressAuthority.evidenceClass ?? "live",
        authority: () => ({
          questCycleId: ingressAuthority?.questCycleId ?? null,
          revision: ingressAuthority?.revision ?? 0,
          evidenceClass: ingressAuthority?.evidenceClass ?? "live",
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
        if (ingressGrant === null || ingressGrant.expiresAt <= Date.now() + 30_000) {
          const refreshed = await issueIngressGrant();
          ingressGrant = refreshed.grant;
          ingressAuthority = refreshed.authority;
        }
        const snapshot = buildMultiGameGameplaySnapshot(output);
        const response = await fetch("/api/gameplay/ingress/snapshot", {
          method: "POST",
          headers: {
            authorization: `Bearer ${ingressGrant.token}`,
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
            setIngressStatus("Session changed; capture connection refreshed");
          } else if (response.status === 429) {
            setIngressStatus("Capture cadence throttled; retrying safely");
          } else {
            throw new Error(payload.error?.message ?? "Gameplay snapshot was rejected.");
          }
        } else {
          setAcceptedSnapshots((count) => count + (payload.result?.status === "duplicate" ? 0 : 1));
          setIngressStatus(
            payload.result?.status === "duplicate"
              ? "Connected; duplicate safely ignored"
              : "Connected; normalized game facts accepted",
          );
        }
        setLatest({
          frameCount,
          capturedAt: output.frame.capturedAt,
          gameProfile: assessment.profile.displayName,
          supportTier: assessment.supportTier,
          gameplayActivity: toGameplayActivity(assessment.interpretation),
          confidenceLabel:
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
        setError(captureError(caught));
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
        <p className={styles.eyebrow}>ChatXPT Studio</p>
        <h1>Gameplay Capture</h1>
        <p>
          Connect OBS Virtual Camera to this Studio session. Frames stay in the browser;
          ChatXPT sends only normalized game facts, timestamps, confidence, and supported-signal status.
        </p>
      </header>

      {sessionError !== null ? <p className={styles.error} role="alert">{sessionError}</p> : null}
      {error !== null ? <p className={styles.error} role="alert">{error}</p> : null}

      <section className={styles.panel} aria-labelledby="setup-heading">
        <h2 id="setup-heading">Connect capture</h2>
        <ol>
          <li>In OBS, put only gameplay or a team-owned gameplay recording in the active scene.</li>
          <li>Click <strong>Start Virtual Camera</strong> in OBS.</li>
          <li>Select the game profile below, then allow camera access in the browser.</li>
        </ol>
        <form onSubmit={(event) => void start(event)}>
          <label className={styles.field}>
            Current Studio session
            <input value={view?.session.sessionId ?? "Loading Studio session"} readOnly />
          </label>
          <label className={styles.field}>
            Server-only Gameplay Capture setup key
            <input name="gameplaySetupKey" type="password" disabled={running || view === null} required autoComplete="off" />
          </label>
          <label className={styles.field}>
            Game profile
            <select
              value={game}
              disabled={running || view === null}
              onChange={(event) => {
                const nextGame = event.target.value as CaptureGame;
                setGame(nextGame);
                rememberCapturePreference({ game: nextGame, connected: false });
              }}
            >
              <option value="minecraft">Minecraft Java - vanilla HUD calibration</option>
              <option value="brawl-stars">Brawl Stars - calibrated when HUD confirms</option>
              <option value="generic">Generic - universal visual signals only</option>
            </select>
          </label>
          <div className={styles.actions}>
            <button type="submit" disabled={running || view === null}>{running ? "Connecting..." : "Connect Gameplay Capture"}</button>
            <button type="button" disabled={!running} onClick={stop}>Stop</button>
            <a href="/studio/gameplay">Back to Gameplay Engine</a>
          </div>
        </form>
        <p className={styles.boundary}>
          This page connects the product capture path. It still reports unsupported or low-confidence
          game facts as unknown instead of guessing.
        </p>
        <p className={styles.boundary}>
          {capturePreference?.lastConnectedAt === null || capturePreference === null
            ? "No saved capture preference yet. The selected game profile is remembered in this browser after setup."
            : `Last successful capture in this browser: ${new Date(capturePreference.lastConnectedAt).toLocaleString()}.`}
        </p>
      </section>

      <section className={styles.grid} aria-live="polite" aria-label="Gameplay Capture status">
        <article className={styles.metric}><span>Capture Health</span><strong>{running ? (latest === null ? "Starting" : "Observed") : error === null ? "Unavailable" : "Permission denied"}</strong></article>
        <article className={styles.metric}><span>Studio connection</span><strong>{ingressStatus}</strong></article>
        <article className={styles.metric}><span>Snapshots accepted</span><strong>{acceptedSnapshots}</strong></article>
        <article className={styles.metric}><span>Frames analyzed</span><strong>{latest?.frameCount ?? 0}</strong></article>
        <article className={styles.metric}><span>Game Profile</span><strong>{latest?.gameProfile ?? (view?.profile.gameName ?? "Waiting")}</strong></article>
        <article className={styles.metric}><span>Support tier</span><strong>{latest?.supportTier ?? "Waiting"}</strong></article>
        <article className={styles.metric}><span>Detected Game Facts</span><strong>{latest?.hudStatus ?? "Waiting"}</strong></article>
        <article className={styles.metric}><span>Gameplay Activity</span><strong>{latest === null ? "Unknown" : `${latest.gameplayActivity[0].toUpperCase()}${latest.gameplayActivity.slice(1)}`}</strong></article>
        <article className={styles.metric}><span>Confidence</span><strong>{latest?.confidenceLabel ?? "Unavailable"}</strong></article>
        <article className={styles.metric}><span>Signal Confidence</span><strong>{latest === null ? "-" : latest.confidence.toFixed(2)}</strong></article>
        <article className={styles.metric}><span>Cadence</span><strong>{latest === null ? "Waiting" : `${latest.cadence} - ${latest.cadenceReason}`}</strong></article>
        <article className={styles.metric}><span>Last observation</span><strong>{latest === null ? "-" : new Date(latest.capturedAt).toLocaleTimeString()}</strong></article>
      </section>

      <section className={styles.panel}>
        <h2>Observed and unknown facts</h2>
        <p>
          {latest === null
            ? "Waiting for Gameplay Capture."
            : latest.detectedFacts.length === 0
              ? "No calibrated game fact is currently observed. Universal Gameplay Activity remains available."
              : latest.detectedFacts.join(", ")}
        </p>
        <details>
          <summary>Supported observations</summary>
          <p>{latest?.supportedSignals.join(", ") || "None available yet."}</p>
        </details>
      </section>

      <section className={styles.panel}>
        <h2>Session readiness</h2>
        <p>{customerSafeLabel(readiness?.label, "Readiness has not loaded yet.")}</p>
        <p>
          {readiness?.ready
            ? "ChatXPT can use this stream state when the rest of the workflow is connected."
            : "Resolve any setup blockers in Studio before starting the full workflow."}
        </p>
      </section>
    </main>
  );
}
