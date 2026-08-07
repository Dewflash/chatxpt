import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  Button,
  Card,
  DesignSystemRoot,
  Field,
  IconButton,
  Notice,
  Progress,
  StatusBadge,
} from ".";

describe("design-system public contract", () => {
  it("marks the selected theme and density context", () => {
    const html = renderToStaticMarkup(
      h(DesignSystemRoot, { theme: "twitch", density: "compact" }, "Controls"),
    );

    expect(html).toContain('data-theme="twitch"');
    expect(html).toContain('data-density="compact"');
  });

  it("keeps loading buttons unavailable and exposes busy state", () => {
    const html = renderToStaticMarkup(h(Button, { loading: true }, "Connect Twitch"));

    expect(html).toContain("disabled");
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("Connect Twitch");
  });

  it("requires and renders an accessible icon-button name", () => {
    const html = renderToStaticMarkup(
      h(IconButton, { "aria-label": "Close setup" }, "×"),
    );

    expect(html).toContain('aria-label="Close setup"');
  });

  it("connects field labels, hints, and errors to the input", () => {
    const html = renderToStaticMarkup(
      h(Field, {
        id: "channel-name",
        label: "Channel name",
        hint: "Use your Twitch channel name.",
        error: "Channel name is required.",
        required: true,
      }),
    );

    expect(html).toContain('for="channel-name"');
    expect(html).toContain('aria-describedby="channel-name-hint channel-name-error"');
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('id="channel-name-error"');
  });

  it("combines a visible status symbol with text", () => {
    const html = renderToStaticMarkup(
      h(StatusBadge, { tone: "success", children: "Twitch connected" }),
    );

    expect(html).toContain('data-tone="success"');
    expect(html).toContain("✓");
    expect(html).toContain("Twitch connected");
  });

  it("exposes the reserved card ribbon state without relying on CSS", () => {
    const html = renderToStaticMarkup(
      h(Card, { ribbon: "winner" }, "Quest result"),
    );

    expect(html).toContain('data-ribbon="winner"');
    expect(html).toContain("Winner. ");
  });

  it("clamps authoritative progress and keeps its value label", () => {
    const html = renderToStaticMarkup(
      h(Progress, { label: "Setup complete", value: 120, max: 100 }),
    );

    expect(html).toContain('value="100"');
    expect(html).toContain('max="100"');
    expect(html).toContain('aria-valuetext="100%"');
  });

  it("announces notices only when the caller opts in", () => {
    const quiet = renderToStaticMarkup(
      h(Notice, { title: "Connection paused" }, "Reconnect when ready."),
    );
    const urgent = renderToStaticMarkup(
      h(
        Notice,
        { title: "Connection lost", tone: "danger", politeness: "assertive" },
        "Reconnect to continue.",
      ),
    );

    expect(quiet).not.toContain("aria-live");
    expect(urgent).toContain('role="alert"');
    expect(urgent).toContain('aria-live="assertive"');
  });
});
