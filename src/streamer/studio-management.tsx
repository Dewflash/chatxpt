"use client";

import { useMemo, useState, type ReactNode } from "react";

import {
  Button,
  Card,
  CardGrid,
  ControlRow,
  DesignSystemRoot,
  Notice,
  Panel,
  Progress,
  StatusBadge,
  type DesignSystemTheme,
  type StatusTone,
} from "../design-system";
import type {
  QuestCandidate,
  ServiceHealth,
  StreamerQuestAction,
  StreamerReadinessView,
  StreamerSetupAction,
  StreamerSetupService,
  StreamerSetupServiceId,
  StreamerViewModel,
} from "../core";
import {
  buildEmergencyClearCommand,
  buildProfileSettingsCommand,
  buildQuestCommand,
  buildQuestProgressCommand,
  buildSetupCommand,
  defaultStreamerCommandFactory,
  editableDefaultsFromView,
  profileDefaultsChanged,
  type EditableProfileDefaults,
  type StreamerCommandFactory,
  type StreamerUiCommand,
} from "./streamer-commands";
import { summarizeGameplayHealth } from "./gameplay-health";
import { LiveDirectorControls } from "./live-director-controls";
import { summarizeQuestGeneration } from "./quest-generation-health";

import styles from "./studio-management.module.css";

export interface StudioManagementSurfaceProps {
  readonly view: StreamerViewModel | null;
  readonly readiness?: StreamerReadinessView | null;
  readonly theme?: DesignSystemTheme;
  readonly pendingCommandId?: string | null;
  readonly commandMessage?: string | null;
  readonly onCommand?: (command: StreamerUiCommand) => void;
  readonly commandFactory?: StreamerCommandFactory;
}

const experienceLabels: Readonly<Record<string, string>> = {
  creativity: "Personality: playful creativity",
  intensity: "Sidequest intensity",
};

const actionLabels: Readonly<Record<StreamerQuestAction, string>> = {
  approve: "Approve selected",
  reject: "Reject selected",
  start: "Start selected",
  pause: "Pause sidequest",
  cancel: "Cancel sidequest",
  skip: "Skip sidequest",
  succeed: "Mark succeeded",
  fail: "Mark failed",
  "emergency-pause": "Emergency pause",
};

const setupActionLabels: Readonly<Record<StreamerSetupAction, string>> = {
  "connect-twitch": "Connect Twitch",
  "install-extension": "Install Extension",
  "select-capture-source": "Select capture source",
  "request-capture-permission": "Allow capture",
  "retry-service": "Retry check",
  "start-session": "Start session",
  "end-session": "End session & reset",
  "open-diagnostics": "Review setup details",
};

const destructiveActions = new Set<StreamerQuestAction>(["cancel", "skip", "fail"]);
const candidateActions = new Set<StreamerQuestAction>(["approve", "reject", "start"]);

