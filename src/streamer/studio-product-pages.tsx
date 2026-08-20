"use client";

import { Card, CardGrid, DesignSystemRoot, Notice, StatusBadge, type StatusTone } from "../design-system";
import type { StreamerReadinessView, StreamerViewModel } from "../core";
import { summarizeGameplayHealth } from "./gameplay-health";
import { summarizeQuestGeneration } from "./quest-generation-health";

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
    body: "Review recommendations, understand why they fit, and keep voting/result state in one authoritative flow.",
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
    title: "Check authorised gameplay inputs",
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

function serviceTone(status: string | undefined): StatusTone {
  if (status === "ready") return "success";
  if (status === "degraded" || status === "misconfigured") return "warning";
  if (status === undefined) return "neutral";
  return "danger";
}

function serviceStatus(readiness: StreamerReadinessView | null | undefined, serviceId: string) {
  return readiness?.services.find((service) => service.service === serviceId) ?? null;
}

function unavailableCard(title: string, detail: string) {
  return (
    <Card className={styles.card}>
      <StatusBadge tone="warning">Unavailable</StatusBadge>
      <h3>{title}</h3>
      <p>{detail}</p>
      <span className={styles.disabledAction} aria-disabled="true">Waiting for setup</span>
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
  const twitch = serviceStatus(readiness, "twitch");
  const obs = serviceStatus(readiness, "obs-capture");
  const realtime = serviceStatus(readiness, "realtime");
  return (
    <CardGrid className={styles.grid}>
      <Card className={styles.card}>
        <StatusBadge tone={serviceTone(twitch?.health.status)}>{twitch?.health.status ? titleCase(twitch.health.status) : "Unknown"}</StatusBadge>
        <h3>Twitch</h3>
        <p>{twitch?.health.message ?? "Connect Twitch before starting ChatXPT."}</p>
      </Card>
      <Card className={styles.card}>
        <StatusBadge tone={serviceTone(obs?.health.status)}>{obs?.health.status ? titleCase(obs.health.status) : "Unknown"}</StatusBadge>
        <h3>Game Capture</h3>
        <p>{obs?.health.message ?? "Allow OBS Virtual Camera from Studio when capture is ready."}</p>
      </Card>
      <Card className={styles.card}>
        <StatusBadge tone={gameplay?.tone ?? "neutral"}>{gameplay?.label ?? "No signal yet"}</StatusBadge>
        <h3>Gameplay Activity</h3>
        <p>{view?.gameplay === null || view === null ? "No current gameplay snapshot is available." : `${gameplay?.knownCount ?? 0} known facts and ${gameplay?.unknownCount ?? 0} unknown facts.`}</p>
      </Card>
      <Card className={styles.card}>
        <StatusBadge tone={generation?.tone ?? serviceTone(realtime?.health.status)}>{generation?.label ?? "Waiting"}</StatusBadge>
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
      {unavailableCard("Production capture controls", "The product capture controller is scheduled for ICP-02. Until then, capture setup remains unavailable here.")}
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
      {unavailableCard("Automatic topics", "Topic detection and watchlist counts are scheduled for ICP-05. Raw chat and usernames will not be shown.")}
      {unavailableCard("Session timeline", "Aggregate audience history is scheduled for ICP-05 and ICP-08.")}
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
      {unavailableCard("Dedicated approval controls", "The full Live Quests workspace is scheduled for ICP-06. Compact controls remain available in Live Config.")}
    </CardGrid>
  );
}

function ProfilePage({ view }: { readonly view: StreamerViewModel | null }) {
  const profile = view?.profile ?? null;
  return (
    <CardGrid className={styles.grid}>
      <Card className={styles.card}>
        <StatusBadge tone={profile === null ? "neutral" : "success"}>{profile === null ? "No profile" : `Revision ${profile.revision}`}</StatusBadge>
        <h3>Personality</h3>
        <p>{profile === null ? "Start a broadcaster session to load saved defaults." : `Intensity ${Math.round((profile.experience.intensity ?? 0.5) * 100)}%, creativity ${Math.round((profile.experience.creativity ?? 0.5) * 100)}%.`}</p>
      </Card>
      <Card className={styles.card}>
        <h3>Safety and accessibility</h3>
        <p>{profile === null ? "No saved profile loaded." : `${profile.restrictions.length + profile.forbiddenQuestTypes.length} saved limits, ${profile.accessibilityNeeds.length} accessibility preferences.`}</p>
      </Card>
      {unavailableCard("Named presets", "Competitive, Chill, Educational, Community, and custom presets are scheduled for ICP-03.")}
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
      {unavailableCard("Temporary override", "Session-only patch and reset controls are scheduled for ICP-03.")}
    </CardGrid>
  );
}

function TestLabPage() {
  return (
    <CardGrid className={styles.grid}>
      <Card className={styles.card}>
        <StatusBadge tone="warning">Unavailable</StatusBadge>
        <h3>Authorised source check</h3>
        <p>Sample and live source controls are scheduled for ICP-08. They will stay separate from the active stream.</p>
      </Card>
      <Card className={styles.card}>
        <h3>Current diagnostic route</h3>
        <p>Existing diagnostics remain outside the normal product flow until the streamer Test Lab is connected.</p>
        <div className={styles.actions}>
          <a href="/diagnostics/gameplay-extraction">Open diagnostics</a>
        </div>
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
