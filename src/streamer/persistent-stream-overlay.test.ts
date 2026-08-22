import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { createFixtureUiGatewaySnapshot, streamerViewModelSchema } from "../core";
import { contractFixtureUiX06RoleViewCatalog } from "../core/testing";
import {
  presentChatStatus,
  presentGameplayFeedState,
  presentGameplayTempo,
  presentQuestStatus,
  presentSessionPhase,
} from "./live-status-presentation";
import { PersistentStreamOverlaySurface } from "./persistent-stream-overlay";

describe("PersistentStreamOverlaySurface", () => {
  it("renders only the four authoritative streamer readings in a compact grid", () => {
    const base = createFixtureUiGatewaySnapshot().views.streamer;
    const view = streamerViewModelSchema.parse({
      ...base,
      publicContext: base.publicContext === null
        ? null
        : { ...base.publicContext, chatStatus: "quiet" },
    });
    const html = renderToStaticMarkup(h(PersistentStreamOverlaySurface, { view }));

    expect(html).toContain("Live Director");
    expect(html).toContain('data-director-status="session"');
    expect(html).toContain('data-director-status="gameplay"');
    expect(html).toContain('data-director-status="chat"');
    expect(html).toContain('data-director-status="quest"');
    expect(html.match(/data-director-status=/gu)).toHaveLength(4);
    expect(html).toContain(presentSessionPhase(view));
    expect(html).toContain(presentGameplayTempo(view));
    expect(html).toContain(presentGameplayFeedState(view));
    expect(html).toContain(presentChatStatus(view));
    expect(html).toContain(presentQuestStatus(view));
    if (base.publicContext !== null) expect(html).toContain("Peaceful");
    expect(html).not.toContain("Director cue");
    expect(html).not.toContain("Community hype");
    expect(html).not.toContain("Private · no raw chat");
    expect(html).not.toContain("<button");
  });

  it("keeps the same four-cell shape while waiting for a session", () => {
    const html = renderToStaticMarkup(h(PersistentStreamOverlaySurface, { view: null }));

    expect(html).toContain("Live Director");
    expect(html.match(/data-director-status=/gu)).toHaveLength(4);
    expect(html).toContain("Waiting");
    expect(html).toContain("Unknown");
    expect(html).toContain("None");
    expect(html).not.toContain("Waiting for this broadcaster");
  });

  it("shows the authoritative selection countdown inside quest status", () => {
    const view = createFixtureUiGatewaySnapshot().views.streamer;
    const html = renderToStaticMarkup(h(PersistentStreamOverlaySurface, { view }));

    expect(view.questCycle.status).toBe("voting");
    expect(html).toContain("Selection · 0:45");
    expect(presentQuestStatus(view, view.envelope.receivedAt + 15_000)).toBe(
      "Selection · 0:30",
    );
    expect(presentQuestStatus(view, view.envelope.receivedAt + 60_000)).toBe(
      "Selection · 0:00",
    );
  });

  it("compresses emergency pause and quest results into quest status", () => {
    const base = createFixtureUiGatewaySnapshot().views.streamer;
    const paused = streamerViewModelSchema.parse({ ...base, emergencyPaused: true });
    const pausedHtml = renderToStaticMarkup(h(PersistentStreamOverlaySurface, { view: paused }));
    expect(pausedHtml).toContain("Paused");
    expect(pausedHtml).not.toContain("Emergency pause active");

    const result = contractFixtureUiX06RoleViewCatalog["r5.quest.succeeded-reward.v1"].streamer;
    const resultHtml = renderToStaticMarkup(h(PersistentStreamOverlaySurface, { view: result }));
    expect(resultHtml).toContain("Completed");
    expect(resultHtml).not.toContain(result.questCycle.result?.reason ?? "missing result");
  });

  it("pushes all three recommendations in automatic mode without a streamer candidate pick", () => {
    const view = contractFixtureUiX06RoleViewCatalog["r4.quest.proposed.v1"].streamer;
    const html = renderToStaticMarkup(h(PersistentStreamOverlaySurface, {
      view,
      onCommand: () => undefined,
    }));

    expect(html).toContain("Recommended quests");
    expect(html).toContain("Push quests now");
    expect(html).toContain("Send all three to viewers");
    expect(html).not.toContain("desktop-live-director-quest");
    for (const option of view.questCycle.options) expect(html).toContain(option.title);
  });

  it("selects and starts one recommendation directly in manual mode", () => {
    const base = contractFixtureUiX06RoleViewCatalog["r4.quest.proposed.v1"].streamer;
    const view = streamerViewModelSchema.parse({
      ...base,
      profile: {
        ...base.profile,
        voting: { ...base.profile.voting, winnerActivationMode: "streamer-approval" },
        streamPresets: base.profile.streamPresets.map((preset) => ({
          ...preset,
          voting: { ...preset.voting, winnerActivationMode: "streamer-approval" },
        })),
      },
    });
    const html = renderToStaticMarkup(h(PersistentStreamOverlaySurface, {
      view,
      onCommand: () => undefined,
    }));

    expect(html).toContain("Start selected quest");
    expect(html).toContain("Choose one to start");
    expect(html.match(/desktop-live-director-quest/gu)).toHaveLength(3);
    expect(html).not.toContain("Open viewer vote");
  });

  it("can generate quests from the private Desktop Live Director", () => {
    const view = contractFixtureUiX06RoleViewCatalog["r5.quest.idle.v1"].streamer;
    const html = renderToStaticMarkup(h(PersistentStreamOverlaySurface, {
      view,
      onCommand: () => undefined,
    }));

    expect(html).toContain("Generate quests");
    expect(html).toContain("Generate three safe options");
  });

  it("shows active quest outcome controls after either automatic or manual setup", () => {
    const base = contractFixtureUiX06RoleViewCatalog["r5.quest.active-manual-progress.v1"].streamer;
    const activeQuest = base.questCycle.options.find(
      (option) => option.candidateId === base.questCycle.activeCandidateId,
    );

    expect(activeQuest).toBeDefined();
    for (const winnerActivationMode of ["automatic", "streamer-approval"] as const) {
      const view = streamerViewModelSchema.parse({
        ...base,
        profile: {
          ...base.profile,
          voting: { ...base.profile.voting, winnerActivationMode },
          streamPresets: base.profile.streamPresets.map((preset) => ({
            ...preset,
            voting: { ...preset.voting, winnerActivationMode },
          })),
        },
      });
      const html = renderToStaticMarkup(h(PersistentStreamOverlaySurface, {
        view,
        onCommand: () => undefined,
      }));

      expect(html).toContain('data-director-active-quest="true"');
      expect(html).toContain(activeQuest?.title);
      expect(html).toContain(activeQuest?.instruction);
      expect(html).toContain("0:30");
      expect(html).toContain("remaining");
      expect(html).toContain("Cancel quest");
      expect(html).toContain("Mark complete");
      expect(html).not.toContain("Studio only");
      expect(html).not.toContain('disabled=""');
      expect(html).not.toContain("desktop-live-director-quest");
    }
  });

  it("presents live duration, a stable feed badge, and peaceful no-message chat", () => {
    const base = createFixtureUiGatewaySnapshot().views.streamer;
    const view = streamerViewModelSchema.parse({
      ...base,
      session: {
        ...base.session,
        status: "live",
        startedAt: base.envelope.receivedAt - 65_000,
      },
      gameplay: base.gameplay === null
        ? null
        : {
            ...base.gameplay,
            signals: [
              {
                ...base.gameplay.signals[0],
                kind: "game-vision-state",
                observation: {
                  status: "known",
                  value: "stable",
                  provenance: base.gameplay.signals[0].observation.provenance,
                },
              },
            ],
          },
      audience: null,
      publicContext: base.publicContext === null
        ? null
        : { ...base.publicContext, chatStatus: "unknown", gameplayStatus: "stable" },
    });

    expect(presentSessionPhase(view)).toBe("Live · 1:05");
    expect(presentGameplayFeedState(view)).toBe("Stable");
    expect(presentChatStatus(view)).toBe("Peaceful");
  });
});
