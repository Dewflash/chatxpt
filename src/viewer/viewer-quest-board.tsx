"use client";

import { useRef, useState } from "react";

import type { ViewerViewModel } from "../core";
import { Button, CardGrid, DesignSystemRoot, Notice, Panel, Progress, StatusBadge } from "../design-system";
import {
  buildViewerReactionCommand,
  buildViewerVoteCommand,
  remainingSeconds,
  serviceStatusLabel,
  visibleQuestOptions,
  voteCountFor,
  voteShareFor,
  type HostedQuestBoardAccessState,
  type ViewerReactionDispatcher,
  type ViewerVoteDispatcher,
  type ViewerSurfaceMode,
} from "./surface-model";
import styles from "./viewer-surfaces.module.css";

export interface ViewerQuestBoardProps {
  readonly initialView: ViewerViewModel;
  readonly surface: ViewerSurfaceMode;
  readonly voterKey: string;
  readonly dispatchVote: ViewerVoteDispatcher;
  readonly dispatchReaction?: ViewerReactionDispatcher;
  readonly heading?: string;
  readonly demoLabel?: string;
}

export type TwitchViewerPanelProps = Omit<ViewerQuestBoardProps, "surface">;

export interface HostedQuestBoardProps extends Omit<ViewerQuestBoardProps, "initialView" | "surface"> {
  readonly initialView?: ViewerViewModel;
  readonly access?: HostedQuestBoardAccessState;
}

