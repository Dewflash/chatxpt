"use client";

import { useState, type CSSProperties, type ReactNode } from "react";

import { Card, CardGrid, DesignSystemRoot, Notice, StatusBadge } from "../design-system";
import {
  resolveCurrentStreamGame,
  resolveEffectiveStreamerProfile,
  resolveSelectedStreamPreset,
  type StreamPreset,
  type StreamerProfile,
  type StreamerReadinessView,
  type StreamerSetupAction,
  type StreamerSetupService,
  type StreamerViewModel,
} from "../core";
import { summarizeGameplayHealth } from "./gameplay-health";
import {
  readinessAvailability,
  unavailableAvailability,
  type ProductAvailability,
} from "./studio-availability";
import {
  buildProfileSettingsCommand,
  buildEmergencyClearCommand,
  buildQuestGenerationCommand,
  buildQuestCommand,
  buildQuestProgressCommand,
  buildSessionOverrideCommand,
  buildSetupCommand,
  defaultStreamerCommandFactory,
  applyEditableDefaultsToProfile,
  editableDefaultsFromProfile,
  type StreamerCommandFactory,
  type StreamerUiCommand,
} from "./streamer-commands";

import styles from "./studio-product-pages.module.css";

export type StudioProductPage =
  | "home"
  | "gameplay"
  | "live-analytics"
  | "live-quests"
  | "profile"
  | "stream-settings"
  | "test-lab";

export interface StudioProductPageSurfaceProps {
  readonly page: StudioProductPage;
  readonly view: StreamerViewModel | null;
  readonly readiness?: StreamerReadinessView | null;
  readonly commandMessage?: string | null;
  readonly pendingCommandId?: string | null;
  readonly onCommand?: (command: StreamerUiCommand) => void;
  readonly onResetSession?: (command: StreamerUiCommand | null) => void;
  readonly localProfile?: StreamerProfile | null;
  readonly localProfileDiagnostic?: string | null;
  readonly localProfileSyncState?: "clean" | "apply-ready" | "conflict";
  readonly onLocalProfileChange?: (profile: StreamerProfile) => void;
  readonly onApplyLocalProfile?: () => void;
  readonly onKeepCloudProfile?: () => void;
  readonly localAccountDisplayName?: string | null;
  readonly onLocalAccountSignOut?: () => void;
  readonly commandFactory?: StreamerCommandFactory;
  readonly children?: ReactNode;
}

type StudioIconName =
  | "home"
  | "gameplay"
  | "analytics"
  | "quests"
  | "profile"
  | "settings"
  | "lab"
  | "mood"
  | "chat"
  | "participants"
  | "votes";

const NAV_ITEMS: readonly { readonly page: StudioProductPage; readonly href: string; readonly label: string; readonly icon: StudioIconName }[] = [
  { page: "home", href: "/studio", label: "Home", icon: "home" },
  { page: "gameplay", href: "/studio/gameplay", label: "Gameplay Engine", icon: "gameplay" },
  { page: "live-analytics", href: "/studio/live-analytics", label: "Live Analytics", icon: "analytics" },
  { page: "live-quests", href: "/studio/live-quests", label: "Live Quests", icon: "quests" },
  { page: "profile", href: "/studio/profile", label: "Profile & Defaults", icon: "profile" },
  { page: "stream-settings", href: "/studio/stream-settings", label: "Stream Settings", icon: "settings" },
  { page: "test-lab", href: "/studio/test-lab", label: "Test Lab", icon: "lab" },
];

function StudioIcon({ name, className }: { readonly name: StudioIconName; readonly className?: string }) {
  let drawing: ReactNode = null;
  switch (name) {
    case "home":
      drawing = <><path d="M3 10.5 12 3l9 7.5" /><path d="M5.5 9.5V21h13V9.5" /><path d="M9.5 21v-6h5v6" /></>;
      break;
    case "gameplay":
      drawing = <><path d="M8.5 8h7a5.5 5.5 0 0 1 5.2 7.3l-1 2.8a2.6 2.6 0 0 1-4.2 1.1L13.7 18h-3.4l-1.8 1.2a2.6 2.6 0 0 1-4.2-1.1l-1-2.8A5.5 5.5 0 0 1 8.5 8Z" /><path d="M7 13h4M9 11v4M16.8 12.5h.01M19 14.5h.01" /></>;
      break;
    case "analytics":
      drawing = <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>;
      break;
    case "quests":
      drawing = <><path d="M5 21V4" /><path d="M5 5h11l-1.8 3L16 11H5" /></>;
      break;
    case "profile":
      drawing = <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>;
      break;
    case "settings":
      drawing = <><path d="M4 6h10M18 6h2M4 12h2M10 12h10M4 18h7M15 18h5" /><circle cx="16" cy="6" r="2" /><circle cx="8" cy="12" r="2" /><circle cx="13" cy="18" r="2" /></>;
      break;
    case "lab":
      drawing = <><path d="M9 3h6M10 3v6l-5 8.5A2.3 2.3 0 0 0 7 21h10a2.3 2.3 0 0 0 2-3.5L14 9V3" /><path d="M7.5 16h9" /></>;
      break;
    case "mood":
      drawing = <><circle cx="12" cy="12" r="9" /><path d="M8.5 14.5a4.5 4.5 0 0 0 7 0M9 9h.01M15 9h.01" /></>;
      break;
    case "chat":
      drawing = <path d="M4 5h16v11H9l-5 4V5Z" />;
      break;
    case "participants":
      drawing = <><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2.5" /><path d="M3.5 20a5.5 5.5 0 0 1 11 0M14 15a5 5 0 0 1 6.5 5" /></>;
      break;
    case "votes":
      drawing = <><path d="M5 21V4" /><path d="M5 5h11l-1.8 3L16 11H5" /><path d="m10 16 1.5 1.5L15 14" /></>;
      break;
  }
  return (
    <svg
      aria-hidden="true"
      className={className}
      data-studio-icon={name}
      fill="none"
      focusable="false"
      viewBox="0 0 24 24"
    >
      <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8">{drawing}</g>
    </svg>
  );
}

const PAGE_SECTIONS: Readonly<Partial<Record<StudioProductPage, readonly string[]>>> = {
  gameplay: ["Overview", "Game Capture", "Understanding", "Health & Recovery"],
  "live-analytics": ["Overview", "Activity", "Topics", "Session History"],
  "live-quests": ["Now", "Recommendations", "Voting", "Results"],
  profile: ["Personality", "Stream Presets", "Safety", "Accessibility"],
  "stream-settings": ["Saved Source", "Session Override", "Reset to Saved"],
  "test-lab": ["Clean Start Reset", "Sample / Live Source", "Capture Controls", "Observed / Unknown", "Recovery"],
};

function titleCase(value: string): string {
  return value
    .split(/[-_]/u)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function customerSafeLabel(label: string | null | undefined, fallback: string): string {
  if (label === null || label === undefined || /\bfixture\b/iu.test(label)) {
    return fallback;
  }
  return label;
}

function AvailabilityAction({ availability }: { readonly availability: ProductAvailability }) {
  return (
    <span
      className={availability.state === "available" ? styles.readyAction : styles.disabledAction}
      aria-disabled={availability.state === "available" ? undefined : "true"}
    >
      {availability.state === "available" ? "Ready" : availability.nextStep}
    </span>
  );
}

function serviceById(
  readiness: StreamerReadinessView | null | undefined,
  serviceId: StreamerSetupService["service"],
): StreamerSetupService | null {
  return readiness?.services.find((service) => service.service === serviceId) ?? null;
}

function studioPageLabel(page: StudioProductPage): string {
  return NAV_ITEMS.find((item) => item.page === page)?.label ?? "Studio";
}

function twitchLifecycleLabel(
  view: StreamerViewModel | null,
  readiness: StreamerReadinessView | null | undefined,
): "Disconnected" | "Preparing" | "Live" | "Stream ended" {
  if (view?.session.status === "ended") return "Stream ended";
  const twitch = serviceById(readiness, "twitch");
  if (view === null || twitch?.health.status !== "ready") return "Disconnected";
  return view.session.status === "live" ? "Live" : "Preparing";
}

function activeGameplayCaptureSource(
  view: StreamerViewModel | null,
  readiness: StreamerReadinessView | null | undefined,
): "OBS Capture" | "Screen Capture" | "None" {
  if (serviceById(readiness, "obs-capture")?.health.status !== "ready") return "None";
  const snapshot = view?.gameplay ?? null;
  if (snapshot === null) return "None";
  const source = snapshot.signals.find((signal) =>
    signal.observation.provenance.source === "obs-virtual-camera" ||
    signal.observation.provenance.source === "browser-display-capture"
  )?.observation.provenance.source ?? snapshot.envelope.source;
  if (source === "obs-virtual-camera") return "OBS Capture";
  if (source === "browser-display-capture") return "Screen Capture";
  return "None";
}

function actionAllowed(
  service: StreamerSetupService | null,
  action: StreamerSetupAction,
): boolean {
  return service?.allowedActions.includes(action) ?? false;
}

function listToText(values: readonly string[]): string {
  return values.join("\n");
}

function textToList(value: FormDataEntryValue | null): string[] {
  if (typeof value !== "string") return [];
  return value
    .split(/\n|,/u)
    .map((item) => item.trim())
    .filter(Boolean);
}

function gameIdFromName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/gu, "-").replace(/^-|-$/gu, "").slice(0, 80) || "custom-game";
}

function clampUnit(value: number, fallback: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : fallback;
}

type SignalSnapshot = NonNullable<StreamerViewModel["gameplay"] | StreamerViewModel["audience"]>;

function signalByKind(snapshot: SignalSnapshot | null, ...kinds: readonly string[]) {
  return snapshot?.signals.find((signal) => kinds.includes(signal.kind)) ?? null;
}

function knownSignalValue(snapshot: SignalSnapshot | null, ...kinds: readonly string[]) {
  const signal = signalByKind(snapshot, ...kinds);
  return signal?.observation.status === "known" ? signal.observation.value : null;
}

function signalStatusText(snapshot: SignalSnapshot | null, kind: string): string {
  const signal = signalByKind(snapshot, kind);
  if (signal === null) return "Unknown";
  if (signal.observation.status === "known") return String(signal.observation.value);
  if (signal.observation.status === "stale") return "Stale";
  if (signal.observation.status === "unavailable") return "Unavailable";
  return titleCase(signal.observation.reason);
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.round(seconds / 60);
  return `${minutes} min`;
}

