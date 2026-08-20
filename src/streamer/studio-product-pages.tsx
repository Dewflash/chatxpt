"use client";

import type { ReactNode } from "react";

import { Card, CardGrid, DesignSystemRoot, Notice, StatusBadge } from "../design-system";
import type {
  StreamerReadinessView,
  StreamerSetupAction,
  StreamerSetupService,
  StreamerViewModel,
} from "../core";
import { summarizeGameplayHealth } from "./gameplay-health";
import { summarizeQuestGeneration } from "./quest-generation-health";
import {
  readinessAvailability,
  unavailableAvailability,
  type ProductAvailability,
} from "./studio-availability";
import {
  buildSetupCommand,
  defaultStreamerCommandFactory,
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
  readonly commandFactory?: StreamerCommandFactory;
}

const NAV_ITEMS: readonly { readonly page: StudioProductPage; readonly href: string; readonly label: string }[] = [
  { page: "home", href: "/studio", label: "Home" },
  { page: "gameplay", href: "/studio/gameplay", label: "Gameplay Engine" },
  { page: "live-analytics", href: "/studio/live-analytics", label: "Live Analytics" },
  { page: "live-quests", href: "/studio/live-quests", label: "Live Quests" },
  { page: "profile", href: "/studio/profile", label: "Profile & Defaults" },
  { page: "stream-settings", href: "/studio/stream-settings", label: "Stream Settings" },
  { page: "test-lab", href: "/studio/test-lab", label: "Test Lab" },
];

