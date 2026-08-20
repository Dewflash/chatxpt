"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";

import type { StreamerReadinessView, StreamerViewModel } from "@/core";
import { connectRealtimeSnapshot } from "@/app/realtime-snapshot-client";
import {
  PersistentStreamOverlaySurface,
  StudioManagementSurface,
  StudioProductPageSurface,
  TwitchConfigSurface,
  TwitchLiveConfigSurface,
  type StudioProductPage,
  type StreamerUiCommand,
} from "@/streamer";

import styles from "./streamer-authorized-client.module.css";

type Surface =
  | "studio"
  | "studio-home"
  | "studio-gameplay"
  | "studio-live-analytics"
  | "studio-live-quests"
  | "studio-profile"
  | "studio-stream-settings"
  | "studio-test-lab"
  | "config"
  | "live-config"
  | "studio-live-config"
  | "studio-live-director";

interface TwitchAuthorization {
  readonly token: string;
  readonly channelId: string;
  readonly userId?: string;
}

interface TwitchExtensionHelper {
  onAuthorized(callback: (authorization: TwitchAuthorization) => void): void;
}

declare global {
  interface Window {
    Twitch?: { readonly ext?: TwitchExtensionHelper };
  }
}

interface SurfacePayload {
  readonly ok: boolean;
  readonly view?: StreamerViewModel;
  readonly readiness?: StreamerReadinessView;
  readonly roomCode?: string | null;
  readonly message?: string;
  readonly error?: { readonly message?: string; readonly retryable?: boolean };
}

interface ObsDescriptorPayload {
  readonly ok: boolean;
  readonly descriptor?: {
    readonly url: string;
    readonly width: number;
    readonly height: number;
  };
  readonly expiresAt?: number;
  readonly error?: { readonly message?: string };
}

const studioProductPages: Readonly<Record<string, StudioProductPage>> = {
  "studio-home": "home",
  "studio-gameplay": "gameplay",
  "studio-live-analytics": "live-analytics",
  "studio-live-quests": "live-quests",
  "studio-profile": "profile",
  "studio-stream-settings": "stream-settings",
  "studio-test-lab": "test-lab",
};

function isStudioAuthenticatedSurface(surface: Surface): boolean {
  return surface === "studio" ||
    surface === "studio-live-config" ||
    surface === "studio-live-director" ||
    surface in studioProductPages;
}

function StudioCaptureAndOverlaySetup({ sessionId }: { readonly sessionId: string }) {
  const [descriptor, setDescriptor] = useState<ObsDescriptorPayload["descriptor"]>(undefined);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [pending, setPending] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  async function generateOverlay(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setPending(true);
    setSetupError(null);
    setCopyMessage(null);
    try {
      const response = await fetch("/api/obs/overlay/grant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          sessionId,
          width: Number(data.get("overlayWidth")),
          height: Number(data.get("overlayHeight")),
        }),
      });
      const payload = (await response.json()) as ObsDescriptorPayload;
      if (!response.ok || !payload.ok || payload.descriptor === undefined) {
        setSetupError(payload.error?.message ?? "OBS Browser Source setup failed.");
        return;
      }
      setDescriptor(payload.descriptor);
      setExpiresAt(payload.expiresAt ?? null);
    } catch {
      setSetupError("OBS Browser Source setup was interrupted.");
    } finally {
      setPending(false);
    }
  }

  async function copyUrl() {
    if (descriptor === undefined) return;
    try {
      await navigator.clipboard.writeText(descriptor.url);
      setCopyMessage("Secure OBS Browser Source URL copied.");
    } catch {
      setCopyMessage("Copy the URL from the field manually.");
    }
  }

  return (
    <aside id="broadcast-output-setup" className={styles.integrationSetup} aria-label="Stream input and broadcast output setup">
      <section>
        <p className={styles.setupEyebrow}>Stream input</p>
        <h2>Gameplay Capture</h2>
        <p>
          Open the capture surface, choose the game profile, and connect OBS Virtual Camera. Only
          normalized game facts are sent to this session; frames stay in the browser.
        </p>
        <a href="/studio/gameplay/capture" target="_blank" rel="noreferrer">
          Open Gameplay Capture
        </a>
      </section>
      <section>
        <p className={styles.setupEyebrow}>Broadcast output</p>
        <h2>OBS Browser Source</h2>
        <p>
          Generate a read-only overlay URL for this live session, then paste it into an OBS Browser
          Source. This output never accepts votes or streamer commands.
        </p>
        <form onSubmit={generateOverlay}>
          <div className={styles.dimensionRow}>
            <label>Width<input name="overlayWidth" type="number" defaultValue="1920" min="1" max="7680" required /></label>
            <label>Height<input name="overlayHeight" type="number" defaultValue="1080" min="1" max="4320" required /></label>
          </div>
          <button type="submit" disabled={pending}>{pending ? "Generating…" : "Generate secure URL"}</button>
        </form>
        {descriptor !== undefined ? (
          <div className={styles.descriptor}>
            <label>
              OBS Browser Source URL
              <input value={descriptor.url} readOnly aria-label="OBS Browser Source URL" />
            </label>
            <button type="button" onClick={() => void copyUrl()}>Copy URL</button>
            <small>
              {descriptor.width}×{descriptor.height}; transparent; read-only
              {expiresAt === null ? "" : `; expires ${new Date(expiresAt).toLocaleString()}`}.
              Treat this URL like a password and regenerate it if exposed.
            </small>
          </div>
        ) : null}
        {setupError ? <p className={styles.setupError} role="alert">{setupError}</p> : null}
        {copyMessage ? <p className={styles.copyMessage} role="status">{copyMessage}</p> : null}
      </section>
    </aside>
  );
}

