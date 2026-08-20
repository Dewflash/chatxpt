"use client";

import { Card, CardGrid, DesignSystemRoot, Notice, StatusBadge } from "../design-system";
import type { StreamerReadinessView, StreamerViewModel } from "../core";
import { summarizeGameplayHealth } from "./gameplay-health";
import { summarizeQuestGeneration } from "./quest-generation-health";
import {
  readinessAvailability,
  unavailableAvailability,
  type ProductAvailability,
} from "./studio-availability";

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
  const gameplay = view === null ? null : summarizeGameplayHealth(view.gameplay);
  const generation = view === null || view.questCycle.options.length === 0
    ? null
    : summarizeQuestGeneration(view.questCycle.options);
  const twitch = readinessAvailability(readiness, "twitch", "Connect Twitch before starting ChatXPT.");
  const obs = readinessAvailability(readiness, "obs-capture", "Allow OBS Virtual Camera from Studio when capture is ready.");
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
        <StatusBadge tone={gameplay?.tone ?? "neutral"}>{gameplay?.label ?? "No signal yet"}</StatusBadge>
        <h3>Gameplay Activity</h3>
        <p>{view?.gameplay === null || view === null ? "No current gameplay snapshot is available." : `${gameplay?.knownCount ?? 0} known facts and ${gameplay?.unknownCount ?? 0} unknown facts.`}</p>
      </Card>
      <Card className={styles.card}>
        <StatusBadge tone={generation?.tone ?? "neutral"}>{generation?.label ?? "Waiting"}</StatusBadge>
        <h3>Sidequests</h3>
        <p>{generation?.detail ?? "ChatXPT opens voting only after exactly three validated options are approved."}</p>
      </Card>
    </CardGrid>
  );
}