const PAGE_COPY: Readonly<Record<StudioProductPage, { readonly eyebrow: string; readonly title: string; readonly body: string }>> = {
  home: {
    eyebrow: "Current Stream",
    title: "Get ChatXPT ready for this stream",
    body: "Connect Twitch, Game Capture, viewer participation, and broadcast output from one place.",
  },
  gameplay: {
    eyebrow: "Gameplay Engine",
    title: "What ChatXPT can see",
    body: "Inspect capture health, supported game facts, confidence, unknowns, and recovery actions.",
  },
  "live-analytics": {
    eyebrow: "Live Analytics",
    title: "Current audience health",
    body: "Track aggregate energy, mood, participation, and repeated topics without exposing viewer messages.",
  },
  "live-quests": {
    eyebrow: "Live Quests",
    title: "Sidequests waiting for approval",
    body: "Review recommendations, understand why they fit, and keep voting and result state in one trusted flow.",
  },
  profile: {
    eyebrow: "Profile & Defaults",
    title: "Settings that return next stream",
    body: "Manage personality, safety, game preferences, accessibility, voting, rewards, and future presets.",
  },
  "stream-settings": {
    eyebrow: "Stream Settings",
    title: "Effective settings for right now",
    body: "See whether the current stream follows saved defaults or a temporary override.",
  },
  "test-lab": {
    eyebrow: "Test Lab",
    title: "Check gameplay inputs",
    body: "Use approved sample or live capture checks without confusing samples with the active stream.",
  },
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

function actionAllowed(
  service: StreamerSetupService | null,
  action: StreamerSetupAction,
): boolean {
  return service?.allowedActions.includes(action) ?? false;
}

function unavailableCard(title: string, detail: string, nextStep?: string) {
  const availability = unavailableAvailability(detail, nextStep);
  return (
    <Card className={styles.card}>
      <StatusBadge tone={availability.tone}>{availability.badge}</StatusBadge>
      <h3>{title}</h3>
      <p>{availability.detail}</p>
      <AvailabilityAction availability={availability} />
    </Card>
  );
}

function HealthStrip({ view, readiness }: {
  readonly view: StreamerViewModel | null;
  readonly readiness?: StreamerReadinessView | null;
}) {
  const twitch = readinessAvailability(readiness, "twitch", "Connect Twitch before starting ChatXPT.");
  const obs = readinessAvailability(readiness, "obs-capture", "Allow OBS Virtual Camera from Studio when capture is ready.");
  const voting = readinessAvailability(readiness, "realtime", "Viewer Voting connects after realtime session state is available.");
  const overlay = view === null
    ? unavailableAvailability("Broadcast Overlay connects after a broadcaster session exists.", "Start broadcaster session")
    : {
        state: "available" as const,
        badge: "Ready",
        tone: "success" as const,
        detail: "Broadcast Overlay can read this session after OBS Browser Source setup.",
        nextStep: "Ready",
      };
  return (
    <CardGrid className={styles.grid}>
      <Card className={styles.card}>
        <StatusBadge tone={twitch.tone}>{twitch.badge}</StatusBadge>
        <h3>Twitch</h3>
        <p>{twitch.detail}</p>
        <AvailabilityAction availability={twitch} />
      </Card>
      <Card className={styles.card}>
        <StatusBadge tone={obs.tone}>{obs.badge}</StatusBadge>
        <h3>Game Capture</h3>
        <p>{obs.detail}</p>
        <AvailabilityAction availability={obs} />
      </Card>
      <Card className={styles.card}>
        <StatusBadge tone={voting.tone}>{voting.badge}</StatusBadge>
        <h3>Viewer Voting</h3>
        <p>{voting.detail}</p>
        <AvailabilityAction availability={voting} />
      </Card>
      <Card className={styles.card}>
        <StatusBadge tone={overlay.tone}>{overlay.badge}</StatusBadge>
        <h3>Broadcast Overlay</h3>
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
      badge: "Preparing",
      title: "ChatXPT is preparing the session",
      detail: "Readiness is being checked before the live workflow opens.",
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
      title: "This ChatXPT session has ended",
      detail: "Start a new broadcaster session when you are ready for the next stream.",
    };
  }
  if (mode === "ready") {
    return {
      badge: "Ready",
      title: "Ready to start ChatXPT",
      detail: "Twitch, Game Capture, viewer voting, and broadcast output have no blocking setup issues.",
    };
  }
  return {
    badge: "Needs setup",
    title: customerSafeLabel(readiness?.label, "Connect Studio to continue"),
    detail: readiness?.blockerCodes.length
      ? "Resolve the highlighted setup blocker before starting ChatXPT."
      : "Start or reconnect a broadcaster session before ChatXPT can read stream state.",
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
  const canStart = view !== null && readiness?.ready === true && actionAllowed(session, "start-session") && onCommand !== undefined;
  const canEnd = view !== null && actionAllowed(session, "end-session") && onCommand !== undefined;
  const gameplay = view === null ? null : summarizeGameplayHealth(view.gameplay);
  const generation = view === null || view.questCycle.options.length === 0
    ? null
    : summarizeQuestGeneration(view.questCycle.options);

  return (
    <section className={styles.homePanel} aria-labelledby="home-state-heading">
      <div className={styles.homeSummary}>
        <StatusBadge tone={mode === "live" || mode === "ready" ? "success" : mode === "cannot-connect" || mode === "reconnecting" ? "warning" : "neutral"}>
          {copy.badge}
        </StatusBadge>
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
            <HomeControlButton
              label="Start ChatXPT"
              disabledLabel={readiness?.recommendedAction === "start-session" ? "Start unavailable" : "Resolve setup first"}
              disabled={!canStart}
              pending={pending}
              onClick={() => {
                if (view !== null) onCommand?.(buildSetupCommand(view, "session", "start-session", commandFactory));
              }}
            />
          )}
          <a href={mode === "live" ? "/studio/live-quests" : "/studio/gameplay"}>
            {mode === "live" ? "Open Live Quests" : "Review setup"}
          </a>
        </div>
      </div>
      <dl className={styles.homeMetrics}>
        <div>
          <dt>Stream vibe</dt>
          <dd>{view?.audience === null || view === null ? "Unknown" : `${view.audience.signals.length} audience signals`}</dd>
        </div>
        <div>
          <dt>Gameplay</dt>
          <dd>{gameplay?.label ?? "No signal yet"}</dd>
        </div>
        <div>
          <dt>Sidequests</dt>
          <dd>{generation?.label ?? "Waiting for three options"}</dd>
        </div>
        <div>
          <dt>Game</dt>
          <dd>{view?.profile.gameName ?? "No game selected"}</dd>
        </div>
      </dl>
    </section>
  );
}

