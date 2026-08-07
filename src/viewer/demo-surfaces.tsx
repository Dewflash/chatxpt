"use client";

import { useMemo } from "react";

import { ChatFallbackInstructions } from "./chat-fallback";
import { acceptFixtureVote, createOverlayDemoView, createViewerDemoView } from "./demo-fixtures";
import { ViewerOverlayVisual } from "./overlay-visual";
import type { ViewerSurfaceMode, ViewerVoteDispatcher } from "./surface-model";
import { ViewerQuestBoard } from "./viewer-quest-board";

export function ViewerQuestBoardDemo({ surface }: { readonly surface: ViewerSurfaceMode }) {
  const initialView = useMemo(
    () => createViewerDemoView({ mode: surface === "extension" ? "twitch-extension" : "hosted-board" }),
    [surface],
  );

  const dispatchVote: ViewerVoteDispatcher = (command) =>
    new Promise((resolve) => {
      window.setTimeout(() => {
        resolve({
          ok: true,
          view: acceptFixtureVote(initialView, command.candidateId),
          message: "Vote accepted by fixture authority.",
        });
      }, 420);
    });

  return (
    <ViewerQuestBoard
      demoLabel="Fixture-only surface"
      dispatchVote={dispatchVote}
      heading={surface === "extension" ? "Vote without leaving Twitch" : "Join by link or room code"}
      initialView={initialView}
      surface={surface}
      voterKey="fixture-viewer-key"
    />
  );
}

export function ChatFallbackInstructionsDemo() {
  return <ChatFallbackInstructions view={createViewerDemoView({ mode: "twitch-chat" })} />;
}

export function ViewerOverlayDemo() {
  return <ViewerOverlayVisual view={createOverlayDemoView("active")} now={1_786_200_016_000} />;
}
