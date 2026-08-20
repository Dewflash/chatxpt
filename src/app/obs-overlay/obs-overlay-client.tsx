"use client";

import { useEffect, useState } from "react";

import type { OverlayViewModel } from "@/core";
import { connectRealtimeSnapshot } from "@/app/realtime-snapshot-client";
import { ObsQuestOverlaySurface } from "@/viewer";

import styles from "./page.module.css";

interface OverlayPayload {
  readonly ok: boolean;
  readonly view?: OverlayViewModel;
  readonly error?: { readonly message?: string };
}

export function ObsOverlayClient() {
  const [view, setView] = useState<OverlayViewModel | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [setupError, setSetupError] = useState<string | null>(null);
  const [connection, setConnection] = useState<{
    readonly token: string;
    readonly sessionId: string;
  } | null>(null);

  useEffect(() => {
    document.documentElement.dataset.surface = "obs-overlay";
    const url = new URL(window.location.href);
    const fragment = new URLSearchParams(url.hash.replace(/^#/, ""));
    const token = fragment.get("overlayAccessToken");
    const sessionId = url.searchParams.get("sessionId");
    if (token === null || token.length < 16 || sessionId === null || sessionId.length === 0) {
      const notice = window.setTimeout(
        () => setSetupError("This OBS Browser Source URL is incomplete. Generate a new URL in ChatXPT Studio."),
        0,
      );
      return () => {
        window.clearTimeout(notice);
        delete document.documentElement.dataset.surface;
      };
    }
    const ready = window.setTimeout(() => setConnection({ token, sessionId }), 0);
    url.hash = "";
    window.history.replaceState(null, document.title, `${url.pathname}${url.search}`);
    return () => {
      window.clearTimeout(ready);
      delete document.documentElement.dataset.surface;
    };
  }, []);

  useEffect(() => {
    let stopped = false;
    let activeController: AbortController | null = null;

    const refresh = async () => {
      if (connection === null) return;
      activeController?.abort();
      activeController = new AbortController();
      try {
        const response = await fetch(
          `/api/obs/overlay/state?sessionId=${encodeURIComponent(connection.sessionId)}`,
          {
            headers: { authorization: `Bearer ${connection.token}` },
            cache: "no-store",
            signal: activeController.signal,
          },
        );
        const payload = (await response.json()) as OverlayPayload;
        if (!response.ok || !payload.ok || payload.view === undefined) {
          if (!stopped) setSetupError(payload.error?.message ?? "Overlay state is unavailable.");
          return;
        }
        if (!stopped) {
          setView(payload.view);
          setSetupError(null);
          setNow(Date.now());
        }
      } catch (caught) {
        if (!stopped && !(caught instanceof DOMException && caught.name === "AbortError")) {
          setSetupError("Reconnecting to authoritative overlay state.");
        }
      }
    };

    const initial = window.setTimeout(() => void refresh(), 0);
    const interval = window.setInterval(() => void refresh(), 10_000);
    const clock = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => {
      stopped = true;
      activeController?.abort();
      window.clearTimeout(initial);
      window.clearInterval(interval);
      window.clearInterval(clock);
    };
  }, [connection]);

  useEffect(() => {
    if (connection === null) return;
    let stopped = false;
    let disconnect: (() => Promise<void>) | null = null;
    void connectRealtimeSnapshot({
      role: "overlay",
      sessionId: connection.sessionId,
      surfaceAuthorization: connection.token,
      loadLatest: async () => {
        const response = await fetch(
          `/api/obs/overlay/state?sessionId=${encodeURIComponent(connection.sessionId)}`,
          {
            headers: { authorization: `Bearer ${connection.token}` },
            cache: "no-store",
          },
        );
        const payload = (await response.json()) as OverlayPayload;
        return response.ok && payload.ok ? payload.view ?? null : null;
      },
      onSnapshot: (snapshot) => {
        if (!stopped) {
          setView(snapshot);
          setSetupError(null);
          setNow(Date.now());
        }
      },
    }).then((release) => {
      if (stopped) void release?.();
      else disconnect = release;
    }).catch(() => {
      // The authorised state read remains the reconnect path.
    });
    return () => {
      stopped = true;
      void disconnect?.();
    };
  }, [connection]);

  return (
    <main className={`${styles.root} canonical-obs-overlay`}>
      <ObsQuestOverlaySurface view={view} now={now} />
      {setupError !== null ? (
        <p className={styles.error} role="status">{setupError}</p>
      ) : null}
    </main>
  );
}
