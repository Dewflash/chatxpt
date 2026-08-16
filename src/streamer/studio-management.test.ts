import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { createFixtureUiGatewaySnapshot, streamerViewModelSchema } from "../core";
import { contractFixtureUiX01ReadinessCatalog } from "../core/testing";
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
    const view = createFixtureUiGatewaySnapshot().views.streamer;
    const readiness = contractFixtureUiX01ReadinessCatalog["r4.setup.ready.v1"];
    const html = renderToStaticMarkup(h(StudioManagementSurface, { view, readiness }));

    expect(html).toContain("Profile &amp; defaults");
    expect(html).toContain("Saved profile · revision");
    expect(html).toContain("Streamer personality");
    expect(html).toContain("Challenge preferences");
    expect(html).toContain("Game &amp; accessibility");
    expect(html).toContain("Voting");
    expect(html).toContain("Rewards");
    expect(html).toContain("Temporary overrides never rewrite defaults");
    expect(html).toContain("Effective source: saved default");
    expect(html).toContain("Session override contract required");
  });

  it("shows OBS, gameplay, provider-neutral intelligence, and realtime health independently", () => {
    const view = createFixtureUiGatewaySnapshot().views.streamer;
    const readiness = contractFixtureUiX01ReadinessCatalog["r4.setup.permission-denied.v1"];
    const html = renderToStaticMarkup(h(StudioManagementSurface, { view, readiness }));

    expect(html).toContain("OBS capture");
    expect(html).toContain("Permission denied");
    expect(html).toContain("Allow capture");
    expect(html).toContain("Gameplay understanding");
    expect(html).toContain("Low confidence");
    expect(html).toContain("AI intelligence");
    expect(html).toContain("Fallback active");
    expect(html).toContain("Realtime");
    expect(html).toContain("There is no combined readiness percentage");
    expect(html).not.toContain("API key");
    expect(html).not.toContain("model selector");
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

    expect(html).toContain("Cancel quest");
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

    expect(html).toContain("Manual quest progress");
    expect(html).toContain("Update progress");
    expect(html).toContain("Mark succeeded");
    expect(html).toContain("Mark failed");
    expect(html).toContain("Skip quest");
    expect(html).toContain("Clear emergency pause");
  });

  it("does not invent missing list, game, accessibility, or session persistence actions", () => {
    const view = createFixtureUiGatewaySnapshot().views.streamer;
    const html = renderToStaticMarkup(h(StudioManagementSurface, { view }));

    expect(html).toContain("Editing waits for the canonical profile-list patch from Role 1");
    expect(html).toContain("their update command is not public yet");
    expect(html).toContain("Studio will not imitate persistence in browser storage");
    expect(html).toContain("Profile actions are not mounted");
  });
});
