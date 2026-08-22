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
  home: ["Stream engagement", "Live Quests", "Chat Analytics", "Live surfaces", "Viewer Voting", "Broadcast Overlay"],
  gameplay: ["Overview", "Game Capture", "Understanding", "Health &amp; Recovery"],
  "live-analytics": ["Overview", "Activity", "Topics", "Session History"],
  "live-quests": ["Now", "Recommendations", "Why", "Voting", "Results"],
  profile: ["Personality", "Stream Presets", "Safety", "Accessibility"],
  "stream-settings": ["Saved Source", "Session Override", "Reset to Saved"],
  "test-lab": ["Clean Start Reset", "Sample / Live Source", "Capture Controls", "Observed / Unknown", "Recovery"],
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
    expect(html).toContain("Stream engagement");
    expect(html).toContain("What your stream sees");
    expect(html).toContain("Viewer Voting");
    expect(html).toContain("Broadcast Overlay");
    expect(html).not.toContain("fixture");
    expect(html).not.toContain("Fixture");
    expect(html).not.toContain("tester");
    expect(html).not.toContain("Role ");
  });

  it("can keep a persistent capture surface open while Studio navigation opens separately", () => {
    const html = renderToStaticMarkup(h(StudioProductPageSurface, {
      page: "gameplay",
      view: null,
      readiness: null,
      navigationTarget: "_blank",
      children: h("p", null, "Persistent capture controls"),
    }));

    expect(html).toContain("Persistent capture controls");
    expect(html).toContain('href="/studio/gameplay"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noreferrer"');
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

  it("renders an active Twitch OAuth link before the Studio session exists", () => {
    const html = renderToStaticMarkup(h(StudioProductPageSurface, {
      page: "home",
      view: null,
      readiness: null,
    }));

    expect(html).toContain('href="/api/twitch/oauth/start"');
    expect(html).toContain("Connect Twitch");
    expect(html).not.toContain("Connect Twitch to continue");
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
    expect(lab).toContain("Sample checks stay separate from live state");
    expect(lab).toContain("Start the entire ChatXPT test from the beginning");
    expect(lab).toContain("Reset ChatXPT to clean start");
    expect(lab).toContain("A direct browser tab cannot create a Twitch viewer identity");
    expect(lab).not.toContain('href="/viewer.html"');
  });

  it("keeps the clean-start reset available when Studio has no loaded session", () => {
    const html = renderToStaticMarkup(h(StudioProductPageSurface, {
      page: "test-lab",
      view: null,
      readiness: null,
      onResetSession: () => undefined,
    }));

    expect(html).toContain("Reset ChatXPT to clean start");
    expect(html).toContain("<button");
    expect(html).not.toContain("disabled=\"\"");
  });

  it("shows Generate quest now while the authoritative cycle is idle", () => {
    const base = createFixtureUiGatewaySnapshot().views.streamer;
    const view = {
      ...base,
      session: { ...base.session, status: "preparing" as const },
      questCycle: {
        ...base.questCycle,
        status: "idle" as const,
        options: [],
        activeCandidateId: null,
        availableStreamerActions: [],
        voteTallies: [],
        startsAt: null,
        endsAt: null,
        progress: null,
        completionRule: null,
        result: null,
      },
    };
    const html = renderToStaticMarkup(h(StudioProductPageSurface, {
      page: "live-quests",
      view,
      onCommand: () => undefined,
    }));

    expect(html).toContain("Generate quest now");
  });

  it("labels an immediate fallback as deterministic and evidence-free", () => {
    const base = createFixtureUiGatewaySnapshot().views.streamer;
    const view = {
      ...base,
      questCycle: {
        ...base.questCycle,
        status: "proposed" as const,
        options: base.questCycle.options.map((option) => ({
          ...option,
          sourceSignalIds: [],
          generation: {
            method: "deterministic-fallback" as const,
            provider: null,
            generatedAt: option.generation.generatedAt,
          },
        })),
      },
    };
    const html = renderToStaticMarkup(h(StudioProductPageSurface, {
      page: "live-quests",
      view,
    }));

    expect(html).toContain("Deterministic fallback shown");
    expect(html).toContain("without gameplay or audience evidence");
    expect(html).toContain("Evidence-driven recommendations use trusted signals later");
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

    expect(html).toContain("Resolve the highlighted setup blocker so ChatXPT can monitor the stream.");
    expect(html).toContain("Waiting for Twitch stream");
    expect(html).toContain('href="/studio/gameplay/capture"');
    expect(html).toContain("Allow camera");
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

    expect(html).toContain("Live Director · OBS + Game Engine");
    expect(html).toContain("End unavailable");
    expect(html).toContain("Open quests");
  });

  it("renders the connected waiting-for-Twitch composition without a manual start", () => {
    const snapshot = createFixtureUiGatewaySnapshot();
    const view = {
      ...snapshot.views.streamer,
      session: { ...snapshot.views.streamer.session, status: "offline" as const },
    };
    const html = renderToStaticMarkup(h(StudioProductPageSurface, {
      page: "home",
      view,
      readiness: contractFixtureUiX01ReadinessCatalog["r4.setup.ready.v1"],
      onCommand: () => undefined,
    }));

    expect(html).toContain("Twitch connected — waiting for the stream");
    expect(html).toContain("Change current game");
    expect(html).toContain("Waiting for Twitch stream");
    expect(html).not.toContain("Start ChatXPT");
  });
});
