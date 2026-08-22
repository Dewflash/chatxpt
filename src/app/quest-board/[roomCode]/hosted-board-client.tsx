"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { domainErrorSchema, type DomainError, type ViewerViewModel } from "@/core";
import { connectRealtimeSnapshot } from "@/app/realtime-snapshot-client";
import { HostedQuestBoardSurface } from "@/viewer";

interface HostedResponse {
  readonly ok: boolean;
  readonly view?: ViewerViewModel;
  readonly error?: { readonly code?: string; readonly message?: string; readonly retryable?: boolean };
}

/** Keeps memory-mode boards responsive even when private Realtime is unavailable. */
export const HOSTED_BOARD_RECOVERY_POLL_INTERVAL_MS = 1_500;

function responseError(payload: HostedResponse, fallback: string): DomainError {
  const rawCode = payload.error?.code;
  const code = [
    "validation",
    "unauthenticated",
    "forbidden",
    "stale-revision",
    "duplicate",
    "unavailable-capability",
    "expired",
    "rate-limited",
    "dependency-unavailable",
    "internal",
  ].includes(rawCode ?? "")
    ? rawCode
    : rawCode === "session-unavailable" || rawCode === "session-not-found"
      ? "unavailable-capability"
      : "dependency-unavailable";
  return domainErrorSchema.parse({
    code,
    message: payload.error?.message ?? fallback,
    retryable: payload.error?.retryable ?? true,
  });
}

function commandId(prefix: string): string {
  return typeof window.crypto?.randomUUID === "function"
    ? `hosted-${prefix}-${window.crypto.randomUUID()}`
    : `hosted-${prefix}-${Date.now().toString(36)}`;
}

export function HostedBoardClient({ roomCode }: { readonly roomCode: string }) {
  const [view, setView] = useState<ViewerViewModel | null>(null);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [pendingCandidateId, setPendingCandidateId] = useState<string | null>(null);
  const [commandError, setCommandError] = useState<DomainError | null>(null);
  const [now, setNow] = useState<number>();
  const accessReady = useRef(false);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    if (!accessReady.current) return;
    try {
      const response = await fetch("/api/hosted-board/viewer", {
        credentials: "include",
        cache: "no-store",
        signal,
      });
      const payload = (await response.json()) as HostedResponse;
      if (!response.ok || !payload.ok || payload.view === undefined) {
        setCommandError(responseError(payload, "Hosted Quest Board state is unavailable."));
        return;
      }
      setView(payload.view);
      setCommandError(null);
      setSelectedCandidateId((selected) => {
        if (payload.view?.acceptedCandidateId !== null && payload.view?.acceptedCandidateId !== undefined) {
          return payload.view.acceptedCandidateId;
        }
        return selected !== null && payload.view?.questCycle.options.some((option) => option.candidateId === selected)
          ? selected
          : null;
      });
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      setCommandError(domainErrorSchema.parse({
        code: "dependency-unavailable",
        message: "Reconnecting to the Hosted Quest Board. A confirmed vote will be restored.",
        retryable: true,
      }));
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let stopped = false;
    const open = async () => {
      try {
        const response = await fetch("/api/hosted-board/access", {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "include",
          cache: "no-store",
          signal: controller.signal,
          body: JSON.stringify({ roomCode }),
        });
        const payload = (await response.json()) as HostedResponse;
        if (!response.ok || !payload.ok) {
          if (!stopped) setCommandError(responseError(payload, "This Quest Board could not be opened."));
          return;
        }
        accessReady.current = true;
        await refresh(controller.signal);
      } catch (caught) {
        if (!stopped && !(caught instanceof DOMException && caught.name === "AbortError")) {
          setCommandError(domainErrorSchema.parse({
            code: "dependency-unavailable",
            message: "This Quest Board could not connect.",
            retryable: true,
          }));
        }
      }
    };
    void open();
    const interval = window.setInterval(
      () => void refresh(controller.signal),
      HOSTED_BOARD_RECOVERY_POLL_INTERVAL_MS,
    );
    return () => {
      stopped = true;
      accessReady.current = false;
      controller.abort();
      window.clearInterval(interval);
    };
  }, [refresh, roomCode]);

  useEffect(() => {
    const sessionId = view?.session.sessionId;
    if (!accessReady.current || sessionId === undefined) return;
    let stopped = false;
    let disconnect: (() => Promise<void>) | null = null;
    void connectRealtimeSnapshot({
      role: "viewer",
      sessionId,
      loadLatest: async () => {
        const response = await fetch("/api/hosted-board/viewer", {
          credentials: "include",
          cache: "no-store",
        });
        const payload = (await response.json()) as HostedResponse;
        return response.ok && payload.ok ? payload.view ?? null : null;
      },
      onSnapshot: () => {
        if (!stopped) void refresh();
      },
    }).then((release) => {
      if (stopped) void release?.();
      else disconnect = release;
    }).catch(() => {
      // Polling restores authoritative state if private Realtime is unavailable.
    });
    return () => {
      stopped = true;
      void disconnect?.();
    };
  }, [refresh, view?.session.sessionId]);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(interval);
  }, []);

  const submit = useCallback(async (
    command: { readonly commandId: string; readonly candidateId: string } | { readonly commandId: string; readonly reaction: "hype" },
  ) => {
    try {
      const response = await fetch("/api/hosted-board/commands", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        cache: "no-store",
        body: JSON.stringify(command),
      });
      const payload = (await response.json()) as HostedResponse;
      if (payload.view !== undefined) setView(payload.view);
      if (!response.ok || !payload.ok) {
        setCommandError(responseError(payload, "The viewer command could not be accepted."));
        return false;
      }
      setCommandError(null);
      return true;
    } catch {
      setCommandError(domainErrorSchema.parse({
        code: "dependency-unavailable",
        message: "The response was interrupted. ChatXPT is checking authoritative state.",
        retryable: true,
      }));
      await refresh();
      return false;
    }
  }, [refresh]);

  async function submitVote(candidateId: string) {
    setPendingCandidateId(candidateId);
    const accepted = await submit({ commandId: commandId("vote"), candidateId });
    if (accepted) setSelectedCandidateId(candidateId);
    setPendingCandidateId(null);
  }

  return (
    <HostedQuestBoardSurface
      view={view}
      roomCode={roomCode.toUpperCase()}
      selectedCandidateId={selectedCandidateId}
      pendingCandidateId={pendingCandidateId}
      commandError={commandError}
      now={now}
      onSelectCandidate={(candidateId) => {
        setSelectedCandidateId(candidateId);
        setCommandError(null);
      }}
      onVoteCandidate={(candidateId) => void submitVote(candidateId)}
      onReact={() => void submit({ commandId: commandId("reaction"), reaction: "hype" })}
      onRetry={() => {
        if (accessReady.current) void refresh();
        else window.location.reload();
      }}
    />
  );
}
