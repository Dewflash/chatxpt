"use client";

import type { ReactNode } from "react";

import type { ServiceHealth, SignalObservation, StreamerViewModel } from "../core";
import {
  Button,
  Card,
  CardGrid,
  ControlRow,
  DesignSystemRoot,
  Notice,
  Panel,
  StatusBadge,
  type DesignSystemTheme,
  type StatusTone,
} from "../design-system";

import styles from "./studio-setup-shell.module.css";

export type StudioSection = "setup" | "profile" | "live-quests" | "test-lab";
export type StudioSetupExperience = "first-time" | "returning";
export type StudioSetupStep = "welcome" | "twitch" | "capture" | "preferences" | "review";

export interface StudioSetupShellProps {
  readonly view: StreamerViewModel | null;
  readonly experience: StudioSetupExperience;
  readonly activeStep?: StudioSetupStep;
  readonly completedSteps?: readonly StudioSetupStep[];
  readonly loading?: boolean;
  readonly reconnecting?: boolean;
  readonly theme?: DesignSystemTheme;
  readonly onNavigate?: (section: StudioSection) => void;
  readonly onSelectStep?: (step: StudioSetupStep) => void;
}

const navigation: ReadonlyArray<{ readonly id: StudioSection; readonly label: string }> = [
  { id: "setup", label: "Setup" },
  { id: "profile", label: "Profile" },
  { id: "live-quests", label: "Live quests" },
  { id: "test-lab", label: "Test Lab" },
];

const setupSteps: ReadonlyArray<{
  readonly id: StudioSetupStep;
  readonly eyebrow: string;
  readonly title: string;
  readonly description: string;
}> = [
  {
    id: "welcome",
    eyebrow: "1",
    title: "Understand the flow",
    description: "Studio manages setup, Twitch hosts viewer participation, and OBS carries broadcast visuals.",
  },
  {
    id: "twitch",
    eyebrow: "2",
    title: "Connect Twitch",
    description: "Connection and installation actions stay inside the secure Studio setup flow.",
  },
  {
    id: "capture",
    eyebrow: "3",
    title: "Check OBS capture",
    description: "Use a raw-game Virtual Camera scene and keep the ChatXPT overlay out of the captured input.",
  },
  {
    id: "preferences",
    eyebrow: "4",
    title: "Review preferences",
    description: "Confirm game, streamer style, intensity, safety limits, and accessibility needs.",
  },
  {
    id: "review",
    eyebrow: "5",
    title: "Review readiness",
    description: "Follow the service checklist and resolve its next action before starting.",
  },
];

const serviceStatus: Record<
  ServiceHealth["status"],
  { readonly label: string; readonly tone: StatusTone }
> = {
  ready: { label: "Ready", tone: "success" },
  degraded: { label: "Degraded", tone: "warning" },
  unavailable: { label: "Unavailable", tone: "danger" },
  "permission-denied": { label: "Permission denied", tone: "warning" },
  misconfigured: { label: "Needs setup", tone: "danger" },
};

const observationStatus: Record<
  SignalObservation["status"],
  { readonly label: string; readonly tone: StatusTone }
> = {
  known: { label: "Known", tone: "success" },
  unknown: { label: "Unknown", tone: "neutral" },
  stale: { label: "Stale", tone: "warning" },
  unavailable: { label: "Unavailable", tone: "danger" },
};

