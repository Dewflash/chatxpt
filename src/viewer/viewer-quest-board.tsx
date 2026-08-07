"use client";

import { useMemo, useState } from "react";

import type { ViewerViewModel } from "../core";
import { acceptFixtureVote, createViewerDemoView } from "./demo-fixtures";
import {
  buildFixtureVoteCommand,
  remainingSeconds,
  serviceStatusLabel,
  visibleQuestOptions,
  voteCountFor,
  voteShareFor,
  type ViewerSurfaceMode,
} from "./surface-model";
import styles from "./viewer-surfaces.module.css";

export interface ViewerQuestBoardProps {
  readonly initialView: ViewerViewModel;
  readonly surface: ViewerSurfaceMode;
  readonly heading?: string;
}

export function ViewerQuestBoard({ initialView, surface, heading = "Vote on the sidequest" }: ViewerQuestBoardProps) {
  const [view, setView] = useState(initialView);
  const [selectedId, setSelectedId] = useState<string | null>(initialView.acceptedCandidateId);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const now =
    view.envelope.evidenceClass === "fixture" && view.questCycle.startsAt !== null
      ? view.questCycle.startsAt + 10_000
      : view.envelope.receivedAt;
  const options = visibleQuestOptions(view.questCycle);
  const seconds = remainingSeconds(now, view.questCycle.endsAt);
  const selectedOption = options.find((option) => option.candidateId === selectedId) ?? null;
  const hasAcceptedVote = view.acceptedCandidateId !== null;
  const shellClass = `${styles.viewerShell} ${surface === "extension" ? styles.extension : ""}`;
  const statusClass = view.connection.status === "ready" ? styles.statusReady : styles.statusWarn;

  function submitVote() {
    if (selectedOption === null || pending || !view.canVote || hasAcceptedVote) return;
    setPending(true);
    setMessage("Sending vote to the fixture dispatcher...");

    const command = buildFixtureVoteCommand({
      view,
      candidateId: selectedOption.candidateId,
      voterKey: "fixture-viewer-key",
      issuedAt: view.envelope.receivedAt + 1,
    });

    window.setTimeout(() => {
      setView(acceptFixtureVote(view, command.candidateId));
      setPending(false);
      setMessage("Vote accepted by fixture authority.");
    }, 420);
  }

  return (
    <main className={styles.viewerSurface}>
      <div className={shellClass}>
        <header className={styles.viewerTopbar}>
          <div className={styles.brand}><span className={styles.mark}>XP</span><span>ChatXPT</span></div>
          <span className={`${styles.statusPill} ${statusClass}`}>{serviceStatusLabel(view.connection)}</span>
        </header>

        <section className={styles.hero}>
          <p className={styles.eyebrow}>{surface === "extension" ? "Twitch Extension" : "Hosted Quest Board"} fixture</p>
          <h1>{heading}</h1>
          <p>Exactly three options, one authoritative vote acknowledgement, and latest safe state during reconnect.</p>
        </section>

        <section className={styles.panel} aria-label="Viewer vote panel">
          <div className={styles.voteHeader}>
            <div>
              <p className={styles.eyebrow}>Choose one</p>
              <h2>{view.questCycle.status === "voting" ? "Voting is open" : "Quest state"}</h2>
            </div>
            <div className={styles.metaRow}>
              <span className={styles.modePill}>{view.participationMode.replace("-", " ")}</span>
              {seconds !== null && <span className={styles.countdown}>{seconds}s</span>}
            </div>
          </div>

          <div className={styles.optionGrid}>
            {options.map((option, index) => {
              const isSelected = option.candidateId === selectedId;
              const isAccepted = option.candidateId === view.acceptedCandidateId;
              return (
                <button
                  className={`${styles.questOption} ${isSelected ? styles.selected : ""} ${isAccepted ? styles.accepted : ""}`}
                  key={option.candidateId}
                  onClick={() => {
                    if (!pending && !hasAcceptedVote) setSelectedId(option.candidateId);
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
                  <div className={styles.tally} aria-label={`${voteCountFor(view.questCycle, option.candidateId)} votes`}>
                    <span>{hasAcceptedVote ? `${voteShareFor(view.questCycle, option.candidateId)}%` : "Tally after vote"}</span>
                    <div className={styles.tallyTrack}><i style={{ width: `${hasAcceptedVote ? voteShareFor(view.questCycle, option.candidateId) : 0}%` }} /></div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className={styles.voteBar}>
            <div className={styles.confirmation} role="status" aria-live="polite">
              {message || (hasAcceptedVote ? "Your accepted vote is restored in this fixture view." : "Select a card, then vote.")}
            </div>
            <button
              className={styles.voteButton}
              disabled={selectedOption === null || pending || !view.canVote || hasAcceptedVote}
              onClick={submitVote}
              type="button"
            >
              {pending ? "Pending..." : hasAcceptedVote ? "Vote accepted" : "Vote"}
            </button>
          </div>

          <div className={styles.reactionRow} aria-label="Reaction controls">
            {["Hype", "Clutch", "Careful"].map((reaction) => (
              <button className={styles.reactionButton} disabled={!view.canReact} key={reaction} type="button">
                {reaction}
              </button>
            ))}
          </div>

          <p className={styles.notice}>
            Fixture-only surface: Role 5 renders state and emits commands; Role 1 remains the vote, identity, tally, timer, and persistence authority.
          </p>
        </section>
      </div>
    </main>
  );
}

export function ViewerQuestBoardDemo({ surface }: { readonly surface: ViewerSurfaceMode }) {
  const initialView = useMemo(
    () => createViewerDemoView({ mode: surface === "extension" ? "twitch-extension" : "hosted-board" }),
    [surface],
  );

  return (
    <ViewerQuestBoard
      initialView={initialView}
      surface={surface}
      heading={surface === "extension" ? "Vote without leaving Twitch" : "Join by link or room code"}
    />
  );
}