export function ViewerQuestBoard({
  initialView,
  surface,
  voterKey,
  dispatchVote,
  dispatchReaction,
  heading = "Vote on the sidequest",
  demoLabel,
}: ViewerQuestBoardProps) {
  const inputKey = `${initialView.envelope.messageId}:${initialView.envelope.revision}:${initialView.acceptedCandidateId ?? "none"}`;
  const [viewOverride, setViewOverride] = useState<{ readonly key: string; readonly view: ViewerViewModel } | null>(null);
  const [selectedOverride, setSelectedOverride] = useState<{ readonly key: string; readonly candidateId: string | null } | null>(null);
  const [pendingState, setPendingState] = useState<{ readonly key: string; readonly pending: boolean } | null>(null);
  const [pendingReaction, setPendingReaction] = useState<{ readonly key: string; readonly reaction: string } | null>(null);
  const [messageState, setMessageState] = useState<{ readonly key: string; readonly message: string } | null>(null);
  const commandSequence = useRef(0);
  const view = viewOverride?.key === inputKey ? viewOverride.view : initialView;
  const selectedId =
    selectedOverride?.key === inputKey
      ? selectedOverride.candidateId
      : initialView.acceptedCandidateId;
  const pending = pendingState?.key === inputKey ? pendingState.pending : false;
  const activeReaction = pendingReaction?.key === inputKey ? pendingReaction.reaction : null;
  const message = messageState?.key === inputKey ? messageState.message : "";
  const now =
    view.envelope.evidenceClass === "fixture" && view.questCycle.startsAt !== null
      ? view.questCycle.startsAt + 10_000
      : view.envelope.receivedAt;
  const options = visibleQuestOptions(view.questCycle);
  const seconds = remainingSeconds(now, view.questCycle.endsAt);
  const selectedOption = options.find((option) => option.candidateId === selectedId) ?? null;
  const hasAcceptedVote = view.acceptedCandidateId !== null;
  const canSendReaction = view.canReact && dispatchReaction !== undefined && view.connection.status === "ready";
  const shellClass = `${styles.viewerShell} ${surface === "extension" ? styles.extension : ""}`;

  function submitVote() {
    if (selectedOption === null || pending || !view.canVote || hasAcceptedVote) return;
    setPendingState({ key: inputKey, pending: true });
    setMessageState({ key: inputKey, message: "Sending vote for confirmation..." });

    commandSequence.current += 1;

    const command = buildViewerVoteCommand({
      view,
      candidateId: selectedOption.candidateId,
      voterKey,
      issuedAt: view.envelope.receivedAt + commandSequence.current,
    });

    dispatchVote(command)
      .then((result) => {
        if (result.ok) {
          setViewOverride({ key: inputKey, view: result.view });
          setSelectedOverride({ key: inputKey, candidateId: result.view.acceptedCandidateId });
          setMessageState({ key: inputKey, message: result.message });
          return;
        }

        setMessageState({ key: inputKey, message: result.message });
      })
      .catch(() => {
        setMessageState({ key: inputKey, message: "Vote could not be sent. Reconnect and try again." });
      })
      .finally(() => {
        setPendingState((current) =>
          current?.key === inputKey ? { key: inputKey, pending: false } : current,
        );
      });
  }

  function submitReaction(reaction: string) {
    if (!canSendReaction || activeReaction !== null) return;

    setPendingReaction({ key: inputKey, reaction });
    setMessageState({ key: inputKey, message: `Sending ${reaction.toLowerCase()} reaction...` });

    commandSequence.current += 1;

    const command = buildViewerReactionCommand({
      view,
      reaction: reaction.toLowerCase(),
      issuedAt: view.envelope.receivedAt + commandSequence.current,
    });

    dispatchReaction(command)
      .then((result) => {
        setMessageState({ key: inputKey, message: result.message });
      })
      .catch(() => {
        setMessageState({ key: inputKey, message: "Reaction could not be sent. Try again after reconnecting." });
      })
      .finally(() => {
        setPendingReaction((current) => (current?.key === inputKey ? null : current));
      });
  }

  return (
    <DesignSystemRoot className={styles.viewerSurface} data-surface={surface} density={surface === "extension" ? "compact" : "comfortable"} theme="twitch">
      <div className={shellClass}>
        <header className={styles.viewerTopbar}>
          <div className={styles.brand}><span className={styles.mark}>XP</span><span>ChatXPT</span></div>
          <StatusBadge tone={view.connection.status === "ready" ? "success" : "warning"}>
            {serviceStatusLabel(view.connection)}
          </StatusBadge>
        </header>

        <section className={styles.hero}>
          <p className={styles.eyebrow}>{surface === "extension" ? "Twitch Extension" : "Hosted Quest Board"}</p>
          <h1>{heading}</h1>
          <p>Pick one challenge while the stream is live. ChatXPT confirms votes and keeps the latest safe state visible during reconnect.</p>
        </section>

        <Panel className={styles.panel} aria-label="Viewer vote panel">
          <div className={styles.voteHeader}>
            <div>
              <p className={styles.eyebrow}>Choose one</p>
              <h2>{view.questCycle.status === "voting" ? "Voting is open" : "Quest state"}</h2>
            </div>
            <div className={styles.metaRow}>
              <StatusBadge tone="info">{view.participationMode.replace("-", " ")}</StatusBadge>
              <StatusBadge tone="info">{`Hype ${view.communityHype}`}</StatusBadge>
              <StatusBadge tone="success">{`${view.sessionPoints} XP`}</StatusBadge>
              {seconds !== null && <span className={styles.countdown}>{seconds}s</span>}
            </div>
          </div>

          <CardGrid className={styles.optionGrid}>
            {options.map((option, index) => {
              const isSelected = option.candidateId === selectedId;
              const isAccepted = option.candidateId === view.acceptedCandidateId;
              return (
                <button
                  className={`${styles.questOption} ${isSelected ? styles.selected : ""} ${isAccepted ? styles.accepted : ""}`}
                  key={option.candidateId}
                  onClick={() => {
                    if (!pending && !hasAcceptedVote) {
                      setSelectedOverride({ key: inputKey, candidateId: option.candidateId });
                    }
                  }}
                  type="button"
                  aria-pressed={isSelected}
                >
                  <span className={styles.optionNumber}>0{index + 1}</span>
                  <div>
                    <h3>{option.title}</h3>
                    <p>{option.instruction}</p>
                  </div>
                  <div className={styles.optionMeta}>
                    <span className={`${styles.difficulty} ${styles[option.difficulty]}`}>{option.difficulty}</span>
                    <span>{option.durationSeconds}s</span>
                    <span>{option.rewardPoints} XP</span>
                  </div>
                  <Progress
                    className={styles.tally}
                    label={`${voteCountFor(view.questCycle, option.candidateId)} votes`}
                    value={hasAcceptedVote ? voteShareFor(view.questCycle, option.candidateId) : 0}
                    valueLabel={hasAcceptedVote ? `${voteShareFor(view.questCycle, option.candidateId)}%` : "After vote"}
                  />
                </button>
              );
            })}
          </CardGrid>

          <div className={styles.voteBar}>
            <div className={styles.confirmation} role="status" aria-live="polite">
              {message || (hasAcceptedVote ? "Your accepted vote is restored in this view." : "Select a card, then vote.")}
            </div>
            <Button
              disabled={selectedOption === null || pending || !view.canVote || hasAcceptedVote}
              loading={pending}
              onClick={submitVote}
            >
              {hasAcceptedVote ? "Vote accepted" : "Vote"}
            </Button>
          </div>

          <div className={styles.reactionRow} aria-label="Reaction controls">
            {["Hype", "Clutch", "Careful"].map((reaction) => (
              <Button
                disabled={!canSendReaction || activeReaction !== null}
                key={reaction}
                loading={activeReaction === reaction}
                onClick={() => submitReaction(reaction)}
                type="button"
                variant="secondary"
              >
                {reaction}
              </Button>
            ))}
          </div>

          <Notice className={styles.notice} title={demoLabel ?? "Live stream state"} tone={demoLabel ? "warning" : "info"}>
            {demoLabel
              ? "Fixture-only diagnostics: Role 5 renders state and emits commands; Role 1 remains the vote, identity, tally, timer, and persistence authority."
              : "Votes, timers, and results are confirmed by ChatXPT, so this panel will not guess while the stream is reconnecting."}
          </Notice>
        </Panel>
      </div>
    </DesignSystemRoot>
  );
}

