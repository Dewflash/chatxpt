"use client";

import {
  Button,
  Card,
  CardGrid,
  DesignSystemRoot,
  Notice,
  Panel,
  Progress,
  StatusBadge,
  VisuallyHidden,
} from "../design-system";
import type { DomainError, OverlayViewModel, ViewerViewModel } from "../core";
import { presentOverlay, presentViewer, type ViewerQuestOptionPresentation } from "./presentation";
import styles from "./surfaces.module.css";

export interface ViewerSurfaceProps {
  readonly view: ViewerViewModel | null;
  readonly selectedCandidateId?: string | null;
  readonly pendingCandidateId?: string | null;
  readonly commandError?: DomainError | null;
  readonly now?: number;
  readonly onSelectCandidate?: (candidateId: string) => void;
  readonly onVoteCandidate?: (candidateId: string) => void;
  readonly onReact?: (reaction: string) => void;
}

export interface HostedBoardSurfaceProps extends ViewerSurfaceProps {
  readonly roomCode?: string | null;
}

export interface ChatFallbackInstructionsProps {
  readonly view: ViewerViewModel | null;
}

export interface ObsQuestOverlaySurfaceProps {
  readonly view: OverlayViewModel | null;
  readonly now?: number;
}

function formatSeconds(seconds: number): string {
  return seconds === 1 ? "1 sec" : `${seconds} sec`;
}

function formatReward(points: number): string {
  return points === 1 ? "1 pt" : `${points} pts`;
}

function formatRemaining(endsAt: number | null, now: number | undefined): string | null {
  if (endsAt === null || now === undefined) return null;
  const remainingSeconds = Math.max(0, Math.ceil((endsAt - now) / 1_000));
  return `${remainingSeconds}s left`;
}

function difficultyTone(difficulty: ViewerQuestOptionPresentation["difficulty"]) {
  if (difficulty === "hard") return "danger" as const;
  if (difficulty === "medium") return "warning" as const;
  return "success" as const;
}

function connectionTone(status: string | undefined) {
  if (status === "ready") return "success" as const;
  if (status === "degraded") return "warning" as const;
  if (status === "permission-denied" || status === "unavailable") return "danger" as const;
  return "neutral" as const;
}

function connectionLabel(status: string | undefined) {
  switch (status) {
    case "ready":
      return "Connected";
    case "degraded":
      return "Reconnecting";
    case "permission-denied":
      return "Access needed";
    case "unavailable":
      return "Temporarily unavailable";
    default:
      return "Loading";
  }
}

function connectionRecoveryCopy(status: string | undefined) {
  switch (status) {
    case "degraded":
      return "We are reconnecting. Your latest safe quest stays visible, but voting and reactions are paused.";
    case "permission-denied":
      return "ChatXPT needs permission before this panel can send votes or reactions.";
    case "unavailable":
      return "Voting is temporarily unavailable. The latest safe quest stays visible while ChatXPT recovers.";
    default:
      return "Voting is paused while ChatXPT reconnects.";
  }
}

function commandErrorCopy(error: DomainError): {
  readonly title: string;
  readonly body: string;
  readonly tone: "info" | "warning" | "danger";
} {
  switch (error.code) {
    case "unauthenticated":
      return {
        title: "Sign in to keep voting",
        body: error.message,
        tone: "warning",
      };
    case "forbidden":
    case "unavailable-capability":
      return {
        title: "Voting is unavailable here",
        body: error.message,
        tone: "warning",
      };
    case "stale-revision":
      return {
        title: "The quest changed",
        body: `${error.message} Your selection is preserved while ChatXPT refreshes.`,
        tone: "warning",
      };
    case "duplicate":
      return {
        title: "Vote already received",
        body: error.message,
        tone: "info",
      };
    case "expired":
      return {
        title: "Voting has closed",
        body: error.message,
        tone: "warning",
      };
    case "rate-limited":
      return {
        title: "Please wait a moment",
        body: error.message,
        tone: "warning",
      };
    case "dependency-unavailable":
      return {
        title: "Connection interrupted",
        body: error.message,
        tone: "warning",
      };
    case "validation":
      return {
        title: "Vote not sent",
        body: error.message,
        tone: "warning",
      };
    case "internal":
      return {
        title: "Something went wrong",
        body: error.message,
        tone: "danger",
      };
  }
}

