import type { OverlayViewModel } from "../core";
import { DesignSystemRoot, Progress, StatusBadge } from "../design-system";
import { activeQuest, overlayPlacementClass, remainingSeconds } from "./surface-model";
import styles from "./viewer-surfaces.module.css";

export interface ViewerOverlayVisualProps {
  readonly view: OverlayViewModel;
  readonly now?: number;
  readonly showInactivePreview?: boolean;
}

export function ViewerOverlayVisual({ showInactivePreview = false, view, now }: ViewerOverlayVisualProps) {
  const effectiveNow = now ?? view.envelope.receivedAt;
  const quest = activeQuest(view.questCycle);
  const seconds = remainingSeconds(effectiveNow, view.questCycle.endsAt);
  const progress = view.questCycle.progress?.value ?? 0;
  const placement = overlayPlacementClass(view);
  const connectionCopy = view.connection.status === "ready" ? "Chat sidequest" : "Reconnecting";
  const result = view.questCycle.result;
  const votingOptions = view.questCycle.status === "voting" ? view.questCycle.options : [];
  const votingDuration =
    view.questCycle.startsAt === null || view.questCycle.endsAt === null
      ? 0
      : view.questCycle.endsAt - view.questCycle.startsAt;
  const votingProgress =
    view.questCycle.startsAt === null || votingDuration <= 0
      ? 0
      : Math.max(
          0,
          Math.min(
            100,
            Math.round(
              ((effectiveNow - view.questCycle.startsAt) / votingDuration) * 100,
            ),
          ),
        );

  return (
    <DesignSystemRoot className={styles.overlaySurface} theme="twitch">
      {quest === null && votingOptions.length === 0 && !showInactivePreview ? (
        <div className={styles.overlayInactive} aria-label="Overlay inactive" />
      ) : quest === null && votingOptions.length === 0 ? (
        <section className={`${styles.overlayCard} ${styles.quiet}`} aria-label="Overlay waiting state">
          <div className={styles.overlayMeta}><span>ChatXPT</span><span>Ready</span></div>
          <h1>Overlay ready</h1>
          <p>No active quest is currently visible.</p>
        </section>
      ) : quest === null ? (
        <section className={`${styles.overlayCard} ${styles.edge}`} aria-label="Voting overlay">
          <div className={styles.overlayMeta}>
            <span>{view.connection.status === "ready" ? "Voting open" : "Reconnecting"}</span>
            <span>{seconds ?? "--"}s</span>
          </div>
          <h1>Chat is choosing</h1>
          <ol className={styles.overlayOptionList}>
            {votingOptions.map((option, index) => (
              <li key={option.candidateId}>
                <span>{index + 1}</span>
                <strong>{option.title}</strong>
              </li>
            ))}
          </ol>
          <div className={styles.overlayFooter}>
            <span className={styles.overlaySeconds}>{seconds ?? "--"}s</span>
            <Progress
              className={styles.overlayProgress}
              label="Voting countdown"
              value={votingProgress}
              valueLabel={seconds === null ? "Open" : `${seconds}s left`}
            />
            <StatusBadge tone="info">{`Hype ${view.communityHype}`}</StatusBadge>
          </div>
        </section>
      ) : (
        <section className={`${styles.overlayCard} ${styles[placement]}`} aria-label="Active quest overlay">
          <div className={styles.overlayMeta}>
            <span>{result ? result.outcome : connectionCopy}</span>
            <span>{result ? `+${result.rewardPointsAwarded} XP` : `+${quest.rewardPoints} XP`}</span>
          </div>
          <h1>{quest.title}</h1>
          <p>{result ? result.reason : quest.instruction}</p>
          <div className={styles.overlayFooter}>
            <span className={styles.overlaySeconds}>{seconds ?? "--"}s</span>
            <Progress
              className={styles.overlayProgress}
              label="Quest progress"
              value={Math.round(progress * 100)}
              valueLabel={`${Math.round(progress * 100)}%`}
            />
            <StatusBadge tone="info">{`Hype ${view.communityHype}`}</StatusBadge>
          </div>
        </section>
      )}
    </DesignSystemRoot>
  );
}

export function QuestOverlay(props: ViewerOverlayVisualProps) {
  return <ViewerOverlayVisual {...props} />;
}
