"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";

import type { StreamerReadinessView, StreamerViewModel } from "@/core";
import {
  StudioManagementSurface,
  TwitchConfigSurface,
  TwitchLiveConfigSurface,
  type StreamerUiCommand,
} from "@/streamer";

import styles from "./streamer-authorized-client.module.css";

type Surface = "studio" | "config" | "live-config";

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
    if (surface === "studio") return;
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
    if (surface !== "studio" && latestToken.current === null) return;
    try {
      const response = await fetch("/api/studio/session", {
        headers: requestHeaders(),
        credentials: "include",
        cache: "no-store",
        signal,
      });
      const payload = (await response.json()) as SurfacePayload;
      if (!response.ok || !payload.ok || payload.view === undefined || payload.readiness === undefined) {
        if (surface === "studio" && response.status === 401) setRequiresBootstrap(true);
        setError(payload.error?.message ?? "Authoritative streamer state is unavailable.");
        return;
      }
      setView(payload.view);
      setReadiness(payload.readiness);
      setRequiresBootstrap(false);
      setError(null);
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      setError("Reconnecting to the authoritative streamer session.");
    }
  }, [requestHeaders, surface]);

  useEffect(() => {
    const active = surface === "studio" || token !== null;
    if (!active) return;
    const controller = new AbortController();
    const initial = window.setTimeout(() => void refresh(controller.signal), 0);
    const interval = window.setInterval(() => void refresh(controller.signal), 2_000);
    return () => {
      controller.abort();
      window.clearTimeout(initial);
      window.clearInterval(interval);
    };
  }, [refresh, surface, token]);

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
        setError(payload.error?.message ?? "The authoritative command was rejected.");
        if (response.status === 409) await refresh();
        return;
      }
      setMessage(payload.message ?? "Authoritative command completed.");
    } catch {
      setError("The command response was interrupted. Studio is refreshing authoritative state.");
      await refresh();
    } finally {
      setPendingCommandId(null);
    }
  }, [refresh, requestHeaders]);

  if (surface === "studio" && requiresBootstrap && view === null) {
    return (
      <main className={styles.bootstrap}>
        <section className={styles.bootstrapCard}>
          <div>
            <p>ChatXPT Studio</p>
            <h1>Start the broadcaster session</h1>
          </div>
          <p>
            This manual server-authorized step creates the real channel-to-session mapping used by
            the Twitch Extension, Gameplay Capture, hosted Quest Board, and OBS overlay.
          </p>
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
            <button type="submit" disabled={starting}>{starting ? "Starting…" : "Start session"}</button>
          </form>
          <p className={styles.grantNote}>
            The setup key is sent only over this HTTPS request and is not stored in browser storage.
            The server returns an HttpOnly, expiring session cookie.
          </p>
          {error ? <p className={styles.error} role="alert">{error}</p> : null}
        </section>
      </main>
    );
  }

  const commandMessage = error ?? message;
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
  if (surface === "live-config") {
    return (
      <TwitchLiveConfigSurface
        view={view}
        readiness={readiness}
        studioHref="/studio"
        pendingCommandId={pendingCommandId}
        commandMessage={commandMessage}
        onCommand={(command) => void dispatchCommand(command)}
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
      {roomCode ? (
        <div className={styles.roomBanner}>
          Hosted Quest Board code: <strong>{roomCode}</strong>. Copy it now; it is intentionally not placed in browser storage.
        </div>
      ) : null}
    </>
  );
}
