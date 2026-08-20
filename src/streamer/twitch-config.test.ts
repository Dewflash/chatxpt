import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { createFixtureUiGatewaySnapshot, streamerViewModelSchema } from "../core";
import {
  contractFixtureLiveDirectorStateCatalog,
  contractFixtureUiX01ReadinessCatalog,
} from "../core/testing";
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
    const base = createFixtureUiGatewaySnapshot().views.streamer;
    const view = streamerViewModelSchema.parse({
      ...base,
      liveDirector: contractFixtureLiveDirectorStateCatalog["live-director.known.v1"],
    });
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

  it("supports a current-stream intensity override without changing the saved default", () => {
    const view = createFixtureUiGatewaySnapshot().views.streamer;
    const html = renderToStaticMarkup(h(TwitchLiveConfigSurface, { view, onCommand: () => undefined }));

    expect(html).toContain("This session");
    expect(html).toContain("Follows saved");
    expect(html).toContain("Apply for this stream");
    expect(html).toContain("Reset to saved");
    expect(html).toContain("Saved profile defaults remain unchanged");
    expect(html).not.toContain("Temporary intensity stays disabled");
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

  it("keeps Live Director compact, private, source-separated, and dock-ready", () => {
    const base = createFixtureUiGatewaySnapshot().views.streamer;
    const view = streamerViewModelSchema.parse({
      ...base,
      liveDirector: contractFixtureLiveDirectorStateCatalog["live-director.known.v1"],
    });
    const html = renderToStaticMarkup(h(TwitchLiveConfigSurface, {
      view,
      popoutHref: "/studio/live-director?display=popout",
      onCommand: () => undefined,
    }));

    expect(html).toContain("Live Director");
    expect(html).toContain(">Private<");
    expect(html).toContain("Streamer says");
    expect(html).toContain("ChatXPT detects");
    expect(html).toContain("Chat suggests");
    expect(html).toContain("Turn into vote");
    expect(html).toContain("Private pop-out or OBS Custom Dock");
    expect(html).toContain('href="/studio/live-director?display=popout"');
    expect(html).toContain("It is not the public OBS overlay");
    expect(html).toContain("read-only stream context");
  });

  it("renders offline, permission, and reconnect boundaries without local authority", () => {
    const base = createFixtureUiGatewaySnapshot().views.streamer;
    const deniedOffline = streamerViewModelSchema.parse({
      ...base,
      session: { ...base.session, status: "offline" },
      liveDirector: contractFixtureLiveDirectorStateCatalog["live-director.privacy-denied.v1"],
    });
    const offlineHtml = renderToStaticMarkup(h(TwitchLiveConfigSurface, { view: deniedOffline }));
    const loadingHtml = renderToStaticMarkup(h(TwitchLiveConfigSurface, {
      view: null,
      commandMessage: "Reconnecting to the authoritative streamer session.",
    }));

    expect(offlineHtml).toContain("Live Director is not live");
    expect(offlineHtml).toContain("Permission Denied");
    expect(offlineHtml).not.toContain("Turn into vote");
    expect(loadingHtml).toContain("Private access required");
    expect(loadingHtml).toContain("Reconnecting to the authoritative streamer session");
  });
});