function phaseTitle(phase: ReturnType<typeof presentViewer>["phase"]): string {
  switch (phase) {
    case "loading":
      return "Loading quest";
    case "offline":
      return "Stream offline";
    case "ended":
      return "Stream ended";
    case "unavailable":
      return "Voting unavailable";
    case "voting":
      return "Choose the sidequest";
    case "active":
      return "Quest active";
    case "result":
      return "Quest result";
    case "waiting":
      return "Waiting for quests";
  }
}

function optionRibbon(
  option: ViewerQuestOptionPresentation,
  selectedCandidateId: string | null,
) {
  if (option.active) return "winner" as const;
  if (option.acceptedByViewer || option.candidateId === selectedCandidateId) {
    return "selected" as const;
  }
  return undefined;
}

function QuestOptionCard({
  option,
  index,
  selectedCandidateId,
  pending,
  canSelect,
  revealWinner,
  onSelectCandidate,
}: {
  readonly option: ViewerQuestOptionPresentation;
  readonly index: number;
  readonly selectedCandidateId: string | null;
  readonly pending: boolean;
  readonly canSelect: boolean;
  readonly revealWinner: boolean;
  readonly onSelectCandidate?: (candidateId: string) => void;
}) {
  const selected = option.candidateId === selectedCandidateId || option.acceptedByViewer;
  const cardClass = `${styles.option} ${revealWinner ? styles.winnerReveal : ""}`;

  return (
    <Card
      ribbon={optionRibbon(option, selectedCandidateId)}
      className={cardClass}
      data-active={option.active || undefined}
    >
      <button
        type="button"
        className={styles.optionButton}
        aria-pressed={selected}
        disabled={!canSelect || pending}
        onClick={() => onSelectCandidate?.(option.candidateId)}
      >
        <span className={styles.optionBody}>
          <span className={styles.optionHeader}>
            <span>
              <span className={styles.optionNumber} aria-hidden="true">{index + 1}</span>
              <VisuallyHidden>Option {index + 1}. </VisuallyHidden>
            </span>
            <strong className={styles.optionTitle}>{option.title}</strong>
          </span>
          <span className={styles.instruction}>{option.instruction}</span>
          <span className={styles.optionFooter}>
            <StatusBadge tone={difficultyTone(option.difficulty)}>{option.difficulty}</StatusBadge>
            <StatusBadge tone="info">{formatSeconds(option.durationSeconds)}</StatusBadge>
            <StatusBadge tone="success">{formatReward(option.rewardPoints)}</StatusBadge>
            {option.votes === null ? null : (
              <StatusBadge tone={option.acceptedByViewer || option.active ? "success" : "neutral"}>
                {`${option.votes} votes`}
              </StatusBadge>
            )}
            {pending ? <StatusBadge tone="info">Sending</StatusBadge> : null}
          </span>
        </span>
      </button>
    </Card>
  );
}

