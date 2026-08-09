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
        onSelectCandidate: () => undefined,
        onVoteCandidate: () => undefined,
      }),
    );

    expect(html).toContain("Choose the sidequest");
    expect(html).toContain("30s left");
    expect(html.match(/Option [123]\./g)).toHaveLength(3);
    expect(html.match(/<button/g)).toHaveLength(4);
    expect(html).toContain("Vote");
    expect(html).not.toContain("4 votes");
    expect(html).not.toContain("2 votes");
    expect(html).not.toContain("rev ");
    expect(html).not.toContain("ready");
    expect(html).not.toContain("Unknown-safe contract fixture");
  });

  it("disables render-only controls when authorised handlers are absent", () => {
    const html = renderToStaticMarkup(
      h(TwitchExtensionViewerSurface, {
        view: votingView({ canReact: true }),
        selectedCandidateId: options[1].candidateId,
        now: NOW,
      }),
    );

    expect(html.match(/disabled=""/g)?.length ?? 0).toBeGreaterThanOrEqual(4);
    expect(html).toContain("Voting is closed or unavailable.");
    expect(html).not.toContain("Send hype");
  });

  it("reveals tallies only after authoritative personal vote acknowledgement", () => {
    const html = renderToStaticMarkup(
      h(TwitchExtensionViewerSurface, {
        view: votingView({
          canVote: false,
          acceptedCandidateId: options[0].candidateId,
        }),
        selectedCandidateId: options[0].candidateId,
        now: NOW,
      }),
    );

    expect(html).toContain("Vote accepted.");
    expect(html).toContain("4 votes");
    expect(html).toContain("2 votes");
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
    expect(html).toContain("voting and reactions are paused");
    expect(html).toContain("disabled");
    expect(html).not.toContain("Send hype");
    expect(html).not.toContain("degraded");
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
