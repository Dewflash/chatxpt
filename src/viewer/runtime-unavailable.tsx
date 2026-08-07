import { DesignSystemRoot, Notice, Panel, StatusBadge } from "../design-system";
import styles from "./viewer-surfaces.module.css";

export type ViewerRuntimeSurface = "extension" | "hosted-board" | "chat" | "overlay-preview";

const surfaceCopy: Record<ViewerRuntimeSurface, { readonly eyebrow: string; readonly title: string; readonly body: string }> = {
  extension: {
    eyebrow: "Twitch Extension",
    title: "Viewer voting is waiting for the stream session",
    body: "The streamer has not connected an authorised ChatXPT session to this surface yet.",
  },
  "hosted-board": {
    eyebrow: "Hosted Quest Board",
    title: "Quest Board is not linked yet",
    body: "Open this page from a live ChatXPT room link once the streamer starts an authorised session.",
  },
  chat: {
    eyebrow: "Twitch chat fallback",
    title: "Chat voting is not active",
    body: "When chat voting is the active fallback, the stream will show which number maps to each quest.",
  },
  "overlay-preview": {
    eyebrow: "OBS overlay",
    title: "Overlay is waiting for a live quest",
    body: "The broadcast overlay stays quiet until there is a live vote, active quest, or result to show.",
  },
};

export function ViewerRuntimeUnavailable({ surface }: { readonly surface: ViewerRuntimeSurface }) {
  const copy = surfaceCopy[surface];

  return (
    <DesignSystemRoot className={styles.viewerSurface} density="compact" theme="twitch">
      <div className={styles.viewerShell}>
        <header className={styles.viewerTopbar}>
          <div className={styles.brand}><span className={styles.mark}>XP</span><span>ChatXPT</span></div>
          <StatusBadge tone="warning">Not connected</StatusBadge>
        </header>

        <section className={styles.hero}>
          <p className={styles.eyebrow}>{copy.eyebrow}</p>
          <h1>{copy.title}</h1>
          <p>{copy.body}</p>
        </section>

        <Panel className={styles.panel} aria-label="Viewer runtime status">
          <Notice title="Waiting for live stream state" tone="warning">
            This page will show the current viewer state after ChatXPT receives the live session snapshot.
          </Notice>
        </Panel>
      </div>
    </DesignSystemRoot>
  );
}

export function ViewerOverlayInactive() {
  return (
    <DesignSystemRoot className={styles.overlaySurface} theme="twitch">
      <div className={styles.overlayInactive} aria-label="Overlay inactive" />
    </DesignSystemRoot>
  );
}
