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
    expect(html).not.toContain("fixture");
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

    expect(home).not.toContain("Sample and live source controls");
    expect(lab).toContain("Sample and live source controls are scheduled for ICP-08");
  });
});