function HomePage({ view, readiness }: {
  readonly view: StreamerViewModel | null;
  readonly readiness?: StreamerReadinessView | null;
}) {
  return (
    <>
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

function GameplayPage({ view }: { readonly view: StreamerViewModel | null }) {
  const gameplay = view === null ? null : summarizeGameplayHealth(view.gameplay);
  return (
    <CardGrid className={styles.grid}>
      <Card className={styles.card}>
        <StatusBadge tone={gameplay?.tone ?? "neutral"}>{gameplay?.label ?? "No signal yet"}</StatusBadge>
        <h3>Overview</h3>
        <p>{view?.gameplay === null || view === null ? "Connect Game Capture to let ChatXPT read supported gameplay facts." : `${titleCase(view.gameplay.capabilities.tier)} is active for ${view.gameplay.capabilities.gameId ?? "the selected game"}.`}</p>
      </Card>
      <Card className={styles.card}>
        <h3>Understanding</h3>
        <dl className={styles.list}>
          <div><dt>Known facts</dt><dd>{gameplay?.knownCount ?? 0}</dd></div>
          <div><dt>Unknown facts</dt><dd>{gameplay?.unknownCount ?? 0}</dd></div>
          <div><dt>Stale facts</dt><dd>{gameplay?.staleCount ?? 0}</dd></div>
        </dl>
      </Card>
      {unavailableCard("Capture controls", "Game Capture controls are not connected to the live session yet.", "Available in the next setup pass")}
    </CardGrid>
  );
}

function LiveAnalyticsPage({ view }: { readonly view: StreamerViewModel | null }) {
  const audience = view?.audience ?? null;
  return (
    <CardGrid className={styles.grid}>
      <Card className={styles.card}>
        <StatusBadge tone={audience === null ? "neutral" : "info"}>{audience === null ? "Waiting" : "Active"}</StatusBadge>
        <h3>Activity</h3>
        <p>{audience === null ? "Connect Twitch chat to show privacy-safe audience activity." : `${audience.signals.length} aggregate audience signals are available.`}</p>
      </Card>
      {unavailableCard("Automatic topics", "Topic detection and watchlist counts are not connected yet. Raw chat and usernames will not be shown.", "Available after audience setup")}
      {unavailableCard("Session timeline", "Aggregate audience history is not connected to this page yet.", "Available after history setup")}
    </CardGrid>
  );
}

function LiveQuestsPage({ view }: { readonly view: StreamerViewModel | null }) {
  const cycle = view?.questCycle ?? null;
  return (
    <CardGrid className={styles.grid}>
      <Card className={styles.card}>
        <StatusBadge tone={cycle === null ? "neutral" : "info"}>{cycle === null ? "Waiting" : titleCase(cycle.status)}</StatusBadge>
        <h3>Now</h3>
        <p>{cycle?.activeCandidateId === null || cycle === null ? "No sidequest is active." : "An approved sidequest is active."}</p>
      </Card>
      <Card className={styles.card}>
        <h3>Recommendations</h3>
        <p>{cycle === null || cycle.options.length !== 3 ? "ChatXPT will not open voting until exactly three validated options are ready." : "Three validated options are available for streamer review."}</p>
      </Card>
      {unavailableCard("Approval controls", "Full Live Quests controls are not connected here yet. Compact controls remain available in Live Config.", "Use Live Config for now")}
    </CardGrid>
  );
}

function ProfilePage({ view }: { readonly view: StreamerViewModel | null }) {
  const profile = view?.profile ?? null;
  return (
    <CardGrid className={styles.grid}>
      <Card className={styles.card}>
        <StatusBadge tone={profile === null ? "neutral" : "success"}>{profile === null ? "No profile" : "Saved profile"}</StatusBadge>
        <h3>Personality</h3>
        <p>{profile === null ? "Start a broadcaster session to load saved defaults." : `Intensity ${Math.round((profile.experience.intensity ?? 0.5) * 100)}%, creativity ${Math.round((profile.experience.creativity ?? 0.5) * 100)}%.`}</p>
      </Card>
      <Card className={styles.card}>
        <h3>Safety and accessibility</h3>
        <p>{profile === null ? "No saved profile loaded." : `${profile.restrictions.length + profile.forbiddenQuestTypes.length} saved limits, ${profile.accessibilityNeeds.length} accessibility preferences.`}</p>
      </Card>
      {unavailableCard("Named presets", "Competitive, Chill, Educational, Community, and custom presets are not connected yet.", "Use saved defaults for now")}
    </CardGrid>
  );
}

function StreamSettingsPage({ view }: { readonly view: StreamerViewModel | null }) {
  return (
    <CardGrid className={styles.grid}>
      <Card className={styles.card}>
        <StatusBadge tone={view === null ? "neutral" : "info"}>{view === null ? "Waiting" : "Saved source"}</StatusBadge>
        <h3>Effective values</h3>
        <p>{view === null ? "Start a session to see current-stream settings." : "This stream currently follows saved profile defaults."}</p>
      </Card>
      {unavailableCard("Temporary override", "Session-only changes and reset controls are not connected yet.", "Use saved defaults for now")}
    </CardGrid>
  );
}

function TestLabPage() {
  return (
    <CardGrid className={styles.grid}>
      <Card className={styles.card}>
        <StatusBadge tone="warning">Unavailable</StatusBadge>
        <h3>Authorised source check</h3>
        <p>Sample and live source controls are not connected yet. They will stay separate from the active stream.</p>
      </Card>
      <Card className={styles.card}>
        <StatusBadge tone="warning">Unavailable</StatusBadge>
        <h3>Gameplay source check</h3>
        <p>Live capture checks remain separated from the active stream until Test Lab is connected.</p>
        <AvailabilityAction availability={unavailableAvailability("Live capture checks remain separated from the active stream until Test Lab is connected.", "Available after Test Lab setup")} />
      </Card>
    </CardGrid>
  );
}

function PageBody({ page, view, readiness }: {
  readonly page: StudioProductPage;
  readonly view: StreamerViewModel | null;
  readonly readiness?: StreamerReadinessView | null;
}) {
  if (page === "home") return <HomePage view={view} readiness={readiness} />;
  if (page === "gameplay") return <GameplayPage view={view} />;
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
}: StudioProductPageSurfaceProps) {
  const copy = PAGE_COPY[page];
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
              {readiness?.label ?? "Connect Studio"}
            </StatusBadge>
            <small>{view?.profile.gameName ?? "No game selected"}</small>
          </div>
        </section>
        {commandMessage ? <Notice tone="warning" title="Studio status">{commandMessage}</Notice> : null}
        <PageBody page={page} view={view} readiness={readiness} />
      </main>
    </DesignSystemRoot>
  );
}
