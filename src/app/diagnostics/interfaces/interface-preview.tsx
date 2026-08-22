"use client";

import { useMemo, useState } from "react";

import type { OverlayViewModel, StreamerViewModel, ViewerViewModel } from "@/core";
import {
  StudioManagementSurface,
  TwitchConfigSurface,
  TwitchLiveConfigSurface,
} from "@/streamer";
import {
  ChatFallbackInstructions,
  HostedQuestBoardSurface,
  ObsQuestOverlaySurface,
  TwitchExtensionViewerSurface,
} from "@/viewer";

export type InterfacePreviewSurface =
  | "studio"
  | "config"
  | "live-config"
  | "viewer"
  | "hosted"
  | "chat"
  | "overlay";

interface InterfacePreviewProps {
  readonly surface: InterfacePreviewSurface;
  readonly streamerView: StreamerViewModel;
  readonly viewerView: ViewerViewModel;
  readonly overlayView: OverlayViewModel;
}

function previewNow(endsAt: number | null): number | undefined {
  return endsAt === null ? undefined : endsAt - 17_000;
}

export function InterfacePreview({
  surface,
  streamerView,
  viewerView,
  overlayView,
}: InterfacePreviewProps) {
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const now = previewNow(viewerView.questCycle.endsAt);
  const chatView = useMemo<ViewerViewModel>(
    () => ({
      ...viewerView,
      participationMode: "twitch-chat",
      capabilities: {
        ...viewerView.capabilities,
        twitchExtension: false,
        hostedViewerBoard: false,
        twitchChatFallback: true,
      },
    }),
    [viewerView],
  );

  if (surface === "studio") {
    return <StudioManagementSurface view={streamerView} />;
  }

  if (surface === "config") {
    return <TwitchConfigSurface view={streamerView} studioHref="?surface=studio" />;
  }

  if (surface === "live-config") {
    return (
      <TwitchLiveConfigSurface
        view={streamerView}
        studioHref="?surface=studio"
        popoutHref="?surface=live-config"
      />
    );
  }

  if (surface === "hosted") {
    return (
      <HostedQuestBoardSurface
        view={viewerView}
        roomCode="QUEST123"
        selectedCandidateId={selectedCandidateId}
        now={now}
        onSelectCandidate={setSelectedCandidateId}
        onVoteCandidate={() => undefined}
        onReact={() => undefined}
      />
    );
  }

  if (surface === "chat") {
    return <ChatFallbackInstructions view={chatView} now={now} />;
  }

  if (surface === "overlay") {
    return <ObsQuestOverlaySurface view={overlayView} now={now} />;
  }

  return (
    <TwitchExtensionViewerSurface
      view={viewerView}
      selectedCandidateId={selectedCandidateId}
      now={now}
      onSelectCandidate={setSelectedCandidateId}
      onVoteCandidate={() => undefined}
      onReact={() => undefined}
    />
  );
}
