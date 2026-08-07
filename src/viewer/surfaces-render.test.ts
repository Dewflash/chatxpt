import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ChatFallbackInstructions } from "./chat-fallback";
import { createOverlayDemoView, createViewerDemoView } from "./demo-fixtures";
import { ViewerOverlayVisual } from "./overlay-visual";
import { ViewerQuestBoard } from "./viewer-quest-board";

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
});
