import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { createFixtureUiGatewaySnapshot, streamerViewModelSchema } from "../core";
import {
  contractFixtureLiveDirectorStateCatalog,
  contractFixtureUiX01ReadinessCatalog,
} from "../core/testing";
import { StudioManagementSurface } from "./studio-management";

function mixedGenerationView() {
  const view = createFixtureUiGatewaySnapshot().views.streamer;
  return streamerViewModelSchema.parse({
    ...view,
    questCycle: {
      ...view.questCycle,
      options: view.questCycle.options.map((option, index) => ({
        ...option,
        generation: index === 1
          ? { ...option.generation, method: "deterministic-fallback", provider: null }
          : { ...option.generation, method: "ai-provider", provider: "fixture-provider" },
      })),
    },
  });
}

describe("StudioManagementSurface", () => {
  it("keeps persistent and live controls unavailable before an authorised view loads", () => {
    const html = renderToStaticMarkup(h(StudioManagementSurface, { view: null }));

    expect(html).toContain("Loading authorised Studio state");
    expect(html).toContain("Saved defaults, health, session overrides, and controls remain unavailable");
    expect(html).not.toContain("Save supported defaults");
  });

  it("renders the complete Studio hierarchy with saved provenance and an honest session boundary", () => {
    const base = createFixtureUiGatewaySnapshot().views.streamer;
    const view = streamerViewModelSchema.parse({
      ...base,
      liveDirector: contractFixtureLiveDirectorStateCatalog["live-director.known.v1"],
    });
    const readiness = contractFixtureUiX01ReadinessCatalog["r4.setup.ready.v1"];
    const html = renderToStaticMarkup(h(StudioManagementSurface, { view, readiness }));

    expect(html).toContain("Profile &amp; defaults");
    expect(html).toContain("Saved profile · revision");
    expect(html).toContain("Streamer personality");
    expect(html).toContain("Sidequest preferences");
    expect(html).toContain("Game &amp; accessibility");
    expect(html).toContain("Voting");
    expect(html).toContain("Rewards");
    expect(html).toContain("Temporary overrides never rewrite defaults");
    expect(html).toContain("Effective source: saved default");
    expect(html).toContain("Session override contract required");
  });

  it("shows Capture Health, Signal Confidence, generation, and realtime independently", () => {
    const view = createFixtureUiGatewaySnapshot().views.streamer;
    const readiness = contractFixtureUiX01ReadinessCatalog["r4.setup.permission-denied.v1"];
    const html = renderToStaticMarkup(h(StudioManagementSurface, { view, readiness }));

    expect(html).toContain("Gameplay Capture");
    expect(html).toContain("Permission denied");
    expect(html).toContain("Allow capture");
    expect(html).toContain("Signal Confidence");
    expect(html).toContain("Low confidence");
    expect(html).toContain("Sidequest generation");
    expect(html).toContain("Fallback active");
    expect(html).toContain("Realtime");
    expect(html).toContain("There is no combined readiness percentage");
    expect(html).not.toContain("API key");
    expect(html).not.toContain("model selector");
  });

  it("keeps the reusable clean-start reset in Test Lab", () => {
    const view = createFixtureUiGatewaySnapshot().views.streamer;
    const html = renderToStaticMarkup(h(StudioManagementSurface, {
      view,
      onCommand: () => undefined,
    }));

    expect(html).toContain("Test Lab");
    expect(html).toContain("Reset the app for a clean-start test");
    expect(html).toContain("clears this browser&#x27;s Studio session");
    expect(html).toContain("End session &amp; reset");
  });

  it("warns when an AI candidate batch contains validated fallback replacements", () => {
    const html = renderToStaticMarkup(h(StudioManagementSurface, {
      view: mixedGenerationView(),
      readiness: contractFixtureUiX01ReadinessCatalog["r4.setup.ready.v1"],
    }));

    expect(html).toContain("AI + validated replacements");
    expect(html).toContain("This candidate batch includes validated fallback replacements");
    expect(html).not.toContain("AI route active");
  });

  it("renders only authoritative quest actions and keeps destructive controls explicit", () => {
    const view = createFixtureUiGatewaySnapshot().views.streamer;
    const html = renderToStaticMarkup(h(StudioManagementSurface, {
      view,
      readiness: contractFixtureUiX01ReadinessCatalog["r4.setup.ready.v1"],
      onCommand: () => undefined,
    }));

    expect(html).toContain("Cancel sidequest");
    expect(html).toContain("Emergency pause");
    expect(html).not.toContain("Approve selected");
    expect(html).not.toContain("Mark succeeded");
    expect(html).not.toContain("Mark failed");
    expect(html).not.toContain("No viewer action");
  });

  it("renders manual progress, completion, recovery, and a clearable emergency latch when authorised", () => {
    const view = createFixtureUiGatewaySnapshot().views.streamer;
    const activeCandidateId = view.questCycle.options[0]!.candidateId;
    const activeView = streamerViewModelSchema.parse({
      ...view,
      emergencyPaused: true,
      questCycle: {
        ...view.questCycle,
        status: "active",
        activeCandidateId,
        availableStreamerActions: ["succeed", "fail", "skip", "emergency-pause"],
        progress: {
          value: 0.4,
          updatedAt: view.envelope.occurredAt,
          method: "manual",
          evidenceSignalIds: [],
        },
        completionRule: { mode: "manual", allowedSignalKinds: [] },
      },
    });
    const html = renderToStaticMarkup(h(StudioManagementSurface, {
      view: activeView,
      onCommand: () => undefined,
    }));

    expect(html).toContain("Manual sidequest progress");
    expect(html).toContain("Update progress");
    expect(html).toContain("Mark succeeded");
    expect(html).toContain("Mark failed");
    expect(html).toContain("Skip sidequest");
    expect(html).toContain("Clear emergency pause");
  });

  it("does not invent missing list, game, accessibility, or session persistence actions", () => {
    const view = createFixtureUiGatewaySnapshot().views.streamer;
    const html = renderToStaticMarkup(h(StudioManagementSurface, { view }));

    expect(html).toContain("Profile &amp; Defaults owns full list editing");
    expect(html).toContain("Profile &amp; Defaults owns saved game and accessibility changes.");
    expect(html).toContain("Studio will not imitate persistence in browser storage");
    expect(html).toContain("Profile actions are not mounted");
  });

  it("renders private source-separated Live Context and every available Director Cue action", () => {
    const base = createFixtureUiGatewaySnapshot().views.streamer;
    const view = streamerViewModelSchema.parse({
      ...base,
      liveDirector: contractFixtureLiveDirectorStateCatalog["live-director.known.v1"],
    });
    const html = renderToStaticMarkup(h(StudioManagementSurface, {
      view,
      onCommand: () => undefined,
    }));

    expect(html).toContain("Session Goal");
    expect(html).toContain("Current Objective");
    expect(html).toContain("Voice context");
    expect(html).toContain("Start listening");
    expect(html).toContain("does not store raw microphone audio");
    expect(html).toContain("Streamer says");
    expect(html).toContain("ChatXPT detects");
    expect(html).toContain("Chat suggests");
    expect(html).toContain("3 unique participants");
    expect(html).toContain(">Acknowledge<");
    expect(html).toContain("Turn into vote");
    expect(html).toContain(">Later<");
    expect(html).toContain(">Dismiss<");
    expect(html).toContain("prepares exactly three private quest options for approval");
  });

  it("keeps stale and permission-denied context honest and removes stale cue actions", () => {
    const base = createFixtureUiGatewaySnapshot().views.streamer;
    const stale = streamerViewModelSchema.parse({
      ...base,
      liveDirector: contractFixtureLiveDirectorStateCatalog["live-director.stale.v1"],
    });
    const denied = streamerViewModelSchema.parse({
      ...base,
      liveDirector: contractFixtureLiveDirectorStateCatalog["live-director.privacy-denied.v1"],
    });
    const staleHtml = renderToStaticMarkup(h(StudioManagementSurface, { view: stale }));
    const deniedHtml = renderToStaticMarkup(h(StudioManagementSurface, { view: denied }));

    expect(staleHtml).toContain("This cue has no available action");
    expect(staleHtml).not.toContain(">Later<");
    expect(deniedHtml).toContain("Permission Denied");
    expect(deniedHtml).toContain("Audience aggregate access is not authorised");
    expect(deniedHtml).toContain("Permission is not available");
  });
});