function ViewerShell({
  surface,
  view,
  roomCode = null,
  selectedCandidateId = null,
  pendingCandidateId = null,
  commandError = null,
  now,
  onSelectCandidate,
  onVoteCandidate,
  onReact,
}: ViewerSurfaceProps & { readonly surface: "extension" | "hosted"; readonly roomCode?: string | null }) {
  const presentation = presentViewer(view);
  const remaining = formatRemaining(presentation.endsAt, now);
  const accepted = presentation.acceptedCandidateId !== null;
  const pending = pendingCandidateId !== null;
  const effectiveSelectedCandidateId = presentation.acceptedCandidateId ?? selectedCandidateId;
  const selectedOption = presentation.options.find(
    (option) => option.candidateId === selectedCandidateId,
  );
  const activeOption = presentation.options.find((option) => option.active);
  const visibleOptions =
    (presentation.phase === "active" || presentation.phase === "result") && activeOption
      ? [activeOption]
      : presentation.phase === "result"
        ? []
        : presentation.options;
  const canSelect =
    presentation.canVote &&
    !accepted &&
    !pending &&
    onSelectCandidate !== undefined;
  const canSubmit =
    presentation.canVote &&
    !accepted &&
    onVoteCandidate !== undefined &&
    selectedOption !== undefined &&
    !pending;
  const canReact = presentation.canReact && onReact !== undefined;
  const rootClass = `${styles.surface} ${surface === "hosted" ? styles.hosted : styles.extension}`;
  const errorCopy = commandError ? commandErrorCopy(commandError) : null;
  const voteStatus = (() => {
    if (presentation.phase === "active") return "Winner confirmed. The quest is now active.";
    if (presentation.phase === "result") return "The authoritative quest result is shown above.";
    if (accepted) return "Vote accepted. Live tallies are now visible.";
    if (pending) return "Sending your vote. Keep this panel open for confirmation.";
    if (presentation.canVote && onVoteCandidate !== undefined) {
      return "Select one option, then vote.";
    }
    return "Voting is closed or unavailable.";
  })();

  return (
    <DesignSystemRoot
      theme="twitch"
      density="compact"
      className={rootClass}
      data-phase={presentation.phase}
    >
      <Panel className={styles.shell}>
        <header className={styles.header}>
          <div className={styles.titleBlock}>
            <p className={styles.eyebrow}>
              {surface === "hosted" ? "Quest Board" : "Twitch Extension"}
            </p>
            <h2 className={styles.title}>{phaseTitle(presentation.phase)}</h2>
          </div>
          <div className={styles.metaRow}>
            {roomCode ? <StatusBadge tone="info">{`Room ${roomCode}`}</StatusBadge> : null}
            <StatusBadge tone={connectionTone(presentation.connection?.status)}>
              {connectionLabel(presentation.connection?.status)}
            </StatusBadge>
            {remaining ? <StatusBadge tone="info">{remaining}</StatusBadge> : null}
          </div>
        </header>

        <div className={styles.content}>
          {presentation.connection?.status && presentation.connection.status !== "ready" ? (
            <Notice
              tone={presentation.connection.status === "degraded" ? "warning" : "danger"}
              title={connectionLabel(presentation.connection.status)}
              politeness="polite"
              className={styles.notice}
            >
              {connectionRecoveryCopy(presentation.connection.status)}
            </Notice>
          ) : null}

          {errorCopy ? (
            <Notice
              tone={errorCopy.tone}
              title={errorCopy.title}
              politeness="polite"
              className={styles.notice}
            >
              {errorCopy.body}
            </Notice>
          ) : null}

          {visibleOptions.length === 0 && presentation.result === null ? (
            <Notice title={phaseTitle(presentation.phase)} className={styles.notice}>
              No vote is open right now.
            </Notice>
          ) : visibleOptions.length > 0 ? (
            <CardGrid className={styles.options}>
              {visibleOptions.map((option) => {
                const optionIndex = presentation.options.findIndex(
                  (candidate) => candidate.candidateId === option.candidateId,
                );
                return (
                  <QuestOptionCard
                    key={option.candidateId}
                    option={option}
                    index={optionIndex}
                    selectedCandidateId={effectiveSelectedCandidateId}
                    pending={option.candidateId === pendingCandidateId}
                    canSelect={canSelect}
                    revealWinner={presentation.phase === "active" && option.active}
                    onSelectCandidate={onSelectCandidate}
                  />
                );
              })}
            </CardGrid>
          ) : null}

          {presentation.progress ? (
            <Progress
              label="Quest progress"
              value={presentation.progress.value}
              max={1}
              valueLabel={`${Math.round(presentation.progress.value * 100)}%`}
            />
          ) : null}

          {presentation.result ? (
            <Notice
              tone={presentation.result.outcome === "succeeded" ? "success" : "warning"}
              title={`Quest ${presentation.result.outcome}`}
              politeness="polite"
            >
              {presentation.result.reason} Awarded {formatReward(presentation.result.rewardPointsAwarded)}.
            </Notice>
          ) : null}
        </div>

        <div className={styles.actions}>
          {presentation.phase === "voting" ? (
            <Button
              className={styles.voteButton}
              disabled={!accepted && !canSubmit}
              aria-disabled={accepted || undefined}
              loading={pending}
              onClick={() => {
                if (canSubmit && selectedOption) onVoteCandidate?.(selectedOption.candidateId);
              }}
            >
              {accepted ? "Vote accepted" : pending ? "Sending vote" : "Vote"}
            </Button>
          ) : null}
          <p className={styles.statusLine} aria-live="polite">
            {voteStatus}
          </p>
          <div className={styles.engagement} aria-label="Viewer engagement">
            <div className={`${styles.engagementMetric} ${styles.engagementPrimary}`}>
              <span className={styles.metricLabel}>Community hype</span>
              <strong className={styles.metricValue}>{presentation.communityHype}</strong>
            </div>
            <div className={styles.engagementMetric}>
              <span className={styles.metricLabel}>Your session points</span>
              <strong>{presentation.sessionPoints}</strong>
            </div>
          </div>
          {canReact ? (
            <Button variant="secondary" onClick={() => onReact?.("hype")}>
              Send hype
            </Button>
          ) : null}
        </div>
      </Panel>
    </DesignSystemRoot>
  );
}

