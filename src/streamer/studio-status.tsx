"use client";

import {
  Card,
  CardGrid,
  DesignSystemRoot,
  Notice,
  Panel,
  Progress,
  StatusBadge,
} from "../design-system";
import type {
  AudienceSnapshot,
  GameplaySnapshot,
  QuestCandidate,
  ServiceHealth,
  StreamerViewModel,
} from "../core";
import styles from "./studio-status.module.css";

export interface StudioStatusSurfaceProps {
  readonly view: StreamerViewModel | null;
  readonly compact?: boolean;
}

function serviceTone(status: ServiceHealth["status"]) {
  if (status === "ready") return "success" as const;
  if (status === "degraded" || status === "misconfigured") return "warning" as const;
  if (status === "permission-denied" || status === "unavailable") return "danger" as const;
  return "neutral" as const;
}

function sessionTone(status: StreamerViewModel["session"]["status"]) {
  if (status === "live") return "success" as const;
  if (status === "preparing") return "info" as const;
  if (status === "ended") return "neutral" as const;
  return "warning" as const;
}

function evidenceTone(evidenceClass: StreamerViewModel["envelope"]["evidenceClass"]) {
  if (evidenceClass === "live") return "success" as const;
  return "warning" as const;
}

function connectionLabel(evidenceClass: StreamerViewModel["envelope"]["evidenceClass"]): string {
  return evidenceClass === "live" ? "Live connected" : "Live connection not confirmed";
}

function observationCounts(snapshot: GameplaySnapshot | AudienceSnapshot | null) {
  const counts = {
    known: 0,
    unknown: 0,
    stale: 0,
    unavailable: 0,
  };
  for (const signal of snapshot?.signals ?? []) {
    counts[signal.observation.status] += 1;
  }
  return counts;
}

function formatCount(label: string, count: number): string {
  return `${label} ${count}`;
}

function formatSeconds(seconds: number): string {
  return seconds === 1 ? "1 sec" : `${seconds} sec`;
}

function formatReward(points: number): string {
  return points === 1 ? "1 pt" : `${points} pts`;
}

function ServiceCard({ service }: { readonly service: ServiceHealth }) {
  return (
    <Card className={styles.item}>
      <div className={styles.sectionHeader}>
        <h3 className={styles.itemTitle}>{service.service}</h3>
        <StatusBadge tone={serviceTone(service.status)}>{service.status}</StatusBadge>
      </div>
      <p className={styles.bodyText}>
        {service.message ?? (service.retryable ? "Recovery action can be retried." : "No action reported.")}
      </p>
    </Card>
  );
}

function SnapshotCard({
  title,
  snapshot,
}: {
  readonly title: string;
  readonly snapshot: GameplaySnapshot | AudienceSnapshot | null;
}) {
  const counts = observationCounts(snapshot);

  return (
    <Card className={styles.item}>
      <div className={styles.sectionHeader}>
        <h3 className={styles.itemTitle}>{title}</h3>
        <StatusBadge tone={snapshot === null ? "neutral" : evidenceTone(snapshot.envelope.evidenceClass)}>
          {snapshot === null ? "Missing" : connectionLabel(snapshot.envelope.evidenceClass)}
        </StatusBadge>
      </div>
      <div className={styles.metaRow}>
        <StatusBadge tone="success">{formatCount("Known", counts.known)}</StatusBadge>
        <StatusBadge tone="warning">{formatCount("Unknown", counts.unknown)}</StatusBadge>
        <StatusBadge tone="warning">{formatCount("Stale", counts.stale)}</StatusBadge>
        <StatusBadge tone="danger">{formatCount("Unavailable", counts.unavailable)}</StatusBadge>
      </div>
      {snapshot && "capabilities" in snapshot ? (
        <p className={styles.finePrint}>
          {snapshot.capabilities.tier}
          {snapshot.capabilities.gameId ? ` · ${snapshot.capabilities.gameId}` : ""}
        </p>
      ) : null}
    </Card>
  );
}

function QuestOptionCard({ option }: { readonly option: QuestCandidate }) {
  return (
    <Card className={styles.option}>
      <h3 className={styles.optionTitle}>{option.title}</h3>
      <p className={styles.optionBody}>{option.instruction}</p>
      <div className={styles.metaRow}>
        <StatusBadge tone="info">{formatSeconds(option.durationSeconds)}</StatusBadge>
        <StatusBadge tone={option.difficulty === "hard" ? "danger" : option.difficulty === "medium" ? "warning" : "success"}>
          {option.difficulty}
        </StatusBadge>
        <StatusBadge tone="success">{formatReward(option.rewardPoints)}</StatusBadge>
      </div>
    </Card>
  );
}

