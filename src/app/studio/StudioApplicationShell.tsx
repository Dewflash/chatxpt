"use client";

import { usePathname } from "next/navigation";

import {
  StreamerAuthorizedClient,
  type StreamerAuthorizedSurface,
} from "../streamer-authorized-client";

const STUDIO_SURFACES: Readonly<Record<string, StreamerAuthorizedSurface>> = {
  "/studio": "studio-home",
  "/studio/gameplay": "studio-gameplay",
  "/studio/gameplay/capture": "studio-gameplay",
  "/studio/live-analytics": "studio-live-analytics",
  "/studio/live-director": "studio-live-director",
  "/studio/live-quests": "studio-live-quests",
  "/studio/profile": "studio-profile",
  "/studio/stream-settings": "studio-stream-settings",
  "/studio/test-lab": "studio-test-lab",
};

export function studioSurfaceForPathname(pathname: string): StreamerAuthorizedSurface {
  return STUDIO_SURFACES[pathname] ?? "studio-home";
}

export function StudioApplicationShell() {
  const pathname = usePathname();
  return <StreamerAuthorizedClient surface={studioSurfaceForPathname(pathname)} />;
}