export function TwitchViewerPanel(props: TwitchViewerPanelProps) {
  return (
    <ViewerQuestBoard
      {...props}
      heading={props.heading ?? "Vote without leaving Twitch"}
      surface="extension"
    />
  );
}

export function HostedQuestBoard(props: HostedQuestBoardProps) {
  const { access, initialView, ...boardProps } = props;
  if (access !== undefined && access.status !== "ready") {
    return <HostedQuestBoardAccessPanel access={access} />;
  }

  const view = access?.status === "ready" ? access.view : initialView;
  if (view === undefined) {
    return (
      <HostedQuestBoardAccessPanel
        access={{
          status: "unavailable",
          message: "The hosted Quest Board cannot load until an authorised room view is available.",
          retryable: true,
        }}
      />
    );
  }

  return (
    <ViewerQuestBoard
      {...boardProps}
      heading={boardProps.heading ?? "Join by link or room code"}
      initialView={view}
      surface="hosted-board"
    />
  );
}

function HostedQuestBoardAccessPanel({ access }: { readonly access: Exclude<HostedQuestBoardAccessState, { readonly status: "ready" }> }) {
  const titleByStatus: Record<typeof access.status, string> = {
    loading: "Finding your Quest Board",
    invalid: "Room code not found",
    expired: "Room expired",
    forbidden: "Access not available",
    unavailable: "Quest Board unavailable",
  };

  const tone = access.status === "loading" ? "info" : access.retryable ? "warning" : "danger";

  return (
    <DesignSystemRoot className={styles.viewerSurface} density="compact" theme="twitch">
      <div className={styles.viewerShell}>
        <header className={styles.viewerTopbar}>
          <div className={styles.brand}><span className={styles.mark}>XP</span><span>ChatXPT</span></div>
          <StatusBadge tone={tone}>Hosted fallback</StatusBadge>
        </header>

        <section className={styles.hero}>
          <p className={styles.eyebrow}>Hosted Quest Board</p>
          <h1>{titleByStatus[access.status]}</h1>
          <p>{access.message}</p>
        </section>

        <Panel className={styles.panel} aria-label="Hosted board access status">
          {access.roomCode ? (
            <div className={styles.chatLine}>
              <span>Room code</span>
              <strong>{access.roomCode}</strong>
            </div>
          ) : null}
          <Notice title={access.retryable ? "Try again" : "Use another voting path"} tone={tone}>
            {access.retryable
              ? "Reconnect or ask the streamer for a fresh ChatXPT link."
              : "This page only displays room access returned by ChatXPT. Ask the streamer for a fresh link or use Twitch chat if available."}
          </Notice>
        </Panel>
      </div>
    </DesignSystemRoot>
  );
}
