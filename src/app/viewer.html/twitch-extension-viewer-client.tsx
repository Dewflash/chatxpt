"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { domainErrorSchema, type DomainError, type ViewerViewModel } from "@/core";
import { TwitchExtensionViewerSurface } from "@/viewer";

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

interface ViewerResponse {
  readonly ok: boolean;
  readonly view?: ViewerViewModel;
  readonly outcome?: "committed" | "duplicate";
  readonly error?: { readonly code?: string; readonly message?: string; readonly retryable?: boolean };
}

function responseError(payload: ViewerResponse, fallback: string): DomainError {
  const code = payload.error?.code;
  const canonicalCode = [
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
  ].includes(code ?? "")
    ? code
    : code === "session-unavailable" || code === "session-not-found"
      ? "unavailable-capability"
      : "dependency-unavailable";
  return domainErrorSchema.parse({
    code: canonicalCode,
    message: payload.error?.message ?? fallback,
    retryable: payload.error?.retryable ?? true,
  });
}

function commandId(prefix = "vote"): string {
  return typeof window.crypto?.randomUUID === "function"
    ? `twx-${prefix}-${window.crypto.randomUUID()}`
    : `twx-${prefix}-${Date.now().toString(36)}`;
}

export function TwitchExtensionViewerClient() {
  const [token, setToken] = useState<string | null>(null);
  const [view, setView] = useState<ViewerViewModel | null>(null);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [pendingCandidateId, setPendingCandidateId] = useState<string | null>(null);
  const [commandError, setCommandError] = useState<DomainError | null>(null);
  const [now, setNow] = useState<number>();
  const latestToken = useRef<string | null>(null);

  useEffect(() => {
    latestToken.current = token;
  }, [token]);

  useEffect(() => {
    let stopped = false;
    let attempts = 0;
    const register = () => {
      const helper = window.Twitch?.ext;
      if (helper !== undefined) {
        helper.onAuthorized((authorization) => {
          if (stopped) return;
          setToken(authorization.token);
          setCommandError(null);
        });
        return;
      }
      attempts += 1;
      if (attempts < 100) {
        window.setTimeout(register, 100);
      } else {
        setCommandError(
          domainErrorSchema.parse({
            code: "unauthenticated",
            message: "Open this panel through Twitch Local Test or Hosted Test to authorize voting.",
            retryable: true,
          }),
        );
      }
    };
    register();
    return () => {
      stopped = true;
    };
  }, []);

  const refresh = useCallback(async (activeToken: string, signal?: AbortSignal) => {
    try {
      const response = await fetch("/api/twitch/extension/viewer", {
        headers: { authorization: `Bearer ${activeToken}` },
        cache: "no-store",
        signal,
      });
      const payload = (await response.json()) as ViewerResponse;
      if (!response.ok || !payload.ok || payload.view === undefined) {
        setCommandError(responseError(payload, "The Twitch viewer state is unavailable."));
        return;
      }
      setView(payload.view);
      setCommandError(null);
      if (payload.view.acceptedCandidateId !== null) {
        setSelectedCandidateId(payload.view.acceptedCandidateId);
      } else if (
        selectedCandidateId !== null &&
        !payload.view.questCycle.options.some(
          (option) => option.candidateId === selectedCandidateId,
        )
      ) {
        setSelectedCandidateId(null);
      }
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      setCommandError(
        domainErrorSchema.parse({
          code: "dependency-unavailable",
          message: "Reconnecting to ChatXPT. Your confirmed vote will be restored automatically.",
          retryable: true,
        }),
      );
    }
  }, [selectedCandidateId]);

  useEffect(() => {
    if (token === null) return;
    const controller = new AbortController();
    const initial = window.setTimeout(() => void refresh(token, controller.signal), 0);
    const interval = window.setInterval(() => {
      if (latestToken.current !== null) void refresh(latestToken.current, controller.signal);
    }, 1_500);
    return () => {
      controller.abort();
      window.clearTimeout(initial);
      window.clearInterval(interval);
    };
  }, [refresh, token]);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(interval);
  }, []);

  const submitVote = useCallback(async (candidateId: string) => {
    const activeToken = latestToken.current;
    if (activeToken === null) {
      setCommandError(
        domainErrorSchema.parse({
          code: "unauthenticated",
          message: "Twitch is still authorizing this viewer.",
          retryable: true,
        }),
      );
      return;
    }
    setPendingCandidateId(candidateId);
    setCommandError(null);
    try {
      const response = await fetch("/api/twitch/extension/commands", {
        method: "POST",
        headers: {
          authorization: `Bearer ${activeToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ commandId: commandId(), candidateId }),
      });
      const payload = (await response.json()) as ViewerResponse;
      if (payload.view !== undefined) setView(payload.view);
      if (!response.ok || !payload.ok) {
        setCommandError(responseError(payload, "The vote could not be accepted."));
        if (payload.view?.acceptedCandidateId !== null && payload.view?.acceptedCandidateId !== undefined) {
          setSelectedCandidateId(payload.view.acceptedCandidateId);
        }
        return;
      }
      setSelectedCandidateId(payload.view?.acceptedCandidateId ?? candidateId);
      setCommandError(null);
    } catch {
      setCommandError(
        domainErrorSchema.parse({
          code: "dependency-unavailable",
          message: "The vote response was interrupted. ChatXPT is checking whether it was accepted.",
          retryable: true,
        }),
      );
      await refresh(activeToken);
    } finally {
      setPendingCandidateId(null);
    }
  }, [refresh]);

  const submitReaction = useCallback(async (reaction: string) => {
    const activeToken = latestToken.current;
    if (activeToken === null) return;
    try {
      const response = await fetch("/api/twitch/extension/commands", {
        method: "POST",
        headers: {
          authorization: `Bearer ${activeToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ commandId: commandId("reaction"), reaction }),
      });
      const payload = (await response.json()) as ViewerResponse;
      if (payload.view !== undefined) setView(payload.view);
      if (!response.ok || !payload.ok) {
        setCommandError(responseError(payload, "The reaction could not be accepted."));
      }
    } catch {
      setCommandError(
        domainErrorSchema.parse({
          code: "dependency-unavailable",
          message: "The reaction response was interrupted. ChatXPT is reconnecting.",
          retryable: true,
        }),
      );
    }
  }, []);

  return (
    <TwitchExtensionViewerSurface
      view={view}
      selectedCandidateId={selectedCandidateId}
      pendingCandidateId={pendingCandidateId}
      commandError={commandError}
      now={now}
      onSelectCandidate={(candidateId) => {
        setSelectedCandidateId(candidateId);
        setCommandError(null);
      }}
      onVoteCandidate={(candidateId) => void submitVote(candidateId)}
      onReact={(reaction) => void submitReaction(reaction)}
    />
  );
}
