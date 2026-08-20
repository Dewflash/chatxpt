import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { createFixtureUiGatewaySnapshot } from "../core";
import { contractFixtureUiX01ReadinessCatalog } from "../core/testing";
import { StudioProductPageSurface, type StudioProductPage } from "./studio-product-pages";

const pages: readonly StudioProductPage[] = [
  "home",
  "gameplay",
  "live-analytics",
  "live-quests",
  "profile",
  "stream-settings",
  "test-lab",
];

const requiredPageSections: Readonly<Record<StudioProductPage, readonly string[]>> = {
  home: ["Ready to start ChatXPT", "Twitch", "Game Capture", "Viewer Voting", "Broadcast Overlay"],
  gameplay: ["Overview", "Game Capture", "Understanding", "Health &amp; Recovery"],
  "live-analytics": ["Overview", "Activity", "Topics", "Session History"],
  "live-quests": ["Now", "Recommendations", "Why", "Voting", "Results"],
  profile: ["Personality", "Stream Presets", "Safety", "Accessibility"],
  "stream-settings": ["Saved Source", "Session Override", "Reset to Saved"],
  "test-lab": ["Sample / Live Source", "Capture Controls", "Observed / Unknown", "Recovery"],
};

describe("StudioProductPageSurface", () => {
  it("renders the ICP-01 Studio route map with product-facing navigation", () => {
    const view = createFixtureUiGatewaySnapshot().views.streamer;
    const readiness = contractFixtureUiX01ReadinessCatalog["r4.setup.ready.v1"];
    const html = renderToStaticMarkup(h(StudioProductPageSurface, {
      page: "home",
      view,
      readiness,
    }));

    expect(html).toContain("ChatXPT Studio");
    expect(html).toContain("Gameplay Engine");
    expect(html).toContain("Live Analytics");
    expect(html).toContain("Live Quests");
    expect(html).toContain("Profile &amp; Defaults");
    expect(html).toContain("Stream Settings");
    expect(html).toContain("Test Lab");
    expect(html).toContain("Open the right workspace");
    expect(html).toContain("Ready to start ChatXPT");
    expect(html).toContain("Viewer Voting");
    expect(html).toContain("Broadcast Overlay");
    expect(html).not.toContain("fixture");
    expect(html).not.toContain("Fixture");
    expect(html).not.toContain("tester");
    expect(html).not.toContain("Role ");
  });

  it.each(pages)("renders %s without a loaded session and keeps controls unavailable", (page) => {
    const html = renderToStaticMarkup(h(StudioProductPageSurface, {
      page,
      view: null,
      readiness: null,
    }));

    expect(html).toContain("Connect Studio");
    expect(html).toContain("Unavailable controls stay visible only when ChatXPT can explain what is needed next.");
    expect(html).not.toContain("Not live workflow evidence");
    expect(html).not.toContain("revision label");
    expect(html).not.toContain("Open diagnostics");
    expect(html).not.toContain("scheduled for");
  });

  it("keeps Test Lab sample/live distinction outside ordinary product pages", () => {
    const home = renderToStaticMarkup(h(StudioProductPageSurface, {
      page: "home",
      view: createFixtureUiGatewaySnapshot().views.streamer,
    }));
    const lab = renderToStaticMarkup(h(StudioProductPageSurface, {
      page: "test-lab",
      view: createFixtureUiGatewaySnapshot().views.streamer,
    }));

    expect(home).not.toContain("Sample checks and live source checks");
    expect(lab).toContain("Sample checks and live source checks are not connected yet");
  });

  it.each(pages)("renders the required ICP-01 sections for %s", (page) => {
    const html = renderToStaticMarkup(h(StudioProductPageSurface, {
      page,
      view: createFixtureUiGatewaySnapshot().views.streamer,
      readiness: contractFixtureUiX01ReadinessCatalog["r4.setup.ready.v1"],
    }));

    for (const section of requiredPageSections[page]) {
      expect(html).toContain(section);
    }
  });

  it("links Gameplay Engine capture setup to the Studio product route", () => {
    const html = renderToStaticMarkup(h(StudioProductPageSurface, {
      page: "gameplay",
      view: createFixtureUiGatewaySnapshot().views.streamer,
      readiness: contractFixtureUiX01ReadinessCatalog["r4.setup.ready.v1"],
    }));

    expect(html).toContain("/studio/gameplay/capture");
    expect(html).not.toContain("/diagnostics/gameplay-extraction");
  });

  it("renders the blocked Home composition without dispatchable start controls", () => {
    const view = createFixtureUiGatewaySnapshot().views.streamer;
    const readiness = contractFixtureUiX01ReadinessCatalog["r4.setup.permission-denied.v1"];
    const html = renderToStaticMarkup(h(StudioProductPageSurface, {
      page: "home",
      view,
      readiness,
      onCommand: () => undefined,
    }));

    expect(html).toContain("Resolve the highlighted setup blocker before starting ChatXPT.");
    expect(html).toContain("Resolve setup first");
    expect(html).not.toContain("<button");
  });

  it("renders live Home as stream control instead of setup start", () => {
    const snapshot = createFixtureUiGatewaySnapshot();
    const view = {
      ...snapshot.views.streamer,
      session: { ...snapshot.views.streamer.session, status: "live" as const },
    };
    const html = renderToStaticMarkup(h(StudioProductPageSurface, {
      page: "home",
      view,
      readiness: contractFixtureUiX01ReadinessCatalog["r4.setup.ready.v1"],
      onCommand: () => undefined,
    }));

    expect(html).toContain("ChatXPT is live for this stream");
    expect(html).toContain("End unavailable");
    expect(html).toContain("Open Live Quests");
  });
});
