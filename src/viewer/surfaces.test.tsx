import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  contractFixtureCandidateBatch,
  contractFixtureOverlayView,
  contractFixtureViewerView,
} from "../core/testing";
import { overlayViewModelSchema, viewerViewModelSchema } from "../core";
import {
  ChatFallbackInstructions,
  HostedQuestBoardSurface,
  ObsQuestOverlaySurface,
  TwitchExtensionViewerSurface,
} from "./surfaces";

const options = contractFixtureCandidateBatch.candidates;
const NOW = contractFixtureViewerView.envelope.occurredAt;

function votingView(overrides: Record<string, unknown> = {}) {
  return viewerViewModelSchema.parse({
    ...contractFixtureViewerView,
    ...overrides,
    session: {
      ...contractFixtureViewerView.session,
      status: "live",
      revision: contractFixtureViewerView.envelope.revision,
      ...(overrides.session as object | undefined),
    },
    canVote: true,
    questCycle: {
      ...contractFixtureViewerView.questCycle,
      status: "voting",
      options,
      startsAt: NOW,
      endsAt: NOW + 30_000,
      voteTallies: [
        { candidateId: options[0].candidateId, votes: 4 },
        { candidateId: options[1].candidateId, votes: 2 },
      ],
      ...(overrides.questCycle as object | undefined),
    },
  });
}

describe("Role 5 viewer surfaces", () => {
  it("renders exactly three Twitch Extension options and one confirmation action", () => {
    const html = renderToStaticMarkup(
      h(TwitchExtensionViewerSurface, {
        view: votingView(),
        selectedCandidateId: options[1].candidateId,
        now: NOW,
      }),
    );

    expect(html).toContain("Choose the sidequest");
    expect(html).toContain("30s left");
    expect(html.match(/Option [123]\./g)).toHaveLength(3);
    expect(html.match(/<button/g)).toHaveLength(4);
    expect(html).toContain("Vote");
    expect(html).not.toContain("Unknown-safe contract fixture");
  });

  it("keeps the hosted board wider-layout wrapper separate from Twitch copy", () => {
    const html = renderToStaticMarkup(
      h(HostedQuestBoardSurface, {
        view: votingView(),
        roomCode: "AB12CD34",
        selectedCandidateId: options[0].candidateId,
      }),
    );

    expect(html).toContain("Room AB12CD34");
    expect(html).toContain("Quest Board");
    expect(html).not.toContain("Twitch Extension");
  });

  it("retains a degraded snapshot while disabling vote and reaction commands", () => {
    const html = renderToStaticMarkup(
      h(TwitchExtensionViewerSurface, {
        view: votingView({
          canReact: true,
          connection: {
            ...contractFixtureViewerView.connection,
            status: "degraded",
            retryable: true,
            message: "Reconnecting",
          },
        }),
        selectedCandidateId: options[0].candidateId,
      }),
    );

    expect(html).toContain("Reconnecting");
    expect(html).toContain("Commands are disabled until authority returns.");
    expect(html).toContain("disabled");
    expect(html).not.toContain("Send hype");
  });

  it("maps the same three visible choices into chat-only instructions", () => {
    const html = renderToStaticMarkup(
      h(ChatFallbackInstructions, {
        view: votingView({ participationMode: "twitch-chat" }),
      }),
    );

    expect(html).toContain("Vote in Twitch chat");
    expect(html).toContain("Send <strong>1</strong>");
    expect(html).toContain("Send <strong>2</strong>");
    expect(html).toContain("Send <strong>3</strong>");
    expect(html).toContain("status comes from ChatXPT");
  });
});

describe("Role 5 OBS overlay surface", () => {
  it("stays visually quiet while inactive", () => {
    const html = renderToStaticMarkup(h(ObsQuestOverlaySurface, { view: contractFixtureOverlayView }));

    expect(html).not.toContain("Overlay ready");
    expect(html).not.toContain("Waiting for quests");
    expect(html).toContain('aria-hidden="true"');
  });

  it("renders an active quest without command controls", () => {
    const view = overlayViewModelSchema.parse({
      ...contractFixtureOverlayView,
      session: {
        ...contractFixtureOverlayView.session,
        status: "live",
      },
      questCycle: {
        ...contractFixtureOverlayView.questCycle,
        status: "active",
        options,
        activeCandidateId: options[2].candidateId,
        startsAt: NOW,
        endsAt: NOW + 45_000,
        progress: {
          value: 0.5,
          updatedAt: NOW + 5_000,
          method: "automatic",
          evidenceSignalIds: [],
        },
      },
    });
    const html = renderToStaticMarkup(h(ObsQuestOverlaySurface, { view, now: NOW }));

    expect(html).toContain(options[2].title);
    expect(html).toContain("45s left");
    expect(html).toContain("Progress");
    expect(html).not.toContain("<button");
  });
});