function titleCase(value: string): string {
  return value
    .split(/[-_]/u)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function checkedAtLabel(value: number): string {
  const checkedAt = new Date(value);
  if (Number.isNaN(checkedAt.getTime())) {
    return "Time unavailable";
  }

  const iso = checkedAt.toISOString();
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
}

function evidenceBadge(view: StreamerViewModel | null): {
  readonly label: string;
  readonly tone: StatusTone;
} {
  switch (view?.envelope.evidenceClass) {
    case "live":
      return { label: "Live connected", tone: "success" };
    case "diagnostic":
      return { label: "Live connection not confirmed", tone: "warning" };
    case "fixture":
      return { label: "Fixture preview", tone: "warning" };
    default:
      return { label: "No Studio snapshot", tone: "neutral" };
  }
}

function Metric({ label, children }: { readonly label: string; readonly children: ReactNode }) {
  return (
    <div className={styles.metric}>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function Navigation({
  onNavigate,
}: Pick<StudioSetupShellProps, "onNavigate">) {
  return (
    <nav className={styles.navigation} aria-label="Studio sections">
      <div className={styles.brand}>
        <span className={styles.brandMark} aria-hidden="true">CX</span>
        <span>
          <strong>ChatXPT</strong>
          <small>Streamer Studio</small>
        </span>
      </div>
      <ul className={styles.navigationList}>
        {navigation.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              className={styles.navigationButton}
              data-active={item.id === "setup" || undefined}
              aria-current={item.id === "setup" ? "page" : undefined}
              disabled={onNavigate === undefined}
              onClick={() => onNavigate?.(item.id)}
            >
              {item.label}
            </button>
          </li>
        ))}
      </ul>
      <p className={styles.navigationHint}>
        Setup comes first. Live controls appear when the stream is ready.
      </p>
    </nav>
  );
}

function SetupJourney({
  activeStep,
  completedSteps,
  onSelectStep,
}: Required<Pick<StudioSetupShellProps, "activeStep" | "completedSteps">> &
  Pick<StudioSetupShellProps, "onSelectStep">) {
  const completed = new Set(completedSteps);

  return (
    <section aria-labelledby="setup-journey-title">
      <div className={styles.sectionHeading}>
        <div>
          <p className={styles.eyebrow}>Guided setup</p>
          <h2 id="setup-journey-title">One clear task at a time</h2>
        </div>
        <StatusBadge tone="info">No readiness score</StatusBadge>
      </div>
      <ol className={styles.stepList}>
        {setupSteps.map((step) => {
          const isCurrent = step.id === activeStep;
          const isCompleted = completed.has(step.id);
          return (
            <li key={step.id} className={styles.step} data-state={isCompleted ? "complete" : isCurrent ? "current" : "upcoming"}>
              <button
                type="button"
                className={styles.stepButton}
                aria-current={isCurrent ? "step" : undefined}
                disabled={onSelectStep === undefined}
                onClick={() => onSelectStep?.(step.id)}
              >
                <span className={styles.stepNumber} aria-hidden="true">
                  {isCompleted ? "✓" : step.eyebrow}
                </span>
                <span>
                  <strong>{step.title}</strong>
                  <small>{step.description}</small>
                </span>
                <span className={styles.stepState}>
                  {isCompleted ? "Complete" : isCurrent ? "Current" : "Upcoming"}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function ServiceChecklist({ services }: { readonly services: readonly ServiceHealth[] }) {
  return (
    <section aria-labelledby="service-checklist-title">
      <div className={styles.sectionHeading}>
        <div>
          <p className={styles.eyebrow}>Service health</p>
          <h2 id="service-checklist-title">Readiness checklist</h2>
        </div>
        <StatusBadge tone="warning">Overall readiness unconfirmed</StatusBadge>
      </div>
      {services.length === 0 ? (
        <Notice tone="warning" title="No service checks supplied">
          Studio will not infer readiness. Wait for the next service snapshot and its recommended action.
        </Notice>
      ) : (
        <CardGrid>
          {services.map((service) => {
            const status = serviceStatus[service.status];
            return (
              <Card key={service.service} className={styles.serviceCard}>
                <ControlRow>
                  <h3>{titleCase(service.service)}</h3>
                  <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                </ControlRow>
                <p>{service.message ?? "No additional service detail was supplied."}</p>
                <div className={styles.serviceMeta}>
                  <span>Checked {checkedAtLabel(service.checkedAt)}</span>
                  <span>{service.retryable ? "Retry permitted" : "No automatic retry"}</span>
                </div>
              </Card>
            );
          })}
        </CardGrid>
      )}
      <Notice tone="info" title="Actions are intentionally unavailable in this slice">
        Connect, permission, profile-save, and session controls stay disabled until those setup actions are connected.
      </Notice>
    </section>
  );
}

function ProfileSummary({ view }: { readonly view: StreamerViewModel }) {
  const profile = view.profile;
  const intensity = profile.experience.intensity;
  const creativity = profile.experience.creativity;

  return (
    <section aria-labelledby="profile-summary-title">
      <div className={styles.sectionHeading}>
        <div>
          <p className={styles.eyebrow}>Saved profile</p>
          <h2 id="profile-summary-title">Five understandable groups</h2>
        </div>
        <StatusBadge tone="neutral">Read only</StatusBadge>
      </div>
      <CardGrid>
        <Panel>
          <h3>Game</h3>
          <p>{profile.gameName ?? "No game selected"}</p>
        </Panel>
        <Panel>
          <h3>Streamer style</h3>
          <p>{creativity === undefined ? "Not recorded" : `${Math.round(creativity * 100)}% creativity`}</p>
        </Panel>
        <Panel>
          <h3>Quest intensity</h3>
          <p>{intensity === undefined ? "Not recorded" : `${Math.round(intensity * 100)}% intensity`}</p>
        </Panel>
        <Panel>
          <h3>Safety &amp; restrictions</h3>
          <p>{profile.restrictions.length + profile.forbiddenQuestTypes.length} saved limits</p>
        </Panel>
        <Panel>
          <h3>Accessibility</h3>
          <p>{profile.accessibilityNeeds.length === 0 ? "No preferences recorded" : profile.accessibilityNeeds.join(", ")}</p>
        </Panel>
      </CardGrid>
    </section>
  );
}

function observationSummary(observation: SignalObservation): string {
  switch (observation.status) {
    case "known":
      return String(observation.value);
    case "unknown":
      return titleCase(observation.reason);
    case "stale":
    case "unavailable":
      return observation.reason;
  }
}

function IntelligenceSummary({ view }: { readonly view: StreamerViewModel }) {
  const gameplay = view.gameplay;

  return (
    <section aria-labelledby="intelligence-summary-title">
      <div className={styles.sectionHeading}>
        <div>
          <p className={styles.eyebrow}>Plain-language intelligence</p>
          <h2 id="intelligence-summary-title">What ChatXPT can currently observe</h2>
        </div>
        <StatusBadge tone={evidenceBadge(view).tone}>{evidenceBadge(view).label}</StatusBadge>
      </div>
      {gameplay === null ? (
        <Notice tone="warning" title="No gameplay snapshot">
          ChatXPT reports gameplay understanding as unavailable until Game Capture supplies a trusted snapshot.
        </Notice>
      ) : (
        <Card className={styles.intelligenceCard}>
          <ControlRow>
            <div>
              <p className={styles.eyebrow}>Capability tier</p>
              <h3>{titleCase(gameplay.capabilities.tier)}</h3>
            </div>
            <StatusBadge tone="info">{`${gameplay.capabilities.supportedSignals.length} supported signals`}</StatusBadge>
          </ControlRow>
          <div className={styles.signalList}>
            {gameplay.signals.length === 0 ? (
              <p>No observations were supplied.</p>
            ) : gameplay.signals.map((signal) => {
              const status = observationStatus[signal.observation.status];
              const provenance = signal.observation.provenance;
              return (
                <details key={signal.signalId} className={styles.signal}>
                  <summary>
                    <span>
                      <strong>{titleCase(signal.kind)}</strong>
                      <small>{observationSummary(signal.observation)}</small>
                    </span>
                    <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                  </summary>
                  <dl className={styles.metrics}>
                    <Metric label="Method">{titleCase(provenance.method)}</Metric>
                    <Metric label="Source">{titleCase(provenance.source)}</Metric>
                    <Metric label="Confidence">{Math.round(provenance.confidence * 100)}%</Metric>
                    <Metric label="Observed">{checkedAtLabel(provenance.observedAt)}</Metric>
                  </dl>
                </details>
              );
            })}
          </div>
        </Card>
      )}
      <Notice tone="info" title="Quest generation status is not reported yet">
        Quest generation details will appear only when the current session supplies that state.
      </Notice>
    </section>
  );
}

function EmptySnapshot({ loading }: { readonly loading: boolean }) {
  if (loading) {
    return (
      <Card className={styles.emptyState} aria-busy="true">
        <StatusBadge tone="info">Loading authorised status</StatusBadge>
        <h2>Checking your Studio snapshot</h2>
        <p>ChatXPT is waiting for the latest streamer view.</p>
      </Card>
    );
  }

  return (
    <Notice tone="warning" title="No Studio snapshot">
      Setup remains read only. Refresh or reconnect through the approved host instead of creating local readiness state.
    </Notice>
  );
}

export function StudioSetupShell({
  view,
  experience,
  activeStep = "welcome",
  completedSteps = [],
  loading = false,
  reconnecting = false,
  theme = "dark",
  onNavigate,
  onSelectStep,
}: StudioSetupShellProps) {
  const evidence = evidenceBadge(view);
  const title = experience === "first-time"
    ? "Set up ChatXPT without guesswork"
    : `Welcome back${view === null ? "" : `, ${view.profile.displayName}`}`;

  return (
    <DesignSystemRoot theme={theme} className={styles.shell}>
      <Navigation onNavigate={onNavigate} />
      <main className={styles.main}>
        <header className={styles.hero}>
          <div>
            <div className={styles.heroBadges}>
              <StatusBadge tone={evidence.tone}>{evidence.label}</StatusBadge>
            </div>
            <p className={styles.eyebrow}>{experience === "first-time" ? "First-time setup" : "Returning streamer"}</p>
            <h1>{title}</h1>
            <p className={styles.lede}>
              Follow the guided setup, then use the service checklist to resolve the one thing that needs attention next.
            </p>
          </div>
          <div className={styles.heroAction}>
            <Button disabled>Start session</Button>
            <small>Enabled only when readiness passes.</small>
          </div>
        </header>

        {view?.envelope.evidenceClass !== "live" ? (
          <Notice tone="warning" title="Not live workflow evidence">
            This setup view is not connected to the full live Twitch, Game Capture, AI, persistence, and realtime workflow yet.
          </Notice>
        ) : null}
        {reconnecting ? (
          <Notice tone="warning" title="Reconnecting" politeness="polite">
            The last authorised revision remains visible while Studio requests a fresh snapshot. Actions stay unavailable. Revision {view?.session.revision ?? "unknown"}.
          </Notice>
        ) : null}

        <SetupJourney
          activeStep={activeStep}
          completedSteps={completedSteps}
          onSelectStep={onSelectStep}
        />

        {view === null ? (
          <EmptySnapshot loading={loading} />
        ) : (
          <>
            <ServiceChecklist services={view.services} />
            <ProfileSummary view={view} />
            <IntelligenceSummary view={view} />
          </>
        )}
      </main>
    </DesignSystemRoot>
  );
}
