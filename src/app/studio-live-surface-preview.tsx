"use client";

import { useEffect, useMemo, useState } from "react";

import {
  CanonicalViewProjector,
  serviceHealthSchema,
  viewerViewModelSchema,
  type OverlayViewModel,
  type StreamerViewModel,
  type ViewerViewModel,
} from "@/core";
import { ObsQuestOverlaySurface, TwitchExtensionViewerSurface } from "@/viewer";

export interface StudioLiveSurfaceViews {
  readonly viewer: ViewerViewModel;
  readonly overlay: OverlayViewModel;
}

/**
 * Reprojects the authoritative broadcaster snapshot through the same canonical
 * public projector used by the live Twitch and OBS routes. Personal viewer
 * receipts and points are intentionally absent from the Studio preview.
 */
export function projectStudioLiveSurfaceViews(
  view: StreamerViewModel,
  projectedAt: number,
): StudioLiveSurfaceViews {
  const projector = new CanonicalViewProjector();
  const common = {
    envelope: {
      ...view.envelope,
      occurredAt: projectedAt,
      receivedAt: projectedAt,
      source: "studio" as const,
    },
    session: view.session,
    profile: view.profile,
    services: view.services,
    gameplay: view.gameplay,
    audience: view.audience,
    questCycle: view.questCycle,
    emergencyPaused: view.emergencyPaused,
    capabilities: view.session.capabilities,
    viewerId: null,
    sessionPoints: 0,
    communityHype: view.communityHype,
    acceptedCandidateId: null,
    sessionOverride: view.sessionOverride,
    liveDirector: view.liveDirector,
  };
  const viewerProjection = projector.project({
    ...common,
    participationMode: "twitch-extension",
    connection: serviceHealthSchema.parse({
      service: "twitch-extension-ebs",
      status: "ready",
      checkedAt: projectedAt,
      message: "Studio is previewing the current Twitch Extension state",
      retryable: false,
    }),
  });
  const overlayProjection = projector.project({
    ...common,
    participationMode: "unavailable",
    connection: serviceHealthSchema.parse({
      service: "obs-overlay",
      status: "ready",
      checkedAt: projectedAt,
      message: "Studio is previewing the current OBS overlay state",
      retryable: false,
    }),
  });
  const viewer = viewerViewModelSchema.parse(viewerProjection.viewer);

  return {
    viewer: viewerViewModelSchema.parse(
      viewer.questCycle.status === "voting" && viewer.acceptedCandidateId === null
        ? { ...viewer, questCycle: { ...viewer.questCycle, voteTallies: [] } }
        : viewer,
    ),
    overlay: overlayProjection.overlay,
  };
}

function usePreviewClock(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(interval);
  }, []);
  return now;
}

export function StudioTwitchExtensionLivePreview({
  view,
}: {
  readonly view: StreamerViewModel;
}) {
  const now = usePreviewClock();
  const projected = useMemo(
    () => projectStudioLiveSurfaceViews(view, Math.max(now, view.envelope.receivedAt)),
    [now, view],
  );
  return <TwitchExtensionViewerSurface view={projected.viewer} now={now} />;
}

export function StudioObsOverlayLivePreview({
  view,
}: {
  readonly view: StreamerViewModel;
}) {
  const now = usePreviewClock();
  const projected = useMemo(
    () => projectStudioLiveSurfaceViews(view, Math.max(now, view.envelope.receivedAt)),
    [now, view],
  );
  return <ObsQuestOverlaySurface view={projected.overlay} now={now} />;
}
