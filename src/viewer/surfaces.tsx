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
import type { OverlayViewModel, ViewerViewModel } from "../core";
import { presentOverlay, presentViewer, type ViewerQuestOptionPresentation } from "./presentation";
import styles from "./surfaces.module.css";

export interface ViewerSurfaceProps {
  readonly view: ViewerViewModel | null;
  readonly selectedCandidateId?: string | null;
  readonly pendingCandidateId?: string | null;
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

function statusTone(status: string | undefined) {
  if (status === "ready") return "success" as const;
  if (status === "degraded") return "warning" as const;
  if (status === "permission-denied" || status === "unavailable") return "danger" as const;
  return "neutral" as const;
}

function difficultyTone(difficulty: ViewerQuestOptionPresentation["difficulty"]) {
  if (difficulty === "hard") return "danger" as const;
  if (difficulty === "medium") return "warning" as const;
  return "success" as const;
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
  onSelectCandidate,
}: {
  readonly option: ViewerQuestOptionPresentation;
  readonly index: number;
  readonly selectedCandidateId: string | null;
  readonly pending: boolean;
  readonly canSelect: boolean;
  readonly onSelectCandidate?: (candidateId: string) => void;
}) {
  const selected = option.candidateId === selectedCandidateId || option.acceptedByViewer;
  const tallyLabel = option.votes === null ? "Tally hidden" : `${option.votes} votes`;

  return (
    <Card ribbon={optionRibbon(option, selectedCandidateId)} className={styles.option}>
      <button
        type="button"
        className={styles.optionButton}
        aria-pressed={selected}
        disabled={!canSelect || pending}
        onClick={() => onSelectCandidate?.(option.candidateId)}
      >
        <span className={styles.optionHeader}>
          <span>
            <span className={styles.optionNumber} aria-hidden="true">{index + 1}</span>
            <VisuallyHidden>Option {index + 1}. </VisuallyHidden>
          </span>
          <strong className={styles.optionTitle}>{option.title}</strong>
        </span>
        <span className={styles.instruction}>{option.instruction}</span>
      </button>
      <div className={styles.optionFooter}>
        <StatusBadge tone={difficultyTone(option.difficulty)}>{option.difficulty}</StatusBadge>
        <StatusBadge tone="info">{formatSeconds(option.durationSeconds)}</StatusBadge>
        <StatusBadge tone="success">{formatReward(option.rewardPoints)}</StatusBadge>
        {option.acceptedByViewer || option.active ? (
          <StatusBadge tone="success">{tallyLabel}</StatusBadge>
        ) : (
          <StatusBadge tone="neutral">{tallyLabel}</StatusBadge>
        )}
        {pending ? <StatusBadge tone="info">Sending</StatusBadge> : null}
      </div>
    </Card>
  );
}

function ViewerShell({
  surface,
  view,
  selectedCandidateId = null,
  pendingCandidateId = null,
  now,
  onSelectCandidate,
  onVoteCandidate,
  onReact,
}: ViewerSurfaceProps & { readonly surface: "extension" | "hosted" }) {
  const presentation = presentViewer(view);
  const remaining = formatRemaining(presentation.endsAt, now);
  const selectedOption = presentation.options.find(
    (option) => option.candidateId === selectedCandidateId,
  );
  const canSubmit = presentation.canVote && selectedOption !== undefined && pendingCandidateId === null;
  const rootClass = `${styles.surface} ${surface === "hosted" ? styles.hosted : ""}`;

  return (
    <DesignSystemRoot theme="twitch" density="compact" className={rootClass}>
      <Panel className={styles.shell}>
        <header className={styles.header}>
          <div className={styles.titleBlock}>
            <p className={styles.eyebrow}>
              {surface === "hosted" ? "Quest Board" : "Twitch Extension"}
            </p>
            <h2 className={styles.title}>{phaseTitle(presentation.phase)}</h2>
          </div>
          <div className={styles.metaRow}>
            {presentation.revision !== null ? (
              <StatusBadge tone="diagnostic">{`rev ${presentation.revision}`}</StatusBadge>
            ) : null}
            <StatusBadge tone={statusTone(presentation.connection?.status)}>
              {presentation.connection?.status ?? "loading"}
            </StatusBadge>
            {remaining ? <StatusBadge tone="info">{remaining}</StatusBadge> : null}
          </div>
        </header>

        {presentation.connection?.status && presentation.connection.status !== "ready" ? (
          <Notice
            tone={presentation.connection.status === "degraded" ? "warning" : "danger"}
            title={presentation.connection.message ?? "Connection not ready"}
            politeness="polite"
            className={styles.notice}
          >
            Latest safe quest is kept visible. Commands are disabled until authority returns.
          </Notice>
        ) : null}

        {presentation.options.length === 0 ? (
          <Notice title={phaseTitle(presentation.phase)} className={styles.notice}>
            No vote is open right now.
          </Notice>
        ) : (
          <CardGrid className={styles.options}>
            {presentation.options.map((option, index) => (
              <QuestOptionCard
                key={option.candidateId}
                option={option}
                index={index}
                selectedCandidateId={selectedCandidateId}
                pending={option.candidateId === pendingCandidateId}
                canSelect={presentation.canVote}
                onSelectCandidate={onSelectCandidate}
              />
            ))}
          </CardGrid>
        )}

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
            title={presentation.result.outcome}
            politeness="polite"
          >
            {presentation.result.reason} Awarded {formatReward(presentation.result.rewardPointsAwarded)}.
          </Notice>
        ) : null}

        <div className={styles.actions}>
          {presentation.phase === "voting" ? (
            <Button
              disabled={!canSubmit}
              loading={pendingCandidateId !== null}
              onClick={() => {
                if (selectedOption) onVoteCandidate?.(selectedOption.candidateId);
              }}
            >
              Vote
            </Button>
          ) : null}
          <p className={styles.statusLine} aria-live="polite">
            {presentation.acceptedCandidateId
              ? "Vote accepted."
              : presentation.canVote
                ? "Select one option, then vote."
                : "Voting is closed or unavailable."}
          </p>
          {presentation.canReact ? (
            <Button variant="secondary" onClick={() => onReact?.("hype")}>
              Send hype
            </Button>
          ) : null}
          <div className={styles.metaRow}>
            <StatusBadge tone="info">{`Hype ${presentation.communityHype}`}</StatusBadge>
            <StatusBadge tone="success">{`You ${formatReward(presentation.sessionPoints)}`}</StatusBadge>
          </div>
        </div>
      </Panel>
    </DesignSystemRoot>
  );
}

export function TwitchExtensionViewerSurface(props: ViewerSurfaceProps) {
  return <ViewerShell surface="extension" {...props} />;
}

export function HostedQuestBoardSurface({ roomCode, ...props }: HostedBoardSurfaceProps) {
  return (
    <div className={styles.shell}>
      {roomCode ? <StatusBadge tone="info">{`Room ${roomCode}`}</StatusBadge> : null}
      <ViewerShell surface="hosted" {...props} />
    </div>
  );
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
              <StatusBadge tone={statusTone(presentation.connection?.status)}>
                {presentation.connection?.status ?? "loading"}
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
