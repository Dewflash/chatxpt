"use client";

import { useEffect, useRef, useState } from "react";

import type { StreamerViewModel } from "@/core";
import { PersistentStreamOverlaySurface } from "@/streamer";

import styles from "./page.module.css";

interface LiveDirectorPayload {
  readonly ok: boolean;
  readonly view?: StreamerViewModel;
  readonly error?: { readonly code?: string; readonly message?: string };
}

export function LiveDirectorOverlayClient() {
  const [view, setView] = useState<StreamerViewModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const tokenRef = useRef<string | null>(null);
  const broadcasterIdRef = useRef<string | null>(null);

  useEffect(() => {
    document.documentElement.dataset.surface = "live-director-overlay";
    const url = new URL(window.location.href);
    const broadcasterId = url.searchParams.get("broadcasterId");
    const fragment = new URLSearchParams(url.hash.replace(/^#/, ""));
    const token = fragment.get("directorAccessToken");
    if (token === null || token.length < 16 || broadcasterId === null || broadcasterId.length === 0) {
      const notice = window.setTimeout(
        () => setError("This Live Director Dock URL is incomplete. Copy the permanent private URL from ChatXPT Studio."),
        0,
      );
      return () => {
        window.clearTimeout(notice);
        delete document.documentElement.dataset.surface;
      };
    }
    tokenRef.current = token;
    broadcasterIdRef.current = broadcasterId;
    return () => {
      tokenRef.current = null;
      broadcasterIdRef.current = null;
      delete document.documentElement.dataset.surface;
    };
  }, []);

  useEffect(() => {
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
  }, []);

  return (
    <main className={styles.root}>
      <PersistentStreamOverlaySurface view={view} />
      {error !== null ? <p className={styles.error} role="status">{error}</p> : null}
    </main>
  );
}