export function StreamerAuthorizedClient({ surface }: { readonly surface: Surface }) {
  const [token, setToken] = useState<string | null>(null);
  const [view, setView] = useState<StreamerViewModel | null>(null);
  const [readiness, setReadiness] = useState<StreamerReadinessView | null>(null);
  const [pendingCommandId, setPendingCommandId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [requiresBootstrap, setRequiresBootstrap] = useState(false);
  const [starting, setStarting] = useState(false);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const latestToken = useRef<string | null>(null);

  useEffect(() => {
    latestToken.current = token;
  }, [token]);

  useEffect(() => {
    const parameters = new URLSearchParams(window.location.search);
    const oauth = parameters.get("oauth");
    const notice = window.setTimeout(() => {
      if (oauth === "connected") {
        setMessage(
          parameters.get("eventsub") === "pending"
            ? "Twitch connected. Channel game details were imported and chat delivery is being verified."
            : "Twitch connected. Channel game details were imported; chat delivery still needs recovery.",
        );
      } else if (oauth === "error") {
        setError("Twitch connection did not finish. Retry Twitch authorization or use the diagnostic fallback.");
      }
    }, 0);
    if (oauth !== null) {
      window.history.replaceState({}, "", window.location.pathname);
    }
    return () => window.clearTimeout(notice);
  }, []);

  useEffect(() => {
    if (isStudioAuthenticatedSurface(surface)) return;
    let stopped = false;
    let attempts = 0;
    const register = () => {
      const helper = window.Twitch?.ext;
      if (helper !== undefined) {
        helper.onAuthorized((authorization) => {
          if (stopped) return;
          setToken(authorization.token);
          setError(null);
        });
        return;
      }
      attempts += 1;
      if (attempts < 100) {
        window.setTimeout(register, 100);
      } else {
        setError("Open this page through Twitch Config or Live Config so Twitch can authorize the broadcaster.");
      }
    };
    register();
    return () => { stopped = true; };
  }, [surface]);

  const requestHeaders = useCallback((): HeadersInit => {
    const activeToken = latestToken.current;
    return activeToken === null ? {} : { authorization: `Bearer ${activeToken}` };
  }, []);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    if (!isStudioAuthenticatedSurface(surface) && latestToken.current === null) return;
    try {
      const response = await fetch("/api/studio/session", {
        headers: requestHeaders(),
        credentials: "include",
        cache: "no-store",
        signal,
      });
      const payload = (await response.json()) as SurfacePayload;
      if (!response.ok || !payload.ok || payload.view === undefined || payload.readiness === undefined) {
        if (
          isStudioAuthenticatedSurface(surface) &&
          (response.status === 401 || response.status === 404)
        ) {
          setView(null);
          setReadiness(null);
          setRoomCode(null);
          setRequiresBootstrap(true);
        }
        setError(payload.error?.message ?? "Studio state is unavailable.");
        return;
      }
      setView(payload.view);
      setReadiness(payload.readiness);
      setRoomCode(payload.roomCode ?? null);
      setRequiresBootstrap(false);
      setError(null);
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      setError("Reconnecting to the streamer session.");
    }
  }, [requestHeaders, surface]);

  useEffect(() => {
    const active = isStudioAuthenticatedSurface(surface) || token !== null;
    if (!active) return;
    const controller = new AbortController();
    const initial = window.setTimeout(() => void refresh(controller.signal), 0);
    const interval = window.setInterval(() => void refresh(controller.signal), 10_000);
    return () => {
      controller.abort();
      window.clearTimeout(initial);
      window.clearInterval(interval);
    };
  }, [refresh, surface, token]);

  useEffect(() => {
    const sessionId = view?.session.sessionId;
    if (sessionId === undefined) return;
    let stopped = false;
    let disconnect: (() => Promise<void>) | null = null;
    void connectRealtimeSnapshot({
      role: "streamer",
      sessionId,
      surfaceAuthorization: token,
      loadLatest: async () => {
        const response = await fetch("/api/studio/session", {
          headers: requestHeaders(),
          credentials: "include",
          cache: "no-store",
        });
        const payload = (await response.json()) as SurfacePayload;
        return response.ok && payload.ok ? payload.view ?? null : null;
      },
      onSnapshot: (snapshot) => {
        if (!stopped) setView(snapshot);
      },
    }).then((release) => {
      if (stopped) void release?.();
      else disconnect = release;
    }).catch(() => {
      // The regular authorised read remains the recovery path.
    });
    return () => {
      stopped = true;
      void disconnect?.();
    };
  }, [requestHeaders, token, view?.session.sessionId]);

  useEffect(() => {
    if (view?.session.status !== "live") return;
    const sendPresence = (action: "heartbeat" | "disconnect", keepalive = false) => {
      void fetch("/api/studio/presence", {
        method: "POST",
        headers: { ...requestHeaders(), "content-type": "application/json" },
        credentials: "include",
        cache: "no-store",
        keepalive,
        body: JSON.stringify({ action }),
      }).catch(() => {
        // The next heartbeat or authorised read performs recovery.
      });
    };
    const initial = window.setTimeout(() => sendPresence("heartbeat"), 0);
    const interval = window.setInterval(() => sendPresence("heartbeat"), 30_000);
    const disconnect = () => sendPresence("disconnect", true);
    window.addEventListener("pagehide", disconnect);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
      window.removeEventListener("pagehide", disconnect);
    };
  }, [requestHeaders, view?.session.status]);

  async function startSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const setupKey = String(data.get("setupKey") ?? "");
    const gameId = String(data.get("gameId") ?? "").trim();
    const gameName = String(data.get("gameName") ?? "").trim();
    setStarting(true);
    setError(null);
    try {
      const response = await fetch("/api/studio/session/start", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-chatxpt-studio-setup-key": setupKey,
        },
        credentials: "include",
        body: JSON.stringify({
          channelId: String(data.get("channelId") ?? "").trim(),
          displayName: String(data.get("displayName") ?? "").trim(),
          gameId: gameId || null,
          gameName: gameName || null,
        }),
      });
      const payload = (await response.json()) as SurfacePayload;
      if (!response.ok || !payload.ok || payload.view === undefined || payload.readiness === undefined) {
        setError(payload.error?.message ?? "The broadcaster session could not be started.");
        return;
      }
      setView(payload.view);
      setReadiness(payload.readiness);
      setRoomCode(payload.roomCode ?? null);
      setRequiresBootstrap(false);
      setMessage("Broadcaster session started. Twitch surfaces can now map the signed channel JWT to this session.");
    } catch {
      setError("The secure broadcaster session request was interrupted.");
    } finally {
      setStarting(false);
    }
  }

  const dispatchCommand = useCallback(async (command: StreamerUiCommand) => {
    setPendingCommandId(command.commandId);
    setError(null);
    try {
      const response = await fetch("/api/studio/commands", {
        method: "POST",
        headers: { ...requestHeaders(), "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify(command),
      });
      const payload = (await response.json()) as SurfacePayload;
      if (payload.view !== undefined) setView(payload.view);
      if (payload.readiness !== undefined) setReadiness(payload.readiness);
      if (!response.ok || !payload.ok) {
        setError(payload.error?.message ?? "The Studio action was rejected.");
        if (response.status === 409) await refresh();
        return;
      }
      setMessage(payload.message ?? "Studio action completed.");
    } catch {
      setError("The command response was interrupted. Studio is refreshing the latest state.");
      await refresh();
    } finally {
      setPendingCommandId(null);
    }
  }, [refresh, requestHeaders]);

  if (isStudioAuthenticatedSurface(surface) && requiresBootstrap && view === null) {
    return (
      <main className={styles.bootstrap}>
        <section className={styles.bootstrapCard}>
          <div>
            <p>ChatXPT Studio</p>
            <h1>Start the broadcaster session</h1>
          </div>
          <p>
            Connect the broadcaster account once. ChatXPT verifies Twitch, imports the channel game,
            prepares signed chat delivery, and creates the session used by every surface.
          </p>
          <a className={styles.oauthButton} href="/api/twitch/oauth/start">Connect Twitch</a>
          <details className={styles.manualFallback}>
            <summary>Diagnostic manual setup</summary>
            <p>Use this only when external Twitch credentials are unavailable during local recovery.</p>
            <form onSubmit={startSession}>
              <label>
                Twitch channel ID
                <input name="channelId" required autoComplete="off" />
              </label>
              <label>
                Streamer display name
                <input name="displayName" required autoComplete="name" />
              </label>
              <label>
                Game ID (optional; supply with game name)
                <input name="gameId" autoComplete="off" />
              </label>
              <label>
                Game name (optional; supply with game ID)
                <input name="gameName" autoComplete="off" />
              </label>
              <label>
                Server-only Studio setup key
                <input name="setupKey" type="password" required autoComplete="off" />
              </label>
              <button type="submit" disabled={starting}>{starting ? "Starting…" : "Start diagnostic session"}</button>
            </form>
            <p className={styles.grantNote}>
              The setup key is sent only over this HTTPS request and is never stored in browser storage.
            </p>
          </details>
          {error ? <p className={styles.error} role="alert">{error}</p> : null}
        </section>
      </main>
    );
  }

  const commandMessage = error ?? message;
  const productPage = studioProductPages[surface];
  if (productPage !== undefined) {
    return (
      <>
        <StudioProductPageSurface
          page={productPage}
          view={view}
          readiness={readiness}
          commandMessage={commandMessage}
          pendingCommandId={pendingCommandId}
          onCommand={(command) => void dispatchCommand(command)}
        />
        {productPage === "test-lab" && view !== null
          ? <StudioCaptureAndOverlaySetup sessionId={view.session.sessionId} />
          : null}
        {roomCode ? (
          <div className={styles.roomBanner}>
            Hosted Quest Board: <strong>{roomCode}</strong> · <a href={`/quest-board/${encodeURIComponent(roomCode)}`} target="_blank" rel="noreferrer">Open viewer link</a>
          </div>
        ) : null}
      </>
    );
  }
  if (surface === "config") {
    return (
      <TwitchConfigSurface
        view={view}
        readiness={readiness}
        studioHref="/studio"
        pendingCommandId={pendingCommandId}
        commandMessage={commandMessage}
        onCommand={(command) => void dispatchCommand(command)}
      />
    );
  }
  if (surface === "live-config" || surface === "studio-live-config") {
    return (
      <TwitchLiveConfigSurface
        view={view}
        readiness={readiness}
        studioHref="/studio"
        popoutHref="/studio/live-director?display=popout"
        pendingCommandId={pendingCommandId}
        commandMessage={commandMessage}
        onCommand={(command) => void dispatchCommand(command)}
      />
    );
  }
  if (surface === "studio-live-director") {
    return (
      <PersistentStreamOverlaySurface
        view={view}
        readiness={readiness}
      />
    );
  }
  return (
    <>
      <StudioManagementSurface
        view={view}
        readiness={readiness}
        pendingCommandId={pendingCommandId}
        commandMessage={commandMessage}
        onCommand={(command) => void dispatchCommand(command)}
      />
      {view !== null ? <StudioCaptureAndOverlaySetup sessionId={view.session.sessionId} /> : null}
      {roomCode ? (
        <div className={styles.roomBanner}>
          Hosted Quest Board: <strong>{roomCode}</strong> · <a href={`/quest-board/${encodeURIComponent(roomCode)}`} target="_blank" rel="noreferrer">Open viewer link</a>
        </div>
      ) : null}
    </>
  );
}
