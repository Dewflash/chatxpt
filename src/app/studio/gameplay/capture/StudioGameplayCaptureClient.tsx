"use client";

import { useEffect, useRef, useState } from "react";

import {
  resolveCurrentStreamGame,
  type GameplaySnapshot,
  type StreamerReadinessView,
  type StreamerViewModel,
} from "@/core";
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
  buildCurrentGameProfileSettingsCommand,
  buildCurrentStreamGameCommand,
  connectGameplayCapturePreview,
  describeSelectedGameplaySource,
  editableDefaultsFromView,
  resolveDesktopDirectorSetupMode,
  STUDIO_GAME_PROFILE_OPTIONS,
  studioGameProfileOption,
  type StudioGameProfileId,
} from "@/streamer";

import styles from "./studio-gameplay-capture.module.css";
import {
  captureDeliveryResponseAction,
  captureSnapshotIsStale,
} from "./capture-delivery-policy";

export type CaptureGame = StudioGameProfileId;
type CaptureSource = "screen-window" | "obs-virtual-camera";

const CAPTURE_PREFERENCE_KEY = "chatxpt.studio.gameplayCapture.v1";
export const DESKTOP_DIRECTOR_OPEN_URL = "chatxpt://open";

export function requestAutomaticDesktopDirectorOpen(
  view: StreamerViewModel,
  navigate: (url: string) => void = (url) => window.location.assign(url),
): boolean {
  try {
    if (resolveDesktopDirectorSetupMode(view.profile) !== "automatic") return false;
    navigate(DESKTOP_DIRECTOR_OPEN_URL);
    return true;
  } catch {
    return false;
  }
}

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
  readonly error?: { readonly code?: string; readonly message?: string; readonly retryable?: boolean };
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
  readonly profileReadings: readonly CaptureReading[];
}

export interface CaptureReading {
  readonly signalId: string;
  readonly label: string;
  readonly value: string;
  readonly category: CaptureReadingCategory;
  readonly availability: "supported";
}

export type CaptureReadingCategory = "condition" | "activity" | "environment" | "others";

const CAPTURE_READING_CATEGORIES: readonly {
  readonly id: CaptureReadingCategory;
  readonly label: string;
}[] = [
  { id: "condition", label: "Condition" },
  { id: "activity", label: "Activity" },
  { id: "environment", label: "Environment" },
  { id: "others", label: "Others" },
];

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

export function captureGameFromView(view: StreamerViewModel | null): CaptureGame {
  const currentGame = view === null
    ? null
    : resolveCurrentStreamGame(view.profile, view.session.currentGame);
  const gameId = currentGame?.gameId.toLowerCase() ?? "";
  const gameName = currentGame?.gameName.toLowerCase() ?? "";
  if (gameId.includes("minecraft") || gameName.includes("minecraft")) return "minecraft";
  if (gameId.includes("brawl") || gameName.includes("brawl")) return "brawl-stars";
  if (gameId === "generic") return "generic";
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
  return game === "generic" ? null : studioGameProfileOption(game);
}