function QuestPanel({ view }: { readonly view: StreamerViewModel }) {
  const cycle = view.questCycle;
  const active = cycle.options.find((option) => option.candidateId === cycle.activeCandidateId);

  return (
    <section className={styles.section} aria-labelledby="studio-quest-heading">
      <div className={styles.sectionHeader}>
        <h2 id="studio-quest-heading" className={styles.sectionTitle}>Quest state</h2>
        <div className={styles.metaRow}>
          <StatusBadge tone="info">{cycle.status}</StatusBadge>
          <StatusBadge tone="neutral">Synced state</StatusBadge>
        </div>
      </div>

      {cycle.options.length === 3 ? (
        <CardGrid className={styles.grid}>
          {cycle.options.map((option) => (
            <QuestOptionCard key={option.candidateId} option={option} />
          ))}
        </CardGrid>
      ) : (
        <Notice title="No three-option quest is available">
          ChatXPT is waiting for the next three-option proposal.
        </Notice>
      )}

      {active ? (
        <Notice tone="success" title="Active quest" politeness="polite">
          {active.title}
        </Notice>
      ) : null}

      {cycle.progress ? (
        <Progress
          label="Quest progress"
          value={cycle.progress.value}
          max={1}
          valueLabel={`${Math.round(cycle.progress.value * 100)}%`}
        />
      ) : null}

      {cycle.availableStreamerActions.length > 0 ? (
        <p className={styles.finePrint}>
          Available actions: {cycle.availableStreamerActions.join(", ")}
        </p>
      ) : (
        <p className={styles.finePrint}>No streamer action is currently available.</p>
      )}
    </section>
  );
}

export function StudioStatusSurface({ view, compact = false }: StudioStatusSurfaceProps) {
  if (view === null) {
    return (
      <DesignSystemRoot theme="dark" density={compact ? "compact" : "comfortable"} className={styles.surface}>
        <Panel className={styles.shell}>
          <Notice title="Loading Studio snapshot" politeness="polite">
            Waiting for the latest Studio view from ChatXPT.
          </Notice>
        </Panel>
      </DesignSystemRoot>
    );
  }

  return (
    <DesignSystemRoot theme="dark" density={compact ? "compact" : "comfortable"} className={styles.surface}>
      <Panel className={styles.shell}>
        <header className={styles.header}>
          <div className={styles.titleBlock}>
            <p className={styles.eyebrow}>ChatXPT Studio</p>
            <h1 className={styles.title}>
              {view.profile.displayName}
              {view.profile.gameName ? ` · ${view.profile.gameName}` : ""}
            </h1>
            <p className={styles.subtitle}>
              Setup status is shown per service so the streamer can see the exact blocker.
            </p>
          </div>
          <div className={styles.metaRow}>
            <StatusBadge tone={sessionTone(view.session.status)}>{view.session.status}</StatusBadge>
            <StatusBadge tone={evidenceTone(view.envelope.evidenceClass)}>{connectionLabel(view.envelope.evidenceClass)}</StatusBadge>
          </div>
        </header>

        {view.emergencyPaused ? (
          <Notice tone="danger" title="Emergency pause active" politeness="assertive">
            Quest controls stay paused until emergency pause is cleared.
          </Notice>
        ) : null}

        <section className={styles.section} aria-labelledby="studio-services-heading">
          <div className={styles.sectionHeader}>
            <h2 id="studio-services-heading" className={styles.sectionTitle}>Integration health</h2>
            <p className={styles.finePrint}>No overall readiness score is derived in this UI.</p>
          </div>
          <CardGrid className={styles.grid}>
            {view.services.map((service) => (
              <ServiceCard key={service.service} service={service} />
            ))}
          </CardGrid>
        </section>

        <section className={styles.section} aria-labelledby="studio-signals-heading">
          <div className={styles.sectionHeader}>
            <h2 id="studio-signals-heading" className={styles.sectionTitle}>Signals</h2>
            <p className={styles.finePrint}>Unknown facts stay unknown and are never labelled live.</p>
          </div>
          <CardGrid className={styles.grid}>
            <SnapshotCard title="Gameplay" snapshot={view.gameplay} />
            <SnapshotCard title="Audience" snapshot={view.audience} />
          </CardGrid>
        </section>

        <QuestPanel view={view} />
      </Panel>
    </DesignSystemRoot>
  );
}
