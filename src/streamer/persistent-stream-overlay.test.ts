import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { createFixtureUiGatewaySnapshot, streamerViewModelSchema } from "../core";
import {
  contractFixtureLiveDirectorStateCatalog,
  contractFixtureUiX01ReadinessCatalog,
} from "../core/testing";
import { PersistentStreamOverlaySurface } from "./persistent-stream-overlay";

describe("PersistentStreamOverlaySurface", () => {
  it("renders private stream context as read-only status without controls", () => {
    const base = createFixtureUiGatewaySnapshot().views.streamer;
    const view = streamerViewModelSchema.parse({
      ...base,
      liveDirector: contractFixtureLiveDirectorStateCatalog["live-director.known.v1"],
    });
    const html = renderToStaticMarkup(h(PersistentStreamOverlaySurface, {
      view,
      readiness: contractFixtureUiX01ReadinessCatalog["r4.setup.ready.v1"],
    }));

    expect(html).toContain("ChatXPT Stream Context");
    expect(html).toContain("OBS Capture");
    expect(html).toContain("Gameplay");
    expect(html).toContain("Audience");
    expect(html).toContain("Sidequests");
    expect(html).toContain("Realtime");
    expect(html).toContain("Director Cue");
    expect(html).toContain("Streamer says");
    expect(html).toContain("ChatXPT detects");
    expect(html).toContain("Chat suggests");
    expect(html).toContain("Sources stay separate");
    expect(html).toContain("Private broadcaster context only");
    expect(html).not.toContain("<button");
    expect(html).not.toContain("Turn into vote");
    expect(html).not.toContain(">Approve<");
    expect(html).not.toContain(">Reject<");
    expect(html).not.toContain(">Skip<");
    expect(html).not.toContain(">Cancel<");
  });

  it("keeps loading and emergency-pause states informational", () => {
    const loading = renderToStaticMarkup(h(PersistentStreamOverlaySurface, { view: null }));
    expect(loading).toContain("Loading stream context");
    expect(loading).not.toContain("<button");

    const base = createFixtureUiGatewaySnapshot().views.streamer;
    const paused = streamerViewModelSchema.parse({
      ...base,
      emergencyPaused: true,
      liveDirector: contractFixtureLiveDirectorStateCatalog["live-director.privacy-denied.v1"],
    });
    const pausedHtml = renderToStaticMarkup(h(PersistentStreamOverlaySurface, { view: paused }));

    expect(pausedHtml).toContain("Emergency pause active");
    expect(pausedHtml).toContain("Permission Denied");
    expect(pausedHtml).not.toContain("Clear emergency pause");
    expect(pausedHtml).not.toContain("<button");
  });
});