export function TwitchExtensionViewerSurface(props: ViewerSurfaceProps) {
  return <ViewerShell surface="extension" {...props} />;
}

export function HostedQuestBoardSurface({ roomCode, ...props }: HostedBoardSurfaceProps) {
  return <ViewerShell surface="hosted" roomCode={roomCode} {...props} />;
}

export function ChatFallbackInstructions({ view }: ChatFallbackInstructionsProps) {
  const presentation = presentViewer(view);
  const ready = presentation.participationMode === "twitch-chat" && presentation.options.length === 3;

  return (
    <DesignSystemRoot theme="twitch" density="compact" className={styles.surface}>
      <Panel className={styles.shell}>
        <header className={styles.header}>
          <div className={styles.titleBlock}>
            <p className={styles.eyebrow}>Chat fallback</p>
            <h2 className={styles.title}>{ready ? "Vote in Twitch chat" : "Chat voting inactive"}</h2>
          </div>
          <StatusBadge tone={ready ? "success" : "neutral"}>
            {presentation.participationMode ?? "loading"}
          </StatusBadge>
        </header>
        {ready ? (
          <ol className={styles.chatList}>
            {presentation.options.map((option, index) => (
              <li key={option.candidateId} className={styles.chatItem}>
                <span className={styles.chatDigit}>{index + 1}</span>
                <span>
                  Send <strong>{index + 1}</strong> for <strong>{option.title}</strong>
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <Notice title="No chat vote is open">Wait for the next authorised poll.</Notice>
        )}
        <p className={styles.statusLine}>
          Counted, duplicate, rejected, and late status comes from ChatXPT after Twitch receives the
          message.
        </p>
      </Panel>
    </DesignSystemRoot>
  );
}

export function ObsQuestOverlaySurface({ view, now }: ObsQuestOverlaySurfaceProps) {
  const presentation = presentOverlay(view);
  const remaining = formatRemaining(presentation.endsAt, now);

  if (presentation.phase === "inactive" || presentation.activeQuest === null) {
    return (
      <DesignSystemRoot theme="dark" density="compact" className={styles.overlay}>
        <div className={styles.overlayEmpty} aria-hidden="true" />
      </DesignSystemRoot>
    );
  }

  return (
    <DesignSystemRoot theme="dark" density="compact" className={styles.overlay}>
      <Card ribbon={presentation.phase === "result" ? "winner" : undefined} className={styles.overlayCard}>
        <div className={styles.shell}>
          <header className={styles.header}>
            <div className={styles.titleBlock}>
              <p className={styles.eyebrow}>{presentation.phase === "voting" ? "Vote now" : "Sidequest"}</p>
              <h2 className={styles.title}>{presentation.activeQuest.title}</h2>
            </div>
            <div className={styles.metaRow}>
              {remaining ? <StatusBadge tone="info">{remaining}</StatusBadge> : null}
              <StatusBadge tone={connectionTone(presentation.connection?.status)}>
                {connectionLabel(presentation.connection?.status)}
              </StatusBadge>
            </div>
          </header>
          <p className={styles.instruction}>{presentation.activeQuest.instruction}</p>
          {presentation.progress ? (
            <Progress
              label="Progress"
              value={presentation.progress.value}
              max={1}
              valueLabel={`${Math.round(presentation.progress.value * 100)}%`}
            />
          ) : null}
          {presentation.result ? (
            <p className={styles.statusLine}>
              {presentation.result.outcome}: {presentation.result.reason}
            </p>
          ) : null}
        </div>
      </Card>
    </DesignSystemRoot>
  );
}
