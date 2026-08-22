import { createFixtureUiGatewaySnapshot } from "@/core";

import {
  InterfacePreview,
  type InterfacePreviewSurface,
} from "./interface-preview";

import styles from "./page.module.css";

export const dynamic = "force-dynamic";

const surfaces = new Set<InterfacePreviewSurface>([
  "studio",
  "config",
  "live-config",
  "viewer",
  "hosted",
  "chat",
  "overlay",
]);

export default async function InterfacePreviewPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly surface?: string }>;
}) {
  const requestedSurface = (await searchParams).surface;
  const surface = surfaces.has(requestedSurface as InterfacePreviewSurface)
    ? (requestedSurface as InterfacePreviewSurface)
    : "viewer";
  const snapshot = createFixtureUiGatewaySnapshot();

  return (
    <div
      className={`${styles.preview} ${surface === "overlay" ? "canonical-obs-overlay" : ""}`}
      data-preview-surface={surface}
    >
      <p className={styles.watermark}>Fixture preview · {surface}</p>
      <InterfacePreview
        surface={surface}
        streamerView={snapshot.views.streamer}
        viewerView={snapshot.views.viewer}
        overlayView={snapshot.views.overlay}
      />
    </div>
  );
}
