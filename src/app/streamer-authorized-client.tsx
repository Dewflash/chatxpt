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

interface LocalPreviewAccount {
  readonly id: string;
  readonly displayName: string;
  readonly email: string;
  readonly signedInAt: number;
}

const LOCAL_PREVIEW_ACCOUNT_KEY = "chatxpt.local-preview-account.v1";
const localPreviewAccountRequired = process.env.NEXT_PUBLIC_APP_ENV === "local" ||
  process.env.NEXT_PUBLIC_CHATXPT_PREVIEW_ACCOUNT_ENABLED === "true";

export function twitchOauthErrorMessage(reason: string | null): string {
  if (reason === "misconfigured") {
    return "Connect Twitch is unavailable because this local ChatXPT server has no registered Twitch application ID and secret. Configure the product-owned Twitch app once, restart ChatXPT, and try again.";
  }
  if (reason === "denied") return "Twitch authorization was cancelled. Choose Connect Twitch when you are ready to try again.";
  if (reason === "state") return "Twitch authorization expired or opened in another browser. Choose Connect Twitch to start a fresh secure request.";
  return "Twitch connection did not finish. Choose Connect Twitch to retry authorization.";
}

function readLocalPreviewAccount(): LocalPreviewAccount | null {
  try {
    const source = window.localStorage.getItem(LOCAL_PREVIEW_ACCOUNT_KEY);
    if (source === null) return null;
    const parsed = JSON.parse(source) as Partial<LocalPreviewAccount>;
    if (
      typeof parsed.id !== "string" ||
      typeof parsed.displayName !== "string" ||
      typeof parsed.email !== "string" ||
      typeof parsed.signedInAt !== "number"
    ) return null;
    return parsed as LocalPreviewAccount;
  } catch {
    return null;
  }
}

export function LocalPreviewAccountGate({
  loading,
  onSignIn,
}: {
  readonly loading: boolean;
  readonly onSignIn: (account: LocalPreviewAccount) => void;
}) {
  const [accountError, setAccountError] = useState<string | null>(null);

  function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const displayName = String(data.get("displayName") ?? "").trim();
    const email = String(data.get("email") ?? "").trim().toLowerCase();
    const password = String(data.get("password") ?? "");
    if (displayName.length < 2 || !email.includes("@") || password.length < 8) {
      setAccountError("Enter a display name, an email address, and at least eight password characters.");
      return;
    }
    setAccountError(null);
    onSignIn({
      id: typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `local-${Date.now()}`,
      displayName,
      email,
      signedInAt: Date.now(),
    });
  }

  return (
    <main className={styles.bootstrap}>
      <section className={styles.bootstrapCard} aria-labelledby="local-account-heading">
        <div>
          <p className={styles.accountEyebrow}>Demo account preview</p>
          <h1 id="local-account-heading">Sign in to ChatXPT</h1>
        </div>
        <p>
          This fake account lets you test the downloaded-app journey before production account
          authentication is connected. It stays only in this browser; Twitch login comes next.
        </p>
        {loading ? <p role="status">Checking this browser for a saved ChatXPT account…</p> : (
          <form onSubmit={signIn}>
            <label>
              Display name
              <input name="displayName" defaultValue="Local Streamer" autoComplete="name" required />
            </label>
            <label>
              Email
              <input name="email" type="email" defaultValue="streamer@chatxpt.local" autoComplete="email" required />
            </label>
            <label>
              Password
              <input name="password" type="password" defaultValue="chatxpt-demo" autoComplete="current-password" minLength={8} required />
            </label>
            <button type="submit">Sign in to ChatXPT</button>
            <small className={styles.accountNote}>The preview password is not transmitted or stored.</small>
          </form>
        )}
        {accountError ? <p className={styles.error} role="alert">{accountError}</p> : null}
      </section>
    </main>
  );
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
  const [localAccountChecked, setLocalAccountChecked] = useState(!localPreviewAccountRequired);
  const [localAccount, setLocalAccount] = useState<LocalPreviewAccount | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [view, setView] = useState<StreamerViewModel | null>(null);
  const [readiness, setReadiness] = useState<StreamerReadinessView | null>(null);
  const [pendingCommandId, setPendingCommandId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [requiresBootstrap, setRequiresBootstrap] = useState(false);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const latestToken = useRef<string | null>(null);

  useEffect(() => {
    if (!localPreviewAccountRequired) return;
    const account = readLocalPreviewAccount();
    const timer = window.setTimeout(() => {
      setLocalAccount(account);
      setLocalAccountChecked(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    latestToken.current = token;
  }, [token]);

  useEffect(() => {
    const parameters = new URLSearchParams(window.location.search);
    const oauth = parameters.get("oauth");
    const notice = window.setTimeout(() => {
      if (oauth === "connected") {
        const eventSub = parameters.get("eventsub");
        setMessage(
          eventSub === "pending"
            ? "Twitch connected. Channel details were imported; live-status and chat delivery are being verified."
            : eventSub === "configured"
              ? "Twitch connected. Channel details, live status, and chat delivery are configured."
              : "Twitch connected. Channel details were imported; live-status and chat delivery still need recovery.",
        );
      } else if (oauth === "error") {
        setError(twitchOauthErrorMessage(parameters.get("reason")));
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
    if (
      localPreviewAccountRequired &&
      isStudioAuthenticatedSurface(surface) &&
      (!localAccountChecked || localAccount === null)
    ) return;
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
  }, [localAccount, localAccountChecked, refresh, surface, token]);

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

  const productPage = studioProductPages[surface];

  if (
    localPreviewAccountRequired &&
    isStudioAuthenticatedSurface(surface) &&
    (!localAccountChecked || localAccount === null)
  ) {
    return (
      <LocalPreviewAccountGate
        loading={!localAccountChecked}
        onSignIn={(account) => {
          window.localStorage.setItem(LOCAL_PREVIEW_ACCOUNT_KEY, JSON.stringify(account));
          setLocalAccount(account);
        }}
      />
    );
  }

  // Normal Studio pages must remain reachable before Twitch or a live session exists.
  // They already render honest unavailable/readiness states and the Connect Twitch action.
  // Non-product broadcaster surfaces recover through the same verified Twitch connection.
  if (productPage === undefined && isStudioAuthenticatedSurface(surface) && requiresBootstrap && view === null) {
    return (
      <main className={styles.bootstrap}>
        <section className={styles.bootstrapCard}>
          <div>
            <p>ChatXPT Studio</p>
            <h1>Connect the broadcaster</h1>
          </div>
          <p>
            Connect the broadcaster account once. ChatXPT verifies Twitch, imports the channel game,
            prepares live-status and chat delivery, and follows the Twitch stream automatically for every surface.
          </p>
          <a className={styles.oauthButton} href="/api/twitch/oauth/start">Connect Twitch</a>
          {error ? <p className={styles.error} role="alert">{error}</p> : null}
        </section>
      </main>
    );
  }

  const commandMessage = error ?? message;
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
        {localPreviewAccountRequired && localAccount !== null ? (
          <aside className={styles.accountBadge} aria-label="Local ChatXPT account">
            <span><small>Demo account</small><strong>{localAccount.displayName}</strong></span>
            <button type="button" onClick={() => {
              window.localStorage.removeItem(LOCAL_PREVIEW_ACCOUNT_KEY);
              setLocalAccount(null);
            }}>Sign out</button>
          </aside>
        ) : null}
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
