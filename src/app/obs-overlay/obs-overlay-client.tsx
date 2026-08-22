"use client";

import { useEffect, useRef, useState } from "react";

import type { OverlayViewModel } from "@/core";
import { ObsQuestOverlaySurface } from "@/viewer";

import styles from "./page.module.css";

interface OverlayPayload {
  readonly ok: boolean;
  readonly view?: OverlayViewModel;
  readonly error?: { readonly code?: string; readonly message?: string };
}

export function ObsOverlayClient() {
  const [view, setView] = useState<OverlayViewModel | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [setupError, setSetupError] = useState<string | null>(null);
  const [standby, setStandby] = useState<"connecting" | "offline">("connecting");
  const tokenRef = useRef<string | null>(null);
  const broadcasterIdRef = useRef<string | null>(null);

  useEffect(() => {
    document.documentElement.dataset.surface = "obs-overlay";
    const url = new URL(window.location.href);
    const fragment = new URLSearchParams(url.hash.replace(/^#/, ""));
    const broadcasterId = url.searchParams.get("broadcasterId");
    const tokenStorageKey = broadcasterId === null
      ? null
      : `chatxpt.obs-overlay-token.${broadcasterId}`;
    const fragmentToken = fragment.get("overlayAccessToken");
    const token = fragmentToken ?? (tokenStorageKey === null
      ? null
      : window.sessionStorage.getItem(tokenStorageKey));
    if (token === null || token.length < 16 || broadcasterId === null || broadcasterId.length === 0) {
      const notice = window.setTimeout(
        () => setSetupError("This OBS Browser Source URL is incomplete. Copy the permanent source URL from ChatXPT Studio."),
        0,
      );
      return () => {
        window.clearTimeout(notice);
        delete document.documentElement.dataset.surface;
      };
    }
    tokenRef.current = token;
    broadcasterIdRef.current = broadcasterId;
    if (fragmentToken !== null && tokenStorageKey !== null) {
      window.sessionStorage.setItem(tokenStorageKey, fragmentToken);
    }
    return () => {
      tokenRef.current = null;
      broadcasterIdRef.current = null;
      delete document.documentElement.dataset.surface;
    };
  }, []);

  useEffect(() => {
    let stopped = false;
    let activeController: AbortController | null = null;
    let refreshing = false;

    const refresh = async () => {
      const token = tokenRef.current;
      const broadcasterId = broadcasterIdRef.current;
      if (token === null || broadcasterId === null || refreshing) return;
      refreshing = true;
      activeController = new AbortController();
      try {
        const response = await fetch(
          `/api/obs/overlay/state?broadcasterId=${encodeURIComponent(broadcasterId)}`,
          {
            headers: { authorization: `Bearer ${token}` },
            cache: "no-store",
            signal: activeController.signal,
          },
        );
        const payload = (await response.json()) as OverlayPayload;
        if (!response.ok || !payload.ok || payload.view === undefined) {
          if (!stopped && payload.error?.code === "session-not-found") {
            setView(null);
            setStandby("offline");
            setSetupError(null);
          } else if (!stopped) {
            setStandby("connecting");
            setSetupError(payload.error?.message ?? "Overlay state is unavailable.");
          }
          return;
        }
        if (!stopped) {
          setView(payload.view);
          setStandby("connecting");
          setSetupError(null);
          setNow(Date.now());
        }
      } catch (caught) {
        if (!stopped && !(caught instanceof DOMException && caught.name === "AbortError")) {
          setSetupError("Reconnecting to authoritative overlay state.");
        }
      } finally {
        refreshing = false;
        activeController = null;
      }
    };

    const initial = window.setTimeout(() => void refresh(), 0);
    const interval = window.setInterval(() => void refresh(), 1_500);
    const clock = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => {
      stopped = true;
      activeController?.abort();
      window.clearTimeout(initial);
      window.clearInterval(interval);
      window.clearInterval(clock);
    };
  }, []);

  return (
    <main className={`${styles.root} canonical-obs-overlay`}>
      <ObsQuestOverlaySurface view={view} now={now} standby={standby} />
      {setupError !== null ? (
        <p className={styles.error} role="status">{setupError}</p>
      ) : null}
    </main>
  );
}
