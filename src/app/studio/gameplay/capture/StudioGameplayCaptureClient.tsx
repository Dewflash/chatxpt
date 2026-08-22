"use client";

import { useEffect, useRef, useState } from "react";

import type { GameplaySnapshot, StreamerReadinessView, StreamerViewModel } from "@/core";
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
  LatestOnlyDelivery,
  MediaStreamVideoFrameCapture,
  obsVirtualCameraFailureReason,
  requestBrowserDisplayCaptureStream,
  requestObsVirtualCameraStream,
  type ObsVirtualCameraFailureReason,
} from "@/integrations";
import {
  buildProfileSettingsCommand,
  connectGameplayCapturePreview,
  describeSelectedGameplaySource,
  editableDefaultsFromView,
} from "@/streamer";

import styles from "./studio-gameplay-capture.module.css";

type CaptureGame = "brawl-stars" | "minecraft" | "generic";
type CaptureSource = "screen-window" | "obs-virtual-camera";

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
  readonly analysisRateFps: number | null;
  readonly sampleResolution: string;
  readonly gameProfile: string;
  readonly supportTier: string;
  readonly gameplayActivity: string;
  readonly confidenceLabel: string;
  readonly confidence: number;
  readonly cadence: string;
  readonly cadenceReason: string;
  readonly hudStatus: string;
  readonly hudReason: string;
  readonly hudAnchorScores: string;
  readonly supportedSignals: readonly string[];
  readonly detectedFacts: readonly string[];
  readonly unknownFactCount: number;
  readonly health: string;
  readonly hunger: string;
  readonly recentDamage: string;
  readonly movement: string;
  readonly turning: string;
  readonly combat: string;
  readonly eating: string;
  readonly healthTrend: string;
  readonly screen: string;
  readonly environment: string;
  readonly life: string;
}

interface CapturePreference {
  readonly game: CaptureGame;
  readonly source: CaptureSource;
  readonly sessionId: string | null;
  readonly savedAt: number;
  readonly lastConnectedAt: number | null;
}

function captureError(caught: unknown, source: CaptureSource): string {
  if (source === "screen-window" && caught instanceof DOMException && caught.name === "NotAllowedError") {
    return "Screen or window selection was cancelled or blocked. Click Select Screen or Window and choose the game again.";
  }
  return caught instanceof Error ? caught.message : "Gameplay Capture could not start.";
}

function captureHealthCopy(
  running: boolean,
  hasObservation: boolean,
  error: string | null,
  failureReason: ObsVirtualCameraFailureReason | null,
  source: CaptureSource,
): string {
  if (running) return hasObservation ? "Observed" : "Starting";
  if (error === null) return "Unavailable";
  if (source === "screen-window") return "Selection stopped";
  if (failureReason === "permission-denied") return "Permission denied";
  if (failureReason === "not-found") return "Camera not found";
  if (failureReason === "device-unavailable") return "Camera unavailable";
  return "Unavailable";
}

function isCaptureGame(value: unknown): value is CaptureGame {
  return value === "brawl-stars" || value === "minecraft" || value === "generic";
}

function isCaptureSource(value: unknown): value is CaptureSource {
  return value === "screen-window" || value === "obs-virtual-camera";
}