function formatElapsed(startedAt: number | null, now = Date.now()): string {
  if (startedAt === null) return "Not started";
  const minutes = Math.max(0, Math.floor((now - startedAt) / 60_000));
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function formatSessionTime(observedAt: number, startedAt: number | null): string {
  if (startedAt === null || observedAt < startedAt) return new Date(observedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const seconds = Math.floor((observedAt - startedAt) / 1_000);
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function gameplayTempo(view: StreamerViewModel | null): string {
  if (view?.gameplay === null || view === null) return "Unknown";
  const activity = knownSignalValue(
    view.gameplay,
    "minecraft-activity",
    "game-vision-state",
    "activity-intensity",
  );
  if (typeof activity === "number") {
    return activity >= 0.7 ? "Energetic" : activity >= 0.35 ? "Steady" : "Calm";
  }
  const value = String(activity ?? "").toLowerCase();
  if (/combat|fight|active|high/u.test(value)) return "Energetic";
  if (/explor|mining|building|steady/u.test(value)) return "Steady";
  if (/quiet|stable|sleep|menu|calm/u.test(value)) return "Calm";
  if (/transition/u.test(value)) return "Changing";
  return "Unknown";
}

function audienceMood(view: StreamerViewModel | null): string {
  if (view?.audience === null || view === null) return "Unknown";
  const intent = knownSignalValue(view.audience, "audience-intent");
  const energy = knownSignalValue(view.audience, "audience-energy");
  if (typeof intent === "string" && intent !== "neutral") {
    return titleCase(intent);
  }
  if (typeof energy !== "number") return "Unknown";
  if (energy >= 0.72) return "Excited";
  if (energy >= 0.45) return "Engaged";
  if (energy >= 0.25) return "Curious";
  return "Quiet";
}

const CHAT_ANALYTICS_WINDOW_MS = 30_000;

type ChatAnalyticsMode =
  | "twitch-disconnected"
  | "stream-offline"
  | "stream-ended"
  | "awaiting-chat"
  | "receiving-chat"
  | "chat-stale";

interface ChatAnalyticsPresentation {
  readonly mode: ChatAnalyticsMode;
  readonly badge: string;
  readonly tone: "neutral" | "success" | "warning" | "danger" | "info";
  readonly mood: string;
  readonly detail: string;
  readonly topicFallback: string;
  readonly participation: string;
  readonly footer: string;
  readonly showCurrentAudience: boolean;
}

function chatAnalyticsPresentation(
  view: StreamerViewModel | null,
  readiness: StreamerReadinessView | null | undefined,
): ChatAnalyticsPresentation {
  if (readiness?.twitchAuthorization !== "verified") {
    return {
      mode: "twitch-disconnected",
      badge: "Twitch disconnected",
      tone: "danger",
      mood: "Unavailable",
      detail: "Connect Twitch to receive authorised chat activity.",
      topicFallback: "Chat topics unavailable",
      participation: "No Twitch connection",
      footer: "Connect Twitch",
      showCurrentAudience: false,
    };
  }
  if (view === null || view.session.status === "offline" || view.session.status === "preparing") {
    return {
      mode: "stream-offline",
      badge: "Stream offline",
      tone: "neutral",
      mood: "Waiting for stream",
      detail: "Twitch is connected. Chat analytics starts when the stream goes live.",
      topicFallback: "No live chat to analyse",
      participation: "No live participation",
      footer: "Waiting for stream",
      showCurrentAudience: false,
    };
  }
  if (view.session.status === "ended") {
    return {
      mode: "stream-ended",
      badge: "Stream ended",
      tone: "neutral",
      mood: "Ended",
      detail: "Live chat analytics stopped when this stream ended.",
      topicFallback: "No current live topic",
      participation: "Live participation ended",
      footer: "Open Stream History for retained results",
      showCurrentAudience: false,
    };
  }
  if (view.audience === null) {
    return {
      mode: "awaiting-chat",
      badge: "Live · waiting for chat",
      tone: "info",
      mood: "No chat yet",
      detail: "The stream is live. Waiting for the first authorised Twitch chat message.",
      topicFallback: "No chat messages yet",
      participation: "0 active participants",
      footer: "Listening for chat",
      showCurrentAudience: false,
    };
  }
  const audienceAge = view.envelope.receivedAt - view.audience.envelope.receivedAt;
  if (audienceAge > CHAT_ANALYTICS_WINDOW_MS) {
    return {
      mode: "chat-stale",
      badge: "Live · no recent chat",
      tone: "warning",
      mood: "No recent chat",
      detail: "No authorised chat arrived in the current 30-second window. If viewers are chatting, reconnect Twitch chat.",
      topicFallback: "No current repeated topic",
      participation: "No recent participation",
      footer: "Waiting for a new chat message",
      showCurrentAudience: false,
    };
  }
  return {
    mode: "receiving-chat",
    badge: "Listening",
    tone: "success",
    mood: audienceMood(view),
    detail: "Inferred from the current rolling activity window.",
    topicFallback: "No repeated topic yet",
    participation: "Participation building",
    footer: "Current session only",
    showCurrentAudience: true,
  };
}

function activePreset(view: StreamerViewModel | null): StreamPreset | null {
  if (view === null) return null;
  return resolveSelectedStreamPreset(view.profile, view.sessionOverride);
}

function HealthStrip({ view, readiness }: {
  readonly view: StreamerViewModel | null;
  readonly readiness?: StreamerReadinessView | null;
}) {
  const twitch = readinessAvailability(readiness, "twitch", "Connect Twitch so ChatXPT can monitor the stream.");
  const obs = readinessAvailability(readiness, "obs-capture", "Select a gameplay screen or window from Studio when capture is ready.");
  const realtime = readinessAvailability(readiness, "realtime", "Viewer Voting connects after session state is available.");
  const participationModes = view === null
    ? []
    : [
        ...(view.session.capabilities.twitchExtension ? ["Twitch Extension"] : []),
        ...(view.session.capabilities.hostedViewerBoard ? ["hosted Quest Board"] : []),
        ...(view.session.capabilities.twitchChatVoting ? ["Twitch chat"] : []),
      ];
  const voting: ProductAvailability = participationModes.length === 0
    ? unavailableAvailability("No viewer participation path is available for this session.", "Review Twitch setup")
    : {
        state: "available",
        badge: realtime.state === "available" ? "Ready" : "Fallback ready",
        tone: realtime.state === "available" ? "success" : "warning",
        detail: `${participationModes.join(", ")} ${realtime.state === "available" ? participationModes.length === 1 ? "shares" : "share" : participationModes.length === 1 ? "remains" : "remain"} ${realtime.state === "available" ? "private live state." : "available through authorised recovery reads."}`,
        nextStep: realtime.state === "available" ? "Ready" : "Review connection",
      };
  const overlay = view === null
    ? unavailableAvailability("Broadcast Overlay connects after a broadcaster session exists.", "Open Studio")
    : view.session.status === "live"
      ? {
          state: "available" as const,
          badge: "Ready",
          tone: "success" as const,
          detail: "Broadcast Overlay can read this live session after OBS Browser Source setup.",
          nextStep: "Ready",
        }
    : {
        state: "waiting" as const,
        badge: "Waiting",
        tone: "neutral" as const,
        detail: "Broadcast Overlay can be prepared now and will show the stream output after ChatXPT starts.",
        nextStep: "Set up overlay",
      };
  return (
    <CardGrid className={styles.grid}>
      <Card className={styles.card}>
        <div className={styles.statusTitle}>
          <h3>Twitch</h3>
          <StatusBadge tone={twitch.tone}>{twitch.badge}</StatusBadge>
        </div>
        <p>{twitch.detail}</p>
        {twitch.state === "available"
          ? <AvailabilityAction availability={twitch} />
          : <a href="/api/twitch/oauth/start">Connect Twitch</a>}
      </Card>
      <Card className={styles.card}>
        <div className={styles.statusTitle}>
          <h3>Game Capture</h3>
          <StatusBadge tone={obs.tone}>{obs.badge}</StatusBadge>
        </div>
        <p>{obs.detail}</p>
        {obs.state === "available"
          ? <AvailabilityAction availability={obs} />
          : <a href="/studio/gameplay">{obs.nextStep}</a>}
      </Card>
      <Card className={styles.card}>
        <div className={styles.statusTitle}>
          <h3>Viewer Voting</h3>
          <StatusBadge tone={voting.tone}>{voting.badge}</StatusBadge>
        </div>
        <p>{voting.detail}</p>
        <AvailabilityAction availability={voting} />
      </Card>
      <Card className={styles.card}>
        <div className={styles.statusTitle}>
          <h3>Broadcast Overlay</h3>
          <StatusBadge tone={overlay.tone}>{overlay.badge}</StatusBadge>
        </div>
        <p>{overlay.detail}</p>
        <AvailabilityAction availability={overlay} />
      </Card>
    </CardGrid>
  );
}

type HomeMode = "cannot-connect" | "ready" | "preparing" | "live" | "reconnecting" | "ended";

function homeMode(
  view: StreamerViewModel | null,
  readiness: StreamerReadinessView | null | undefined,
): HomeMode {
  if (view === null || readiness === null || readiness === undefined) return "cannot-connect";
  if (readiness.status === "blocked") return "cannot-connect";
  if (view.session.status === "live") return readiness.status === "diagnostic" ? "reconnecting" : "live";
  if (view.session.status === "preparing") return "preparing";
  if (view.session.status === "ended") return "ended";
  return "ready";
}

function homeCopy(mode: HomeMode, readiness: StreamerReadinessView | null | undefined) {
  if (mode === "live") {
    return {
      badge: "Live",
      title: "ChatXPT is live for this stream",
      detail: "Keep an eye on Game Capture, viewer participation, sidequests, and broadcast output.",
    };
  }
  if (mode === "preparing") {
    return {
      badge: "Connected",
      title: "Twitch connected — go live when ready",
      detail: "ChatXPT watches Twitch and starts the authoritative session automatically when the stream goes live.",
    };
  }
  if (mode === "reconnecting") {
    return {
      badge: "Reconnecting",
      title: "Live session is waiting on a connection",
      detail: "The session remains visible while ChatXPT refreshes the latest stream state.",
    };
  }
  if (mode === "ended") {
    return {
      badge: "Ended",
      title: "The Twitch stream has ended",
      detail: "Go live on Twitch again when ready; ChatXPT will open the next session automatically.",
    };
  }
  if (mode === "ready") {
    return {
      badge: "Connected",
      title: "Twitch connected — waiting for the stream",
      detail: "No Start Session step is required. ChatXPT follows the verified Twitch live state automatically.",
    };
  }
  return {
    badge: "Needs setup",
    title: customerSafeLabel(readiness?.label, "Connect Studio to continue"),
    detail: readiness?.blockerCodes.length
      ? "Resolve the highlighted setup blocker so ChatXPT can monitor the stream."
      : "Connect or reopen Twitch before ChatXPT can read stream state.",
  };
}

function HomeControlButton({
  label,
  disabledLabel,
  disabled,
  pending,
  onClick,
}: {
  readonly label: string;
  readonly disabledLabel: string;
  readonly disabled: boolean;
  readonly pending: boolean;
  readonly onClick: () => void;
}) {
  if (disabled) {
    return <span className={styles.disabledAction} aria-disabled="true">{disabledLabel}</span>;
  }
  return (
    <button className={styles.primaryAction} type="button" disabled={pending} onClick={onClick}>
      {pending ? "Working..." : label}
    </button>
  );
}

function HomeStatePanel({
  view,
  readiness,
  pending,
  onCommand,
  commandFactory,
}: {
  readonly view: StreamerViewModel | null;
  readonly readiness?: StreamerReadinessView | null;
  readonly pending: boolean;
  readonly onCommand?: (command: StreamerUiCommand) => void;
  readonly commandFactory: StreamerCommandFactory;
}) {
  const mode = homeMode(view, readiness);
  const copy = homeCopy(mode, readiness);
  const session = serviceById(readiness, "session");
  const canEnd = view !== null && actionAllowed(session, "end-session") && onCommand !== undefined;
  const preset = activePreset(view);

  return (
    <section className={styles.readyHero} data-mode={mode} aria-labelledby="home-state-heading">
      <div className={styles.homeSummary}>
        <div className={styles.statusTitle}>
          <span className={styles.sectionLabel}>Live Director</span>
          <StatusBadge tone={mode === "live" || mode === "ready" ? "success" : mode === "cannot-connect" || mode === "reconnecting" ? "warning" : "neutral"}>
            {copy.badge}
          </StatusBadge>
        </div>
        <h2 id="home-state-heading">{copy.title}</h2>
        <p>{copy.detail}</p>
        <div className={styles.actions}>
          {mode === "live" ? (
            <HomeControlButton
              label="End ChatXPT session"
              disabledLabel="End unavailable"
              disabled={!canEnd}
              pending={pending}
              onClick={() => {
                if (view !== null) onCommand?.(buildSetupCommand(view, "session", "end-session", commandFactory));
              }}
            />
          ) : (
            view === null ? (
              <a className={styles.primaryAction} href="/api/twitch/oauth/start">
                Connect Twitch
              </a>
            ) : (
              <span className={styles.disabledAction} aria-live="polite">
                Waiting for Twitch stream
              </span>
            )
          )}
          <a href={mode === "live" ? "/studio/live-quests" : "/studio/gameplay"}>
            {mode === "live" ? "Open Live Quests" : "Review setup"}
          </a>
          {mode === "ready" ? <a href="/studio/gameplay/capture">Change stream game</a> : null}
        </div>
      </div>
      <dl className={styles.readyDetails}>
        <div>
          <dt>Game</dt>
          <dd>{view === null ? "Not selected" : resolveCurrentStreamGame(view.profile, view.session.currentGame)?.gameName ?? "Not selected"}</dd>
        </div>
        <div>
          <dt>Preset</dt>
          <dd>{preset?.name ?? "Saved defaults"}</dd>
        </div>
        <div>
          <dt>Approval</dt>
          <dd>Manual</dd>
        </div>
        <div>
          <dt>Voting</dt>
          <dd>{view?.session.capabilities.twitchExtension ? "Twitch + fallbacks" : "Fallbacks only"}</dd>
        </div>
      </dl>
    </section>
  );
}

function HomeQuestSummary({ view }: { readonly view: StreamerViewModel }) {
  const cycle = view.questCycle;
  const totalVotes = cycle.voteTallies.reduce((sum, tally) => sum + tally.votes, 0);
  const ranked = cycle.options
    .map((option) => ({
      option,
      votes: cycle.voteTallies.find((tally) => tally.candidateId === option.candidateId)?.votes ?? 0,
    }))
    .sort((left, right) => right.votes - left.votes);
  const leader = ranked[0] ?? null;
  return (
    <article className={styles.engagementCard}>
      <div className={styles.panelHeading}>
        <div>
          <div className={styles.statusTitle}>
            <h2>Live Quests</h2>
            <StatusBadge tone={cycle.status === "voting" ? "info" : cycle.status === "active" ? "success" : "neutral"}>
              {titleCase(cycle.status)}
            </StatusBadge>
          </div>
        </div>
        <a href="/studio/live-quests">Open quests</a>
      </div>
      {leader === null ? (
        <p>Waiting for a safe, validated three-option proposal.</p>
      ) : (
        <div className={styles.questList}>
          {ranked.slice(0, 3).map(({ option, votes }, index) => (
            <div className={styles.questLeader} key={option.candidateId}>
              <span className={styles.questNumber}>{index + 1}</span>
              <span><small>{cycle.status === "voting" && index === 0 ? "Leading" : "Validated option"}</small><strong>{option.title}</strong><em>{option.instruction}</em></span>
              <strong>{cycle.status === "voting" ? `${totalVotes === 0 ? 0 : Math.round((votes / totalVotes) * 100)}%` : formatDuration(option.durationSeconds)}</strong>
            </div>
          ))}
        </div>
      )}
      <div className={styles.cardFooter}>
        <span>{cycle.options.length === 3 ? `${totalVotes} votes · 3 safe options` : "No official vote is open"}</span>
        <span>Manual approval</span>
      </div>
    </article>
  );
}

function HomeChatSummary({ view, readiness }: {
  readonly view: StreamerViewModel;
  readonly readiness?: StreamerReadinessView | null;
}) {
  const presentation = chatAnalyticsPresentation(view, readiness);
  const pointer = presentation.showCurrentAudience ? view.liveDirector?.audiencePointer ?? null : null;
  const topic = pointer?.status === "known" || pointer?.status === "stale" ? pointer.topic : null;
  const messageRate = presentation.showCurrentAudience
    ? knownSignalValue(view.audience, "audience-message-rate")
    : null;
  const messagesPerMinute = typeof messageRate === "number" ? messageRate : null;
  return (
    <article className={styles.engagementCard}>
      <div className={styles.panelHeading}>
        <div><div className={styles.statusTitle}><h2>Chat Analytics</h2><StatusBadge tone={presentation.tone}>{presentation.badge}</StatusBadge></div></div>
        <a href="/studio/live-analytics">Open analytics</a>
      </div>
      <div className={styles.chatVibe}>
        <span><small>Audience mood</small><strong>{presentation.mood}</strong><em>{presentation.detail}</em></span>
        <b>{messagesPerMinute ?? "—"}<small>msg/min</small></b>
      </div>
      <div className={styles.topicChips}>
        {topic ? <span>{topic}</span> : <span>{presentation.topicFallback}</span>}
        {view.profile.keywordWatchlist.slice(0, 2).map((keyword) => <span key={keyword}>{keyword}</span>)}
      </div>
      <div className={styles.cardFooter}>
        <span>{pointer?.status === "known" ? `${pointer.uniqueParticipants} active participants` : presentation.participation}</span>
        <span>{presentation.footer}</span>
      </div>
    </article>
  );
}

function HomeSurfacePreview({ view }: { readonly view: StreamerViewModel }) {
  const [tab, setTab] = useState<"streamer" | "viewer" | "overlay">("streamer");
  const cycle = view.questCycle;
  const active = cycle.options.find((option) => option.candidateId === cycle.activeCandidateId) ?? null;
  const previewHref = tab === "streamer"
    ? "/studio/live-director?display=popout"
    : tab === "viewer"
      ? "/studio/test-lab#viewer-voting-check"
      : "/studio/test-lab#broadcast-output-setup";
  return (
    <article className={styles.previewPanel}>
      <div className={styles.panelHeading}>
        <div><span className={styles.sectionLabel}>Live surfaces</span><h2>What your stream sees</h2></div>
        <a href={previewHref}>{tab === "streamer" ? "Open full view" : "Open setup check"}</a>
      </div>
      <div className={styles.previewTabs} role="tablist" aria-label="Live surface preview">
        {(["streamer", "viewer", "overlay"] as const).map((value) => (
          <button key={value} type="button" role="tab" aria-selected={tab === value} onClick={() => setTab(value)}>
            {value === "streamer" ? "Live Director" : value === "viewer" ? "Twitch Extension" : "OBS Overlay"}
          </button>
        ))}
      </div>
      <div className={styles.previewStage}>
        {tab === "streamer" ? (
          <div className={styles.dockPreview}>
            <small>Private streamer companion</small>
            <strong>{view.liveDirector?.cue?.reason ?? "Waiting for a fresh Live Director cue."}</strong>
            <p>{cycle.options.length === 3 ? "Three private quest options are ready for review." : "Gameplay and audience context stay off the broadcast."}</p>
          </div>
        ) : tab === "viewer" ? (
          <div className={styles.viewerPreview}>
            <small>{cycle.status === "voting" ? "Choose the next quest" : "ChatXPT Sidequests"}</small>
            {cycle.options.length === 3 ? cycle.options.map((option, index) => <span key={option.candidateId}><b>{index + 1}</b><strong>{option.title}</strong><em>{titleCase(option.difficulty)} · {option.rewardPoints} pts</em></span>) : <p>No official vote is open.</p>}
          </div>
        ) : (
          <div className={styles.overlayPreview}>
            <small>Up next</small>
            <strong>{active?.title ?? view.liveDirector?.publicContext?.currentDecision ?? "Hidden until context is safe to publish"}</strong>
            <p>{cycle.status === "voting" ? "Viewers are choosing from three sidequests." : "Only concise public quest state appears over gameplay."}</p>
          </div>
        )}
      </div>
    </article>
  );
}

function LiveHomeDashboard({ view, readiness, pending, onCommand, commandFactory }: {
  readonly view: StreamerViewModel;
  readonly readiness?: StreamerReadinessView | null;
  readonly pending: boolean;
  readonly onCommand?: (command: StreamerUiCommand) => void;
  readonly commandFactory: StreamerCommandFactory;
}) {
  const gameplay = summarizeGameplayHealth(view.gameplay);
  const preset = activePreset(view);
  const sessionService = serviceById(readiness, "session");
  const canEnd = actionAllowed(sessionService, "end-session") && onCommand !== undefined;
  const knownFacts = view.gameplay?.signals.filter((signal) => signal.observation.status === "known").length ?? 0;
  const contextFact = view.liveDirector?.liveContext?.facts.find((fact) => fact.sourceClass === "gameplay-observed" && fact.status === "known") ?? null;
  return (
    <div className={styles.liveHome}>
      <article className={styles.currentStream}>
        <div className={styles.currentStreamHeader}>
          <div><div className={styles.statusTitle}><span className={styles.sectionLabel}>Live Director</span><StatusBadge tone="success">Live</StatusBadge></div><h2>{resolveCurrentStreamGame(view.profile, view.session.currentGame)?.gameName ?? "Current stream"}</h2><small>{preset?.name ?? "Saved defaults"} · {formatElapsed(view.session.startedAt, view.envelope.receivedAt)}</small></div>
          <HomeControlButton label="End ChatXPT session" disabledLabel="End unavailable" disabled={!canEnd} pending={pending} onClick={() => onCommand?.(buildSetupCommand(view, "session", "end-session", commandFactory))} />
        </div>
        <div className={styles.directorReading}>
          <span className={styles.orbit} aria-hidden="true" />
          <div><small>Live Director · OBS + Game Engine</small><strong>{contextFact?.value === null || contextFact === null ? `${gameplayTempo(view)} gameplay is being read now.` : String(contextFact.value)}</strong><p>{view.liveDirector?.cue?.reason ?? `ChatXPT has ${knownFacts} supported current game facts and will wait when the moment is not suitable for a quest.`}</p></div>
        </div>
        <dl className={styles.captureBrief}>
          <div><dt>Session phase</dt><dd>{view.session.status === "live" ? `Live · ${formatElapsed(view.session.startedAt, view.envelope.receivedAt)}` : titleCase(view.session.status)}</dd></div>
          <div><dt>Gameplay tempo</dt><dd>{gameplayTempo(view)}</dd></div>
          <div><dt>Current risk</dt><dd>{signalStatusText(view.gameplay, "minecraft-danger")}</dd></div>
          <div><dt>Game reading</dt><dd>{gameplay.label}</dd></div>
        </dl>
        <div className={styles.directorMeta}><span>Stream vibe: <b>{preset?.name ?? "Saved defaults"}</b></span><span>Game facts: <b>{knownFacts} known</b></span><a href="/studio/gameplay">Open Gameplay Engine</a></div>
      </article>
      <section className={styles.engagementSection} aria-labelledby="engagement-heading">
        <div className={styles.panelHeading}><div><span className={styles.sectionLabel}>Stream engagement</span><h2 id="engagement-heading">Audience response and live sidequests</h2></div></div>
        <div className={styles.engagementGrid}><HomeQuestSummary view={view} /><HomeChatSummary view={view} readiness={readiness} /></div>
      </section>
      <HomeSurfacePreview view={view} />
      <a className={styles.settingsSummary} href="/studio/stream-settings"><span><small>This stream</small><strong>{preset?.name ?? "Saved defaults"}</strong></span><span>{Math.round((resolveEffectiveStreamerProfile(view.profile, view.sessionOverride, view.session.currentGame).experience.intensity ?? 0.5) * 100)}% intensity · Viewer voting {view.session.capabilities.twitchExtension ? "on" : "using fallback"} · Manual approval</span></a>
      <HealthStrip view={view} readiness={readiness} />
    </div>
  );
}

function HomePage({ view, readiness, pending, onCommand, commandFactory }: {
  readonly view: StreamerViewModel | null;
  readonly readiness?: StreamerReadinessView | null;
  readonly pending: boolean;
  readonly onCommand?: (command: StreamerUiCommand) => void;
  readonly commandFactory: StreamerCommandFactory;
}) {
  const mode = homeMode(view, readiness);
  if (mode === "live" && view !== null) {
    return <LiveHomeDashboard view={view} readiness={readiness} pending={pending} onCommand={onCommand} commandFactory={commandFactory} />;
  }
  return (
    <>
      <HomeStatePanel
        view={view}
        readiness={readiness}
        pending={pending}
        onCommand={onCommand}
        commandFactory={commandFactory}
      />
      <HealthStrip view={view} readiness={readiness} />
    </>
  );
}

function PageSectionCard({
  id,
  title,
  badge,
  badgeTone = "neutral",
  detail,
  children,
}: {
  readonly id?: string;
  readonly title: string;
  readonly badge?: string;
  readonly badgeTone?: ProductAvailability["tone"];
  readonly detail: string;
  readonly children?: ReactNode;
}) {
  return (
    <Card id={id ?? gameIdFromName(title)} className={styles.card}>
      {badge ? <StatusBadge tone={badgeTone}>{badge}</StatusBadge> : null}
      <h3>{title}</h3>
      <p>{detail}</p>
      {children}
    </Card>
  );
}

function GameplayPage({
  view,
  readiness,
}: {
  readonly view: StreamerViewModel | null;
  readonly readiness?: StreamerReadinessView | null;
}) {
  const gameplay = view === null ? null : summarizeGameplayHealth(view.gameplay);
  const capture = readinessAvailability(readiness, "obs-capture", "Connect Game Capture before ChatXPT can inspect supported gameplay facts.");
  const snapshot = view?.gameplay ?? null;
  const metrics = snapshot?.captureMetrics ?? null;
  const knownFacts = snapshot?.signals.filter((signal) => signal.observation.status === "known").length ?? 0;
  const gameplayFacts = view?.liveDirector?.liveContext?.facts.filter((fact) => fact.sourceClass === "gameplay-observed") ?? [];
  const originalCaptureSource = snapshot?.signals.find((signal) =>
    signal.observation.provenance.source === "browser-display-capture" ||
    signal.observation.provenance.source === "obs-virtual-camera"
  )?.observation.provenance.source ?? snapshot?.envelope.source;
  const captureSourceLabel = originalCaptureSource === "browser-display-capture"
    ? "Selected screen or window"
    : originalCaptureSource === "obs-virtual-camera"
      ? "OBS Virtual Camera"
      : "Gameplay capture";
  const timeline = gameplayFacts
    .filter((fact) => fact.status === "known" || fact.status === "stale")
    .sort((left, right) => left.observedAt - right.observedAt)
    .slice(-4);
  const primaryMetrics = [
    { label: "Processing coverage", value: metrics === null ? "Unknown" : `${Math.round(metrics.processingCoverage * 100)}%`, detail: metrics === null ? "Capture has not reported coverage" : "Known facts across the latest normalized snapshot" },
    { label: "Frames processed", value: metrics?.framesProcessed.toLocaleString() ?? "Unknown", detail: "Frames analysed in this browser capture run" },
    { label: "Analysis rate", value: metrics?.cadenceFps === null || metrics === null ? "Unknown" : `${metrics.cadenceFps.toFixed(1)} / sec`, detail: "Current observed capture cadence" },
    { label: "Processing latency", value: metrics?.lastLatencyMs === null || metrics === null ? "Unknown" : `${metrics.lastLatencyMs} ms`, detail: "Latest frame-to-normalized-snapshot delay" },
    { label: "Last frame", value: metrics === null ? "Unknown" : formatSessionTime(metrics.observedAt, view?.session.startedAt ?? null), detail: metrics === null ? "No accepted capture metrics" : "Latest accepted observation" },
    { label: "HUD / OCR", value: metrics === null ? "Unknown" : titleCase(metrics.ocrStatus), detail: "Exact HUD facts remain unknown when confidence is weak" },
    { label: "Normalized facts", value: metrics?.normalizedFactCount.toString() ?? knownFacts.toString(), detail: "Current known facts; raw frames retained: 0" },
    { label: "Dropped frames", value: metrics?.droppedFrames === null || metrics === null ? "Unknown" : metrics.droppedFrames.toString(), detail: "Shown only when the capture source reports it" },
  ] as const;
  return (
    <div className={styles.gameplayWorkspace}>
      <article id="overview" className={styles.engineNow}>
        <div className={styles.panelHeading}><div><span className={styles.sectionLabel}>ChatXPT understanding</span><h2>What is happening now</h2></div><StatusBadge tone={gameplay?.tone ?? "neutral"}>{gameplay?.label ?? "Waiting"}</StatusBadge></div>
        <div className={styles.engineReading}><span className={styles.orbit} aria-hidden="true" /><div><strong>{gameplayTempo(view)} gameplay in the current stream period.</strong><p>{snapshot === null ? "Connect Game Capture to establish a trusted gameplay period." : `${knownFacts} supported facts are known. ${gameplay?.unknownCount ?? 0} remain unknown, and ChatXPT will not use them to invent quest context.`}</p></div></div>
        <div className={styles.timeline} aria-label="Meaningful stream period timeline">
          {view?.session.startedAt !== null && view?.session.startedAt !== undefined ? <span><b>00:00</b><strong>Game session started</strong><small>Observed · broadcaster session</small></span> : null}
          {timeline.map((fact) => {
            const provenance = fact.status === "stale" || /infer|classif|estimate/iu.test(fact.method) ? "Inferred" : "Observed";
            return <span key={fact.factId}><b>{formatSessionTime(fact.observedAt, view?.session.startedAt ?? null)}</b><strong>{titleCase(fact.kind)}</strong><small>{provenance} · {fact.value === null ? titleCase(fact.status) : String(fact.value)}</small></span>;
          })}
          {timeline.length === 0 ? <span><b>Now</b><strong>Current period unknown</strong><small>Waiting for a meaningful supported transition</small></span> : null}
        </div>
        <dl className={styles.engineStats}>
          <div><dt>Stream period</dt><dd>{view?.session.status === "live" ? `Live · ${formatElapsed(view.session.startedAt, view.envelope.receivedAt)}` : titleCase(view?.session.status ?? "waiting")}</dd><small>From broadcaster session time</small></div>
          <div><dt>Gameplay tempo</dt><dd>{gameplayTempo(view)}</dd><small>Separate from Stream vibe and Audience mood</small></div>
          <div><dt>Current activity</dt><dd>{signalStatusText(snapshot, "minecraft-activity")}</dd><small>Specific only when supported</small></div>
          <div><dt>Current risk</dt><dd>{signalStatusText(snapshot, "minecraft-danger")}</dd><small>No cause is guessed from motion alone</small></div>
        </dl>
      </article>

      <div className={styles.engineColumns}>
        <article id="game-capture" className={styles.captureCard}>
          <div className={styles.panelHeading}><div><span className={styles.sectionLabel}>Game Capture</span><h2>Gameplay processing</h2></div><StatusBadge tone={capture.tone}>{capture.badge}</StatusBadge></div>
          <div className={styles.captureSource}><strong>{captureSourceLabel}</strong><small>{snapshot === null ? capture.detail : `${titleCase(snapshot.capabilities.tier)} · frames remain local`}</small></div>
          <div className={styles.captureMetrics} aria-label="Game capture processing metrics">
            {primaryMetrics.map((metric) => <span key={metric.label}><small>{metric.label}</small><b>{metric.value}</b><em>{metric.detail}</em></span>)}
          </div>
          <div className={styles.actions}><a href="/studio/gameplay">{capture.state === "available" ? "Open capture controls" : "Connect or recover capture"}</a></div>
          <details className={styles.diagnostics}><summary>Advanced diagnostics</summary><p>Support tier: {snapshot === null ? "Unknown" : titleCase(snapshot.capabilities.tier)}. Capture method: {customerSafeLabel(snapshot?.capabilities.adapterId, "Universal visual path")}. Lower-level transport details remain secondary to the trusted facts below.</p></details>
        </article>

        <article id="understanding" className={styles.understandingPanel}>
          <div className={styles.panelHeading}><div><span className={styles.sectionLabel}>Supported game facts</span><h2>Current understanding</h2></div><span className={styles.softLabel}>Only reliable facts affect quests</span></div>
          <div className={styles.factList}>
            {snapshot === null ? <p>Gameplay facts are unknown until Game Capture supplies a trusted snapshot.</p> : snapshot.signals.map((signal) => {
              const observation = signal.observation;
              const value = observation.status === "known" ? String(observation.value) : observation.status === "stale" ? String(observation.previousValue ?? "Stale") : observation.status === "unknown" ? titleCase(observation.reason) : observation.reason;
              return <div key={signal.signalId}><span><strong>{titleCase(signal.kind)}</strong><small>{value}</small></span><em data-status={observation.status}>{observation.status === "known" ? "Observed" : titleCase(observation.status)}</em></div>;
            })}
          </div>
          <div className={styles.understandingNote}><strong>Quest-safe interpretation</strong><small>Known facts may shape a quest. Inferred facts stay labelled. Unknown, stale, conflicting, or unsupported facts never become a precise claim.</small></div>
        </article>
      </div>
      <PageSectionCard title="Health & Recovery" badge={capture.state === "available" ? "Ready" : "Needs attention"} badgeTone={capture.tone} detail={capture.detail}><div className={styles.actions}><a href="/studio/gameplay">Open Game Capture recovery</a><AvailabilityAction availability={capture} /></div></PageSectionCard>
    </div>
  );
}

function LiveAnalyticsPage({ view, readiness }: {
  readonly view: StreamerViewModel | null;
  readonly readiness?: StreamerReadinessView | null;
}) {
  const presentation = chatAnalyticsPresentation(view, readiness);
  const audience = presentation.showCurrentAudience ? view?.audience ?? null : null;
  const pointer = presentation.showCurrentAudience ? view?.liveDirector?.audiencePointer ?? null : null;
  const knownPointer = pointer?.status === "known" || pointer?.status === "stale" ? pointer : null;
  const messageRate = knownSignalValue(audience, "audience-message-rate");
  const activeParticipants = knownSignalValue(audience, "audience-active-participants");
  const returning = knownSignalValue(audience, "audience-returning-participants");
  const newlyActive = knownSignalValue(audience, "audience-newly-active-participants");
  const recentlyInactive = knownSignalValue(audience, "audience-recently-inactive-participants");
  const previousMood = knownSignalValue(audience, "audience-previous-mood");
  const previousRate = knownSignalValue(audience, "audience-previous-message-rate");
  const questVotes = view?.questCycle.voteTallies.reduce((sum, tally) => sum + tally.votes, 0) ?? 0;
  const currentRateValue = typeof messageRate === "number" ? messageRate : null;
  const previousRateValue = typeof previousRate === "number" ? previousRate : null;
  const comparisonMaximum = Math.max(currentRateValue ?? 0, previousRateValue ?? 0, 1);
  const comparisonWidth = (value: number | null) => value === null || value === 0
    ? "0%"
    : `${Math.max(8, Math.round((value / comparisonMaximum) * 100))}%`;
  const currentParticipants = typeof activeParticipants === "number"
    ? activeParticipants
    : knownPointer?.uniqueParticipants ?? (presentation.mode === "awaiting-chat" ? 0 : null);
  const questResult = view?.questCycle.result ?? null;
  const topicRows: Array<{ readonly label: string; readonly count: number | null; readonly detail: string }> = [];
  if (knownPointer !== null) {
    topicRows.push({ label: knownPointer.topic, count: knownPointer.qualifyingMessages, detail: `${knownPointer.uniqueParticipants} session participants` });
  }
  for (const keyword of view?.profile.keywordWatchlist ?? []) {
    const count = knownSignalValue(audience, `audience-watchlist-${gameIdFromName(keyword)}`);
    topicRows.push({ label: keyword, count: typeof count === "number" ? count : null, detail: "Streamer watchlist" });
  }
  return (
    <div className={styles.analyticsWorkspace}>
      <div id="overview" className={styles.analyticsGrid}>
        <article className={styles.analyticsMetric} data-analytics-metric="audience-mood">
          <div className={styles.metricLabel}><StudioIcon name="mood" className={styles.metricIcon} /><small>Audience mood</small></div>
          <strong>{presentation.mood}</strong>
          <p>{presentation.detail}</p>
          <span className={styles.metricFooter}><StatusBadge tone={presentation.tone}>{presentation.badge}</StatusBadge><small>Previously: {typeof previousMood === "string" ? titleCase(previousMood) : "not enough history yet"}</small></span>
        </article>
        <article className={styles.analyticsMetric} data-analytics-metric="chat-activity">
          <div className={styles.metricLabel}><StudioIcon name="chat" className={styles.metricIcon} /><small>Chat activity</small></div>
          <strong>{currentRateValue === null ? "—" : `${currentRateValue} messages/min`}</strong>
          <p>{presentation.showCurrentAudience ? "Current rolling activity window." : presentation.detail}</p>
          <span>{presentation.showCurrentAudience ? `Previous: ${previousRateValue === null ? "not available yet" : `${previousRateValue} messages/min`}` : presentation.footer}</span>
        </article>
        <article className={styles.analyticsMetric} data-analytics-metric="active-participants">
          <div className={styles.metricLabel}><StudioIcon name="participants" className={styles.metricIcon} /><small>Active participants</small></div>
          <strong>{currentParticipants ?? "—"}</strong>
          <p>{currentParticipants === null ? presentation.participation : `${currentParticipants} active participants in the current window.`}</p>
          <span>Privacy-safe session aggregate</span>
        </article>
        <article className={styles.analyticsMetric} data-analytics-metric="quest-participation">
          <div className={styles.metricLabel}><StudioIcon name="votes" className={styles.metricIcon} /><small>Quest participation</small></div>
          <strong>{questVotes} votes</strong>
          <p>Official votes from the current authoritative quest cycle.</p>
          <span>{view?.questCycle.status === "voting" ? "Voting is open now" : `Current state: ${titleCase(view?.questCycle.status ?? "waiting")}`}</span>
        </article>
      </div>

      <div className={styles.analyticsContentGrid}>
        <article id="activity" className={styles.activityComparison}>
          <div className={styles.panelHeading}>
            <div><span className={styles.sectionLabel}>Chat activity</span><h2>Current and previous equal windows</h2></div>
            <StatusBadge tone={presentation.tone}>{presentation.badge}</StatusBadge>
          </div>
          <div className={styles.comparisonChart} aria-label="Chat messages per minute in the previous and current equal windows">
            <div>
              <span><small>Previous equal window</small><strong>{previousRateValue === null ? "—" : `${previousRateValue} messages/min`}</strong></span>
              <i aria-hidden="true"><b style={{ "--analytics-bar-width": comparisonWidth(previousRateValue) } as CSSProperties} /></i>
            </div>
            <div>
              <span><small>Current window</small><strong>{currentRateValue === null ? "—" : `${currentRateValue} messages/min`}</strong></span>
              <i aria-hidden="true"><b style={{ "--analytics-bar-width": comparisonWidth(currentRateValue) } as CSSProperties} /></i>
            </div>
          </div>
          <p className={styles.privacyNote}>This compares only the two equal rolling windows available from the current stream.</p>
        </article>

        <article id="topics" className={styles.topicPanel}>
          <div className={styles.panelHeading}><div><span className={styles.sectionLabel}>Current topics</span><h2>Audience reactions</h2></div><a href="/studio/profile#watchlist">Edit watchlist</a></div>
          <div className={styles.topicList}>
            {topicRows.length === 0 ? <p>{presentation.showCurrentAudience ? "No repeated topic has passed the current confidence boundary." : presentation.topicFallback}</p> : topicRows.map((topic) => <div key={`${topic.label}-${topic.detail}`}><span><strong>{topic.label}</strong><small>{topic.detail}</small></span><em>{topic.count === null ? "Waiting" : `${topic.count} mentions`}</em></div>)}
          </div>
          <p className={styles.privacyNote}>ChatXPT stores aggregate counts here—not viewer names or raw messages.</p>
        </article>

        <article className={styles.participationPanel}>
          <div className={styles.panelHeading}><div><span className={styles.sectionLabel}>Participation flow</span><h2>How the audience is active now</h2></div><span className={styles.softLabel}>Current session</span></div>
          <div className={styles.flowSummary}>
            <span><b>{typeof newlyActive === "number" ? newlyActive : "—"}</b><small>Newly active</small></span>
            <span><b>{typeof returning === "number" ? returning : "—"}</b><small>Returning</small></span>
            <span><b>{typeof recentlyInactive === "number" ? recentlyInactive : "—"}</b><small>Recently inactive</small></span>
            <span><b>{currentParticipants ?? "—"}</b><small>Active now</small></span>
          </div>
          <p>Returning appears only when a privacy-safe participant key proves earlier activity in this session. This does not claim exact Twitch joins, departures, or cross-session identity.</p>
        </article>

        <article className={styles.questResultPanel}>
          <div className={styles.panelHeading}><div><span className={styles.sectionLabel}>Quest result</span><h2>Current cycle</h2></div><StatusBadge tone={questResult?.outcome === "succeeded" ? "success" : questResult === null ? "neutral" : "warning"}>{titleCase(view?.questCycle.status ?? "waiting")}</StatusBadge></div>
          <dl className={styles.questResultSummary}>
            <div><dt>Votes</dt><dd>{questVotes}</dd></div>
            <div><dt>Result</dt><dd>{questResult === null ? "No result yet" : titleCase(questResult.outcome)}</dd></div>
          </dl>
          <p>{questResult === null ? "Voting choices and stream controls stay in Live Quests." : `${questResult.reason} · ${questResult.rewardPointsAwarded} points awarded.`}</p>
          <a href="/studio/live-quests#results">Open Live Quests</a>
        </article>
      </div>
    </div>
  );
}

function LiveQuestsPage({ view, pending, onCommand, commandFactory }: {
  readonly view: StreamerViewModel | null;
  readonly pending: boolean;
  readonly onCommand?: (command: StreamerUiCommand) => void;
  readonly commandFactory: StreamerCommandFactory;
}) {
  const cycle = view?.questCycle ?? null;
  const active = cycle?.options.find((option) => option.candidateId === cycle.activeCandidateId) ?? null;
  const [selectedCandidateDraft, setSelectedCandidateId] = useState<string | null>(null);
  const selectedCandidateId = cycle?.options.some(
    (option) => option.candidateId === selectedCandidateDraft,
  )
    ? selectedCandidateDraft
    : active?.candidateId ?? cycle?.options[0]?.candidateId ?? null;
  const cycleId = cycle?.envelope.questCycleId ?? null;
  const [confirmationDraft, setConfirmationDraft] = useState<{
    readonly cycleId: string | null;
    readonly action: "cancel" | "skip" | "fail";
  } | null>(null);
  const confirmAction = confirmationDraft?.cycleId === cycleId && cycle?.availableStreamerActions.includes(confirmationDraft.action)
    ? confirmationDraft.action
    : null;
  const serverManualProgress = cycle?.progress?.value ?? 0;
  const [manualProgressDraft, setManualProgressDraft] = useState<{
    readonly cycleId: string | null;
    readonly serverValue: number;
    readonly value: number;
  } | null>(null);
  const manualProgress = manualProgressDraft?.cycleId === cycleId &&
    manualProgressDraft.serverValue === serverManualProgress
    ? manualProgressDraft.value
    : serverManualProgress;
  const totalVotes = cycle?.voteTallies.reduce((sum, tally) => sum + tally.votes, 0) ?? 0;
  const deterministicFallback = cycle?.options.length === 3 && cycle.options.every(
    (option) => option.generation.method === "deterministic-fallback",
  );
  const canGenerateFallback = view !== null &&
    cycle?.status === "idle" &&
    (view.session.status === "preparing" || view.session.status === "live") &&
    !view.emergencyPaused &&
    onCommand !== undefined;
  const actionLabels = {
    approve: "Approve selected",
    reject: "Reject selected",
    start: "Start selected",
    pause: "Pause sidequest",
    cancel: "Cancel sidequest",
    skip: "Skip sidequest",
    succeed: "Mark succeeded",
    fail: "Mark failed",
    "emergency-pause": "Emergency pause",
  } as const;
  function sendAction(action: keyof typeof actionLabels) {
    if (view === null) return;
    const candidateId = ["approve", "reject", "start"].includes(action) ? selectedCandidateId : null;
    onCommand?.(buildQuestCommand(view, action, candidateId, commandFactory));
    setConfirmationDraft(null);
  }
  return (
    <div className={styles.questWorkspace}>
      <article id="now" className={styles.nowQuest}>
        <div><StatusBadge tone={cycle?.status === "voting" ? "info" : cycle?.status === "active" ? "success" : "neutral"}>{cycle === null ? "Waiting" : titleCase(cycle.status)}</StatusBadge><h2>Now</h2><strong>{active === null ? cycle?.status === "voting" ? "Viewers are choosing the next sidequest" : "No sidequest is active" : active.title}</strong><p>{cycle === null || cycle.options.length !== 3 ? "ChatXPT waits until exactly three safe, game-compatible options are validated." : "All three options passed the deterministic safety and game-fit boundary before appearing here."}</p></div>
        <div>
          {cycle?.status === "idle" ? (
            <button
              type="button"
              className={styles.primaryAction}
              disabled={pending || !canGenerateFallback}
              onClick={() => {
                if (view !== null) onCommand?.(buildQuestGenerationCommand(view, commandFactory));
              }}
            >
              {pending ? "Generating fallback…" : "Generate quest now"}
            </button>
          ) : null}
          {view?.emergencyPaused ? <button type="button" className={styles.primaryAction} disabled={pending || onCommand === undefined} onClick={() => onCommand?.(buildEmergencyClearCommand(view, commandFactory))}>Clear emergency pause</button> : cycle?.availableStreamerActions.includes("emergency-pause") ? <button type="button" className={styles.dangerAction} disabled={pending || onCommand === undefined} onClick={() => sendAction("emergency-pause")}>Pause new quests</button> : null}
        </div>
      </article>

      <section id="recommendations" aria-labelledby="recommendations-heading">
        <div className={styles.panelHeading}><div><span className={styles.sectionLabel}>Recommendations</span><h2 id="recommendations-heading">Exactly three official choices</h2></div><span className={styles.softLabel}>{deterministicFallback ? "Deterministic fallback" : cycle?.options.length === 3 ? `${totalVotes} votes` : "Waiting for validation"}</span></div>
        {deterministicFallback ? (
          <Notice tone="info" title="Deterministic fallback shown">
            These three safe quests were generated immediately without gameplay or audience evidence.
            Evidence-driven recommendations use trusted signals later and still pass the same validation.
          </Notice>
        ) : null}
        {deterministicFallback && view?.session.status !== "live" ? (
          <Notice tone="warning" title="Start the stream before opening the vote">
            You can review the fallback now. Viewer voting becomes available after the broadcaster session is live.
          </Notice>
        ) : null}
        {cycle?.options.length === 3 ? (
          <div className={styles.questCards}>
            {cycle.options.map((option, index) => {
              const votes = cycle.voteTallies.find((tally) => tally.candidateId === option.candidateId)?.votes ?? 0;
              const share = totalVotes === 0 ? 0 : Math.round((votes / totalVotes) * 100);
              return (
                <button key={option.candidateId} type="button" className={selectedCandidateId === option.candidateId ? styles.selectedQuest : styles.questCard} aria-pressed={selectedCandidateId === option.candidateId} onClick={() => setSelectedCandidateId(option.candidateId)}>
                  <span className={styles.questNumber}>{index + 1}</span><StatusBadge tone={selectedCandidateId === option.candidateId ? "success" : "neutral"}>{cycle.status === "voting" ? `${share}%` : selectedCandidateId === option.candidateId ? "Selected" : "Option"}</StatusBadge><h3>{option.title}</h3><p>{option.instruction}</p><div className={styles.questTags}><span>{titleCase(option.difficulty)}</span><span>{formatDuration(option.durationSeconds)}</span><span>{option.rewardPoints} pts</span></div>
                </button>
              );
            })}
          </div>
        ) : <Notice title="No official three-option proposal">No partial batch is shown or opened for voting.</Notice>}
      </section>

      <article className={styles.whyPanel}><div><span className={styles.sectionLabel}>Why these were recommended</span><h2>Game fit, timing, and audience context</h2><p>{cycle?.options.find((option) => option.candidateId === selectedCandidateId)?.rationale ?? "Select a validated recommendation to see its private streamer rationale."}</p></div><small>Provider output is never authoritative until deterministic validation passes.</small></article>

      <article id="voting" className={styles.questControls}>
        <div className={styles.panelHeading}><div><span className={styles.sectionLabel}>Voting & controls</span><h2>Authoritative stream controls</h2></div><StatusBadge tone={cycle === null ? "neutral" : "info"}>{cycle === null ? "Waiting" : titleCase(cycle.status)}</StatusBadge></div>
        <div className={styles.actions}>
          {cycle?.availableStreamerActions.filter((action) => action !== "emergency-pause").map((action) => (
            <button key={action} type="button" className={["cancel", "skip", "fail"].includes(action) ? styles.dangerAction : styles.secondaryButton} disabled={pending || onCommand === undefined || (["approve", "reject", "start"].includes(action) && selectedCandidateId === null) || (action === "approve" && view?.session.status !== "live")} onClick={() => {
              if (action === "cancel" || action === "skip" || action === "fail") {
                setConfirmationDraft({ cycleId, action });
              }
              else sendAction(action);
            }}>{actionLabels[action]}</button>
          ))}
        </div>
        {confirmAction !== null ? <Notice tone="danger" title={`Confirm ${actionLabels[confirmAction].toLowerCase()}`}><div className={styles.actions}><button type="button" className={styles.dangerAction} disabled={pending} onClick={() => sendAction(confirmAction)}>Confirm</button><button type="button" className={styles.secondaryButton} onClick={() => setConfirmationDraft(null)}>Keep current sidequest</button></div></Notice> : null}
        {cycle?.status === "active" && cycle.completionRule?.mode === "manual" && view !== null ? <label className={styles.compactField}>Manual progress: {Math.round(manualProgress * 100)}%<input type="range" min="0" max="1" step="0.05" value={manualProgress} disabled={pending || onCommand === undefined} onChange={(event) => setManualProgressDraft({ cycleId, serverValue: serverManualProgress, value: Number(event.currentTarget.value) })} /><button type="button" className={styles.secondaryButton} disabled={pending || onCommand === undefined || manualProgress === serverManualProgress} onClick={() => onCommand?.(buildQuestProgressCommand(view, manualProgress, commandFactory))}>Update progress</button></label> : null}
      </article>

      <PageSectionCard title="Results" badge={cycle?.result === null || cycle === null ? "No result yet" : titleCase(cycle.result.outcome)} badgeTone={cycle?.result?.outcome === "succeeded" ? "success" : cycle?.result === null || cycle === null ? "neutral" : "warning"} detail={cycle?.result === null || cycle === null ? "The authoritative result appears here after success, failure, cancellation, skip, or expiry." : `${cycle.result.reason} · ${cycle.result.rewardPointsAwarded} points awarded.`} />
    </div>
  );
}

function ProfilePage({
  view,
  localProfile,
  pending,
  onCommand,
  onLocalProfileChange,
  commandFactory,
}: {
  readonly view: StreamerViewModel | null;
  readonly localProfile?: StreamerProfile | null;
  readonly pending: boolean;
  readonly onCommand?: (command: StreamerUiCommand) => void;
  readonly onLocalProfileChange?: (profile: StreamerProfile) => void;
  readonly commandFactory: StreamerCommandFactory;
}) {
  const profile = view?.profile ?? localProfile ?? null;
  const saved = profile === null ? null : editableDefaultsFromProfile(profile);
  const canEdit = !pending && (
    (view !== null && onCommand !== undefined) ||
    (view === null && localProfile !== null && localProfile !== undefined && onLocalProfileChange !== undefined)
  );
  const selectedPresetId = profile?.selectedPresetId ?? profile?.streamPresets[0]?.presetId ?? null;
  const selectedPreset = profile?.streamPresets.find((preset) => preset.presetId === selectedPresetId) ?? profile?.streamPresets[0] ?? null;

  function commitProfile(next: NonNullable<typeof saved>) {
    if (view !== null && onCommand !== undefined) {
      onCommand(buildProfileSettingsCommand(view, next, commandFactory));
      return;
    }
    if (localProfile !== null && localProfile !== undefined && onLocalProfileChange !== undefined) {
      onLocalProfileChange(applyEditableDefaultsToProfile(localProfile, next));
    }
  }

  function selectPreset(presetId: string) {
    if (saved !== null) commitProfile({ ...saved, selectedPresetId: presetId });
  }

  function duplicatePreset() {
    if (selectedPreset === null || saved === null) return;
    const presetId = commandFactory.createId("preset").slice(0, 120);
    const nextPreset: StreamPreset = {
      ...selectedPreset,
      presetId,
      name: `${selectedPreset.name} Copy`.slice(0, 48),
      origin: "custom",
      experience: { ...selectedPreset.experience },
      preferredQuestTypes: [...selectedPreset.preferredQuestTypes],
      voting: { ...selectedPreset.voting },
      rewards: { ...selectedPreset.rewards },
    };
    commitProfile({ ...saved, streamPresets: [...saved.streamPresets, nextPreset], selectedPresetId: presetId });
  }

  return (
    <div className={styles.profileWorkspace}>
      <Card id="personality" className={styles.profileIdentity}>
        <div className={styles.panelHeading}><div><span className={styles.sectionLabel}>Personality</span><h2>Saved stream defaults</h2></div><StatusBadge tone={profile === null ? "neutral" : "success"}>{profile === null ? "Waiting" : view === null ? "Saved on device" : "Saved to account"}</StatusBadge></div>
        <form
          className={styles.profileForm}
          onSubmit={(event) => {
            event.preventDefault();
            if (saved === null) return;
            const data = new FormData(event.currentTarget);
            const gameName = String(data.get("gameName") ?? "").trim();
            const gameId = gameName.length === 0
              ? null
              : profile?.gameName === gameName
                ? saved.gameId ?? gameIdFromName(gameName)
                : gameIdFromName(gameName);
            commitProfile({
              ...saved,
              gameId,
              gameName: gameName.length === 0 ? null : gameName,
            });
          }}
        >
          <label className={styles.compactField}>
            Default game
            <input
              key={profile?.gameName ?? "loading-game"}
              name="gameName"
              defaultValue={profile?.gameName ?? ""}
              disabled={!canEdit}
              placeholder="Minecraft"
            />
          </label>
          <button type="submit" disabled={!canEdit}>
            {pending ? "Saving..." : "Save default game"}
          </button>
        </form>
      </Card>

      <div id="stream-presets" className={styles.presetWorkspace}>
        <article className={styles.presetLibrary}>
          <div className={styles.panelHeading}><div><span className={styles.sectionLabel}>Stream Presets</span><h2>Choose a starting style</h2></div><button type="button" className={styles.iconButton} aria-label="Create preset" disabled={saved === null || !canEdit} onClick={duplicatePreset}>+</button></div>
          <div className={styles.presetList}>
            {profile?.streamPresets.map((preset) => <button key={preset.presetId} type="button" aria-pressed={preset.presetId === selectedPresetId} onClick={() => selectPreset(preset.presetId)} disabled={!canEdit}><span className={styles.presetGlyph}>{preset.name.slice(0, 1).toUpperCase()}</span><span><strong>{preset.name}</strong><small>{preset.description}</small></span><em>{preset.presetId === selectedPresetId ? "Selected" : "Open"}</em></button>)}
          </div>
          <button type="button" className={styles.secondaryButton} disabled={saved === null || !canEdit} onClick={duplicatePreset}>Create custom preset</button>
        </article>

        <article className={styles.presetEditor}>
          {selectedPreset === null ? <p>Load a saved profile to edit stream presets.</p> : (
            <form key={selectedPreset.presetId} className={styles.profileForm} onSubmit={(event) => {
              event.preventDefault();
              if (saved === null) return;
              const data = new FormData(event.currentTarget);
              const updated: StreamPreset = {
                ...selectedPreset,
                name: String(data.get("presetName") ?? selectedPreset.name).trim().slice(0, 48),
                description: String(data.get("presetDescription") ?? selectedPreset.description).trim().slice(0, 180),
                experience: {
                  ...selectedPreset.experience,
                  intensity: clampUnit(Number(data.get("presetIntensity")), selectedPreset.experience.intensity ?? 0.5),
                  creativity: clampUnit(Number(data.get("presetCreativity")), selectedPreset.experience.creativity ?? 0.5),
                  playfulness: clampUnit(Number(data.get("presetPlayfulness")), selectedPreset.experience.playfulness ?? 0.5),
                },
                preferredQuestTypes: textToList(data.get("presetQuestTypes")),
                voting: {
                  ...selectedPreset.voting,
                  voteVisibility: data.get("voteVisibility") === "hidden-until-close"
                    ? "hidden-until-close"
                    : "live-tally",
                  voteDurationSeconds: data.get("voteDurationSeconds") === "60" ? 60 : 30,
                  winnerActivationMode:
                    data.get("winnerActivationMode") === "streamer-approval"
                      ? "streamer-approval"
                      : "automatic",
                  showCountdown: data.get("showCountdown") === "on",
                },
                rewards: {
                  ...selectedPreset.rewards,
                  rewardDisplay:
                    data.get("rewardDisplay") === "session-points"
                      ? "session-points"
                      : data.get("rewardDisplay") === "community-hype"
                        ? "community-hype"
                        : "session-points-and-hype",
                  showRewardPreview: data.get("showRewardPreview") === "on",
                },
              };
              commitProfile({ ...saved, streamPresets: saved.streamPresets.map((preset) => preset.presetId === updated.presetId ? updated : preset), selectedPresetId: updated.presetId });
            }}>
              <div className={styles.presetEditorHead}><div><StatusBadge tone="success">{selectedPreset.presetId === profile?.selectedPresetId ? "Selected default" : "Preset"}</StatusBadge><h2>{selectedPreset.name}</h2><p>{selectedPreset.description}</p></div></div>
              <label className={styles.compactField}>Preset name<input name="presetName" defaultValue={selectedPreset.name} maxLength={48} required disabled={!canEdit} /></label>
              <label className={styles.compactField}>Description<input name="presetDescription" defaultValue={selectedPreset.description} maxLength={180} required disabled={!canEdit} /></label>
              <div className={styles.presetBalance}>
                <label className={styles.compactField}>Quest intensity<input name="presetIntensity" type="range" min="0" max="1" step="0.05" defaultValue={selectedPreset.experience.intensity ?? 0.5} disabled={!canEdit} /></label>
                <label className={styles.compactField}>Creativity<input name="presetCreativity" type="range" min="0" max="1" step="0.05" defaultValue={selectedPreset.experience.creativity ?? 0.5} disabled={!canEdit} /></label>
                <label className={styles.compactField}>Playfulness<input name="presetPlayfulness" type="range" min="0" max="1" step="0.05" defaultValue={selectedPreset.experience.playfulness ?? 0.5} disabled={!canEdit} /></label>
                <label className={styles.compactField}>Preferred quest styles<textarea name="presetQuestTypes" defaultValue={listToText(selectedPreset.preferredQuestTypes)} disabled={!canEdit} /></label>
                <label className={styles.compactField}>Voting window<select name="voteDurationSeconds" defaultValue={String(selectedPreset.voting.voteDurationSeconds)} disabled={!canEdit}><option value="30">30 seconds</option><option value="60">60 seconds</option></select></label>
                <label className={styles.compactField}>Winning quest<select name="winnerActivationMode" defaultValue={selectedPreset.voting.winnerActivationMode} disabled={!canEdit}><option value="automatic">Show for 10 seconds, then start</option><option value="streamer-approval">Wait for streamer approval</option></select></label>
                <label className={styles.compactField}>Vote results<select name="voteVisibility" defaultValue={selectedPreset.voting.voteVisibility} disabled={!canEdit}><option value="live-tally">Show live tally</option><option value="hidden-until-close">Reveal when voting closes</option></select></label>
                <label className={styles.compactField}>Reward display<select name="rewardDisplay" defaultValue={selectedPreset.rewards.rewardDisplay} disabled={!canEdit}><option value="session-points-and-hype">Session points + community hype</option><option value="session-points">Session points</option><option value="community-hype">Community hype</option></select></label>
                <label className={styles.checkField}><input name="showCountdown" type="checkbox" defaultChecked={selectedPreset.voting.showCountdown} disabled={!canEdit} /> Show voting countdown</label>
                <label className={styles.checkField}><input name="showRewardPreview" type="checkbox" defaultChecked={selectedPreset.rewards.showRewardPreview} disabled={!canEdit} /> Preview quest rewards</label>
              </div>
              <div className={styles.presetRules}><span><strong>Viewer voting</strong><small>Extension with hosted board and chat fallbacks</small></span><span><strong>Manual approval</strong><small>The streamer reviews each official batch</small></span><span><strong>Session rewards</strong><small>{titleCase(selectedPreset.rewards.rewardDisplay)}</small></span><span><strong>Global boundaries</strong><small>Safety and accessibility below always apply</small></span></div>
              <div className={styles.presetActions}><button type="button" className={styles.secondaryButton} disabled={!canEdit} onClick={duplicatePreset}>Duplicate</button>{selectedPreset.origin === "custom" && saved !== null ? <button type="button" className={styles.dangerAction} disabled={!canEdit || saved.streamPresets.length === 1} onClick={() => {
                const remaining = saved.streamPresets.filter((preset) => preset.presetId !== selectedPreset.presetId);
                const nextSelected = remaining[0]?.presetId ?? null;
                commitProfile({ ...saved, streamPresets: remaining, selectedPresetId: nextSelected });
              }}>Delete</button> : null}<button type="submit" disabled={!canEdit}>Save preset</button></div>
            </form>
          )}
        </article>
      </div>

      <Card id="safety" className={styles.globalBoundaries}>
        <div><StatusBadge tone={profile === null ? "neutral" : "success"}>{profile === null ? "Waiting" : "Global boundaries"}</StatusBadge><h3>Safety & Accessibility</h3><p>These boundaries apply to every preset and cannot be weakened by a live override.</p></div>
        <label className={styles.compactField}>
          Safety limits
          <textarea key={listToText(profile?.restrictions ?? []) || "loading-restrictions"} form="profile-lists-form" name="restrictions" defaultValue={listToText(profile?.restrictions ?? [])} disabled={!canEdit} />
        </label>
        <label className={styles.compactField}>
          Preferred sidequests
          <textarea key={listToText(profile?.preferredQuestTypes ?? []) || "loading-preferred"} form="profile-lists-form" name="preferredQuestTypes" defaultValue={listToText(profile?.preferredQuestTypes ?? [])} disabled={!canEdit} />
        </label>
        <label className={styles.compactField}>
          Forbidden sidequests
          <textarea key={listToText(profile?.forbiddenQuestTypes ?? []) || "loading-forbidden"} form="profile-lists-form" name="forbiddenQuestTypes" defaultValue={listToText(profile?.forbiddenQuestTypes ?? [])} disabled={!canEdit} />
        </label>
        <form
          id="profile-lists-form"
          className={styles.profileForm}
          onSubmit={(event) => {
            event.preventDefault();
            if (saved === null) return;
            const data = new FormData(event.currentTarget);
            commitProfile({
              ...saved,
              restrictions: textToList(data.get("restrictions")),
              preferredQuestTypes: textToList(data.get("preferredQuestTypes")),
              forbiddenQuestTypes: textToList(data.get("forbiddenQuestTypes")),
              accessibilityNeeds: textToList(data.get("accessibilityNeeds")),
              keywordWatchlist: textToList(data.get("keywordWatchlist")),
            });
          }}
        >
          <label id="accessibility" className={styles.compactField}>
            Accessibility needs
            <textarea key={listToText(profile?.accessibilityNeeds ?? []) || "loading-accessibility"} name="accessibilityNeeds" defaultValue={listToText(profile?.accessibilityNeeds ?? [])} disabled={!canEdit} />
          </label>
          <label className={styles.compactField} id="watchlist">
            Keyword watchlist
            <textarea key={listToText(profile?.keywordWatchlist ?? []) || "loading-watchlist"} name="keywordWatchlist" defaultValue={listToText(profile?.keywordWatchlist ?? [])} disabled={!canEdit} />
          </label>
          <button type="submit" disabled={!canEdit}>
            {pending ? "Saving..." : "Save global boundaries"}
          </button>
        </form>
      </Card>
    </div>
  );
}

function StreamSettingsPage({
  view,
  pending,
  onCommand,
  commandFactory,
}: {
  readonly view: StreamerViewModel | null;
  readonly pending: boolean;
  readonly onCommand?: (command: StreamerUiCommand) => void;
  readonly commandFactory: StreamerCommandFactory;
}) {
  const override = view?.sessionOverride ?? null;
  const savedProfile = view === null ? null : resolveEffectiveStreamerProfile(view.profile, null);
  const effectiveProfile = view === null ? null : resolveEffectiveStreamerProfile(view.profile, override, view.session.currentGame);
  const savedPreset = view === null ? null : resolveSelectedStreamPreset(view.profile, null);
  const effectivePreset = view === null ? null : resolveSelectedStreamPreset(view.profile, override);
  const currentGame = view === null ? null : resolveCurrentStreamGame(view.profile, view.session.currentGame);
  const savedIntensity = savedProfile?.experience.intensity ?? 0.5;
  const savedCreativity = savedProfile?.experience.creativity ?? 0.5;
  const effectiveIntensity = effectiveProfile?.experience.intensity ?? savedIntensity;
  const effectiveCreativity = effectiveProfile?.experience.creativity ?? savedCreativity;
  return (
    <div className={styles.settingsWorkspace}>
      <PageSectionCard
        title="Saved Source"
        badge={view === null ? "Waiting" : "Saved defaults"}
        badgeTone={view === null ? "neutral" : "info"}
        detail={view === null ? "Start a session to see current-stream settings." : `${savedPreset?.name ?? "Saved defaults"}: intensity ${Math.round(savedIntensity * 100)}%, creativity ${Math.round(savedCreativity * 100)}%. Default game: ${view.profile.gameName ?? "none"}. Current stream: ${currentGame?.gameName ?? "none"}.`}
      />
      <Card id="session-override" className={styles.card}>
        <StatusBadge tone={override === null ? "neutral" : "warning"}>
          {override === null ? "Using defaults" : "Temporary override"}
        </StatusBadge>
        <h3>Session Override</h3>
        <p>
          {override === null
            ? "This stream's sidequest style currently follows saved profile defaults. The active game may still come from Twitch or Gameplay Capture."
            : `This stream uses ${effectivePreset?.name ?? "a temporary configuration"}: intensity ${Math.round(effectiveIntensity * 100)}%, creativity ${Math.round(effectiveCreativity * 100)}%.`}
        </p>
        <form
          key={`${effectivePreset?.presetId ?? "saved"}:${effectiveIntensity}:${effectiveCreativity}:${override?.appliedAt ?? "defaults"}`}
          className={styles.profileForm}
          onSubmit={(event) => {
            event.preventDefault();
            if (view === null || onCommand === undefined) return;
            const data = new FormData(event.currentTarget);
            onCommand(buildSessionOverrideCommand(view, {
              intensity: clampUnit(Number(data.get("intensity") ?? effectiveIntensity), effectiveIntensity),
              creativity: clampUnit(Number(data.get("creativity") ?? effectiveCreativity), effectiveCreativity),
            }, commandFactory, String(data.get("presetId") ?? "") || null));
          }}
        >
          <label className={styles.compactField}>
            Current-stream preset
            <select name="presetId" defaultValue={effectivePreset?.presetId ?? ""} disabled={view === null || pending || onCommand === undefined}>
              <option value="">Saved default</option>
              {view?.profile.streamPresets.map((preset) => <option key={preset.presetId} value={preset.presetId}>{preset.name}</option>)}
            </select>
          </label>
          <label className={styles.compactField}>
            Current-stream intensity
            <input name="intensity" type="range" min="0" max="1" step="0.05" defaultValue={effectiveIntensity} disabled={view === null || pending || onCommand === undefined} />
          </label>
          <label className={styles.compactField}>
            Current-stream creativity
            <input name="creativity" type="range" min="0" max="1" step="0.05" defaultValue={effectiveCreativity} disabled={view === null || pending || onCommand === undefined} />
          </label>
          <button type="submit" disabled={view === null || pending || onCommand === undefined}>
            {pending ? "Saving..." : "Apply to this stream"}
          </button>
        </form>
      </Card>
      <Card id="reset-to-saved" className={styles.card}>
        <StatusBadge tone={override === null ? "neutral" : "info"}>
          {override === null ? "No override" : "Reset available"}
        </StatusBadge>
        <h3>Reset to Saved</h3>
        <p>
          {override === null
            ? "No temporary override is active for this stream."
            : "Reset removes only the current-stream override and keeps saved defaults unchanged."}
        </p>
        <button
          className={styles.secondaryButton}
          type="button"
          disabled={view === null || override === null || pending || onCommand === undefined}
          onClick={() => {
            if (view !== null) onCommand?.(buildSessionOverrideCommand(view, null, commandFactory));
          }}
        >
          Reset to saved defaults
        </button>
      </Card>
    </div>
  );
}

function TestLabPage({
  view,
  readiness,
  pending,
  onResetSession,
  commandFactory,
}: {
  readonly view: StreamerViewModel | null;
  readonly readiness?: StreamerReadinessView | null;
  readonly pending: boolean;
  readonly onResetSession?: (command: StreamerUiCommand | null) => void;
  readonly commandFactory: StreamerCommandFactory;
}) {
  const capture = readinessAvailability(readiness, "obs-capture", "Select a gameplay screen or window before running the live capture check.");
  const voting = readinessAvailability(readiness, "twitch", "Connect Twitch and install the Extension before checking viewer voting.");
  return (
    <div className={styles.testWorkspace}>
      <article id="clean-start-reset" className={styles.cleanStartReset}>
        <div>
          <StatusBadge tone="danger">Full app reset</StatusBadge>
          <h2>Start the entire ChatXPT test from the beginning</h2>
          <p>
            Ends the current session, disconnects this browser from Twitch, clears the local demo
            account, and returns to the first sign-in screen. The permanent broadcaster-linked OBS
            Browser Source URL remains valid for that broadcaster&apos;s future sessions.
          </p>
        </div>
        <button
          className={styles.dangerButton}
          type="button"
          disabled={pending || onResetSession === undefined}
          onClick={() => {
            if (globalThis.confirm("Reset ChatXPT completely and return to the first sign-in screen?")) {
              onResetSession?.(
                view === null || (view.session.status !== "preparing" && view.session.status !== "live")
                  ? null
                  : buildSetupCommand(view, "session", "end-session", commandFactory),
              );
            }
          }}
        >
          {pending ? "Resetting ChatXPT…" : "Reset ChatXPT to clean start"}
        </button>
      </article>
      <Notice tone="warning" title="Sample checks stay separate from live state">A sample never becomes the judged live gameplay or Twitch evidence. Live checks use the current authorised session and are labelled separately.</Notice>
      <div className={styles.testGrid}>
        <article><span className={styles.testIcon}>01</span><strong>Game Capture</strong><p>Open Gameplay Engine and select the gameplay screen or window in that same Studio page.</p><StatusBadge tone={capture.tone}>{capture.badge}</StatusBadge><a href="/studio/gameplay">Run live capture check</a></article>
        <article id="viewer-voting-check"><span className={styles.testIcon}>02</span><strong>Viewer Voting</strong><p>Open the installed panel from the Twitch channel. A direct browser tab cannot create a Twitch viewer identity.</p><StatusBadge tone={voting.tone}>{voting.badge}</StatusBadge><span className={styles.disabledAction}>Test through Twitch Local or Hosted Test</span></article>
        <article><span className={styles.testIcon}>03</span><strong>Broadcast Overlay</strong><p>Check voting, active quest, result, reconnect, and sanitised Up next output.</p><StatusBadge tone={view?.session.status === "live" ? "success" : "neutral"}>{view?.session.status === "live" ? "Session live" : "Waiting for live session"}</StatusBadge><a href="#broadcast-output-setup">Generate below</a></article>
      </div>
      <PageSectionCard title="Sample / Live Source" badge={view?.gameplay?.envelope.evidenceClass === "live" ? "Live source" : "No live source"} badgeTone={view?.gameplay?.envelope.evidenceClass === "live" ? "success" : "neutral"} detail={view?.gameplay?.envelope.evidenceClass === "live" ? "The current gameplay snapshot came from the live capture boundary." : "No sample is presented as a live gameplay snapshot."} />
      <PageSectionCard title="Capture Controls" badge={capture.badge} badgeTone={capture.tone} detail={capture.detail}><div className={styles.actions}><a href="/studio/gameplay">Open Gameplay Engine</a></div></PageSectionCard>
      <PageSectionCard title="Observed / Unknown" badge={view?.gameplay === null || view === null ? "Waiting" : "Current snapshot"} badgeTone={view?.gameplay === null || view === null ? "neutral" : "info"} detail={view?.gameplay === null || view === null ? "Observed and unknown facts appear after a trusted capture check." : `${view.gameplay.signals.filter((signal) => signal.observation.status === "known").length} observed and ${view.gameplay.signals.filter((signal) => signal.observation.status !== "known").length} unknown, stale, or unavailable facts.`} />
      <PageSectionCard title="Recovery" badge={capture.state === "available" && voting.state === "available" ? "Ready" : "Action available"} badgeTone={capture.state === "available" && voting.state === "available" ? "success" : "warning"} detail="Use the source-specific action above for camera permission, device loss, Twitch authorization, or viewer-state recovery." />
    </div>
  );
}

function PageBody({ page, view, readiness, pending, onCommand, onResetSession, localProfile, onLocalProfileChange, commandFactory }: {
  readonly page: StudioProductPage;
  readonly view: StreamerViewModel | null;
  readonly readiness?: StreamerReadinessView | null;
  readonly pending: boolean;
  readonly onCommand?: (command: StreamerUiCommand) => void;
  readonly onResetSession?: (command: StreamerUiCommand | null) => void;
  readonly localProfile?: StreamerProfile | null;
  readonly onLocalProfileChange?: (profile: StreamerProfile) => void;
  readonly commandFactory: StreamerCommandFactory;
}) {
  if (page === "home") {
    return (
      <HomePage
        view={view}
        readiness={readiness}
        pending={pending}
        onCommand={onCommand}
        commandFactory={commandFactory}
      />
    );
  }
  if (page === "gameplay") return <GameplayPage view={view} readiness={readiness} />;
  if (page === "live-analytics") return <LiveAnalyticsPage view={view} readiness={readiness} />;
  if (page === "live-quests") return <LiveQuestsPage view={view} pending={pending} onCommand={onCommand} commandFactory={commandFactory} />;
  if (page === "profile") {
    return (
      <ProfilePage
        view={view}
        localProfile={localProfile}
        pending={pending}
        onCommand={onCommand}
        onLocalProfileChange={onLocalProfileChange}
        commandFactory={commandFactory}
      />
    );
  }
  if (page === "stream-settings") {
    return (
      <StreamSettingsPage
        view={view}
        pending={pending}
        onCommand={onCommand}
        commandFactory={commandFactory}
      />
    );
  }
  return (
    <TestLabPage
      view={view}
      readiness={readiness}
      pending={pending}
      onResetSession={onResetSession}
      commandFactory={commandFactory}
    />
  );
}

export function StudioProductPageSurface({
  page,
  view,
  readiness,
  commandMessage,
  pendingCommandId = null,
  onCommand,
  onResetSession,
  localProfile = null,
  localProfileDiagnostic = null,
  localProfileSyncState = "clean",
  onLocalProfileChange,
  onApplyLocalProfile,
  onKeepCloudProfile,
  localAccountDisplayName = null,
  onLocalAccountSignOut,
  commandFactory = defaultStreamerCommandFactory,
  children,
}: StudioProductPageSurfaceProps) {
  const pageLabel = studioPageLabel(page);
  const pending = pendingCommandId !== null;
  const activeProfile = view?.profile ?? localProfile;
  const profileConnection = view?.profileConnection;
  const accountLabel = profileConnection?.accountStatus === "twitch-verified"
    ? "Twitch verified"
    : profileConnection?.accountStatus === "diagnostic"
      ? "Diagnostic session"
    : view !== null && profileConnection === undefined
      ? "Connection checking"
    : localProfile !== null
      ? "Local profile"
      : "Not connected";
  const storageLabel = profileConnection?.persistenceStatus === "synced"
    ? "Saved to account"
    : profileConnection?.persistenceStatus === "temporary"
      ? "Server memory only"
      : profileConnection?.persistenceStatus === "unavailable"
        ? "Account storage unavailable"
      : localProfile !== null
        ? "This device only"
        : view !== null
          ? "Storage checking"
          : "Storage unavailable";
  const twitchLifecycle = twitchLifecycleLabel(view, readiness);
  const captureSource = activeGameplayCaptureSource(view, readiness);
  return (
    <DesignSystemRoot className={styles.surface}>
      <aside className={styles.sidebar} aria-label="Studio navigation">
        <div className={styles.sidebarIdentity} aria-label="ChatXPT Streamer Studio">
          <strong>ChatXPT</strong>
          <span>Streamer Studio</span>
        </div>
        <nav className={styles.nav}>
          {NAV_ITEMS.map((item) => (
            <a
              key={item.page}
              href={item.href}
              aria-current={item.page === page ? "page" : undefined}
            >
              <StudioIcon name={item.icon} className={styles.navIcon} />
              <span>{item.label}</span>
            </a>
          ))}
        </nav>
        {localAccountDisplayName !== null ? (
          <section className={styles.localAccount} aria-label="Local ChatXPT account">
            <span><small>Local fallback</small><strong>{localAccountDisplayName}</strong></span>
            <button type="button" onClick={onLocalAccountSignOut}>Sign out</button>
          </section>
        ) : null}
      </aside>
      <main className={`${styles.main} ${page === "live-analytics" ? styles.analyticsMain : ""} ${page === "gameplay" ? styles.gameplayMain : ""}`}>
        <section className={styles.studioHeader}>
          <div className={styles.pageIdentity}>
            <strong>ChatXPT</strong>
            <h1>{pageLabel}</h1>
          </div>
          <dl className={styles.integrationSummary} aria-label="Studio connection status">
            <div>
              <dt>Twitch</dt>
              <dd data-state={twitchLifecycle.toLowerCase().replace(/\s+/gu, "-")}>{twitchLifecycle}</dd>
            </div>
            <div>
              <dt>Game Capture</dt>
              <dd>{captureSource}</dd>
            </div>
          </dl>
          <div className={styles.accountSummary}>
            <span>Account</span>
            <strong>{customerSafeLabel(activeProfile?.displayName, "Not connected")}</strong>
            <small>{accountLabel} · {storageLabel}</small>
          </div>
        </section>
        {PAGE_SECTIONS[page] ? (
          <nav className={styles.sectionNav} aria-label={`${pageLabel} sections`}>
            {PAGE_SECTIONS[page]?.map((section) => (
              <a key={section} href={`#${gameIdFromName(section)}`}>{section}</a>
            ))}
          </nav>
        ) : null}
        {commandMessage ? <Notice tone="warning" title="Studio status">{commandMessage}</Notice> : null}
        {localProfileDiagnostic ? <Notice tone="warning" title="Local profile recovered">{localProfileDiagnostic}</Notice> : null}
        {view !== null && localProfileSyncState !== "clean" ? (
          <Notice
            tone={localProfileSyncState === "conflict" ? "warning" : "info"}
            title={localProfileSyncState === "conflict" ? "Choose which profile to keep" : "Local profile changes are ready"}
          >
            <p>{localProfileSyncState === "conflict"
              ? "The account profile changed since this device last synced. ChatXPT will not merge safety or accessibility settings automatically."
              : "This device has local profile changes based on the current account revision."}</p>
            <div className={styles.actions}>
              <button type="button" disabled={pending || onApplyLocalProfile === undefined} onClick={onApplyLocalProfile}>Use local defaults</button>
              <button type="button" className={styles.secondaryButton} disabled={pending || onKeepCloudProfile === undefined} onClick={onKeepCloudProfile}>Use account defaults</button>
            </div>
          </Notice>
        ) : null}
        {children ?? (
          <PageBody
            page={page}
            view={view}
            readiness={readiness}
            pending={pending}
            onCommand={onCommand}
            onResetSession={onResetSession}
            localProfile={localProfile}
            onLocalProfileChange={onLocalProfileChange}
            commandFactory={commandFactory}
          />
        )}
      </main>
    </DesignSystemRoot>
  );
}
