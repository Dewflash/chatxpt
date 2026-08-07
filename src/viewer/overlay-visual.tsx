import type { OverlayViewModel } from "../core";
import { createOverlayDemoView } from "./demo-fixtures";
import { activeQuest, overlayPlacementClass, remainingSeconds } from "./surface-model";
import styles from "./viewer-surfaces.module.css";

export interface ViewerOverlayVisualProps {
  readonly view: OverlayViewModel;
  readonly now?: number;
}

export function ViewerOverlayVisual({ view, now }: ViewerOverlayVisualProps) {
  const effectiveNow = now ?? view.envelope.receivedAt;
  const quest = activeQuest(view.questCycle) ?? view.questCycle.options[0] ?? null;
  const seconds = remainingSeconds(effectiveNow, view.questCycle.endsAt);
  const progress = view.questCycle.progress?.value ?? 0;
  const placement = overlayPlacementClass(view);
  const connectionCopy = view.connection.status === "ready" ? "Chat sidequest" : "Reconnecting";
  const result = view.questCycle.result;

  return (
    <main className={styles.overlaySurface}>
      {quest === null ? (
        <section className={`${styles.overlayCard} ${styles.quiet}`} aria-label="Overlay waiting state">
          <div className={styles.overlayMeta}><span>ChatXPT</span><span>Ready</span></div>
          <h1>Overlay ready</h1>
          <p>No active quest is currently visible.</p>
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
            <div className={styles.progressTrack}><i style={{ width: `${Math.round(progress * 100)}%` }} /></div>
            <span className={styles.smallPill}>Hype {view.communityHype}</span>
          </div>
        </section>
      )}
    </main>
  );
}

export function ViewerOverlayDemo() {
  return <ViewerOverlayVisual view={createOverlayDemoView("active")} now={1_786_200_016_000} />;
}