function HomePage({ view, readiness, pending, onCommand, commandFactory }: {
  readonly view: StreamerViewModel | null;
  readonly readiness?: StreamerReadinessView | null;
  readonly pending: boolean;
  readonly onCommand?: (command: StreamerUiCommand) => void;
  readonly commandFactory: StreamerCommandFactory;
}) {
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
      <section className={styles.section} aria-labelledby="home-next-heading">
        <h2 id="home-next-heading">Open the right workspace</h2>
        <CardGrid className={styles.grid}>
          <WorkspaceCard title="Gameplay Engine" href="/studio/gameplay" detail="Capture health, supported facts, unknowns, and recovery." />
          <WorkspaceCard title="Live Analytics" href="/studio/live-analytics" detail="Audience energy, mood, participation, topics, and session history." />
          <WorkspaceCard title="Live Quests" href="/studio/live-quests" detail="Recommendations, voting, progress, results, and emergency controls." />
        </CardGrid>
      </section>
    </>
  );
}

function WorkspaceCard({ title, href, detail }: {
  readonly title: string;
  readonly href: string;
  readonly detail: string;
}) {
  return (
    <Card className={styles.card}>
      <h3>{title}</h3>
      <p>{detail}</p>
      <div className={styles.actions}>
        <a href={href}>Open</a>
      </div>
    </Card>
  );
}

