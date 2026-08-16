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
  readonly onRetry?: () => void;
  readonly onReauthenticate?: () => void;
}

export interface HostedBoardSurfaceProps extends ViewerSurfaceProps {
  readonly roomCode?: string | null;
}

export interface ChatFallbackInstructionsProps {
  readonly view: ViewerViewModel | null;
  readonly now?: number;
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

function awaitingOfficialResult(
  phase: ReturnType<typeof presentViewer>["phase"] | ReturnType<typeof presentOverlay>["phase"],
  endsAt: number | null,
  now: number | undefined,
  acceptingVotes: boolean,
): boolean {
  return (
    phase === "voting" &&
    !acceptingVotes &&
    endsAt !== null &&
    now !== undefined &&
    now >= endsAt
  );
}

function difficultyTone(difficulty: ViewerQuestOptionPresentation["difficulty"]) {
  if (difficulty === "hard") return "danger" as const;
  if (difficulty === "medium") return "warning" as const;
  return "success" as const;
}

function connectionTone(status: string | undefined) {
  if (status === "ready") return "success" as const;
  if (status === "degraded") return "warning" as const;
  if (
    status === "permission-denied" ||
    status === "unavailable" ||
    status === "misconfigured"
  ) {
    return "danger" as const;
  }
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
    case "misconfigured":
      return "Setup needed";
    default:
      return "Loading";
  }
}

function connectionRecoveryCopy(status: string | undefined) {
  switch (status) {
    case "degraded":
      return "We are reconnecting. Your latest safe sidequest stays visible, but voting and reactions are paused.";
    case "permission-denied":
      return "ChatXPT needs permission before this panel can send votes or reactions.";
    case "unavailable":
      return "Voting is temporarily unavailable. The latest safe sidequest stays visible while ChatXPT recovers.";
    case "misconfigured":
      return "This viewer surface needs streamer setup before it can reconnect. Your latest safe sidequest stays visible.";
    default:
      return "Voting is paused while ChatXPT reconnects.";
  }
}

function overlayRecoveryCopy(status: string | undefined) {
  switch (status) {
    case "degraded":
      return "Reconnecting to ChatXPT. The latest safe sidequest stays visible.";
    case "permission-denied":
      return "Overlay access needs to be restored. The latest safe sidequest stays visible.";
    case "unavailable":
      return "Overlay updates are temporarily unavailable. The latest safe sidequest stays visible.";
    case "misconfigured":
      return "Overlay setup needs attention before live updates can resume.";
    default:
      return "Waiting for the latest safe overlay update.";
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
        title: "Reconnect with Twitch",
        body: `${error.message} No separate ChatXPT account is needed.`,
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
        title: "The sidequest changed",
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
      return "Loading sidequest";
    case "offline":
      return "Stream offline";
    case "ended":
      return "Stream ended";
    case "unavailable":
      return "Voting unavailable";
    case "voting":
      return "Choose the sidequest";
    case "active":
      return "Sidequest active";
    case "result":
      return "Sidequest result";
    case "waiting":
      return "Waiting for sidequests";
    case "cooldown":
      return "Next vote soon";
  }
}

function progressMethodLabel(method: "automatic" | "manual" | "unknown"): string {
  switch (method) {
    case "automatic":
      return "Live game progress";
    case "manual":
      return "Streamer updated";
    case "unknown":
      return "Progress unavailable";
  }
}

