"use client";

import { useEffect, useState } from "react";

import { DesignSystemRoot } from "../design-system";
import {
  resolveEffectiveStreamerProfile,
  type StreamerReadinessView,
  type StreamerViewModel,
} from "../core";
import {
  presentChatStatus,
  presentGameplayFeedState,
  presentGameplayTempo,
  presentQuestStatus,
  presentSessionPhase,
} from "./live-status-presentation";
import {
  buildQuestCommand,
  buildQuestGenerationCommand,
  defaultStreamerCommandFactory,
  type StreamerCommandFactory,
  type StreamerUiCommand,
} from "./streamer-commands";

import styles from "./persistent-stream-overlay.module.css";

export interface PersistentStreamOverlaySurfaceProps {
  readonly view: StreamerViewModel | null;
  readonly readiness?: StreamerReadinessView | null;
  readonly pendingCommandId?: string | null;
  readonly commandMessage?: string | null;
  readonly onCommand?: (command: StreamerUiCommand) => void;
  readonly commandFactory?: StreamerCommandFactory;
}

function formatRemainingTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function PersistentStreamOverlaySurface({
  view,
  pendingCommandId = null,
  commandMessage = null,
  onCommand,
  commandFactory = defaultStreamerCommandFactory,
}: PersistentStreamOverlaySurfaceProps) {
  const cycle = view?.questCycle ?? null;
  const cycleKey = cycle === null
    ? "no-cycle"
    : [
        cycle.envelope.questCycleId ?? "no-cycle",
        cycle.status,
        ...cycle.options.map((option) => option.candidateId),
      ].join(":");
  const defaultCandidateId = cycle?.options[0]?.candidateId ?? null;
  const [selection, setSelection] = useState({ cycleKey, candidateId: defaultCandidateId });
  const [cancelConfirmationCycleKey, setCancelConfirmationCycleKey] = useState<string | null>(null);
  const selectedCandidateId = selection.cycleKey === cycleKey
    ? selection.candidateId
    : defaultCandidateId;
  const questControlMode = view === null || resolveEffectiveStreamerProfile(
    view.profile,
    view.sessionOverride,
    view.session.currentGame,
  ).voting.winnerActivationMode === "automatic"
    ? "automatic"
    : "manual";
  const canRouteRecommendations =
    view !== null &&
    cycle?.status === "proposed" &&
    cycle.options.length === 3 &&
    cycle.availableStreamerActions.includes("approve");
  const canGenerateRecommendations =
    view !== null &&
    cycle?.status === "idle" &&
    (view.session.status === "preparing" || view.session.status === "live") &&
    !view.emergencyPaused;
  const activeQuest = cycle?.status === "active" && cycle.activeCandidateId !== null
    ? cycle.options.find((option) => option.candidateId === cycle.activeCandidateId) ?? null
    : null;
  const canCancelActiveQuest = activeQuest !== null &&
    cycle?.availableStreamerActions.includes("cancel") === true;
  const canCompleteActiveQuest = activeQuest !== null &&
    cycle?.availableStreamerActions.includes("succeed") === true;
  const confirmingCancellation = canCancelActiveQuest && cancelConfirmationCycleKey === cycleKey;
  const activeQuestId = activeQuest?.candidateId ?? null;
  const needsLiveClock = activeQuestId !== null || cycle?.status === "voting";
  const [currentTime, setCurrentTime] = useState(view?.envelope.receivedAt ?? 0);
  const authoritativeDisplayTime = view === null
    ? currentTime
    : Math.max(currentTime, view.envelope.receivedAt);
  const remainingSeconds = activeQuest !== null && cycle !== null && cycle.endsAt !== null && view !== null
    ? Math.max(0, Math.ceil((cycle.endsAt - authoritativeDisplayTime) / 1_000))
    : null;

  useEffect(() => {
    if (!needsLiveClock) return undefined;

    const intervalId = window.setInterval(() => setCurrentTime(Date.now()), 250);

    return () => window.clearInterval(intervalId);
  }, [needsLiveClock, cycle?.endsAt]);
  const statuses = [
    { key: "session", label: "Session phase", value: presentSessionPhase(view) },
    { key: "gameplay", label: "Gameplay tempo", value: presentGameplayTempo(view) },
    { key: "chat", label: "Chat status", value: presentChatStatus(view) },
    {
      key: "quest",
      label: "Quest status",
      value: presentQuestStatus(view, authoritativeDisplayTime),
    },
  ] as const;

  function sendActiveQuestAction(action: "cancel" | "succeed") {
    if (view === null || activeQuest === null) return;
    onCommand?.(buildQuestCommand(view, action, null, commandFactory));
    setCancelConfirmationCycleKey(null);
  }

  return (
    <DesignSystemRoot theme="dark" density="compact" className={styles.surface}>
      <main className={styles.shell} aria-label="Private Live Director">
        <header className={styles.header}>
          <h1>Live Director</h1>
          <span className={styles.feedState} data-director-feed-state>
            <i aria-hidden="true" />
            {presentGameplayFeedState(view)}
          </span>
        </header>
        <dl className={styles.statusGrid}>
          {statuses.map((status) => (
            <div key={status.key} className={styles.statusCell} data-director-status={status.key}>
              <dt>{status.label}</dt>
              <dd>{status.value}</dd>
            </div>
          ))}
        </dl>
        {canGenerateRecommendations && view !== null ? (
          <section className={styles.questPicker} aria-labelledby="director-generate-heading">
            <div className={styles.questPickerHeader}>
              <h2 id="director-generate-heading">Quests</h2>
              <span>Generate three safe options</span>
            </div>
            <button
              type="button"
              disabled={onCommand === undefined || pendingCommandId !== null}
              onClick={() => onCommand?.(buildQuestGenerationCommand(view, commandFactory))}
            >
              {pendingCommandId === null ? "Generate quests" : "Generating…"}
            </button>
            {commandMessage ? <p className={styles.commandMessage} role="status">{commandMessage}</p> : null}
          </section>
        ) : null}
        {canRouteRecommendations && cycle !== null ? (
          <section className={styles.questPicker} aria-labelledby="director-recommendations-heading">
            <div className={styles.questPickerHeader}>
              <h2 id="director-recommendations-heading">Recommended quests</h2>
              <span>{questControlMode === "automatic" ? "Send all three to viewers" : "Choose one to start"}</span>
            </div>
            <div className={styles.questOptions} role={questControlMode === "manual" ? "radiogroup" : "list"} aria-label="Recommended quests">
              {cycle.options.map((option, index) => (
                questControlMode === "manual" ? (
                  <label
                    key={option.candidateId}
                    className={styles.questOption}
                    data-selected={option.candidateId === selectedCandidateId || undefined}
                    title={`${option.title}: ${option.instruction}`}
                  >
                    <input
                      type="radio"
                      name="desktop-live-director-quest"
                      checked={option.candidateId === selectedCandidateId}
                      onChange={() => setSelection({ cycleKey, candidateId: option.candidateId })}
                    />
                    <span>{index + 1}</span>
                    <strong>{option.title}</strong>
                  </label>
                ) : (
                  <div key={option.candidateId} className={styles.questOption} data-interactive="false" role="listitem" title={`${option.title}: ${option.instruction}`}>
                    <span>{index + 1}</span>
                    <strong>{option.title}</strong>
                  </div>
                )
              ))}
            </div>
            <button
              type="button"
              disabled={
                onCommand === undefined ||
                pendingCommandId !== null ||
                (questControlMode === "manual" && selectedCandidateId === null)
              }
              onClick={() => {
                if (view === null || (questControlMode === "manual" && selectedCandidateId === null)) return;
                onCommand?.(
                  buildQuestCommand(
                    view,
                    "approve",
                    questControlMode === "manual" ? selectedCandidateId : null,
                    commandFactory,
                  ),
                );
              }}
            >
              {pendingCommandId === null
                ? questControlMode === "automatic" ? "Push quests now" : "Start selected quest"
                : questControlMode === "automatic" ? "Pushing quests…" : "Starting quest…"}
            </button>
            {commandMessage ? <p className={styles.commandMessage} role="status">{commandMessage}</p> : null}
          </section>
        ) : null}
        {activeQuest !== null ? (
          <section
            className={styles.activeQuest}
            data-director-active-quest="true"
            aria-labelledby="director-active-quest-heading"
          >
            <div className={styles.activeQuestHeader}>
              <div className={styles.activeQuestIdentity}>
                <span>Current quest</span>
                <h2 id="director-active-quest-heading">{activeQuest.title}</h2>
              </div>
              <div
                className={styles.activeQuestTimer}
                aria-label={remainingSeconds === null
                  ? "Quest timer unavailable"
                  : `${formatRemainingTime(remainingSeconds)} remaining`}
              >
                <strong>{remainingSeconds === null ? "—" : formatRemainingTime(remainingSeconds)}</strong>
                <span>{remainingSeconds === null ? "timer unavailable" : "remaining"}</span>
              </div>
            </div>
            <p className={styles.activeQuestInstruction}>{activeQuest.instruction}</p>
            <div className={styles.activeQuestFooter}>
              <span className={styles.activeQuestMetadata}>
                {activeQuest.difficulty} · {activeQuest.rewardPoints} pts
              </span>
              {canCancelActiveQuest || canCompleteActiveQuest ? (
                <div className={styles.activeQuestActions} aria-label="Quest actions">
                  {confirmingCancellation ? (
                    <>
                      <button
                        type="button"
                        data-tone="danger"
                        disabled={onCommand === undefined || pendingCommandId !== null}
                        onClick={() => sendActiveQuestAction("cancel")}
                      >
                        {pendingCommandId === null ? "Confirm cancel" : "Cancelling…"}
                      </button>
                      <button
                        type="button"
                        disabled={pendingCommandId !== null}
                        onClick={() => setCancelConfirmationCycleKey(null)}
                      >
                        Keep quest
                      </button>
                    </>
                  ) : (
                    <>
                      {canCancelActiveQuest ? (
                        <button
                          type="button"
                          data-tone="danger"
                          disabled={onCommand === undefined || pendingCommandId !== null}
                          onClick={() => setCancelConfirmationCycleKey(cycleKey)}
                        >
                          Cancel quest
                        </button>
                      ) : null}
                      {canCompleteActiveQuest ? (
                        <button
                          type="button"
                          data-tone="success"
                          disabled={onCommand === undefined || pendingCommandId !== null}
                          onClick={() => sendActiveQuestAction("succeed")}
                        >
                          {pendingCommandId === null ? "Mark complete" : "Completing…"}
                        </button>
                      ) : null}
                    </>
                  )}
                </div>
              ) : null}
            </div>
          </section>
        ) : null}
      </main>
    </DesignSystemRoot>
  );
}
