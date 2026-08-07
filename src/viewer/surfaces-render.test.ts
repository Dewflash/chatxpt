import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ChatFallbackInstructions } from "./chat-fallback";
import { createOverlayDemoView, createViewerDemoView } from "./demo-fixtures";
import { QuestOverlay, ViewerOverlayVisual } from "./overlay-visual";
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
    expect(html).toContain("Role 1 owns Twitch chat reading");
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
    expect(html).toContain("Role 5 does not create room access");
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
