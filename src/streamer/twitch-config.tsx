"use client";

import { useState } from "react";

import {
  Button,
  Card,
  ControlRow,
  DesignSystemRoot,
  Notice,
  Panel,
  Progress,
  StatusBadge,
  type StatusTone,
} from "../design-system";
import type {
  ServiceHealth,
  StreamerQuestAction,
  StreamerReadinessView,
  StreamerSetupAction,
  StreamerSetupService,
  StreamerViewModel,
} from "../core";
import {
  buildEmergencyClearCommand,
  buildQuestCommand,
  buildQuestProgressCommand,
  buildSetupCommand,
  defaultStreamerCommandFactory,
  type StreamerCommandFactory,
  type StreamerUiCommand,
} from "./streamer-commands";
import { summarizeGameplayHealth } from "./gameplay-health";
import { LiveDirectorControls } from "./live-director-controls";
import { summarizeQuestGeneration } from "./quest-generation-health";

import styles from "./twitch-config.module.css";

interface TwitchSurfaceProps {
  readonly view: StreamerViewModel | null;
  readonly readiness?: StreamerReadinessView | null;
  readonly studioHref?: string;
  readonly popoutHref?: string;
  readonly pendingCommandId?: string | null;
  readonly commandMessage?: string | null;
  readonly onCommand?: (command: StreamerUiCommand) => void;
  readonly commandFactory?: StreamerCommandFactory;
}

export type TwitchConfigSurfaceProps = TwitchSurfaceProps;
export type TwitchLiveConfigSurfaceProps = TwitchSurfaceProps;

const setupLabels: Readonly<Partial<Record<StreamerSetupAction, string>>> = {
  "connect-twitch": "Connect Twitch",
  "install-extension": "Install Extension",
  "retry-service": "Retry setup",
  "open-diagnostics": "Open diagnostics",
};

