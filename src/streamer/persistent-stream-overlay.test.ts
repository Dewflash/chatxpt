import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { createFixtureUiGatewaySnapshot, streamerViewModelSchema } from "../core";
import {
  contractFixtureLiveDirectorStateCatalog,
  contractFixtureUiX01ReadinessCatalog,
  contractFixtureUiX06RoleViewCatalog,
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

    expect(html).toContain("Private Live Director");
    expect(html).toContain("Chat health");
    expect(html).toContain("Gameplay");
    expect(html).toContain("Sidequest");
    expect(html).toContain("Realtime");
    expect(html).toContain("Director cue");
    expect(html).toContain("Private · no raw chat");
    expect(html).not.toContain("<button");
    expect(html).not.toContain("Turn into vote");
    expect(html).not.toContain(">Approve<");
    expect(html).not.toContain(">Reject<");
    expect(html).not.toContain(">Skip<");
    expect(html).not.toContain(">Cancel<");
  });

  it("keeps loading and emergency-pause states informational", () => {
    const loading = renderToStaticMarkup(h(PersistentStreamOverlaySurface, { view: null }));
    expect(loading).toContain("Live Director is ready");
    expect(loading).not.toContain("<button");

    const base = createFixtureUiGatewaySnapshot().views.streamer;
    const paused = streamerViewModelSchema.parse({
      ...base,
      emergencyPaused: true,
      liveDirector: contractFixtureLiveDirectorStateCatalog["live-director.privacy-denied.v1"],
    });
    const pausedHtml = renderToStaticMarkup(h(PersistentStreamOverlaySurface, { view: paused }));

    expect(pausedHtml).toContain("Emergency pause active");
    expect(pausedHtml).not.toContain("Clear emergency pause");
    expect(pausedHtml).not.toContain("<button");
  });

  it("shows the authoritative quest result during its display window", () => {
    const view = contractFixtureUiX06RoleViewCatalog["r5.quest.succeeded-reward.v1"].streamer;
    const active = view.questCycle.options.find(
      (option) => option.candidateId === view.questCycle.activeCandidateId,
    );
    const html = renderToStaticMarkup(h(PersistentStreamOverlaySurface, { view }));

    expect(html).toContain("Succeeded");
    expect(html).toContain(view.questCycle.result?.reason ?? "missing result");
    expect(html).not.toContain(active?.instruction ?? "missing active instruction");
  });
});
