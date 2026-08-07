import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ChatFallbackInstructions } from "./chat-fallback";
import { createOverlayDemoView, createViewerDemoView } from "./demo-fixtures";
import { QuestOverlay, ViewerOverlayVisual } from "./overlay-visual";
import { ViewerOverlayInactive, ViewerRuntimeUnavailable } from "./runtime-unavailable";
import { HostedQuestBoard, TwitchViewerPanel, ViewerQuestBoard } from "./viewer-quest-board";

describe("Role 5 public viewer surfaces", () => {
  it("renders the production board through the shared design-system boundary", () => {
    const view = createViewerDemoView();
    const html = renderToStaticMarkup(
      h(ViewerQuestBoard, {
        dispatchVote: async () => ({ ok: false as const, message: "not submitted during server render" }),
        heading: "Vote without leaving Twitch",
        initialView: view,
        surface: "extension",
        voterKey: "render-test-viewer",
      }),
    );

    expect(html).toContain('data-theme="twitch"');
    expect(html).toContain('data-density="compact"');
    expect(html).toContain("Vote without leaving Twitch");
    expect(html).toContain("Guardian Protocol");
    expect(html).toContain("Caster Mode");
    expect(html).toContain("Chat Battle Cry");
    expect(html).toContain("Select a card, then vote.");
    expect(html).not.toContain("Fixture-only surface");
    expect(html).not.toContain("fixture dispatcher");
    expect(html).not.toContain("Role 1");
    expect(html).not.toContain("Role 5");
  });

  it("keeps technical fixture wording gated behind the diagnostic label", () => {
    const html = renderToStaticMarkup(
      h(ViewerQuestBoard, {
        demoLabel: "Fixture-only surface",
        dispatchVote: async () => ({ ok: false as const, message: "not submitted during server render" }),
        initialView: createViewerDemoView(),
        surface: "extension",
        voterKey: "render-test-viewer",
      }),
    );

    expect(html).toContain("Fixture-only surface");
    expect(html).toContain("Role 5 renders state");
    expect(html).toContain("Role 1 remains");
  });

  it("renders chat fallback instructions without claiming chat parsing authority", () => {
    const html = renderToStaticMarkup(
      h(ChatFallbackInstructions, {
        view: createViewerDemoView({ mode: "twitch-chat" }),
      }),
    );

    expect(html).toContain("Twitch chat fallback");
    expect(html).toContain("Vote with 1, 2, or 3");
    expect(html).toContain("Send 1, 2, or 3 once");
    expect(html).toContain("duplicate");
    expect(html).toContain("Status updates appear only after ChatXPT confirms them.");
    expect(html).not.toContain("Role 1");
    expect(html).not.toContain("Role 5");
    expect(html).not.toContain("Twitch chat fixture");
  });

  it("renders Role 1 supplied chat vote acknowledgement states", () => {
    const html = renderToStaticMarkup(
      h(ChatFallbackInstructions, {
        acknowledgements: [
          { status: "counted", optionNumber: 1, message: "Your chat vote was counted." },
          { status: "duplicate", optionNumber: 1, message: "Your first vote is already counted." },
          { status: "late", message: "Voting already closed." },
          { status: "unavailable", message: "Chat voting is not the active fallback." },
        ],
        view: createViewerDemoView({ mode: "twitch-chat" }),
      }),
    );

    expect(html).toContain("Chat vote acknowledgement status");
    expect(html).toContain("Counted");
    expect(html).toContain("Duplicate");
    expect(html).toContain("Late");
    expect(html).toContain("Unavailable");
    expect(html).toContain("Option 1");
  });

  it("exports stable Role 1 mount wrappers for extension and hosted surfaces", () => {
    const view = createViewerDemoView();
    const dispatchVote = async () => ({ ok: false as const, message: "not submitted during server render" });
    const extension = renderToStaticMarkup(
      h(TwitchViewerPanel, {
        dispatchVote,
        initialView: view,
        voterKey: "render-test-viewer",
      }),
    );
    const hosted = renderToStaticMarkup(
      h(HostedQuestBoard, {
        dispatchVote,
        initialView: createViewerDemoView({ mode: "hosted-board" }),
        voterKey: "render-test-viewer",
      }),
    );

    expect(extension).toContain("Vote without leaving Twitch");
    expect(extension).toContain('data-surface="extension"');
    expect(hosted).toContain("Join by link or room code");
    expect(hosted).toContain('data-surface="hosted-board"');
  });

  it("renders hosted room access failures without inventing room authority", () => {
    const html = renderToStaticMarkup(
      h(HostedQuestBoard, {
        access: {
          status: "expired",
          roomCode: "ABCDEFGH",
          message: "This room is no longer attached to a live ChatXPT session.",
          retryable: false,
        },
        dispatchVote: async () => ({ ok: false as const, message: "not submitted during server render" }),
        voterKey: "render-test-viewer",
      }),
    );

    expect(html).toContain("Room expired");
    expect(html).toContain("ABCDEFGH");
    expect(html).toContain("Use another voting path");
    expect(html).toContain("Ask the streamer for a fresh link");
    expect(html).not.toContain("Role 1");
    expect(html).not.toContain("Role 5");
    expect(html).not.toContain("Guardian Protocol");
  });

  it("renders the overlay as read-only shared quest state", () => {
    const html = renderToStaticMarkup(
      h(ViewerOverlayVisual, {
        now: 1_786_200_016_000,
        view: createOverlayDemoView("active"),
      }),
    );

    expect(html).toContain('data-theme="twitch"');
    expect(html).toContain("Guardian Protocol");
    expect(html).toContain("43s");
    expect(html).toContain("Quest progress");
    expect(html).toContain("Hype 82");
    expect(html).not.toContain("Vote");
  });

  it("renders inactive and voting overlay states without pretending a winner exists", () => {
    const inactive = renderToStaticMarkup(
      h(ViewerOverlayVisual, {
        view: createOverlayDemoView("inactive"),
      }),
    );
    const voting = renderToStaticMarkup(
      h(ViewerOverlayVisual, {
        now: 1_786_200_000_000,
        view: createOverlayDemoView("voting"),
      }),
    );

    expect(inactive).toContain("Overlay inactive");
    expect(inactive).not.toContain("Overlay ready");
    expect(inactive).not.toContain("No active quest is currently visible.");
    expect(voting).toContain("Voting open");
    expect(voting).toContain("Chat is choosing");
    expect(voting).toContain("Guardian Protocol");
    expect(voting).toContain("Caster Mode");
    expect(voting).not.toContain("+600 XP");
  });

  it("shows the overlay ready card only when a diagnostic preview asks for it", () => {
    const html = renderToStaticMarkup(
      h(ViewerOverlayVisual, {
        showInactivePreview: true,
        view: createOverlayDemoView("inactive"),
      }),
    );

    expect(html).toContain("Overlay ready");
    expect(html).toContain("No active quest is currently visible.");
  });

  it("keeps public route fallbacks free of bundled fixture quest state", () => {
    const html = renderToStaticMarkup(
      h(ViewerRuntimeUnavailable, {
        surface: "extension",
      }),
    );
    const overlay = renderToStaticMarkup(h(ViewerOverlayInactive));

    expect(html).toContain("Viewer voting is waiting for the stream session");
    expect(html).toContain("Waiting for live stream state");
    expect(html).not.toContain("Guardian Protocol");
    expect(html).not.toContain("Fixture-only surface");
    expect(html).not.toContain("Role 1");
    expect(html).not.toContain("Role 5");
    expect(overlay).toContain("Overlay inactive");
    expect(overlay).not.toContain("Overlay ready");
  });

  it("exports the accepted quest overlay wrapper name", () => {
    const html = renderToStaticMarkup(
      h(QuestOverlay, {
        now: 1_786_200_016_000,
        view: createOverlayDemoView("active"),
      }),
    );

    expect(html).toContain("Guardian Protocol");
    expect(html).toContain("Quest progress");
  });
});
