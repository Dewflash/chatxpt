"use client";

import { useEffect, useRef, useState } from "react";

import type { StreamerViewModel } from "@/core";
import {
  PersistentStreamOverlaySurface,
  type StreamerUiCommand,
} from "@/streamer";

import styles from "./page.module.css";

interface LiveDirectorPayload {
  readonly ok: boolean;
  readonly view?: StreamerViewModel;
  readonly message?: string;
  readonly error?: { readonly code?: string; readonly message?: string };
}

export interface DesktopLiveDirectorBridge {
  getDirectorAuth(): Promise<{
    readonly broadcasterId: string | null;
    readonly accessToken: string | null;
  } | null>;
}

export async function resolveLiveDirectorClientAuth(
  href: string,
  desktopBridge?: DesktopLiveDirectorBridge,
): Promise<{ readonly broadcasterId: string; readonly accessToken: string } | null> {
  const url = new URL(href);
  const fragment = new URLSearchParams(url.hash.replace(/^#/, ""));
  let broadcasterId = url.searchParams.get("broadcasterId");
  let accessToken = fragment.get("directorAccessToken");
  if ((accessToken === null || accessToken.length < 16) && desktopBridge !== undefined) {
    const desktopAuth = await desktopBridge.getDirectorAuth();
    broadcasterId = desktopAuth?.broadcasterId ?? broadcasterId;
    accessToken = desktopAuth?.accessToken ?? accessToken;
  }
  if (
    broadcasterId === null ||
    broadcasterId.length === 0 ||
    accessToken === null ||
    accessToken.length < 16
  ) {
    return null;
  }
  return { broadcasterId, accessToken };
}

declare global {
  interface Window {
    chatxptDesktop?: DesktopLiveDirectorBridge;
  }
}

export function LiveDirectorOverlayClient() {
  const [view, setView] = useState<StreamerViewModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [commandMessage, setCommandMessage] = useState<string | null>(null);
  const [pendingCommandId, setPendingCommandId] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const tokenRef = useRef<string | null>(null);
  const broadcasterIdRef = useRef<string | null>(null);

  useEffect(() => {
    document.documentElement.dataset.surface = "live-director-overlay";
    let cancelled = false;
    const initialise = async () => {
      try {
        const auth = await resolveLiveDirectorClientAuth(window.location.href, window.chatxptDesktop);
        if (cancelled) return;
        if (auth === null) {
          setError("This Live Director link is incomplete. Create the permanent private link in ChatXPT Studio.");
          return;
        }
        tokenRef.current = auth.accessToken;
        broadcasterIdRef.current = auth.broadcasterId;
        setAuthReady(true);
      } catch {
        if (!cancelled) setError("The desktop Live Director could not unlock its private link.");
      }
    };
    void initialise();
    return () => {
      cancelled = true;
      tokenRef.current = null;
      broadcasterIdRef.current = null;
      delete document.documentElement.dataset.surface;
    };
  }, []);

  useEffect(() => {
    if (!authReady) return;
    let stopped = false;
    let controller: AbortController | null = null;
    let refreshing = false;
    const refresh = async () => {
      const token = tokenRef.current;
      const broadcasterId = broadcasterIdRef.current;
      if (token === null || broadcasterId === null || refreshing) return;
      refreshing = true;
      controller = new AbortController();
      try {
        const response = await fetch(
          `/api/live-director/state?broadcasterId=${encodeURIComponent(broadcasterId)}`,
          {
            headers: { authorization: `Bearer ${token}` },
            cache: "no-store",
            signal: controller.signal,
          },
        );
        const payload = (await response.json()) as LiveDirectorPayload;
        if (!response.ok || !payload.ok || payload.view === undefined) {
          if (!stopped && payload.error?.code === "session-not-found") {
            setView(null);
            setError(null);
          } else if (!stopped) {
            setError(payload.error?.message ?? "Live Director state is unavailable.");
          }
          return;
        }
        if (!stopped) {
          setView(payload.view);
          setError(null);
        }
      } catch (caught) {
        if (!stopped && !(caught instanceof DOMException && caught.name === "AbortError")) {
          setError("Reconnecting to the private Live Director.");
        }
      } finally {
        refreshing = false;
        controller = null;
      }
    };
    const initial = window.setTimeout(() => void refresh(), 0);
    const interval = window.setInterval(() => void refresh(), 1_500);
    return () => {
      stopped = true;
      controller?.abort();
      window.clearTimeout(initial);
      window.clearInterval(interval);
    };
  }, [authReady]);

  async function dispatchCommand(command: StreamerUiCommand) {
    const token = tokenRef.current;
    const broadcasterId = broadcasterIdRef.current;
    if (token === null || broadcasterId === null) {
      setError("The private Live Director link is not ready.");
      return;
    }
    setPendingCommandId(command.commandId);
    setCommandMessage(null);
    setError(null);
    try {
      const response = await fetch(
        `/api/live-director/commands?broadcasterId=${encodeURIComponent(broadcasterId)}`,
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${token}`,
            "content-type": "application/json",
          },
          cache: "no-store",
          body: JSON.stringify(command),
        },
      );
      const payload = (await response.json()) as LiveDirectorPayload;
      if (payload.view !== undefined) setView(payload.view);
      if (!response.ok || !payload.ok) {
        setError(payload.error?.message ?? "Live Director could not complete the quest action.");
        return;
      }
      setCommandMessage(payload.message ?? "Quest action completed.");
    } catch {
      setError("The Live Director command was interrupted. Current state is refreshing.");
    } finally {
      setPendingCommandId(null);
    }
  }

  return (
    <main className={styles.root}>
      <PersistentStreamOverlaySurface
        view={view}
        pendingCommandId={pendingCommandId}
        commandMessage={commandMessage}
        onCommand={(command) => void dispatchCommand(command)}
      />
      {error !== null ? <p className={styles.error} role="status">{error}</p> : null}
    </main>
  );
}
