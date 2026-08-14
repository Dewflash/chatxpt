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
  intensity: "Quest intensity",
};

const actionLabels: Readonly<Record<StreamerQuestAction, string>> = {
  approve: "Approve selected",
  reject: "Reject selected",
  start: "Start selected",
  pause: "Pause quest",
  cancel: "Cancel quest",
  skip: "Skip quest",
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
  "end-session": "End session",
  "open-diagnostics": "Open diagnostics",
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

        <SettingGroup title="Challenge preferences" badge="Saved · view only">
          <dl className={styles.definitionList}>
            <div>
              <dt>Prefer</dt>
              <dd>{view.profile.preferredQuestTypes.join(", ") || "No preferred challenge types"}</dd>
            </div>
            <div>
              <dt>Avoid</dt>
              <dd>{view.profile.forbiddenQuestTypes.join(", ") || "No extra forbidden types"}</dd>
            </div>
            <div>
              <dt>Safety limits</dt>
              <dd>{view.profile.restrictions.join(", ") || "Core safety policy only"}</dd>
            </div>
          </dl>
          <p className={styles.contractNote}>Editing waits for the canonical profile-list patch from Role 1.</p>
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
          <p className={styles.contractNote}>These values are persistent, but their update command is not public yet.</p>
        </SettingGroup>

        <SettingGroup title="Voting" badge="Saved default">
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
            <span>Show the authoritative 30-second countdown</span>
          </label>
          <p className={styles.contractNote}>One accepted vote per viewer; vote changes stay off for this MVP.</p>
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
          Values remain read only until the authorised host supplies the canonical command dispatcher.
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
          <strong>{`Quest intensity · ${savedIntensity}%`}</strong>
          <p>Effective source: saved default. No session-only value is present in the current authoritative view.</p>
        </div>
        <div className={styles.buttonRow}>
          <Button variant="secondary" disabled>Change for this session</Button>
          <Button variant="ghost" disabled>Reset to saved</Button>
        </div>
      </Panel>
      <Notice tone="warning" title="Session override contract required">
        The control stays unavailable until Role 1 publishes an effective-value source, session patch, and clear action. Studio will not imitate persistence in browser storage.
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
  const methods = new Set(view.questCycle.options.map((option) => option.generation.method));
  const aiRoute = methods.has("ai-provider")
    ? { badge: "AI route active", tone: "success" as const }
    : methods.has("algorithmic")
      ? { badge: "Algorithmic route", tone: "info" as const }
      : methods.has("deterministic-fallback")
        ? { badge: "Fallback active", tone: "warning" as const }
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
      onAction: action === null ? undefined : () => onCommand?.(
        buildSetupCommand(view, service.service, action, commandFactory),
      ),
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
        <HealthCard {...serviceCard("OBS capture", obs, "OBS permission and source health are unknown.")} />
        <HealthCard
          title="Gameplay understanding"
          badge={gameplayHealth.label}
          tone={gameplayHealth.tone}
          detail={view.gameplay === null
            ? "No authorised gameplay snapshot is available. Manual quest controls remain usable."
            : `${titleCase(view.gameplay.capabilities.tier)} · ${gameplayHealth.knownCount} known, ${gameplayHealth.unknownCount} unknown, ${gameplayHealth.staleCount} stale, ${gameplayHealth.unavailableCount} unavailable of ${gameplayHealth.totalCount} signals.`}
          meta={gameplayMeta}
        />
        <HealthCard
          {...serviceCard("AI intelligence", intelligence, "Intelligence service health is unknown.")}
          badge={aiRoute?.badge ?? (intelligence ? healthLabel(intelligence.health.status) : "Unknown")}
          tone={aiRoute?.tone ?? (intelligence ? healthTone(intelligence.health.status) : "neutral")}
          detail={aiRoute === null
            ? intelligence?.health.message ?? "No candidate-generation route is visible yet."
            : "Provider-neutral generation status; raw model and provider controls stay server-side."}
        />
        <HealthCard {...serviceCard("Realtime", realtime, "Realtime snapshot and recovery state are unknown.")} />
      </CardGrid>
      <p className={styles.sectionNote}>There is no combined readiness percentage. Each layer keeps its own evidence and recovery action.</p>
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
          <p className={styles.eyebrow}>Live quests</p>
          <h2 id="live-quests-heading">Review and recover without hidden authority</h2>
        </div>
        <div className={styles.badgeRow}>
          <StatusBadge tone="info">{titleCase(cycle.status)}</StatusBadge>
          <StatusBadge tone="diagnostic">{`Revision ${cycle.envelope.revision}`}</StatusBadge>
        </div>
      </div>

      {view.emergencyPaused ? (
        <Notice tone="danger" title="Emergency pause is latched" politeness="assertive">
          New intervention stays blocked until the authorised runtime clears the latch.
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
        <Notice title="No authorised three-option proposal">
          Studio will wait for the runtime instead of creating local quest choices.
        </Notice>
      )}

      {cycle.progress ? (
        <Progress
          label={`Authoritative progress · ${titleCase(cycle.progress.method)}`}
          value={cycle.progress.value}
          max={1}
          valueLabel={`${Math.round(cycle.progress.value * 100)}%`}
        />
      ) : null}

      {cycle.status === "active" && cycle.completionRule?.mode === "manual" ? (
        <Panel className={styles.manualPanel}>
          <RangeSetting
            label="Manual quest progress"
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
          This changes the authoritative quest outcome. The current quest stays unchanged until you confirm.
          <div className={styles.noticeAction}>
            <Button variant="danger" disabled={pending} onClick={() => emitAction(confirmAction)}>
              Confirm {actionLabels[confirmAction].toLocaleLowerCase()}
            </Button>
            <Button variant="ghost" onClick={() => setConfirmAction(null)}>Keep current quest</Button>
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
          <a href="#health-recovery-heading">Health &amp; recovery</a>
          <a href="#live-quests-heading">Live quests</a>
        </nav>
        <p>Full management lives here. Twitch Live Config stays compact for stream-time control.</p>
      </aside>

      <main className={styles.main}>
        <header className={styles.hero}>
          <div>
            <div className={styles.badgeRow}>
              <StatusBadge tone={view.envelope.evidenceClass === "live" ? "success" : "diagnostic"}>
                {view.envelope.evidenceClass === "live" ? "Live authorised data" : `${titleCase(view.envelope.evidenceClass)} data`}
              </StatusBadge>
              <StatusBadge tone={view.session.status === "live" ? "success" : "neutral"}>{titleCase(view.session.status)}</StatusBadge>
              <StatusBadge tone="diagnostic">{`Revision ${view.envelope.revision}`}</StatusBadge>
            </div>
            <p className={styles.eyebrow}>Returning streamer workspace</p>
            <h1>{`Welcome back, ${view.profile.displayName}`}</h1>
            <p>Saved preferences return every session; temporary live changes remain visibly separate.</p>
          </div>
          <Panel className={styles.heroGame}>
            <small>Selected game profile</small>
            <strong>{view.profile.gameName ?? "No game selected"}</strong>
            <span>{view.gameplay ? titleCase(view.gameplay.capabilities.tier) : "Gameplay signals unknown"}</span>
          </Panel>
        </header>

        {view.envelope.evidenceClass !== "live" ? (
          <Notice tone="warning" title="Not live workflow evidence">
            This management surface is rendering {view.envelope.evidenceClass} data. It does not prove real Twitch, OBS, AI, persistence, or realtime behaviour.
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
      </main>
    </DesignSystemRoot>
  );
}