function resultCopy(result: NonNullable<ReturnType<typeof presentViewer>["result"]>): {
  readonly title: string;
  readonly tone: "info" | "warning" | "success";
} {
  switch (result.outcome) {
    case "succeeded":
      return { title: "Sidequest completed", tone: "success" };
    case "failed":
      return { title: "Sidequest attempt ended", tone: "warning" };
    case "cancelled":
      return { title: "Sidequest cancelled", tone: "warning" };
    case "skipped":
      return { title: "Sidequest skipped", tone: "info" };
    case "expired":
      return { title: "Sidequest expired", tone: "warning" };
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
  onRetry,
  onReauthenticate,
}: ViewerSurfaceProps & { readonly surface: "extension" | "hosted"; readonly roomCode?: string | null }) {
  const presentation = presentViewer(view);
  const remaining = formatRemaining(presentation.endsAt, now);
  const accepted = presentation.acceptedCandidateId !== null;
  const pending = pendingCandidateId !== null;
  const interactionsPaused = commandError !== null;
  const waitingForResult = awaitingOfficialResult(
    presentation.phase,
    presentation.endsAt,
    now,
    presentation.canVote,
  ) && presentation.connection?.status === "ready";
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
    !interactionsPaused &&
    onSelectCandidate !== undefined;
  const canSubmit =
    presentation.canVote &&
    !accepted &&
    onVoteCandidate !== undefined &&
    selectedOption !== undefined &&
    !pending &&
    !interactionsPaused;
  const canReact = presentation.canReact && onReact !== undefined && !interactionsPaused;
  const rootClass = `${styles.surface} ${surface === "hosted" ? styles.hosted : styles.extension}`;
  const errorCopy = commandError ? commandErrorCopy(commandError) : null;
  const needsTwitchAuth =
    presentation.connection?.status === "permission-denied" ||
    commandError?.code === "unauthenticated" ||
    commandError?.code === "forbidden";
  const canRetry =
    !needsTwitchAuth &&
    (presentation.connection?.retryable === true || commandError?.retryable === true);
  const resultDetails = presentation.result ? resultCopy(presentation.result) : null;
  const voteStatus = (() => {
    if (presentation.phase === "active") return "Winner confirmed. The sidequest is now active.";
    if (presentation.phase === "result") return "The authoritative sidequest result is shown above.";
    if (presentation.phase === "cooldown") return "The next vote opens after the official cooldown.";
    if (waitingForResult) return "Awaiting the official result.";
    if (accepted) return "Vote accepted. Live tallies are now visible.";
    if (pending) return "Sending your vote. Keep this panel open for confirmation.";
    if (interactionsPaused) return "Voting and reactions are paused until recovery completes.";
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

          {waitingForResult ? (
            <Notice title="Awaiting the official result" tone="info" className={styles.notice}>
              ChatXPT will announce a winner, tie resolution, or no-vote outcome from the server.
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
            <div className={styles.progressBlock}>
              <Progress
                label="Sidequest progress"
                value={presentation.progress.value}
                max={1}
                valueLabel={`${Math.round(presentation.progress.value * 100)}%`}
              />
              <p className={styles.progressMeta}>
                {progressMethodLabel(presentation.progress.method)}
              </p>
            </div>
          ) : null}

          {presentation.result && resultDetails ? (
            <Notice
              tone={resultDetails.tone}
              title={resultDetails.title}
              politeness="polite"
            >
              {presentation.result.reason}
              {presentation.result.rewardPointsAwarded > 0
                ? ` Awarded ${formatReward(presentation.result.rewardPointsAwarded)}.`
                : null}
            </Notice>
          ) : null}
        </div>

        <div className={styles.actions}>
          {needsTwitchAuth && onReauthenticate ? (
            <Button className={styles.voteButton} variant="secondary" onClick={onReauthenticate}>
              Reconnect with Twitch
            </Button>
          ) : canRetry && onRetry ? (
            <Button className={styles.voteButton} variant="secondary" onClick={onRetry}>
              Retry connection
            </Button>
          ) : presentation.phase === "voting" ? (
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

export function ChatFallbackInstructions({ view, now }: ChatFallbackInstructionsProps) {
  const presentation = presentViewer(view);
  const available = presentation.participationMode === "twitch-chat";
  const voting = available && presentation.phase === "voting" && presentation.options.length === 3;
  const activeOption = presentation.options.find((option) => option.active);
  const waitingForResult =
    available &&
    awaitingOfficialResult(
      presentation.phase,
      presentation.endsAt,
      now,
      presentation.canVote,
    ) &&
    presentation.connection?.status === "ready";
  const resultDetails = presentation.result ? resultCopy(presentation.result) : null;
  const title = (() => {
    if (!available) return "Chat voting inactive";
    if (waitingForResult) return "Awaiting the official result";
    if (presentation.phase === "active") return "Sidequest active";
    if (presentation.phase === "result" && resultDetails) return resultDetails.title;
    if (presentation.phase === "cooldown") return "Next vote soon";
    return voting ? "Vote in Twitch chat" : "Chat voting inactive";
  })();

  return (
    <DesignSystemRoot theme="twitch" density="compact" className={styles.surface}>
      <Panel className={styles.shell}>
        <header className={styles.header}>
          <div className={styles.titleBlock}>
            <p className={styles.eyebrow}>Chat fallback</p>
            <h2 className={styles.title}>{title}</h2>
          </div>
          <StatusBadge tone={voting ? "success" : connectionTone(presentation.connection?.status)}>
            {presentation.participationMode ?? "loading"}
          </StatusBadge>
        </header>
        {presentation.connection?.status && presentation.connection.status !== "ready" ? (
          <Notice
            title={connectionLabel(presentation.connection.status)}
            tone={presentation.connection.status === "degraded" ? "warning" : "danger"}
            politeness="polite"
          >
            {connectionRecoveryCopy(presentation.connection.status)}
          </Notice>
        ) : null}
        {voting && !waitingForResult ? (
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
        ) : waitingForResult ? (
          <Notice title="Server confirmation pending" tone="info" politeness="polite">
            ChatXPT will announce the winner, tie resolution, or no-vote outcome in Twitch chat.
          </Notice>
        ) : presentation.phase === "active" && activeOption ? (
          <Notice title={activeOption.title} tone="success" politeness="polite">
            {activeOption.instruction}
          </Notice>
        ) : presentation.result && resultDetails ? (
          <Notice title={resultDetails.title} tone={resultDetails.tone} politeness="polite">
            {presentation.result.reason}
            {presentation.result.rewardPointsAwarded > 0
              ? ` Awarded ${formatReward(presentation.result.rewardPointsAwarded)}.`
              : null}
          </Notice>
        ) : (
          <Notice title="No chat vote is open">Wait for the next authorised poll.</Notice>
        )}
        <p className={styles.statusLine}>
          {voting && !waitingForResult
            ? "Send only 1, 2, or 3. ChatXPT replies with counted, duplicate, rejected, or late status after Twitch receives the message."
            : "Sidequest and result updates come from ChatXPT. No separate viewer account is needed."}
        </p>
      </Panel>
    </DesignSystemRoot>
  );
}

export function ObsQuestOverlaySurface({ view, now }: ObsQuestOverlaySurfaceProps) {
  const presentation = presentOverlay(view);
  const remaining = formatRemaining(presentation.endsAt, now);
  const waitingForResult =
    presentation.phase === "voting" &&
    presentation.endsAt !== null &&
    now !== undefined &&
    now >= presentation.endsAt;
  const resultDetails = presentation.result ? resultCopy(presentation.result) : null;
  const recovering =
    presentation.connection !== null && presentation.connection.status !== "ready";

  if (
    (presentation.phase === "inactive" || presentation.phase === "loading") &&
    !recovering
  ) {
    return (
      <DesignSystemRoot theme="dark" density="compact" className={styles.overlay}>
        <div className={styles.overlayEmpty} aria-hidden="true" />
      </DesignSystemRoot>
    );
  }

  return (
    <DesignSystemRoot theme="dark" density="compact" className={styles.overlay}>
      <Card
        ribbon={presentation.result?.outcome === "succeeded" ? "winner" : undefined}
        className={styles.overlayCard}
      >
        <div className={styles.shell}>
          <header className={styles.header}>
            <div className={styles.titleBlock}>
              <p className={styles.eyebrow}>
                {presentation.phase === "voting" ? "Audience vote" : "Sidequest"}
              </p>
              <h2 className={styles.title}>
                {presentation.phase === "voting"
                  ? waitingForResult
                    ? "Awaiting the official result"
                    : "Vote now"
                  : presentation.phase === "cooldown"
                    ? "Next vote soon"
                    : presentation.activeQuest?.title ?? resultDetails?.title ?? "Overlay reconnecting"}
              </h2>
            </div>
            <div className={styles.metaRow}>
              {remaining ? <StatusBadge tone="info">{remaining}</StatusBadge> : null}
              <StatusBadge tone={connectionTone(presentation.connection?.status)}>
                {connectionLabel(presentation.connection?.status)}
              </StatusBadge>
            </div>
          </header>
          {recovering ? (
            <p className={styles.statusLine} aria-live="polite">
              {overlayRecoveryCopy(presentation.connection?.status)}
            </p>
          ) : null}
          {presentation.phase === "voting" ? (
            <ol className={styles.overlayVotingList} aria-label="Authoritative vote tally">
              {presentation.options.map((option, index) => (
                <li key={option.candidateId} className={styles.overlayVotingOption}>
                  <span className={styles.chatDigit}>{index + 1}</span>
                  <strong>{option.title}</strong>
                  <span className={styles.overlayTally}>
                    {option.votes === null ? "Tally pending" : `${option.votes} votes`}
                  </span>
                </li>
              ))}
            </ol>
          ) : presentation.activeQuest ? (
            <p className={styles.instruction}>{presentation.activeQuest.instruction}</p>
          ) : null}
          {presentation.progress ? (
            <div className={styles.progressBlock}>
              <Progress
                label="Progress"
                value={presentation.progress.value}
                max={1}
                valueLabel={`${Math.round(presentation.progress.value * 100)}%`}
              />
              <p className={styles.progressMeta}>
                {progressMethodLabel(presentation.progress.method)}
              </p>
            </div>
          ) : null}
          {presentation.result && resultDetails ? (
            <p className={styles.statusLine} aria-live="polite">
              {resultDetails.title}: {presentation.result.reason}
              {presentation.result.rewardPointsAwarded > 0
                ? ` Awarded ${formatReward(presentation.result.rewardPointsAwarded)}.`
                : null}
            </p>
          ) : null}
        </div>
      </Card>
    </DesignSystemRoot>
  );
}
