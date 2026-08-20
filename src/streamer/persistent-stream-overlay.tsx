"use client";

import {
  Card,
  CardGrid,
  ControlRow,
  DesignSystemRoot,
  Notice,
  Panel,
  Progress,
  StatusBadge,
  type StatusTone,
} from "../design-system";
import type {
  AudienceSnapshot,
  DirectorCue,
  LiveContextFact,
  LiveContextSourceClass,
  QuestCandidate,
  ServiceHealth,
  StreamerReadinessView,
  StreamerViewModel,
} from "../core";
import { summarizeGameplayHealth } from "./gameplay-health";
import { summarizeQuestGeneration } from "./quest-generation-health";

import styles from "./persistent-stream-overlay.module.css";

export interface PersistentStreamOverlaySurfaceProps {
  readonly view: StreamerViewModel | null;
  readonly readiness?: StreamerReadinessView | null;
}

const sourceLabels: Readonly<Record<LiveContextSourceClass, string>> = {
  "streamer-declared": "Streamer says",
  "gameplay-observed": "ChatXPT detects",
  "audience-derived": "Chat suggests",
};

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

function evidenceTone(evidenceClass: StreamerViewModel["envelope"]["evidenceClass"]): StatusTone {
  if (evidenceClass === "live") return "success";
  if (evidenceClass === "diagnostic") return "diagnostic";
  return "warning";
}

function serviceTone(status: ServiceHealth["status"]): StatusTone {
  if (status === "ready") return "success";
  if (status === "degraded" || status === "misconfigured") return "warning";
  if (status === "permission-denied" || status === "unavailable") return "danger";
  return "neutral";
}

function factTone(status: LiveContextFact["status"]): StatusTone {
  if (status === "known") return "success";
  if (status === "stale" || status === "conflicting") return "warning";
  if (status === "permission-denied") return "danger";
  return "neutral";
}

function cueTone(cue: DirectorCue | null): StatusTone {
  if (cue === null) return "neutral";
  if (cue.state === "proposed") return "info";
  if (cue.state === "stale" || cue.state === "expired") return "warning";
  if (cue.state === "cancelled") return "danger";
  return "neutral";
}

function factValue(fact: LiveContextFact): string {
  if (fact.value !== null) return String(fact.value);
  if (fact.status === "conflicting") return "Conflicting";
  if (fact.status === "permission-denied") return "Permission denied";
  if (fact.status === "stale") return "Stale";
  return "Unknown";
}

function observationCounts(snapshot: AudienceSnapshot | StreamerViewModel["gameplay"] | null) {
  const counts = { known: 0, unknown: 0, stale: 0, unavailable: 0 };
  for (const signal of snapshot?.signals ?? []) {
    counts[signal.observation.status] += 1;
  }
  return counts;
}

function readinessService(
  readiness: StreamerReadinessView | null | undefined,
  id: string,
) {
  return readiness?.services.find((service) => service.service === id) ?? null;
}

function MetricCard({
  title,
  value,
  tone,
  detail,
}: {
  readonly title: string;
  readonly value: string;
  readonly tone: StatusTone;
  readonly detail: string;
}) {
  return (
    <Card className={styles.metricCard}>
      <ControlRow>
        <h3>{title}</h3>
        <StatusBadge tone={tone}>{value}</StatusBadge>
      </ControlRow>
      <p className={styles.bodyText}>{detail}</p>
    </Card>
  );
}