function titleCase(value: string): string {
  return value
    .split(/[-_]/u)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function healthTone(status: ServiceHealth["status"]): StatusTone {
  if (status === "ready") return "success";
  if (status === "degraded" || status === "misconfigured") return "warning";
  return "danger";
}

function healthLabel(status: ServiceHealth["status"]): string {
  const labels: Readonly<Record<ServiceHealth["status"], string>> = {
    ready: "Healthy",
    degraded: "Degraded",
    unavailable: "Unavailable",
    "permission-denied": "Permission denied",
    misconfigured: "Needs setup",
  };
  return labels[status];
}

function findReadinessService(
  readiness: StreamerReadinessView | null | undefined,
  id: StreamerSetupServiceId,
): StreamerSetupService | null {
  return readiness?.services.find((service) => service.service === id) ?? null;
}

function recoveryAction(
  service: StreamerSetupService,
  recommended: StreamerSetupAction | null | undefined,
): StreamerSetupAction | null {
  if (recommended !== null && recommended !== undefined && service.allowedActions.includes(recommended)) {
    return recommended;
  }
  return service.allowedActions[0] ?? null;
}

function SettingGroup({ title, badge, children }: {
  readonly title: string;
  readonly badge: string;
  readonly children: ReactNode;
}) {
  return (
    <Card className={styles.settingCard}>
      <ControlRow>
        <h3>{title}</h3>
        <StatusBadge tone="neutral">{badge}</StatusBadge>
      </ControlRow>
      {children}
    </Card>
  );
}

function RangeSetting({
  label,
  value,
  disabled,
  onChange,
}: {
  readonly label: string;
  readonly value: number;
  readonly disabled: boolean;
  readonly onChange: (value: number) => void;
}) {
  const percentage = Math.round(value * 100);
  return (
    <label className={styles.rangeField}>
      <span>
        <strong>{label}</strong>
        <output>{percentage}%</output>
      </span>
      <input
        type="range"
        min="0"
        max="1"
        step="0.05"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
      />
    </label>
  );
}

function SavedDefaultsEditor({
  view,
  onCommand,
  commandFactory,
  pending,
}: {
  readonly view: StreamerViewModel;
  readonly onCommand?: (command: StreamerUiCommand) => void;
  readonly commandFactory: StreamerCommandFactory;
  readonly pending: boolean;
}) {
  const saved = useMemo(() => editableDefaultsFromView(view), [view]);
  const [draft, setDraft] = useState<EditableProfileDefaults>(saved);

  const experienceKeys = useMemo(
    () => Array.from(new Set(["creativity", "intensity", ...Object.keys(draft.experience)])),
    [draft.experience],
  );
  const changed = profileDefaultsChanged(saved, draft);
  const editable = onCommand !== undefined;

  function updateExperience(key: string, value: number) {
    setDraft((current) => ({
      ...current,
      experience: { ...current.experience, [key]: value },
    }));
  }

  return (
    <section className={styles.section} aria-labelledby="profile-defaults-heading">
      <div className={styles.sectionHeading}>
        <div>
          <p className={styles.eyebrow}>Profile &amp; defaults</p>
          <h2 id="profile-defaults-heading">Set once, reuse next stream</h2>
        </div>
        <StatusBadge tone="success">{`Saved profile · revision ${view.profile.revision}`}</StatusBadge>
      </div>

      <CardGrid className={styles.settingsGrid}>
        <SettingGroup title="Streamer personality" badge="Saved default">
          <div className={styles.fieldStack}>
            {experienceKeys.map((key) => (
              <RangeSetting
                key={key}
                label={experienceLabels[key] ?? titleCase(key)}
                value={draft.experience[key] ?? 0.5}
                disabled={!editable || pending}
                onChange={(value) => updateExperience(key, value)}
              />
            ))}
          </div>
        </SettingGroup>

        <SettingGroup title="Sidequest preferences" badge="Saved · view only">
          <dl className={styles.definitionList}>
            <div>
              <dt>Prefer</dt>
              <dd>{view.profile.preferredQuestTypes.join(", ") || "No preferred sidequest types"}</dd>
            </div>
            <div>
              <dt>Avoid</dt>
              <dd>{view.profile.forbiddenQuestTypes.join(", ") || "No extra forbidden sidequest types"}</dd>
            </div>
            <div>
              <dt>Safety limits</dt>
              <dd>{view.profile.restrictions.join(", ") || "Core safety policy only"}</dd>
            </div>
          </dl>
          <p className={styles.contractNote}>List persistence uses the canonical profile settings command; full list editing remains unavailable in this pass.</p>
        </SettingGroup>

        <SettingGroup title="Game & accessibility" badge="Saved · view only">
          <dl className={styles.definitionList}>
            <div>
              <dt>Game profile</dt>
              <dd>{view.profile.gameName ?? "No game selected"}</dd>
            </div>
            <div>
              <dt>Accessibility</dt>
              <dd>{view.profile.accessibilityNeeds.join(", ") || "No saved preferences"}</dd>
            </div>
          </dl>
          <p className={styles.contractNote}>These saved values are visible here; their update command is not public yet.</p>
        </SettingGroup>

        <SettingGroup title="Voting" badge="Saved default">
          <label className={styles.selectField}>
            <span>Voting window</span>
            <select
              value={String(draft.voting.voteDurationSeconds)}
              disabled={!editable || pending}
              onChange={(event) => setDraft((current) => ({
                ...current,
                voting: {
                  ...current.voting,
                  voteDurationSeconds: Number(event.currentTarget.value) as 30 | 60,
                },
              }))}
            >
              <option value="30">30 seconds</option>
              <option value="60">60 seconds</option>
            </select>
          </label>
          <label className={styles.selectField}>
            <span>After viewers choose a winner</span>
            <select
              value={draft.voting.winnerActivationMode}
              disabled={!editable || pending}
              onChange={(event) => setDraft((current) => ({
                ...current,
                voting: {
                  ...current.voting,
                  winnerActivationMode: event.currentTarget.value as typeof current.voting.winnerActivationMode,
                },
              }))}
            >
              <option value="automatic">Show winner for 10 seconds, then start</option>
              <option value="streamer-approval">Wait for streamer approval</option>
            </select>
          </label>
          <label className={styles.selectField}>
            <span>Vote visibility</span>
            <select
              value={draft.voting.voteVisibility}
              disabled={!editable || pending}
              onChange={(event) => setDraft((current) => ({
                ...current,
                voting: { ...current.voting, voteVisibility: event.currentTarget.value as typeof current.voting.voteVisibility },
              }))}
            >
              <option value="live-tally">Show live tally</option>
              <option value="hidden-until-close">Hide until close</option>
            </select>
          </label>
          <label className={styles.checkboxField}>
            <input
              type="checkbox"
              checked={draft.voting.showCountdown}
              disabled={!editable || pending}
              onChange={(event) => setDraft((current) => ({
                ...current,
                voting: { ...current.voting, showCountdown: event.currentTarget.checked },
              }))}
            />
            <span>Show the official voting countdown</span>
          </label>
          <p className={styles.contractNote}>The winner is always shown before activation. One accepted vote per viewer; vote changes stay off for this MVP.</p>
        </SettingGroup>

        <SettingGroup title="Rewards" badge="Saved default">
          <label className={styles.selectField}>
            <span>Viewer reward display</span>
            <select
              value={draft.rewards.rewardDisplay}
              disabled={!editable || pending}
              onChange={(event) => setDraft((current) => ({
                ...current,
                rewards: { ...current.rewards, rewardDisplay: event.currentTarget.value as typeof current.rewards.rewardDisplay },
              }))}
            >
              <option value="session-points">Session points</option>
              <option value="community-hype">Community hype</option>
              <option value="session-points-and-hype">Points and hype</option>
            </select>
          </label>
          <label className={styles.checkboxField}>
            <input
              type="checkbox"
              checked={draft.rewards.showRewardPreview}
              disabled={!editable || pending}
              onChange={(event) => setDraft((current) => ({
                ...current,
                rewards: { ...current.rewards, showRewardPreview: event.currentTarget.checked },
              }))}
            />
            <span>Preview non-monetary rewards before voting</span>
          </label>
          <p className={styles.contractNote}>No money, wagering, or persistent economy controls are exposed.</p>
        </SettingGroup>
      </CardGrid>

      <ControlRow className={styles.saveRow}>
        <p>{changed ? "Unsaved supported defaults" : "Supported defaults match the saved profile"}</p>
        <div className={styles.buttonRow}>
          <Button
            variant="secondary"
            disabled={!changed || pending}
            onClick={() => setDraft(saved)}
          >
            Reset changes
          </Button>
          <Button
            loading={pending}
            disabled={!changed || !editable}
            onClick={() => onCommand?.(buildProfileSettingsCommand(view, draft, commandFactory))}
          >
            Save supported defaults
          </Button>
        </div>
      </ControlRow>

      {!editable ? (
        <Notice tone="warning" title="Profile actions are not mounted">
          Values remain read only until the secure Studio action handler is available.
        </Notice>
      ) : null}
    </section>
  );
}

function SessionOverridePanel({ view }: { readonly view: StreamerViewModel }) {
  const savedIntensity = Math.round((view.profile.experience.intensity ?? 0.5) * 100);
  return (
    <section className={styles.section} aria-labelledby="session-overrides-heading">
      <div className={styles.sectionHeading}>
        <div>
          <p className={styles.eyebrow}>This session</p>
          <h2 id="session-overrides-heading">Temporary overrides never rewrite defaults</h2>
        </div>
        <StatusBadge tone="info">Follows saved defaults</StatusBadge>
      </div>
      <Panel className={styles.overridePanel}>
        <div>
          <strong>{`Sidequest intensity · ${savedIntensity}%`}</strong>
          <p>Effective source: saved default. No session-only value is present for this stream.</p>
        </div>
        <div className={styles.buttonRow}>
          <Button variant="secondary" disabled>Change for this session</Button>
          <Button variant="ghost" disabled>Reset to saved</Button>
        </div>
      </Panel>
      <Notice tone="warning" title="Session override contract required">
        This control stays unavailable until current-stream changes and reset actions are connected. Studio will not imitate persistence in browser storage.
      </Notice>
    </section>
  );
}

interface HealthCardProps {
  readonly title: string;
  readonly badge: string;
  readonly tone: StatusTone;
  readonly detail: string;
  readonly meta?: string;
  readonly action?: StreamerSetupAction | null;
  readonly disabled?: boolean;
  readonly onAction?: () => void;
}

function HealthCard({ title, badge, tone, detail, meta, action, disabled, onAction }: HealthCardProps) {
  return (
    <Card className={styles.healthCard}>
      <ControlRow>
        <h3>{title}</h3>
        <StatusBadge tone={tone}>{badge}</StatusBadge>
      </ControlRow>
      <p>{detail}</p>
      {meta ? <small>{meta}</small> : null}
      {action ? (
        <Button variant="secondary" disabled={disabled} onClick={onAction}>
          {setupActionLabels[action]}
        </Button>
      ) : null}
    </Card>
  );
}

function HealthAndRecovery({
  view,
  readiness,
  onCommand,
  commandFactory,
  pending,
}: {
  readonly view: StreamerViewModel;
  readonly readiness?: StreamerReadinessView | null;
  readonly onCommand?: (command: StreamerUiCommand) => void;
  readonly commandFactory: StreamerCommandFactory;
  readonly pending: boolean;
}) {
  const twitch = findReadinessService(readiness, "twitch");
  const obs = findReadinessService(readiness, "obs-capture");
  const intelligence = findReadinessService(readiness, "intelligence");
  const realtime = findReadinessService(readiness, "realtime");
  const gameplayHealth = summarizeGameplayHealth(view.gameplay);
  const gameplayMeta = gameplayHealth.permissionDeniedCount > 0
    ? `${gameplayHealth.permissionDeniedCount} observation blocked by capture permission`
    : gameplayHealth.unavailableCount > 0
      ? `${gameplayHealth.unavailableCount} unavailable observation kept unknown`
      : gameplayHealth.staleCount > 0
        ? `${gameplayHealth.staleCount} stale observation not treated as current`
        : gameplayHealth.averageKnownConfidence === null
          ? "Unsupported facts remain unknown"
          : `${Math.round(gameplayHealth.averageKnownConfidence * 100)}% average known-signal confidence`;
  const generation = view.questCycle.options.length > 0
    ? summarizeQuestGeneration(view.questCycle.options)
    : null;

  function serviceCard(
    title: string,
    service: StreamerSetupService | null,
    fallback: string,
  ): HealthCardProps {
    if (service === null) {
      return { title, badge: "Unknown", tone: "neutral", detail: fallback };
    }
    const action = recoveryAction(service, readiness?.recommendedAction);
    return {
      title,
      badge: healthLabel(service.health.status),
      tone: healthTone(service.health.status),
      detail: service.health.message ?? "No additional health detail was supplied.",
      meta: service.configured ? "Configured" : "Configuration incomplete",
      action,
      disabled: onCommand === undefined || pending,
      onAction: action === null
        ? undefined
        : () => onCommand?.(buildSetupCommand(view, service.service, action, commandFactory)),
    };
  }

  return (
    <section className={styles.section} aria-labelledby="health-recovery-heading">
      <div className={styles.sectionHeading}>
        <div>
          <p className={styles.eyebrow}>Health &amp; recovery</p>
          <h2 id="health-recovery-heading">See the exact degraded layer</h2>
        </div>
        <StatusBadge tone={readiness?.ready ? "success" : readiness ? "warning" : "neutral"}>
          {readiness?.label ?? "Readiness not supplied"}
        </StatusBadge>
      </div>
      <CardGrid className={styles.healthGrid}>
        <HealthCard {...serviceCard("Twitch", twitch, "Twitch setup health is not in this snapshot.")} />
        <HealthCard {...serviceCard("Gameplay Capture", obs, "Capture permission and source health are unknown.")} />
        <HealthCard
          title="Signal Confidence"
          badge={gameplayHealth.label}
          tone={gameplayHealth.tone}
          detail={view.gameplay === null
            ? "No current gameplay snapshot is available. Manual sidequest controls remain usable."
            : `${titleCase(view.gameplay.capabilities.tier)} · ${gameplayHealth.knownCount} observed, ${gameplayHealth.unknownCount} unknown, ${gameplayHealth.staleCount} stale, ${gameplayHealth.unavailableCount} unavailable of ${gameplayHealth.totalCount} Detected Game Facts.`}
          meta={gameplayMeta}
        />
        <HealthCard
          {...serviceCard("Sidequest generation", intelligence, "Sidequest-generation health is unknown.")}
          badge={generation?.label ?? (intelligence ? healthLabel(intelligence.health.status) : "Unknown")}
          tone={generation?.tone ?? (intelligence ? healthTone(intelligence.health.status) : "neutral")}
          detail={generation === null
            ? intelligence?.health.message ?? "No candidate-generation route is visible yet."
            : `${generation.detail} Generation details stay server-side.`}
        />
        <HealthCard {...serviceCard("Realtime", realtime, "Realtime snapshot and recovery state are unknown.")} />
      </CardGrid>
      <p className={styles.sectionNote}>There is no combined readiness percentage. Each layer keeps its own status and recovery action.</p>
    </section>
  );
}

function TestLab({
  view,
  onCommand,
  commandFactory,
  pending,
}: {
  readonly view: StreamerViewModel;
  readonly onCommand?: (command: StreamerUiCommand) => void;
  readonly commandFactory: StreamerCommandFactory;
  readonly pending: boolean;
}) {
  function resetSession() {
    if (!globalThis.confirm("End this ChatXPT session and return Studio to a clean start?")) return;
    onCommand?.(buildSetupCommand(view, "session", "end-session", commandFactory));
  }

  return (
    <section className={styles.section} aria-labelledby="test-lab-heading">
      <div className={styles.sectionHeading}>
        <div>
          <p className={styles.eyebrow}>Test Lab</p>
          <h2 id="test-lab-heading">Reset the app for a clean-start test</h2>
        </div>
        <StatusBadge tone="diagnostic">Testing control</StatusBadge>
      </div>
      <Card className={styles.testLabCard}>
        <div>
          <h3>Clean-start reset</h3>
          <p>
            Ends the current ChatXPT session, clears this browser&apos;s Studio session, and returns
            to the starting screen. Your Twitch connection and permanent OBS Browser Source URL
            stay linked to the broadcaster.
          </p>
        </div>
        <Button
          variant="danger"
          disabled={onCommand === undefined || pending || view.session.status !== "live"}
          onClick={resetSession}
        >
          {pending ? "Resetting…" : "End session & reset"}
        </Button>
      </Card>
    </section>
  );
}

function QuestOption({
  option,
  selected,
  votes,
  onSelect,
}: {
  readonly option: QuestCandidate;
  readonly selected: boolean;
  readonly votes: number;
  readonly onSelect: () => void;
}) {
  return (
    <Card className={styles.questCard} ribbon={selected ? "selected" : undefined}>
      <label className={styles.questChoice}>
        <input type="radio" name="studio-quest-choice" checked={selected} onChange={onSelect} />
        <span>
          <strong>{option.title}</strong>
          <small>{option.instruction}</small>
        </span>
      </label>
      <div className={styles.badgeRow}>
        <StatusBadge tone="info">{titleCase(option.difficulty)}</StatusBadge>
        <StatusBadge tone="neutral">{`${option.durationSeconds}s`}</StatusBadge>
        <StatusBadge tone="success">{`${option.rewardPoints} pts`}</StatusBadge>
        <StatusBadge tone="diagnostic">{`${votes} votes`}</StatusBadge>
      </div>
      <p className={styles.rationale}>{option.rationale}</p>
    </Card>
  );
}

function QuestManagement({
  view,
  onCommand,
  commandFactory,
  pending,
}: {
  readonly view: StreamerViewModel;
  readonly onCommand?: (command: StreamerUiCommand) => void;
  readonly commandFactory: StreamerCommandFactory;
  readonly pending: boolean;
}) {
  const cycle = view.questCycle;
  const defaultCandidate = cycle.activeCandidateId ?? cycle.options[0]?.candidateId ?? null;
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(defaultCandidate);
  const [confirmAction, setConfirmAction] = useState<StreamerQuestAction | null>(null);
  const [manualProgress, setManualProgress] = useState(cycle.progress?.value ?? 0);

  function emitAction(action: StreamerQuestAction) {
    const candidateId = candidateActions.has(action) ? selectedCandidateId : null;
    onCommand?.(buildQuestCommand(view, action, candidateId, commandFactory));
    setConfirmAction(null);
  }

  function requestAction(action: StreamerQuestAction) {
    if (destructiveActions.has(action)) {
      setConfirmAction(action);
      return;
    }
    emitAction(action);
  }

  const regularActions = cycle.availableStreamerActions.filter((action) => action !== "emergency-pause");

  return (
    <section className={styles.section} aria-labelledby="live-quests-heading">
      <div className={styles.sectionHeading}>
        <div>
          <p className={styles.eyebrow}>Live sidequests</p>
          <h2 id="live-quests-heading">Review and recover from the latest stream state</h2>
        </div>
        <div className={styles.badgeRow}>
          <StatusBadge tone="info">{titleCase(cycle.status)}</StatusBadge>
          <StatusBadge tone="neutral">Synced state</StatusBadge>
        </div>
      </div>

      {view.emergencyPaused ? (
        <Notice tone="danger" title="Emergency pause is latched" politeness="assertive">
          New sidequests stay blocked until emergency pause is cleared.
          <div className={styles.noticeAction}>
            <Button
              variant="secondary"
              disabled={onCommand === undefined || pending}
              onClick={() => onCommand?.(buildEmergencyClearCommand(view, commandFactory))}
            >
              Clear emergency pause
            </Button>
          </div>
        </Notice>
      ) : null}

      {cycle.options.length === 3 ? (
        <CardGrid className={styles.questGrid}>
          {cycle.options.map((option) => (
            <QuestOption
              key={option.candidateId}
              option={option}
              selected={option.candidateId === selectedCandidateId}
              votes={cycle.voteTallies.find((tally) => tally.candidateId === option.candidateId)?.votes ?? 0}
              onSelect={() => setSelectedCandidateId(option.candidateId)}
            />
          ))}
        </CardGrid>
      ) : (
        <Notice title="No three-option sidequest proposal">
          Studio will wait for ChatXPT instead of creating local sidequest choices.
        </Notice>
      )}

      {cycle.status === "selected" ? (
        <Notice title="Audience winner selected" tone="info" politeness="polite">
          {cycle.endsAt === null
            ? "Review the winning option, then choose Start when you are ready."
            : "The winning option will start automatically after its 10-second reveal."}
        </Notice>
      ) : null}

      {cycle.progress ? (
        <Progress
          label={`Sidequest progress · ${titleCase(cycle.progress.method)}`}
          value={cycle.progress.value}
          max={1}
          valueLabel={`${Math.round(cycle.progress.value * 100)}%`}
        />
      ) : null}

      {cycle.status === "active" && cycle.completionRule?.mode === "manual" ? (
        <Panel className={styles.manualPanel}>
          <RangeSetting
            label="Manual sidequest progress"
            value={manualProgress}
            disabled={onCommand === undefined || pending}
            onChange={setManualProgress}
          />
          <Button
            variant="secondary"
            disabled={onCommand === undefined || pending || manualProgress === (cycle.progress?.value ?? 0)}
            onClick={() => onCommand?.(buildQuestProgressCommand(view, manualProgress, commandFactory))}
          >
            Update progress
          </Button>
        </Panel>
      ) : null}

      <ControlRow className={styles.questActions}>
        <div className={styles.buttonRow}>
          {regularActions.map((action) => (
            <Button
              key={action}
              variant={destructiveActions.has(action) ? "danger" : action === "approve" || action === "start" ? "primary" : "secondary"}
              disabled={onCommand === undefined || pending || (candidateActions.has(action) && selectedCandidateId === null)}
              onClick={() => requestAction(action)}
            >
              {actionLabels[action]}
            </Button>
          ))}
        </div>
        {cycle.availableStreamerActions.includes("emergency-pause") ? (
          <Button
            variant="danger"
            disabled={onCommand === undefined || pending}
            onClick={() => emitAction("emergency-pause")}
          >
            Emergency pause
          </Button>
        ) : null}
      </ControlRow>

      {confirmAction ? (
        <Notice tone="danger" title={`Confirm ${actionLabels[confirmAction].toLocaleLowerCase()}`} politeness="assertive">
          This changes the current sidequest outcome. The sidequest stays unchanged until you confirm.
          <div className={styles.noticeAction}>
            <Button variant="danger" disabled={pending} onClick={() => emitAction(confirmAction)}>
              Confirm {actionLabels[confirmAction].toLocaleLowerCase()}
            </Button>
            <Button variant="ghost" onClick={() => setConfirmAction(null)}>Keep current sidequest</Button>
          </div>
        </Notice>
      ) : null}
    </section>
  );
}

export function StudioManagementSurface({
  view,
  readiness,
  theme = "dark",
  pendingCommandId = null,
  commandMessage = null,
  onCommand,
  commandFactory = defaultStreamerCommandFactory,
}: StudioManagementSurfaceProps) {
  if (view === null) {
    return (
      <DesignSystemRoot theme={theme} className={styles.surface}>
        <main className={styles.emptyShell}>
          <Notice title="Loading authorised Studio state" politeness="polite">
            Saved defaults, health, session overrides, and controls remain unavailable until the streamer view loads.
          </Notice>
        </main>
      </DesignSystemRoot>
    );
  }

  const pending = pendingCommandId !== null;

  return (
    <DesignSystemRoot theme={theme} className={styles.surface}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <span aria-hidden="true">CX</span>
          <div>
            <strong>ChatXPT</strong>
            <small>Streamer Studio</small>
          </div>
        </div>
        <nav aria-label="Studio management sections">
          <a href="#profile-defaults-heading">Profile &amp; defaults</a>
          <a href="#session-overrides-heading">This session</a>
          <a href="#live-director-heading">Live Director</a>
          <a href="#health-recovery-heading">Health &amp; recovery</a>
          <a href="#live-quests-heading">Live sidequests</a>
          <a href="#test-lab-heading">Test Lab</a>
        </nav>
        <p>Full management lives here. Twitch Live Config stays compact for stream-time control.</p>
      </aside>

      <main className={styles.main}>
        <header className={styles.hero}>
          <div>
            <div className={styles.badgeRow}>
              <StatusBadge tone={view.envelope.evidenceClass === "live" ? "success" : "warning"}>
                {view.envelope.evidenceClass === "live" ? "Live session mode" : "Live connection not confirmed"}
              </StatusBadge>
              <StatusBadge tone={view.session.status === "live" ? "success" : "neutral"}>{titleCase(view.session.status)}</StatusBadge>
            </div>
            <p className={styles.eyebrow}>Returning streamer workspace</p>
            <h1>{`Welcome back, ${view.profile.displayName}`}</h1>
            <p>Saved preferences return every session; temporary live changes remain visibly separate.</p>
          </div>
          <Panel className={styles.heroGame}>
            <small>Selected game profile</small>
            <strong>{view.profile.gameName ?? "No game selected"}</strong>
            <span>{view.gameplay ? titleCase(view.gameplay.capabilities.tier) : "Gameplay Activity unknown"}</span>
          </Panel>
        </header>

        {view.envelope.evidenceClass !== "live" ? (
          <Notice tone="warning" title="Live connection not confirmed">
            This view is not connected to the full live Twitch, Game Capture, intelligence, persistence, and realtime workflow yet.
          </Notice>
        ) : null}

        {commandMessage ? (
          <Notice tone="info" title="Command update" politeness="polite">{commandMessage}</Notice>
        ) : null}

        <SavedDefaultsEditor
          key={`${view.profile.profileId}:${view.profile.revision}`}
          view={view}
          onCommand={onCommand}
          commandFactory={commandFactory}
          pending={pending}
        />
        <SessionOverridePanel view={view} />
        <section className={styles.section} aria-labelledby="live-director-heading">
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.eyebrow}>Private Live Director</p>
              <h2 id="live-director-heading">Direct the moment from the latest stream context</h2>
            </div>
            <StatusBadge tone="diagnostic">Broadcaster only</StatusBadge>
          </div>
          <LiveDirectorControls
            view={view}
            pending={pending}
            onCommand={onCommand}
            commandFactory={commandFactory}
          />
        </section>
        <HealthAndRecovery
          view={view}
          readiness={readiness}
          onCommand={onCommand}
          commandFactory={commandFactory}
          pending={pending}
        />
        <QuestManagement
          key={`${view.questCycle.envelope.questCycleId ?? "no-cycle"}:${view.questCycle.envelope.revision}`}
          view={view}
          onCommand={onCommand}
          commandFactory={commandFactory}
          pending={pending}
        />
        <TestLab
          view={view}
          onCommand={onCommand}
          commandFactory={commandFactory}
          pending={pending}
        />
      </main>
    </DesignSystemRoot>
  );
}