function PageSectionCard({
  title,
  badge,
  badgeTone = "neutral",
  detail,
  children,
}: {
  readonly title: string;
  readonly badge?: string;
  readonly badgeTone?: ProductAvailability["tone"];
  readonly detail: string;
  readonly children?: ReactNode;
}) {
  return (
    <Card className={styles.card}>
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
  return (
    <CardGrid className={styles.grid}>
      <PageSectionCard
        title="Overview"
        badge={gameplay?.label ?? "No signal yet"}
        badgeTone={gameplay?.tone ?? "neutral"}
        detail={view?.gameplay === null || view === null ? "Connect Game Capture to let ChatXPT read supported gameplay facts." : `${titleCase(view.gameplay.capabilities.tier)} is active for ${view.gameplay.capabilities.gameId ?? "the selected game"}.`}
      />
      <PageSectionCard
        title="Game Capture"
        badge={capture.badge}
        badgeTone={capture.tone}
        detail={capture.detail}
      >
        <AvailabilityAction availability={capture} />
      </PageSectionCard>
      <PageSectionCard
        title="Understanding"
        detail="ChatXPT separates known, unknown, and stale facts instead of guessing missing gameplay state."
      >
        <dl className={styles.list}>
          <div><dt>Known facts</dt><dd>{gameplay?.knownCount ?? 0}</dd></div>
          <div><dt>Unknown facts</dt><dd>{gameplay?.unknownCount ?? 0}</dd></div>
          <div><dt>Stale facts</dt><dd>{gameplay?.staleCount ?? 0}</dd></div>
        </dl>
      </PageSectionCard>
      <PageSectionCard
        title="Health & Recovery"
        badge={capture.state === "available" ? "Ready" : "Needs setup"}
        badgeTone={capture.tone}
        detail={capture.state === "available" ? "Capture is currently healthy enough for the selected stream state." : "Recovery actions stay unavailable until the production capture controller is connected here."}
      >
        <AvailabilityAction availability={capture.state === "available" ? capture : unavailableAvailability("Recovery actions stay unavailable until the production capture controller is connected here.", "Use setup recovery")} />
      </PageSectionCard>
    </CardGrid>
  );
}

function LiveAnalyticsPage({ view }: { readonly view: StreamerViewModel | null }) {
  const audience = view?.audience ?? null;
  return (
    <CardGrid className={styles.grid}>
      <PageSectionCard
        title="Overview"
        badge={audience === null ? "Waiting" : "Active"}
        badgeTone={audience === null ? "neutral" : "info"}
        detail="Live Analytics keeps only aggregate audience health, not raw messages or viewer usernames."
      />
      <PageSectionCard
        title="Activity"
        badge={audience === null ? "Waiting" : "Active"}
        badgeTone={audience === null ? "neutral" : "info"}
        detail={audience === null ? "Connect Twitch chat to show privacy-safe audience activity." : `${audience.signals.length} aggregate audience signals are available.`}
      />
      {unavailableCard("Topics", "Topic detection and watchlist counts are not connected yet. Raw chat and usernames will not be shown.", "Available after audience setup")}
      {unavailableCard("Session History", "Aggregate audience history is not connected to this page yet.", "Available after history setup")}
    </CardGrid>
  );
}

function LiveQuestsPage({ view }: { readonly view: StreamerViewModel | null }) {
  const cycle = view?.questCycle ?? null;
  const active = cycle?.options.find((option) => option.candidateId === cycle.activeCandidateId) ?? null;
  return (
    <CardGrid className={styles.grid}>
      <PageSectionCard
        title="Now"
        badge={cycle === null ? "Waiting" : titleCase(cycle.status)}
        badgeTone={cycle === null ? "neutral" : "info"}
        detail={active === null ? "No sidequest is active." : `${active.title} is active.`}
      />
      <PageSectionCard
        title="Recommendations"
        badge={cycle?.options.length === 3 ? "Three options" : "Waiting"}
        badgeTone={cycle?.options.length === 3 ? "success" : "neutral"}
        detail={cycle === null || cycle.options.length !== 3 ? "ChatXPT will not open voting until exactly three validated options are ready." : "Three validated options are available for streamer review."}
      />
      <PageSectionCard
        title="Why"
        badge={cycle?.options.length === 3 ? "Available" : "Waiting"}
        badgeTone={cycle?.options.length === 3 ? "info" : "neutral"}
        detail={cycle?.options[0]?.rationale ?? "Reasoning appears after ChatXPT has a validated three-option proposal."}
      />
      {unavailableCard("Voting", "Full voting controls are not connected here yet. Compact controls remain available in Live Config.", "Use Live Config for now")}
      {unavailableCard("Results", "Result controls and history summaries are not connected to this page yet.", "Available after quest workflow setup")}
    </CardGrid>
  );
}

function ProfilePage({ view }: { readonly view: StreamerViewModel | null }) {
  const profile = view?.profile ?? null;
  return (
    <CardGrid className={styles.grid}>
      <PageSectionCard
        title="Personality"
        badge={profile === null ? "No profile" : "Saved profile"}
        badgeTone={profile === null ? "neutral" : "success"}
        detail={profile === null ? "Start a broadcaster session to load saved defaults." : `Intensity ${Math.round((profile.experience.intensity ?? 0.5) * 100)}%, creativity ${Math.round((profile.experience.creativity ?? 0.5) * 100)}%.`}
      />
      {unavailableCard("Stream Presets", "Competitive, Chill, Educational, Community, and custom presets are not connected yet.", "Use saved defaults for now")}
      <PageSectionCard
        title="Safety"
        badge={profile === null ? "Waiting" : "Saved"}
        badgeTone={profile === null ? "neutral" : "success"}
        detail={profile === null ? "No saved profile loaded." : `${profile.restrictions.length + profile.forbiddenQuestTypes.length} saved limits are active.`}
      />
      <PageSectionCard
        title="Accessibility"
        badge={profile === null ? "Waiting" : "Saved"}
        badgeTone={profile === null ? "neutral" : "success"}
        detail={profile === null ? "No saved accessibility preferences loaded." : profile.accessibilityNeeds.length === 0 ? "No extra accessibility preferences saved." : profile.accessibilityNeeds.join(", ")}
      />
    </CardGrid>
  );
}

function StreamSettingsPage({ view }: { readonly view: StreamerViewModel | null }) {
  return (
    <CardGrid className={styles.grid}>
      <PageSectionCard
        title="Saved Source"
        badge={view === null ? "Waiting" : "Saved defaults"}
        badgeTone={view === null ? "neutral" : "info"}
        detail={view === null ? "Start a session to see current-stream settings." : "This stream currently follows saved profile defaults."}
      />
      {unavailableCard("Session Override", "Session-only changes are not connected yet.", "Use saved defaults for now")}
      {unavailableCard("Reset to Saved", "Reset controls are unavailable until session override state is connected.", "No override to reset")}
    </CardGrid>
  );
}

function TestLabPage() {
  return (
    <CardGrid className={styles.grid}>
      {unavailableCard("Sample / Live Source", "Sample checks and live source checks are not connected yet. They will stay separate from the active stream.", "Available after Test Lab setup")}
      {unavailableCard("Capture Controls", "Capture controls are not connected to Test Lab yet.", "Available after capture setup")}
      <PageSectionCard
        title="Observed / Unknown"
        badge="Waiting"
        badgeTone="neutral"
        detail="Observed facts and unknown facts will appear here without upgrading samples into live stream state."
      />
      {unavailableCard("Recovery", "Permission, source, and reconnect recovery controls are not connected to Test Lab yet.", "Available after recovery setup")}
    </CardGrid>
  );
}

function PageBody({ page, view, readiness }: {
  readonly page: StudioProductPage;
  readonly view: StreamerViewModel | null;
  readonly readiness?: StreamerReadinessView | null;
  readonly pending: boolean;
  readonly onCommand?: (command: StreamerUiCommand) => void;
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
  if (page === "live-analytics") return <LiveAnalyticsPage view={view} />;
  if (page === "live-quests") return <LiveQuestsPage view={view} />;
  if (page === "profile") return <ProfilePage view={view} />;
  if (page === "stream-settings") return <StreamSettingsPage view={view} />;
  return <TestLabPage />;
}

export function StudioProductPageSurface({
  page,
  view,
  readiness,
  commandMessage,
  pendingCommandId = null,
  onCommand,
  commandFactory = defaultStreamerCommandFactory,
}: StudioProductPageSurfaceProps) {
  const copy = PAGE_COPY[page];
  const pending = pendingCommandId !== null;
  return (
    <DesignSystemRoot className={styles.surface}>
      <aside className={styles.sidebar} aria-label="Studio navigation">
        <div className={styles.brand}>
          <strong>ChatXPT Studio</strong>
          <small>{view?.profile.displayName ?? "Streamer workspace"}</small>
        </div>
        <nav className={styles.nav}>
          {NAV_ITEMS.map((item) => (
            <a key={item.page} href={item.href} aria-current={item.page === page ? "page" : undefined}>
              {item.label}
            </a>
          ))}
        </nav>
        <p>Unavailable controls stay visible only when ChatXPT can explain what is needed next.</p>
      </aside>
      <main className={styles.main}>
        <section className={styles.hero}>
          <div>
            <p className={styles.muted}>{copy.eyebrow}</p>
            <h1>{copy.title}</h1>
            <p>{copy.body}</p>
          </div>
          <div className={styles.heroMeta}>
            <StatusBadge tone={readiness?.ready ? "success" : readiness ? "warning" : "neutral"}>
              {customerSafeLabel(readiness?.label, readiness?.ready ? "Ready to start" : "Connect Studio")}
            </StatusBadge>
            <small>{view?.profile.gameName ?? "No game selected"}</small>
          </div>
        </section>
        {commandMessage ? <Notice tone="warning" title="Studio status">{commandMessage}</Notice> : null}
        <PageBody
          page={page}
          view={view}
          readiness={readiness}
          pending={pending}
          onCommand={onCommand}
          commandFactory={commandFactory}
        />
      </main>
    </DesignSystemRoot>
  );
}