function ContextCard({
  sourceClass,
  facts,
}: {
  readonly sourceClass: LiveContextSourceClass;
  readonly facts: readonly LiveContextFact[];
}) {
  return (
    <Card className={styles.contextCard}>
      <div className={styles.factHeader}>
        <h3>{sourceLabels[sourceClass]}</h3>
        <StatusBadge tone={facts.some((fact) => fact.status === "known") ? "success" : "neutral"}>
          {facts.length === 0 ? "Unknown" : `${facts.length} facts`}
        </StatusBadge>
      </div>
      {facts.length === 0 ? (
        <p className={styles.bodyText}>No authorised fact is available.</p>
      ) : (
        <ul className={styles.sourceList}>
          {facts.slice(0, 4).map((fact) => (
            <li className={styles.factItem} key={fact.factId}>
              <div className={styles.factHeader}>
                <span>{titleCase(fact.kind)}</span>
                <StatusBadge tone={factTone(fact.status)}>{titleCase(fact.status)}</StatusBadge>
              </div>
              <span className={styles.factValue}>{factValue(fact)}</span>
              <small className={styles.metaText}>
                {`${Math.round(fact.confidence * 100)}% · ${titleCase(fact.evidenceClass)}`}
              </small>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function QuestOption({ option }: { readonly option: QuestCandidate }) {
  return (
    <li className={styles.optionItem}>
      <span className={styles.optionTitle}>{option.title}</span>
      <span className={styles.bodyText}>{option.instruction}</span>
      <div className={styles.badgeRow}>
        <StatusBadge tone="info">{`${option.durationSeconds}s`}</StatusBadge>
        <StatusBadge tone={option.difficulty === "hard" ? "danger" : option.difficulty === "medium" ? "warning" : "success"}>
          {titleCase(option.difficulty)}
        </StatusBadge>
      </div>
    </li>
  );
}

function QuestStatus({ view }: { readonly view: StreamerViewModel }) {
  const cycle = view.questCycle;
  const active = cycle.options.find((option) => option.candidateId === cycle.activeCandidateId);
  return (
    <Card className={styles.questCard}>
      <ControlRow>
        <div>
          <p className={styles.eyebrow}>Sidequest</p>
          <h2>{active?.title ?? titleCase(cycle.status)}</h2>
        </div>
        <StatusBadge tone="info">{titleCase(cycle.status)}</StatusBadge>
      </ControlRow>
      {active ? <p className={styles.bodyText}>{active.instruction}</p> : null}
      {cycle.progress ? (
        <div className={styles.progressWrap}>
          <Progress
            label={`Progress · ${titleCase(cycle.progress.method)}`}
            value={cycle.progress.value}
            max={1}
            valueLabel={`${Math.round(cycle.progress.value * 100)}%`}
          />
        </div>
      ) : null}
      {active === undefined && cycle.options.length > 0 ? (
        <ul className={styles.optionList}>
          {cycle.options.slice(0, 3).map((option) => <QuestOption key={option.candidateId} option={option} />)}
        </ul>
      ) : null}
      {cycle.options.length === 0 ? (
        <p className={styles.bodyText}>Waiting for the next authorised three-option proposal.</p>
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
          <Notice title="Loading stream context" politeness="polite">
            Waiting for an authorised streamer snapshot.
          </Notice>
        </main>
      </DesignSystemRoot>
    );
  }

  const gameplayCounts = observationCounts(view.gameplay);
  const audienceCounts = observationCounts(view.audience);
  const gameplay = summarizeGameplayHealth(view.gameplay);
  const generation = summarizeQuestGeneration(view.questCycle.options);
  const obs = readinessService(readiness, "obs-capture");
  const realtime = readinessService(readiness, "realtime");
  const liveDirector = view.liveDirector ?? null;
  const facts = liveDirector?.liveContext?.facts ?? [];
  const cue = liveDirector?.cue ?? null;
  const sourceClasses = [
    "streamer-declared",
    "gameplay-observed",
    "audience-derived",
  ] as const satisfies readonly LiveContextSourceClass[];

  return (
    <DesignSystemRoot theme="dark" density="compact" className={styles.surface}>
      <main className={styles.shell}>
        <Panel className={styles.card}>
          <header className={styles.header}>
            <div className={styles.titleBlock}>
              <p className={styles.eyebrow}>ChatXPT Stream Context</p>
              <h1 className={styles.title}>
                {view.profile.gameName ? `${view.profile.gameName} · ` : ""}
                {view.profile.displayName}
              </h1>
            </div>
            <div className={styles.badgeRow}>
              <StatusBadge tone={sessionTone(view.session.status)}>{titleCase(view.session.status)}</StatusBadge>
              <StatusBadge tone={evidenceTone(view.envelope.evidenceClass)}>{titleCase(view.envelope.evidenceClass)}</StatusBadge>
              <StatusBadge tone="diagnostic">{`Rev ${view.envelope.revision}`}</StatusBadge>
            </div>
          </header>

          {view.emergencyPaused ? (
            <Notice tone="danger" title="Emergency pause active" politeness="assertive">
              New sidequests are blocked by the authoritative runtime.
            </Notice>
          ) : null}

          <CardGrid className={styles.grid}>
            <MetricCard
              title="OBS Capture"
              value={obs ? titleCase(obs.health.status) : "Unknown"}
              tone={obs ? serviceTone(obs.health.status) : "neutral"}
              detail={obs?.health.message ?? "No OBS capture readiness was supplied."}
            />
            <MetricCard
              title="Gameplay"
              value={gameplay.label}
              tone={gameplay.tone}
              detail={`Known ${gameplayCounts.known} · Unknown ${gameplayCounts.unknown} · Stale ${gameplayCounts.stale}`}
            />
            <MetricCard
              title="Audience"
              value={audienceCounts.known > 0 ? "Signal" : "Unknown"}
              tone={audienceCounts.known > 0 ? "success" : "neutral"}
              detail={`Known ${audienceCounts.known} · Unknown ${audienceCounts.unknown} · Stale ${audienceCounts.stale}`}
            />
            <MetricCard
              title="Sidequests"
              value={generation.label}
              tone={generation.tone}
              detail={view.questCycle.options.length === 3 ? "Three candidate options are available." : "No complete option set is available."}
            />
            <MetricCard
              title="Realtime"
              value={realtime ? titleCase(realtime.health.status) : "Unknown"}
              tone={realtime ? serviceTone(realtime.health.status) : "neutral"}
              detail={realtime?.health.message ?? "No realtime readiness was supplied."}
            />
            <MetricCard
              title="Director Cue"
              value={cue === null ? "None" : titleCase(cue.state)}
              tone={cueTone(cue)}
              detail={cue?.reason ?? "No fresh private cue is available."}
            />
          </CardGrid>
        </Panel>

        <section className={styles.wideGrid} aria-label="Private stream context">
          <Card className={styles.card}>
            <div className={styles.sectionHeader}>
              <div>
                <p className={styles.eyebrow}>Private Context</p>
                <h2 className={styles.title}>Sources stay separate</h2>
              </div>
              <StatusBadge tone={liveDirector?.liveContext ? "info" : "neutral"}>
                {liveDirector?.liveContext ? "Authoritative" : "Unknown"}
              </StatusBadge>
            </div>
            <CardGrid className={styles.grid}>
              {sourceClasses.map((sourceClass) => (
                <ContextCard
                  key={sourceClass}
                  sourceClass={sourceClass}
                  facts={facts.filter((fact) => fact.sourceClass === sourceClass)}
                />
              ))}
            </CardGrid>
          </Card>
          <QuestStatus view={view} />
        </section>

        <p className={`${styles.finePrint} ${styles.privacyNote}`}>
          Private broadcaster context only. Raw chat, usernames, viewer identifiers, provider payloads, and command controls are absent from this surface.
        </p>
      </main>
    </DesignSystemRoot>
  );
}