function captureGameLabel(game: CaptureGame): string {
  return game === "generic" ? "Generic" : studioGameProfileOption(game).label;
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

function signalValue(
  snapshot: GameplaySnapshot,
  signalId: string,
  lastKnownValues?: Map<string, string>,
): string {
  const observation = snapshot.signals.find((signal) => signal.signalId === signalId)?.observation;
  if (observation?.status === "known") {
    const value = String(observation.value);
    lastKnownValues?.set(signalId, value);
    return value;
  }
  if (observation?.status === "stale" && observation.previousValue !== undefined) {
    const value = String(observation.previousValue);
    lastKnownValues?.set(signalId, value);
    return value;
  }
  return lastKnownValues?.get(signalId) ?? "Unknown";
}

const CAPTURE_READING_DEFINITIONS: Readonly<Record<CaptureGame, readonly Omit<CaptureReading, "value">[]>> = {
  minecraft: [
    { signalId: "minecraft-health-hearts", label: "Health", category: "condition", availability: "supported" },
    { signalId: "minecraft-hunger-shanks", label: "Hunger", category: "condition", availability: "supported" },
    { signalId: "minecraft-armor-points", label: "Armor", category: "condition", availability: "supported" },
    { signalId: "minecraft-recent-damage", label: "Recent damage", category: "condition", availability: "supported" },
    { signalId: "minecraft-health-trend", label: "Health trend", category: "condition", availability: "supported" },
    { signalId: "minecraft-life", label: "Alive / dead", category: "condition", availability: "supported" },
    { signalId: "minecraft-turning", label: "Turning", category: "activity", availability: "supported" },
    { signalId: "minecraft-movement", label: "Movement", category: "activity", availability: "supported" },
    { signalId: "minecraft-combat", label: "Combat", category: "activity", availability: "supported" },
    { signalId: "minecraft-eating", label: "Eating", category: "activity", availability: "supported" },
    { signalId: "game-global-motion-pattern", label: "Global motion", category: "activity", availability: "supported" },
    { signalId: "minecraft-environment", label: "Scene / environment", category: "environment", availability: "supported" },
    { signalId: "minecraft-day-night", label: "Day / night", category: "environment", availability: "supported" },
    { signalId: "game-scene-transition", label: "Scene transition", category: "environment", availability: "supported" },
    { signalId: "minecraft-screen", label: "Screen state", category: "others", availability: "supported" },
    { signalId: "minecraft-selected-hotbar-category", label: "Selected item", category: "others", availability: "supported" },
  ],
  "brawl-stars": [
    { signalId: "brawl-match-active", label: "Match active", category: "condition", availability: "supported" },
    { signalId: "game-vision-activity", label: "Activity intensity", category: "activity", availability: "supported" },
    { signalId: "game-global-motion-pattern", label: "Global motion", category: "activity", availability: "supported" },
    { signalId: "game-scene-transition", label: "Scene transition", category: "environment", availability: "supported" },
    { signalId: "brawl-hud-layout", label: "HUD layout", category: "others", availability: "supported" },
    { signalId: "game-vision-state", label: "Visual state", category: "others", availability: "supported" },
  ],
  generic: [
    { signalId: "game-vision-activity", label: "Activity intensity", category: "activity", availability: "supported" },
    { signalId: "game-global-motion-pattern", label: "Global motion", category: "activity", availability: "supported" },
    { signalId: "game-scene-transition", label: "Scene transition", category: "environment", availability: "supported" },
    { signalId: "game-vision-state", label: "Visual state", category: "others", availability: "supported" },
  ],
};

export function captureReadingsForSnapshot(
  game: CaptureGame,
  snapshot: GameplaySnapshot | null,
  lastKnownValues?: Map<string, string>,
): readonly CaptureReading[] {
  return CAPTURE_READING_DEFINITIONS[game].map((reading) => ({
    ...reading,
    value: snapshot === null ? "—" : signalValue(snapshot, reading.signalId, lastKnownValues),
  }));
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
  const [savingGameProfile, setSavingGameProfile] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);
  const previewRef = useRef<HTMLVideoElement | null>(null);
  const lastKnownSignalValuesRef = useRef(new Map<string, string>());
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
        const platformGame = captureGameFromView(payload.view);
        if (!capturePreferenceLoadedRef.current) {
          const savedPreference = readCapturePreference();
          capturePreferenceLoadedRef.current = true;
          setCapturePreference(savedPreference);
          setCaptureSource(savedPreference?.source ?? "screen-window");
        }
        setGame(platformGame);
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

  async function persistGameProfile(
    selectedCaptureGame: CaptureGame,
    currentView: StreamerViewModel,
    signal?: AbortSignal,
  ): Promise<StreamerViewModel> {
    const selectedGame = savedGameFor(selectedCaptureGame);
    const currentGame = resolveCurrentStreamGame(
      currentView.profile,
      currentView.session.currentGame,
    );
    if (selectedGame === null) {
      if (currentGame?.gameId === "generic" && currentGame.gameName === "Current Game") {
        return currentView;
      }
      const response = await fetch("/api/studio/commands", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        cache: "no-store",
        signal,
        body: JSON.stringify(buildCurrentStreamGameCommand(currentView, {
          gameId: "generic",
          gameName: "Current Game",
        })),
      });
      const payload = (await response.json()) as StudioSessionPayload;
      if (!response.ok || !payload.ok || payload.view === undefined) {
        throw new CaptureRequestError(
          payload.error?.message ?? "ChatXPT could not apply the Generic stream profile.",
          payload.error?.retryable === true || response.status >= 500 || response.status === 409,
        );
      }
      setView(payload.view);
      if (payload.readiness !== undefined) setReadiness(payload.readiness);
      return payload.view;
    }
    if (
      currentView.profile.gameId === selectedGame.gameId &&
      currentView.profile.gameName === selectedGame.gameName &&
      currentGame?.gameId === selectedGame.gameId &&
      currentGame.gameName === selectedGame.gameName
    ) {
      return currentView;
    }
    const response = await fetch("/api/studio/commands", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      cache: "no-store",
      signal,
      body: JSON.stringify(buildCurrentGameProfileSettingsCommand(currentView, {
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
    setView(payload.view);
    if (payload.readiness !== undefined) setReadiness(payload.readiness);
    return payload.view;
  }

  async function selectGameProfile(nextGame: CaptureGame): Promise<void> {
    if (nextGame !== game) {
      lastKnownSignalValuesRef.current.clear();
      setLatest(null);
    }
    setGame(nextGame);
    rememberCapturePreference({ game: nextGame, source: captureSource, connected: false });
    if (view === null) return;
    setSavingGameProfile(true);
    setError(null);
    setIngressStatus(`Saving ${captureGameLabel(nextGame)} profile`);
    try {
      await persistGameProfile(nextGame, view);
      setIngressStatus(
        nextGame === "generic"
          ? "Generic analysis selected for this stream"
          : `${captureGameLabel(nextGame)} profile selected and saved`,
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "ChatXPT could not save the selected game profile.");
      setIngressStatus("Game profile could not be saved");
    } finally {
      setSavingGameProfile(false);
    }
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

    try {
      currentView = await persistGameProfile(game, currentView, controller.signal);
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
      requestAutomaticDesktopDirectorOpen(currentView);
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
            if (captureSnapshotIsStale(snapshot.envelope.occurredAt)) {
              setIngressStatus("OBS capture is still live; skipped one stale frame after browser scheduling paused");
              return;
            }
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
            const responseAction = captureDeliveryResponseAction({
              responseOk: response.ok && payload.ok,
              status: response.status,
              resultReason: payload.result?.reason,
              errorCode: payload.error?.code,
              retryable: payload.error?.retryable,
            });
            if (responseAction !== "accepted") {
              if (responseAction === "refresh-authority") {
                setIngressStatus("Session changed; capture connection refreshed");
              } else if (responseAction === "skip-stale") {
                setIngressStatus("OBS capture is still live; skipped an out-of-date frame and resumed with the latest one");
              } else if (responseAction === "throttled") {
                setIngressStatus("Server delivery throttled; local analysis is continuing");
              } else {
                throw new CaptureRequestError(
                  payload.error?.message ?? "Gameplay snapshot was rejected.",
                  responseAction === "retry",
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
          sampler: createBrowserCanvasPixelSampler({
            maximumPixels: captureProfile.requestedGameId === "minecraft" ? 640 * 360 : 160 * 90,
          }),
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
            profileReadings: captureReadingsForSnapshot(
              game,
              builtSnapshot,
              lastKnownSignalValuesRef.current,
            ),
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

  const detectorReadings = latest?.profileReadings ?? captureReadingsForSnapshot(game, null);
  const captureStatsColumns = [
    {
      id: "connection",
      label: "Connection",
      stats: [
        { label: "Capture health", value: captureHealthCopy(running, latest !== null, error, failureReason, captureSource) },
        { label: "Studio connection", value: ingressStatus },
        { label: "Support tier", value: latest?.supportTier ?? "Waiting" },
      ],
    },
    {
      id: "processing",
      label: "Processing",
      stats: [
        { label: "Snapshots accepted", value: acceptedSnapshots },
        { label: "Frames analysed", value: latest?.frameCount ?? 0 },
        { label: "Local analysis rate", value: latest?.analysisRateFps === null || latest === null ? "Starting" : `${latest.analysisRateFps.toFixed(1)} / sec` },
        { label: "Last observation", value: latest === null ? "-" : new Date(latest.capturedAt).toLocaleTimeString() },
        { label: "Signal confidence", value: latest === null ? "-" : latest.confidence.toFixed(2) },
      ],
    },
    {
      id: "gameplay",
      label: "Gameplay",
      stats: [
        { label: "Gameplay activity", value: latest === null ? "Unknown" : `${latest.gameplayActivity[0].toUpperCase()}${latest.gameplayActivity.slice(1)}` },
        { label: "Detected game facts", value: latest?.hudStatus ?? "Waiting" },
        { label: "Game profile", value: latest?.gameProfile ?? (view === null ? "Waiting" : resolveCurrentStreamGame(view.profile, view.session.currentGame)?.gameName ?? "Waiting") },
        { label: "Confidence", value: latest?.confidenceLabel ?? "Unavailable" },
      ],
    },
    {
      id: "others",
      label: "Others",
      stats: [
        { label: "Cadence", value: latest === null ? "Waiting" : `${latest.cadence} - ${latest.cadenceReason}` },
        { label: "Capture source", value: previewConnected ? captureDeviceLabel ?? "Connected source" : running ? "Connecting" : "None" },
        { label: "Analysis sample", value: latest?.sampleResolution ?? "Waiting" },
        { label: "Unknown facts", value: latest?.unknownFactCount ?? "Waiting" },
      ],
    },
  ] as const;

  return (
    <div className={styles.shell}>
        {sessionError !== null ? <p className={styles.error} role="alert">{sessionError}</p> : null}
        {error !== null ? <p className={styles.error} role="alert">{error}</p> : null}

        <section id="overview" className={styles.proofPanel} aria-live="polite" aria-labelledby="proof-heading">
          <div className={styles.proofHeading}>
            <div>
              <p className={styles.eyebrow}>{captureGameLabel(game)} profile</p>
              <h2 id="proof-heading">Live Detector Proof</h2>
            </div>
            <p>
              {!previewConnected
                ? running
                  ? "Connecting gameplay feed…"
                  : "Connect a gameplay feed first."
                : latest === null
                  ? "Feed connected · analysing the first frame."
                  : `Feed connected · ${latest.frameCount} frames analysed locally at ${latest.analysisRateFps?.toFixed(1) ?? "starting"} frames/sec.`}
            </p>
          </div>
          <div className={styles.proofColumns}>
            {CAPTURE_READING_CATEGORIES.map((category) => (
              <section className={styles.proofColumn} key={category.id} aria-labelledby={`proof-${category.id}`}>
                <h3 id={`proof-${category.id}`}>{category.label}</h3>
                <dl>
                  {detectorReadings
                    .filter((reading) => reading.category === category.id)
                    .map((reading) => (
                      <div key={reading.signalId} data-availability={reading.availability}>
                        <dt>{reading.label}</dt>
                        <dd>{reading.value}</dd>
                      </div>
                    ))}
                  {category.id === "others" ? (
                    <>
                      <div>
                        <dt>HUD detector</dt>
                        <dd>{latest?.hudStatus ?? "—"}</dd>
                      </div>
                      <div>
                        <dt>Analysis sample</dt>
                        <dd>{latest?.sampleResolution ?? "—"}</dd>
                      </div>
                      <div>
                        <dt>Unknown facts</dt>
                        <dd>{latest?.unknownFactCount ?? "—"}</dd>
                      </div>
                    </>
                  ) : null}
                </dl>
              </section>
            ))}
          </div>
          <p className={styles.detectorReason}>{latest?.hudReason ?? `Connect the ${captureGameLabel(game)} gameplay feed to begin.`}</p>
          {game === "minecraft" ? (
            <details>
              <summary>HUD anchor confidence</summary>
              <p>{latest?.hudAnchorScores ?? "—"}</p>
            </details>
          ) : null}
        </section>

        <section id="stream-capture" className={styles.panel} aria-labelledby="setup-heading">
        <div className={styles.setupHeading}>
          <h2 id="setup-heading">Stream Capture</h2>
          <div className={styles.captureInfo}>
            <button type="button" aria-label="Stream Capture instructions" aria-describedby="capture-instructions">i</button>
            <div id="capture-instructions" role="tooltip">
              <ol>
                <li>Select the matching game profile.</li>
                <li>Choose a screen or connect OBS Virtual Camera.</li>
                <li>Move around Studio freely; capture continues until you stop it.</li>
              </ol>
            </div>
          </div>
        </div>
        <div className={styles.preview} data-active={previewConnected ? "true" : "false"}>
          <video
            ref={previewRef}
            muted
            autoPlay
            playsInline
            suppressHydrationWarning
            aria-label="Exact gameplay feed watched by ChatXPT"
          />
          <form className={styles.captureControls} onSubmit={(event) => event.preventDefault()}>
            <div className={styles.selectedSource} aria-live="polite">
              <span>Current selected source</span>
              <strong>
                {previewConnected
                  ? captureDeviceLabel
                  : running
                    ? captureSource === "obs-virtual-camera"
                      ? "Connecting to OBS Virtual Camera…"
                      : "Waiting for screen selection…"
                    : "None"}
              </strong>
              {previewConnected ? (
                <small>
                  {latest === null
                    ? "Waiting for the first analysed frame"
                    : `Frame ${latest.frameCount} analysed at ${new Date(latest.capturedAt).toLocaleTimeString()}`}
                </small>
              ) : null}
            </div>
            <label className={styles.field}>
              Current Studio session
              <input
                value={view?.session.sessionId ?? (sessionError === null ? "Loading Studio session" : "Studio session unavailable - retrying")}
                readOnly
              />
            </label>
            <label className={styles.field}>
              Game profile
              <select
                value={game}
                disabled={running || savingGameProfile || view === null}
                onChange={(event) => void selectGameProfile(event.target.value as CaptureGame)}
              >
                {STUDIO_GAME_PROFILE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            {running ? (
              <button className={styles.stopCapture} type="button" onClick={stop}>Stop capture</button>
            ) : (
              <fieldset className={styles.sourcePicker}>
                <legend>Capture source</legend>
                <div>
                  <button
                    type="button"
                    disabled={savingGameProfile || view === null}
                    onClick={() => void start("screen-window")}
                  >
                    Select Screen or Window
                  </button>
                  <button
                    type="button"
                    disabled={savingGameProfile || view === null}
                    onClick={() => void start("obs-virtual-camera")}
                  >
                    Connect OBS Virtual Camera
                  </button>
                </div>
              </fieldset>
            )}
          </form>
        </div>
        <p className={styles.lastCapture}>
          {capturePreference?.lastConnectedAt === null || capturePreference === null
            ? "Last successful capture: None"
            : `Last successful capture: ${new Date(capturePreference.lastConnectedAt).toLocaleString()}`}
        </p>
        </section>

        <section id="capture-stats" className={`${styles.panel} ${styles.statsPanel}`} aria-live="polite" aria-labelledby="capture-stats-heading">
          <h2 id="capture-stats-heading">Capture Stats</h2>
          <div className={styles.statsColumns}>
            {captureStatsColumns.map((column) => (
              <section className={styles.statsColumn} key={column.id} aria-labelledby={`capture-stats-${column.id}`}>
                <h3 id={`capture-stats-${column.id}`}>{column.label}</h3>
                <dl>
                  {column.stats.map((stat) => (
                    <div key={stat.label}>
                      <dt>{stat.label}</dt>
                      <dd>{stat.value}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}
          </div>
        </section>

        {previewConnected ? (
          <>
        <section id="facts" className={styles.panel}>
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

        <section id="session-readiness" className={styles.panel}>
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