const questLabels: Readonly<Record<StreamerQuestAction, string>> = {
  approve: "Approve",
  reject: "Reject",
  start: "Start",
  pause: "Pause",
  cancel: "Cancel",
  skip: "Skip",
  succeed: "Succeeded",
  fail: "Failed",
  "emergency-pause": "Emergency pause",
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

function serviceTone(status: ServiceHealth["status"]): StatusTone {
  if (status === "ready") return "success";
  if (status === "degraded" || status === "misconfigured") return "warning";
  return "danger";
}

function readinessService(
  readiness: StreamerReadinessView | null | undefined,
  id: StreamerSetupService["service"],
): StreamerSetupService | null {
  return readiness?.services.find((service) => service.service === id) ?? null;
}

function preferredAction(
  service: StreamerSetupService,
  recommended: StreamerSetupAction | null | undefined,
): StreamerSetupAction | null {
  if (recommended && service.allowedActions.includes(recommended)) return recommended;
  return service.allowedActions.find((action) => action in setupLabels) ?? null;
}

function CompactHeader({
  eyebrow,
  title,
  view,
}: {
  readonly eyebrow: string;
  readonly title: string;
  readonly view: StreamerViewModel | null;
}) {
  return (
    <header className={styles.header}>
      <div>
        <p className={styles.eyebrow}>{eyebrow}</p>
        <h1>{title}</h1>
      </div>
      <div className={styles.badges}>
        <StatusBadge tone={view?.session.status === "live" ? "success" : "neutral"}>
          {view ? titleCase(view.session.status) : "Loading"}
        </StatusBadge>
        {view ? <StatusBadge tone="diagnostic">{`Rev ${view.envelope.revision}`}</StatusBadge> : null}
        {view && view.envelope.evidenceClass !== "live" ? (
          <StatusBadge tone="diagnostic">{`${titleCase(view.envelope.evidenceClass)} data`}</StatusBadge>
        ) : null}
      </div>
    </header>
  );
}

function OpenStudioLink({ href }: { readonly href: string }) {
  return <a className={styles.studioLink} href={href} target="_blank" rel="noreferrer">Open full Studio</a>;
}

export function TwitchConfigSurface({
  view,
  readiness,
  studioHref = "/",
  pendingCommandId = null,
  commandMessage = null,
  onCommand,
  commandFactory = defaultStreamerCommandFactory,
}: TwitchConfigSurfaceProps) {
  const twitch = readinessService(readiness, "twitch");
  const action = twitch ? preferredAction(twitch, readiness?.recommendedAction) : null;

  return (
    <DesignSystemRoot theme="twitch" density="compact" className={styles.surface}>
      <main className={styles.shell}>
        <CompactHeader eyebrow="Twitch Config" title="Install once, manage in Studio" view={view} />

        {view === null ? (
          <Notice title="Loading channel setup" politeness="polite">
            Waiting for an authorised broadcaster snapshot.
          </Notice>
        ) : (
          <>
            <Card className={styles.statusCard}>
              <ControlRow>
                <div>
                  <small>Channel connection</small>
                  <h2>Twitch Extension</h2>
                </div>
                <StatusBadge tone={twitch ? serviceTone(twitch.health.status) : "neutral"}>
                  {twitch ? titleCase(twitch.health.status) : "Unknown"}
                </StatusBadge>
              </ControlRow>
              <p>{twitch?.health.message ?? "Twitch installation readiness was not supplied."}</p>
              {action ? (
                <Button
                  disabled={onCommand === undefined || pendingCommandId !== null}
                  loading={pendingCommandId !== null}
                  onClick={() => onCommand?.(buildSetupCommand(view, twitch!.service, action, commandFactory))}
                >
                  {setupLabels[action] ?? titleCase(action)}
                </Button>
              ) : null}
            </Card>

            <Panel className={styles.summary}>
              <div>
                <small>Saved streamer</small>
                <strong>{view.profile.displayName}</strong>
              </div>
              <div>
                <small>Game profile</small>
                <strong>{view.profile.gameName ?? "Not selected"}</strong>
              </div>
              <div>
                <small>Default intensity</small>
                <strong>{`${Math.round((view.profile.experience.intensity ?? 0.5) * 100)}%`}</strong>
              </div>
            </Panel>

            <Notice title="Configuration stays focused">
              Full personality, safety, accessibility, game, voting, reward, testing, and recovery settings live in Studio. No viewer-personality profile is stored here.
            </Notice>
          </>
        )}

        {commandMessage ? <Notice title="Setup update" politeness="polite">{commandMessage}</Notice> : null}
        <OpenStudioLink href={studioHref} />
      </main>
    </DesignSystemRoot>
  );
}

function CompactHealth({ view, readiness }: {
  readonly view: StreamerViewModel;
  readonly readiness?: StreamerReadinessView | null;
}) {
  const obs = readinessService(readiness, "obs-capture");
  const realtime = readinessService(readiness, "realtime");
  const gameplay = summarizeGameplayHealth(view.gameplay);
  const generation = summarizeQuestGeneration(view.questCycle.options);
  return (
    <section className={styles.compactSection} aria-labelledby="live-health-heading">
      <ControlRow>
        <h2 id="live-health-heading">Live health</h2>
        <StatusBadge tone={readiness?.ready ? "success" : readiness ? "warning" : "neutral"}>
          {readiness?.ready ? "Ready" : readiness ? "Needs attention" : "Unknown"}
        </StatusBadge>
      </ControlRow>
      <div className={styles.healthList}>
        <div>
          <span>Capture Health</span>
          <StatusBadge tone={obs ? serviceTone(obs.health.status) : "neutral"}>{obs ? titleCase(obs.health.status) : "Unknown"}</StatusBadge>
        </div>
        <div>
          <span>Gameplay Activity</span>
          <StatusBadge tone={gameplay.tone}>{gameplay.label}</StatusBadge>
        </div>
        <div>
          <span>Sidequests</span>
          <StatusBadge tone={generation.tone}>{generation.label}</StatusBadge>
        </div>
        <div>
          <span>Realtime</span>
          <StatusBadge tone={realtime ? serviceTone(realtime.health.status) : "neutral"}>{realtime ? titleCase(realtime.health.status) : "Unknown"}</StatusBadge>
        </div>
      </div>
    </section>
  );
}

export function TwitchLiveConfigSurface({
  view,
  readiness,
  studioHref = "/",
  popoutHref = "/studio/live-director?display=popout",
  pendingCommandId = null,
  commandMessage = null,
  onCommand,
  commandFactory = defaultStreamerCommandFactory,
}: TwitchLiveConfigSurfaceProps) {
  const defaultCandidate = view?.questCycle.activeCandidateId ?? view?.questCycle.options[0]?.candidateId ?? null;
  const cycleKey = view === null
    ? "loading"
    : `${view.questCycle.envelope.questCycleId ?? "no-cycle"}:${view.questCycle.envelope.revision}`;
  const [selection, setSelection] = useState({ cycleKey, candidateId: defaultCandidate });
  const [confirmation, setConfirmation] = useState<{
    readonly cycleKey: string;
    readonly action: StreamerQuestAction;
  } | null>(null);
  const [progressDraft, setProgressDraft] = useState({
    cycleKey,
    value: view?.questCycle.progress?.value ?? 0,
  });
  const selectedCandidateId = selection.cycleKey === cycleKey ? selection.candidateId : defaultCandidate;
  const confirmAction = confirmation?.cycleKey === cycleKey ? confirmation.action : null;
  const manualProgress = progressDraft.cycleKey === cycleKey
    ? progressDraft.value
    : view?.questCycle.progress?.value ?? 0;

  if (view === null) {
    return (
      <DesignSystemRoot theme="twitch" density="compact" className={styles.surface}>
        <main className={styles.shell}>
          <CompactHeader eyebrow="Twitch Live Config" title="Live control" view={null} />
          <Notice title="Loading live controls" politeness="polite">Waiting for the latest authorised session snapshot.</Notice>
          {commandMessage ? <Notice tone="warning" title="Private authority required">{commandMessage}</Notice> : null}
          <a className={styles.studioLink} href={popoutHref} target="_blank" rel="noreferrer">Open private pop-out</a>
          <OpenStudioLink href={studioHref} />
        </main>
      </DesignSystemRoot>
    );
  }

  const currentView = view;
  const cycle = currentView.questCycle;
  const active = cycle.options.find((option) => option.candidateId === cycle.activeCandidateId);
  const pending = pendingCommandId !== null;
  const regularActions = cycle.availableStreamerActions.filter((action) => action !== "emergency-pause");

  function emitAction(action: StreamerQuestAction) {
    const candidateId = candidateActions.has(action) ? selectedCandidateId : null;
    onCommand?.(buildQuestCommand(currentView, action, candidateId, commandFactory));
    setConfirmation(null);
  }

  function requestAction(action: StreamerQuestAction) {
    if (destructiveActions.has(action)) {
      setConfirmation({ cycleKey, action });
      return;
    }
    emitAction(action);
  }

  return (
    <DesignSystemRoot theme="twitch" density="compact" className={styles.surface}>
      <main className={styles.shell}>
        <CompactHeader eyebrow="Twitch Live Config" title="Live control" view={currentView} />

        {currentView.emergencyPaused ? (
          <Notice tone="danger" title="Emergency pause active" politeness="assertive">
            New sidequests stay blocked until cleared.
            <div className={styles.noticeActions}>
              <Button
                variant="secondary"
                disabled={onCommand === undefined || pending}
                onClick={() => onCommand?.(buildEmergencyClearCommand(currentView, commandFactory))}
              >
                Clear emergency pause
              </Button>
            </div>
          </Notice>
        ) : null}

        <CompactHealth view={currentView} readiness={readiness} />

        <section className={styles.compactSection} aria-labelledby="live-director-heading">
          <ControlRow>
            <h2 id="live-director-heading">Live Director</h2>
            <StatusBadge tone="diagnostic">Private</StatusBadge>
          </ControlRow>
          <LiveDirectorControls
            view={currentView}
            compact
            pending={pending}
            onCommand={onCommand}
            commandFactory={commandFactory}
          />
        </section>

        <section className={styles.compactSection} aria-labelledby="live-quest-heading">
          <ControlRow>
            <h2 id="live-quest-heading">Sidequest</h2>
            <StatusBadge tone="info">{titleCase(cycle.status)}</StatusBadge>
          </ControlRow>

          {active ? (
            <Card className={styles.activeQuest}>
              <small>Active sidequest</small>
              <strong>{active.title}</strong>
              <p>{active.instruction}</p>
            </Card>
          ) : cycle.options.length === 3 ? (
            <div className={styles.optionList}>
              {cycle.options.map((option) => (
                <label key={option.candidateId} className={styles.optionRow} data-selected={option.candidateId === selectedCandidateId || undefined}>
                  <input
                    type="radio"
                    name="live-config-quest"
                    checked={option.candidateId === selectedCandidateId}
                    onChange={() => setSelection({ cycleKey, candidateId: option.candidateId })}
                  />
                  <span>
                    <strong>{option.title}</strong>
                    <small>{`${titleCase(option.difficulty)} · ${option.durationSeconds}s · ${option.rewardPoints} pts`}</small>
                  </span>
                </label>
              ))}
            </div>
          ) : (
            <Notice title="No three-option sidequest proposal">Waiting for the authoritative runtime.</Notice>
          )}

          {cycle.progress ? (
            <Progress
              label={`Progress · ${titleCase(cycle.progress.method)}`}
              value={cycle.progress.value}
              max={1}
              valueLabel={`${Math.round(cycle.progress.value * 100)}%`}
            />
          ) : null}

          {cycle.status === "active" && cycle.completionRule?.mode === "manual" ? (
            <Panel className={styles.manualProgress}>
              <label>
                <span>Manual progress <output>{`${Math.round(manualProgress * 100)}%`}</output></span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={manualProgress}
                  disabled={onCommand === undefined || pending}
                  onChange={(event) => setProgressDraft({ cycleKey, value: Number(event.currentTarget.value) })}
                />
              </label>
              <Button
                variant="secondary"
                disabled={onCommand === undefined || pending || manualProgress === (cycle.progress?.value ?? 0)}
                onClick={() => onCommand?.(buildQuestProgressCommand(currentView, manualProgress, commandFactory))}
              >
                Update
              </Button>
            </Panel>
          ) : null}
        </section>

        <section className={styles.compactSection} aria-labelledby="quick-intensity-heading">
          <ControlRow>
            <h2 id="quick-intensity-heading">This session</h2>
            <StatusBadge tone="info">Follows saved</StatusBadge>
          </ControlRow>
          <label className={styles.disabledRange}>
            <span>Sidequest intensity <output>{`${Math.round((currentView.profile.experience.intensity ?? 0.5) * 100)}%`}</output></span>
            <input type="range" min="0" max="1" value={currentView.profile.experience.intensity ?? 0.5} disabled readOnly />
          </label>
          <p>Temporary intensity stays disabled until the runtime supplies a session override and reset command. The saved default is not changed here.</p>
        </section>

        <section className={styles.actionSection} aria-label="Authorised sidequest actions">
          <div className={styles.actionGrid}>
            {regularActions.map((action) => (
              <Button
                key={action}
                variant={destructiveActions.has(action) ? "danger" : action === "approve" || action === "start" ? "primary" : "secondary"}
                disabled={onCommand === undefined || pending || (candidateActions.has(action) && selectedCandidateId === null)}
                onClick={() => requestAction(action)}
              >
                {questLabels[action]}
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
        </section>

        {confirmAction ? (
          <Notice tone="danger" title={`Confirm ${questLabels[confirmAction].toLocaleLowerCase()}`} politeness="assertive">
            The current sidequest remains unchanged until confirmation.
            <div className={styles.noticeActions}>
              <Button variant="danger" disabled={pending} onClick={() => emitAction(confirmAction)}>Confirm</Button>
              <Button variant="ghost" onClick={() => setConfirmation(null)}>Keep sidequest</Button>
            </div>
          </Notice>
        ) : null}

        {commandMessage ? <Notice title="Control update" politeness="polite">{commandMessage}</Notice> : null}
        <aside className={styles.dockSetup} aria-label="Private pop-out and OBS Custom Dock setup">
          <strong>Private pop-out or OBS Custom Dock</strong>
          <p>
            Open the Studio-authorised compact surface in a browser tab, or use that same URL as an OBS Custom Browser Dock after authorising its browser session. It is not the public OBS overlay.
          </p>
          <a className={styles.studioLink} href={popoutHref} target="_blank" rel="noreferrer">Open private Live Director</a>
        </aside>
        <OpenStudioLink href={studioHref} />
      </main>
    </DesignSystemRoot>
  );
}
