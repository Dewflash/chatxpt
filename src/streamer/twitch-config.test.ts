import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { createFixtureUiGatewaySnapshot, streamerViewModelSchema } from "../core";
import { contractFixtureUiX01ReadinessCatalog } from "../core/testing";
import { TwitchConfigSurface, TwitchLiveConfigSurface } from "./twitch-config";

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

describe("TwitchConfigSurface", () => {
  it("keeps infrequent setup compact and routes detailed management back to Studio", () => {
    const view = createFixtureUiGatewaySnapshot().views.streamer;
    const readiness = contractFixtureUiX01ReadinessCatalog["r4.setup.misconfigured.v1"];
    const html = renderToStaticMarkup(h(TwitchConfigSurface, {
      view,
      readiness,
      studioHref: "/studio",
      onCommand: () => undefined,
    }));

    expect(html).toContain("Twitch Config");
    expect(html).toContain("Install once, manage in Studio");
    expect(html).toContain("Connect Twitch");
    expect(html).toContain("Full personality, safety, accessibility, game, voting, reward, testing, and recovery settings live in Studio");
    expect(html).toContain('href="/studio"');
    expect(html).toContain("No viewer-personality profile is stored here");
  });
});

describe("TwitchLiveConfigSurface", () => {
  it("uses a compact status-first hierarchy with the four requested health layers", () => {
    const view = createFixtureUiGatewaySnapshot().views.streamer;
    const readiness = contractFixtureUiX01ReadinessCatalog["r4.setup.permission-denied.v1"];
    const html = renderToStaticMarkup(h(TwitchLiveConfigSurface, { view, readiness }));

    expect(html).toContain("Twitch Live Config");
    expect(html).toContain("Live health");
    expect(html).toContain("Capture Health");
    expect(html).toContain("Gameplay Activity");
    expect(html).toContain("Low confidence");
    expect(html).toContain("Sidequests");
    expect(html).toContain("Realtime");
    expect(html).toContain("Fallback active");
    expect(html).toContain("Sidequest");
  });

  it("shows a warning label for a mixed AI and fallback candidate batch", () => {
    const html = renderToStaticMarkup(h(TwitchLiveConfigSurface, {
      view: mixedGenerationView(),
    }));

    expect(html).toContain("AI + validated replacements");
    expect(html).not.toContain("AI intelligence active");
  });

  it("distinguishes temporary intensity from the saved default without pretending to persist it", () => {
    const view = createFixtureUiGatewaySnapshot().views.streamer;
    const html = renderToStaticMarkup(h(TwitchLiveConfigSurface, { view }));

    expect(html).toContain("This session");
    expect(html).toContain("Follows saved");
    expect(html).toContain("Temporary intensity stays disabled until the runtime supplies a session override and reset command");
    expect(html).toContain("The saved default is not changed here");
  });

  it("shows only current authoritative quest actions and keeps emergency pause immediate", () => {
    const view = createFixtureUiGatewaySnapshot().views.streamer;
    const html = renderToStaticMarkup(h(TwitchLiveConfigSurface, {
      view,
      onCommand: () => undefined,
    }));

    expect(html).toContain("Cancel");
    expect(html).toContain("Emergency pause");
    expect(html).not.toContain(">Approve<");
    expect(html).not.toContain(">Succeeded<");
    expect(html).not.toContain(">Failed<");
  });

  it("keeps authorised active-quest recovery and manual controls available in the compact surface", () => {
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
    const html = renderToStaticMarkup(h(TwitchLiveConfigSurface, {
      view: activeView,
      onCommand: () => undefined,
    }));

    expect(html).toContain("Active sidequest");
    expect(html).toContain("Manual progress");
    expect(html).toContain(">Update<");
    expect(html).toContain(">Succeeded<");
    expect(html).toContain(">Failed<");
    expect(html).toContain(">Skip<");
    expect(html).toContain("Clear emergency pause");
  });

  it("keeps the same management boundary while loading", () => {
    const html = renderToStaticMarkup(h(TwitchLiveConfigSurface, {
      view: null,
      studioHref: "/studio",
    }));

    expect(html).toContain("Loading live controls");
    expect(html).toContain("Open full Studio");
    expect(html).not.toContain("Sidequest intensity");
  });
});
