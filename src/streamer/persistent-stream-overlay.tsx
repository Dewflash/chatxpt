"use client";

import {
  Card,
  DesignSystemRoot,
  Notice,
  Progress,
  StatusBadge,
  type StatusTone,
} from "../design-system";
import type { StreamerReadinessView, StreamerViewModel } from "../core";

import styles from "./persistent-stream-overlay.module.css";

export interface PersistentStreamOverlaySurfaceProps {
  readonly view: StreamerViewModel | null;
  readonly readiness?: StreamerReadinessView | null;
}

function titleCase(value: string): string {
  return value
    .split(/[-_]/u)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function sessionTone(status: StreamerViewModel["session"]["status"]): StatusTone {
  if (status === "live") return "success";
  if (status === "preparing") return "info";
  if (status === "ended") return "neutral";
  return "warning";
}

function chatTone(status: NonNullable<StreamerViewModel["publicContext"]>["chatStatus"]): StatusTone {
  if (status === "hype") return "success";
  if (status === "quiet") return "warning";
  if (status === "steady") return "info";
  return "neutral";
}

function remainingSeconds(view: StreamerViewModel): number | null {
  if (view.questCycle.endsAt === null) return null;
  return Math.max(0, Math.ceil((view.questCycle.endsAt - view.envelope.receivedAt) / 1_000));
}

function QuestBand({ view }: { readonly view: StreamerViewModel }) {
  const cycle = view.questCycle;
  const winner = cycle.options.find((option) => option.candidateId === cycle.activeCandidateId);
  const remaining = remainingSeconds(view);
  const statusLabel = cycle.status === "selected"
    ? cycle.endsAt === null
      ? "Approval needed"
      : "Winner selected"
    : titleCase(cycle.status);
  return (
    <Card className={styles.band}>
      <div className={styles.bandHeader}>
        <span>Sidequest</span>
        <StatusBadge tone={cycle.status === "active" ? "success" : cycle.status === "selected" ? "info" : "neutral"}>
          {statusLabel}
        </StatusBadge>
      </div>
      {cycle.result ? (
        <div className={styles.primaryCopy}>
          <strong>{titleCase(cycle.result.outcome)}</strong>
          <span>{cycle.result.reason}</span>
        </div>
      ) : winner ? (
        <div className={styles.primaryCopy}>
          <strong>{winner.title}</strong>
          <span>{winner.instruction}</span>
        </div>
      ) : cycle.status === "voting" ? (
        <ol className={styles.questList}>
          {cycle.options.map((option, index) => (
            <li key={option.candidateId}>
              <b>{index + 1}</b>
              <span>{option.title}</span>
              <small>{cycle.voteTallies.find((tally) => tally.candidateId === option.candidateId)?.votes ?? 0}</small>
            </li>
          ))}
        </ol>
      ) : (
        <span className={styles.muted}>Waiting for the next safe three-option vote.</span>
      )}
      {cycle.status === "selected" ? (
        <p className={styles.explainer}>
          {cycle.endsAt === null
            ? "The viewers chose this quest. Approve Start in Studio or Twitch Live Config."
            : `The viewers chose this quest. It starts automatically in ${remaining ?? 0}s.`}
        </p>
      ) : cycle.status === "voting" && remaining !== null ? (
        <p className={styles.explainer}>{`${remaining}s left in the audience vote.`}</p>
      ) : null}
      {cycle.progress ? (
        <Progress
          label={`Progress · ${titleCase(cycle.progress.method)}`}
          value={cycle.progress.value}
          max={1}
          valueLabel={`${Math.round(cycle.progress.value * 100)}%`}
        />
      ) : null}
    </Card>
  );
}

export function PersistentStreamOverlaySurface({
  view,
  readiness,
}: PersistentStreamOverlaySurfaceProps) {
  if (view === null) {
    return (
      <DesignSystemRoot theme="dark" density="compact" className={styles.surface}>
        <main className={styles.shell}>
          <Notice title="Live Director is ready" politeness="polite">
            Waiting for this broadcaster&apos;s active ChatXPT session.
          </Notice>
        </main>
      </DesignSystemRoot>
    );
  }

  const context = view.publicContext;
  const capture = readiness?.services.find((service) => service.service === "obs-capture")?.health ??
    view.services.find((service) => service.service === "gameplay-capture");
  const realtime = readiness?.services.find((service) => service.service === "realtime")?.health ??
    view.services.find((service) => service.service === "realtime");
  const cue = view.liveDirector?.cue ?? null;

  return (
    <DesignSystemRoot theme="dark" density="compact" className={styles.surface}>
      <main className={styles.shell}>
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>Private Live Director</p>
            <h1>{view.profile.gameName ?? view.profile.displayName}</h1>
          </div>
          <StatusBadge tone={sessionTone(view.session.status)}>{titleCase(view.session.status)}</StatusBadge>
        </header>

        {view.emergencyPaused ? (
          <Notice tone="danger" title="Emergency pause active" politeness="assertive">
            New sidequests are blocked until the pause is cleared.
          </Notice>
        ) : null}

        <Card className={styles.band}>
          <div className={styles.bandHeader}>
            <span>Chat health</span>
            <StatusBadge tone={chatTone(context?.chatStatus ?? "unknown")}>
              {titleCase(context?.chatStatus ?? "unknown")}
            </StatusBadge>
          </div>
          <div className={styles.metricRow}>
            <strong>{context?.chatEnergy === null || context?.chatEnergy === undefined ? "—" : `${Math.round(context.chatEnergy * 100)}%`}</strong>
            <span>Energy</span>
            <strong>{view.communityHype}</strong>
            <span>Community hype</span>
          </div>
        </Card>

        <Card className={styles.band}>
          <div className={styles.bandHeader}>
            <span>Gameplay</span>
            <StatusBadge tone={context?.gameplayStatus ? "success" : "neutral"}>
              {context?.gameplayStatus ? "Observed" : "Unknown"}
            </StatusBadge>
          </div>
          <strong className={styles.gameplayStatus}>{context?.gameplayStatus ?? "No supported fresh state yet"}</strong>
          <p className={styles.explainer}>{context?.explainer ?? "ChatXPT is still observing the current stream."}</p>
        </Card>

        <QuestBand view={view} />

        <Card className={styles.band}>
          <div className={styles.bandHeader}>
            <span>Director cue</span>
            <StatusBadge tone={cue?.state === "proposed" ? "info" : "neutral"}>
              {cue ? titleCase(cue.state) : "None"}
            </StatusBadge>
          </div>
          <p className={styles.explainer}>{cue?.reason ?? "No private cue needs attention."}</p>
        </Card>

        <footer className={styles.footer}>
          <span><i data-tone={capture?.status ?? "unknown"} />Capture {titleCase(capture?.status ?? "unknown")}</span>
          <span><i data-tone={realtime?.status ?? "unknown"} />Realtime {titleCase(realtime?.status ?? "unknown")}</span>
          <span className={styles.private}>Private · no raw chat</span>
        </footer>
      </main>
    </DesignSystemRoot>
  );
}