function readCapturePreference(): CapturePreference | null {
  try {
    const raw = window.localStorage.getItem(CAPTURE_PREFERENCE_KEY);
    if (raw === null) return null;
    const parsed = JSON.parse(raw) as Partial<CapturePreference>;
    if (!isCaptureGame(parsed.game) || typeof parsed.savedAt !== "number") return null;
    return {
      game: parsed.game,
      source: isCaptureSource(parsed.source) ? parsed.source : "screen-window",
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
  // Vanilla Minecraft is the accepted calibrated MVP demonstration target.
  // Keep it as the visible ChatXPT default rather than silently trapping a
  // new capture in universal, stat-free Generic mode.
  return "minecraft";
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

function savedGameFor(game: CaptureGame): { readonly gameId: string; readonly gameName: string } | null {
  if (game === "minecraft") return { gameId: "minecraft", gameName: "Minecraft" };
  if (game === "brawl-stars") return { gameId: "brawl-stars", gameName: "Brawl Stars" };
  return null;
}

function assertCaptureSession(authority: GameplayIngressAuthority) {
  if (authority.evidenceClass === "fixture") {
    throw new Error("Start a broadcaster session before connecting Gameplay Capture.");
  }
}

class CaptureRequestError extends Error {
  constructor(message: string, readonly retryable: boolean) {
    super(message);
    this.name = "CaptureRequestError";
  }
}

function waitForCaptureRetry(signal: AbortSignal, durationMs = 1_000): Promise<void> {
  if (signal.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    const timeout = window.setTimeout(resolve, durationMs);
    signal.addEventListener("abort", () => {
      window.clearTimeout(timeout);
      resolve();
    }, { once: true });
  });
}

function signalValue(snapshot: GameplaySnapshot, signalId: string): string {
  const observation = snapshot.signals.find((signal) => signal.signalId === signalId)?.observation;
  if (observation === undefined) return "Unknown";
  if (observation.status === "known") return String(observation.value);
  if (observation.status === "stale") return `${String(observation.previousValue ?? "Unknown")} (stale)`;
  return "Unknown";
}

function readableSignalName(value: string): string {
  return value
    .replace(/^minecraft-/u, "")
    .split("-")
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

export function StudioGameplayCaptureClient() {
  const [view, setView] = useState<StreamerViewModel | null>(null);
  const [readiness, setReadiness] = useState<StreamerReadinessView | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [game, setGame] = useState<CaptureGame>("generic");
  const [captureSource, setCaptureSource] = useState<CaptureSource>("screen-window");
  const [running, setRunning] = useState(false);
  const [previewConnected, setPreviewConnected] = useState(false);
  const [latest, setLatest] = useState<LatestCapture | null>(null);
  const [capturePreference, setCapturePreference] = useState<CapturePreference | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [failureReason, setFailureReason] = useState<ObsVirtualCameraFailureReason | null>(null);
  const [ingressStatus, setIngressStatus] = useState("Waiting for Studio session");
  const [captureDeviceLabel, setCaptureDeviceLabel] = useState<string | null>(null);
  const [acceptedSnapshots, setAcceptedSnapshots] = useState(0);
  const controllerRef = useRef<AbortController | null>(null);
  const previewRef = useRef<HTMLVideoElement | null>(null);
  const capturePreferenceLoadedRef = useRef(false);

  useEffect(() => {
    let active = true;
    let retryTimer: number | null = null;
    async function loadSession() {
      let retryAfterMs = 10_000;
      try {
        const response = await fetch("/api/studio/session", {
          credentials: "include",
          cache: "no-store",
        });
        const payload = (await response.json()) as StudioSessionPayload;
        if (!active) return;
        if (!response.ok || !payload.ok || payload.view === undefined || payload.readiness === undefined) {
          setSessionError(payload.error?.message ?? "Open Studio first so Gameplay Capture can find the stream session.");
          setIngressStatus("Studio session unavailable; reconnecting automatically");
          retryAfterMs = payload.error?.retryable === false ? 5_000 : 2_000;
          return;
        }
        setView(payload.view);
        setReadiness(payload.readiness);
        if (!capturePreferenceLoadedRef.current) {
          const savedPreference = readCapturePreference();
          const platformGame = gameFromProfile(payload.view);
          capturePreferenceLoadedRef.current = true;
          setCapturePreference(savedPreference);
          setCaptureSource(savedPreference?.source ?? "screen-window");
          setGame(
            savedPreference?.game === undefined ||
              (savedPreference.game === "generic" && platformGame !== "generic")
              ? platformGame
              : savedPreference.game,
          );
        }
        if (controllerRef.current === null) setIngressStatus("Studio session ready");
        setSessionError(null);
      } catch {
        if (active) {
          setSessionError("Studio session could not be loaded. Retrying automatically.");
          setIngressStatus("Studio session unavailable; reconnecting automatically");
          retryAfterMs = 2_000;
        }
      } finally {
        if (active) retryTimer = window.setTimeout(() => void loadSession(), retryAfterMs);
      }
    }
    void loadSession();
    return () => {
      active = false;
      if (retryTimer !== null) window.clearTimeout(retryTimer);
      controllerRef.current?.abort();
    };
  }, []);

  function stop() {
    controllerRef.current?.abort();
    controllerRef.current = null;
    if (previewRef.current !== null) {
      previewRef.current.pause();
      previewRef.current.srcObject = null;
    }
    setCaptureDeviceLabel(null);
    setPreviewConnected(false);
    setRunning(false);
  }

  function rememberCapturePreference(input: {
    readonly game: CaptureGame;
    readonly source: CaptureSource;
    readonly connected: boolean;
  }) {
    const now = Date.now();
    const next = {
      game: input.game,
      source: input.source,
      sessionId: view?.session.sessionId ?? null,
      savedAt: now,
      lastConnectedAt: input.connected ? now : capturePreference?.lastConnectedAt ?? null,
    } satisfies CapturePreference;
    setCapturePreference(next);
    writeCapturePreference(next);
  }

  async function start(selectedSource: CaptureSource) {
    if (running || controllerRef.current !== null || view === null) return;
    setCaptureSource(selectedSource);
    let currentView = view;
    const captureProfile = selectionFor(game);
    const controller = new AbortController();
    controllerRef.current = controller;
    setError(null);
    setFailureReason(null);
    setLatest(null);
    setAcceptedSnapshots(0);
    setPreviewConnected(false);
    setRunning(true);
    let mediaStream: MediaStream | null = null;
    let ingressGrant: { token: string; expiresAt: number } | null = null;
    let ingressAuthority: GameplayIngressAuthority | null = null;

    async function issueIngressGrant(announceSelection = true): Promise<{
      readonly grant: { readonly token: string; readonly expiresAt: number };
      readonly authority: GameplayIngressAuthority;
    }> {
      const response = await fetch("/api/gameplay/ingress/grant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        cache: "no-store",
        signal: controller.signal,
        body: JSON.stringify({ sessionId: currentView.session.sessionId }),
      });
      const payload = (await response.json()) as GameplayIngressPayload;
      if (!response.ok || !payload.ok || payload.grant === undefined) {
        throw new CaptureRequestError(
          payload.error?.message ?? "Gameplay Capture authorization failed.",
          payload.error?.retryable === true || response.status >= 500,
        );
      }
      assertCaptureSession(payload.grant.authority);
      if (announceSelection) {
        setIngressStatus(
          selectedSource === "obs-virtual-camera"
            ? "Connected to Studio; waiting for OBS Virtual Camera"
            : "Connected to Studio; waiting for screen or window selection",
        );
      }
      return {
        grant: { token: payload.grant.token, expiresAt: payload.grant.expiresAt },
        authority: payload.grant.authority,
      };
    }

    async function persistCaptureGame(): Promise<void> {
      const selectedGame = savedGameFor(game);
      if (
        selectedGame === null ||
        (currentView.profile.gameId === selectedGame.gameId &&
          currentView.profile.gameName === selectedGame.gameName)
      ) {
        return;
      }
      setIngressStatus(`Saving ${selectedGame.gameName} as the current ChatXPT game`);
      const response = await fetch("/api/studio/commands", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        cache: "no-store",
        signal: controller.signal,
        body: JSON.stringify(buildProfileSettingsCommand(currentView, {
          ...editableDefaultsFromView(currentView),
          gameId: selectedGame.gameId,
          gameName: selectedGame.gameName,
        })),
      });
      const payload = (await response.json()) as StudioSessionPayload;
      if (!response.ok || !payload.ok || payload.view === undefined) {
        throw new CaptureRequestError(
          payload.error?.message ?? "ChatXPT could not save the selected game profile.",
          payload.error?.retryable === true || response.status >= 500 || response.status === 409,
        );
      }
      currentView = payload.view;
      setView(payload.view);
      if (payload.readiness !== undefined) setReadiness(payload.readiness);
      setIngressStatus(
        selectedSource === "obs-virtual-camera"
          ? `${selectedGame.gameName} is saved; waiting for OBS Virtual Camera`
          : `${selectedGame.gameName} is saved; waiting for screen or window selection`,
      );
    }

    try {
      await persistCaptureGame();
      const issued = await issueIngressGrant();
      ingressGrant = issued.grant;
      ingressAuthority = issued.authority;
      mediaStream = selectedSource === "obs-virtual-camera"
        ? await requestObsVirtualCameraStream()
        : await requestBrowserDisplayCaptureStream();
      const videoTrack = mediaStream.getVideoTracks()[0] ?? null;
      if (videoTrack === null) {
        throw new CaptureRequestError(
          "The selected source did not provide a video feed. Select the gameplay screen again.",
          false,
        );
      }
      const preview = previewRef.current;
      if (preview === null) {
        throw new CaptureRequestError(
          "ChatXPT could not open the selected-feed preview. Reload Gameplay Engine and try again.",
          true,
        );
      }
      await connectGameplayCapturePreview(preview, mediaStream);
      setCaptureDeviceLabel(describeSelectedGameplaySource(videoTrack, selectedSource));
      setPreviewConnected(true);
      setIngressStatus(
        captureProfile.requestedGameId === null
          ? `${selectedSource === "obs-virtual-camera" ? "OBS Virtual Camera" : "Selected-screen"} capture started with the Generic activity profile`
          : `${selectedSource === "obs-virtual-camera" ? "OBS Virtual Camera" : "Selected-screen"} capture started with the ${captureProfile.requestedGameId} profile`,
      );
      videoTrack?.addEventListener("ended", () => {
        if (controller.signal.aborted) return;
        setError(
          selectedSource === "obs-virtual-camera"
            ? "OBS Virtual Camera stopped. Restart it in OBS, then connect capture again."
            : "Screen sharing stopped. Click Select Screen or Window to choose the game again.",
        );
        setIngressStatus(
          selectedSource === "obs-virtual-camera"
            ? "OBS Virtual Camera capture stopped"
            : "Selected-screen capture stopped",
        );
        controller.abort();
      }, { once: true });
      rememberCapturePreference({ game, source: selectedSource, connected: true });
      const capture = new MediaStreamVideoFrameCapture(mediaStream, {
        stopStreamOnEnd: true,
        video: preview,
      });
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
        source: selectedSource === "obs-virtual-camera"
          ? "obs-virtual-camera"
          : "browser-display-capture",
        frameIntervalMs: 100,
      });
      const analyzer = new MultiGameVisionAnalyzer();
      const snapshotDelivery = new LatestOnlyDelivery<GameplaySnapshot>({
        deliver: async (snapshot) => {
          try {
            if (ingressGrant === null || ingressGrant.expiresAt <= Date.now() + 30_000) {
              const refreshed = await issueIngressGrant(false);
              ingressGrant = refreshed.grant;
              ingressAuthority = refreshed.authority;
            }
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
                setIngressStatus("Server delivery throttled; local analysis is continuing");
              } else {
                throw new CaptureRequestError(
                  payload.error?.message ?? "Gameplay snapshot was rejected.",
                  payload.error?.retryable === true || response.status >= 500 || response.status === 401,
                );
              }
            } else {
              setAcceptedSnapshots((count) => count + (payload.result?.status === "duplicate" ? 0 : 1));
              setIngressStatus(
                payload.result?.status === "duplicate"
                  ? "Local analysis is live; duplicate server snapshot safely ignored"
                  : "Local analysis is live and the Game Engine accepted the latest snapshot",
              );
            }
          } catch (caught) {
            if (controller.signal.aborted) return;
            const retryable = !(caught instanceof CaptureRequestError) || caught.retryable;
            if (!retryable) throw caught;
            ingressGrant = null;
            setIngressStatus("Local analysis is continuing; Studio delivery interrupted and will retry");
            await waitForCaptureRetry(controller.signal);
          }
        },
        onError: (caught) => {
          if (!controller.signal.aborted) {
            setError(captureError(caught, selectedSource));
            setIngressStatus("Capture stopped because Studio rejected gameplay delivery");
            controller.abort();
          }
          return "stop";
        },
      });
      let frameCount = 0;
      const recentAnalysisTimes: number[] = [];
      setIngressStatus("Preview is live; sampling the first frame locally");
      try {
        for await (const output of streamMultiGameVisionAssessments(source, {
          sampler: createBrowserCanvasPixelSampler(),
          sampleWidth: captureProfile.requestedGameId === "minecraft" ? 640 : 160,
          sampleHeight: captureProfile.requestedGameId === "minecraft" ? 360 : 90,
          selection: captureProfile,
          analyzer,
        }, controller.signal)) {
          if (output.status !== "ready") continue;
          frameCount += 1;
          const analysisCompletedAt = Date.now();
          recentAnalysisTimes.push(analysisCompletedAt);
          while (recentAnalysisTimes.length > 1 && recentAnalysisTimes[0] < analysisCompletedAt - 10_000) {
            recentAnalysisTimes.shift();
          }
          const cadenceWindowMs = analysisCompletedAt - (recentAnalysisTimes[0] ?? analysisCompletedAt);
          const cadenceFps = recentAnalysisTimes.length < 2 || cadenceWindowMs <= 0
            ? null
            : Number((((recentAnalysisTimes.length - 1) * 1_000) / cadenceWindowMs).toFixed(2));
          const assessment = output.assessment;
          const builtSnapshot = buildMultiGameGameplaySnapshot(output);
          const knownFactCount = builtSnapshot.signals.filter(
            (signal) => signal.observation.status === "known",
          ).length;
          const unknownFactCount = builtSnapshot.signals.filter(
            (signal) => signal.observation.status !== "known",
          ).length;
          const hudStatus = assessment.brawlHud?.status ?? assessment.minecraftHud?.status ?? null;
          const snapshot: GameplaySnapshot = {
            ...builtSnapshot,
            captureMetrics: {
              observedAt: output.frame.capturedAt,
              framesProcessed: frameCount,
              processingCoverage:
                builtSnapshot.signals.length === 0
                  ? 0
                  : knownFactCount / builtSnapshot.signals.length,
              cadenceFps,
              lastLatencyMs: Math.max(0, analysisCompletedAt - output.frame.capturedAt),
              droppedFrames: null,
              ocrStatus:
                hudStatus === null
                  ? "not-required"
                  : hudStatus === "standard-like" || hudStatus === "vanilla-like" || hudStatus === "minecraft-like"
                    ? "ready"
                    : hudStatus === "hud-hidden" || hudStatus === "insufficient-resolution"
                      ? "unavailable"
                      : "unknown",
              normalizedFactCount: knownFactCount,
            },
          };
          setLatest({
            frameCount,
            capturedAt: output.frame.capturedAt,
            analysisRateFps: cadenceFps,
            sampleResolution: captureProfile.requestedGameId === "minecraft" ? "640 × 360" : "160 × 90",
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
            hudReason:
              assessment.minecraftHud?.reasons[0] ??
              assessment.brawlHud?.reasons[0] ??
              "This game profile uses universal visual activity only.",
            hudAnchorScores: assessment.minecraftHud?.anchorScores === undefined
              ? "Not applicable"
              : [
                  `health ${assessment.minecraftHud.anchorScores.health.toFixed(2)}`,
                  `hunger ${assessment.minecraftHud.anchorScores.hunger.toFixed(2)}`,
                  `hotbar ${assessment.minecraftHud.anchorScores.hotbar.toFixed(2)}`,
                  `layout ${assessment.minecraftHud.anchorScores.layout.toFixed(2)}`,
                ].join(" · "),
            supportedSignals: assessment.supportedSignals,
            detectedFacts: builtSnapshot.signals.flatMap((signal) =>
              signal.observation.status === "known"
                ? [`${readableSignalName(signal.kind)}: ${String(signal.observation.value)}`]
                : [],
            ),
            unknownFactCount,
            health: signalValue(builtSnapshot, "minecraft-health-hearts"),
            hunger: signalValue(builtSnapshot, "minecraft-hunger-shanks"),
            recentDamage: signalValue(builtSnapshot, "minecraft-recent-damage"),
            movement: signalValue(builtSnapshot, "minecraft-movement"),
            turning: signalValue(builtSnapshot, "minecraft-turning"),
            combat: signalValue(builtSnapshot, "minecraft-combat"),
            eating: signalValue(builtSnapshot, "minecraft-eating"),
            healthTrend: signalValue(builtSnapshot, "minecraft-health-trend"),
            screen: signalValue(builtSnapshot, "minecraft-screen"),
            environment: signalValue(builtSnapshot, "minecraft-environment"),
            life: signalValue(builtSnapshot, "minecraft-life"),
          });
          snapshotDelivery.push(snapshot);
        }
      } finally {
        snapshotDelivery.stop();
      }
    } catch (caught) {
      if (!controller.signal.aborted) {
        setFailureReason(
          selectedSource === "obs-virtual-camera"
            ? obsVirtualCameraFailureReason(caught)
            : null,
        );
        setError(captureError(caught, selectedSource));
        for (const track of mediaStream?.getTracks() ?? []) track.stop();
      }
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null;
      if (previewRef.current !== null) {
        previewRef.current.pause();
        previewRef.current.srcObject = null;
      }
      setCaptureDeviceLabel(null);
      setPreviewConnected(false);
      setRunning(false);
    }
  }

  return (
    <div className={styles.shell}>
        <section className={styles.intro}>
          <p className={styles.eyebrow}>Gameplay Capture</p>
          <p>
            Choose OBS Virtual Camera or select a screen, window, or browser tab directly. Frames stay in the
            browser; ChatXPT sends only normalized game facts, timestamps, confidence, and supported-signal status.
          </p>
        </section>

        {sessionError !== null ? <p className={styles.error} role="alert">{sessionError}</p> : null}
        {error !== null ? <p className={styles.error} role="alert">{error}</p> : null}

        <section className={styles.panel} aria-labelledby="setup-heading">
        <h2 id="setup-heading">Connect capture</h2>
        <ol>
          <li>Select the capture source and matching game profile below.</li>
          <li>
            {captureSource === "obs-virtual-camera"
              ? <>Start Virtual Camera in OBS, then click <strong>Connect OBS Virtual Camera</strong>.</>
              : <>Click <strong>Select Screen or Window</strong> and choose the gameplay feed.</>}
          </li>
          <li>Keep this Gameplay Engine page open while you play.</li>
        </ol>
        <div className={styles.preview} data-active={previewConnected ? "true" : "false"}>
          <video
            ref={previewRef}
            muted
            autoPlay
            playsInline
            suppressHydrationWarning
            aria-label="Exact gameplay feed watched by ChatXPT"
          />
          <div aria-live="polite">
            <span>Current selected source</span>
            <strong>
              {previewConnected
                ? captureDeviceLabel
                : running
                  ? captureSource === "obs-virtual-camera"
                    ? "Connecting to OBS Virtual Camera…"
                    : "Waiting for your screen or window selection…"
                : captureSource === "obs-virtual-camera"
                  ? "None selected — connect OBS Virtual Camera"
                  : "None selected — select a screen or window"}
            </strong>
            <small>
              {previewConnected
                ? latest === null
                  ? "Preview is live; waiting for the first analysed frame"
                  : `Live heartbeat: frame ${latest.frameCount} analysed at ${new Date(latest.capturedAt).toLocaleTimeString()}`
                : running
                  ? "ChatXPT will not start analysis until this exact preview is live."
                  : "After you connect, this preview shows the exact feed ChatXPT analyzes."}
            </small>
          </div>
        </div>
        <form onSubmit={(event) => event.preventDefault()}>
          <label className={styles.field}>
            Current Studio session
            <input
              value={view?.session.sessionId ?? (sessionError === null ? "Loading Studio session" : "Studio session unavailable — retrying")}
              readOnly
            />
          </label>
          <label className={styles.field}>
            Game profile
            <select
              value={game}
              disabled={running || view === null}
              onChange={(event) => {
                const nextGame = event.target.value as CaptureGame;
                setGame(nextGame);
                rememberCapturePreference({ game: nextGame, source: captureSource, connected: false });
              }}
            >
              <option value="minecraft">Minecraft Java - default vanilla HUD calibration</option>
              <option value="brawl-stars">Brawl Stars - calibrated when HUD confirms</option>
              <option value="generic">Generic - universal visual signals only</option>
            </select>
          </label>
          <fieldset className={styles.sourcePicker}>
            <legend>Choose how ChatXPT watches your game</legend>
            <div>
              <button
                type="button"
                disabled={running || view === null}
                onClick={() => void start("screen-window")}
              >
                <strong>Select Screen or Window</strong>
                <span>Open the browser picker and choose the gameplay feed.</span>
              </button>
              <button
                type="button"
                disabled={running || view === null}
                onClick={() => void start("obs-virtual-camera")}
              >
                <strong>Connect OBS Virtual Camera</strong>
                <span>Analyze the active scene sent by OBS Virtual Camera.</span>
              </button>
            </div>
            <small>
              {running
                ? "Stop the current capture before switching sources."
                : "Both choices use the same local gameplay analysis engine."}
            </small>
          </fieldset>
          <div className={styles.actions}>
            <button type="button" disabled={!running} onClick={stop}>Stop</button>
            <a href="/studio">Back to Studio home</a>
          </div>
        </form>
        <p className={styles.boundary}>
          This page connects the product capture path. It still reports unsupported or low-confidence
          game facts as unknown instead of guessing.
        </p>
        <p className={styles.keepOpen}>
          Keep this Gameplay Engine page open while you play. Navigating away stops access to the
          selected gameplay feed, and returning here lets you reconnect it.
        </p>
        <p className={styles.boundary}>
          {capturePreference?.lastConnectedAt === null || capturePreference === null
            ? "No saved capture preference yet. The selected game profile is remembered in this browser after setup."
            : `Last successful capture in this browser: ${new Date(capturePreference.lastConnectedAt).toLocaleString()}.`}
        </p>
        </section>

        {previewConnected ? (
          <>
        <section className={styles.proofPanel} aria-live="polite" aria-labelledby="proof-heading">
        <div>
          <p className={styles.eyebrow}>Live detector proof</p>
          <h2 id="proof-heading">What ChatXPT reads from this exact feed</h2>
          <p>
            {latest === null
              ? "Waiting for the first analysed frame."
              : `${latest.frameCount} frames analysed locally at ${latest.analysisRateFps?.toFixed(1) ?? "starting"} frames/sec.`}
          </p>
        </div>
        <div className={styles.proofGrid}>
          <span><small>Health hearts</small><strong>{latest?.health ?? "Waiting"}</strong></span>
          <span><small>Hunger shanks</small><strong>{latest?.hunger ?? "Waiting"}</strong></span>
          <span><small>Recent damage</small><strong>{latest?.recentDamage ?? "Waiting"}</strong></span>
          <span><small>Movement</small><strong>{latest?.movement ?? "Waiting"}</strong></span>
          <span><small>Turning</small><strong>{latest?.turning ?? "Waiting"}</strong></span>
          <span><small>Combat</small><strong>{latest?.combat ?? "Waiting"}</strong></span>
          <span><small>Eating</small><strong>{latest?.eating ?? "Waiting"}</strong></span>
          <span><small>Health trend</small><strong>{latest?.healthTrend ?? "Waiting"}</strong></span>
          <span><small>Screen state</small><strong>{latest?.screen ?? "Waiting"}</strong></span>
          <span><small>Land / water</small><strong>{latest?.environment ?? "Waiting"}</strong></span>
          <span><small>Alive / dead</small><strong>{latest?.life ?? "Waiting"}</strong></span>
          <span><small>HUD detector</small><strong>{latest?.hudStatus ?? "Waiting"}</strong></span>
          <span><small>Analysis sample</small><strong>{latest?.sampleResolution ?? "Waiting"}</strong></span>
          <span><small>Unknown facts</small><strong>{latest?.unknownFactCount ?? "Waiting"}</strong></span>
        </div>
        <p className={styles.detectorReason}>{latest?.hudReason ?? "Connect the Minecraft gameplay feed to begin."}</p>
        <details>
          <summary>HUD anchor confidence</summary>
          <p>{latest?.hudAnchorScores ?? "Waiting for the first analysed frame."}</p>
        </details>
        </section>

        <section className={styles.grid} aria-live="polite" aria-label="Gameplay Capture status">
        <article className={styles.metric}><span>Capture Health</span><strong>{captureHealthCopy(running, latest !== null, error, failureReason, captureSource)}</strong></article>
        <article className={styles.metric}><span>Studio connection</span><strong>{ingressStatus}</strong></article>
        <article className={styles.metric}><span>Snapshots accepted</span><strong>{acceptedSnapshots}</strong></article>
        <article className={styles.metric}><span>Frames analyzed</span><strong>{latest?.frameCount ?? 0}</strong></article>
        <article className={styles.metric}><span>Local analysis rate</span><strong>{latest?.analysisRateFps === null || latest === null ? "Starting" : `${latest.analysisRateFps.toFixed(1)} / sec`}</strong></article>
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
          </>
        ) : null}
    </div>
  );
}
