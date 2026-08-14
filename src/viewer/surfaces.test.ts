import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  contractFixtureCandidateBatch,
  contractFixtureOverlayView,
  contractFixtureUiX06RoleViewCatalog,
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

    expect(html).toContain("Vote accepted. Live tallies are now visible.");
    expect(html).toContain('aria-disabled="true"');
    expect(html).toContain("4 votes");
    expect(html).toContain("2 votes");
  });

  it("locks every option and the confirmation action while a vote is pending", () => {
    const html = renderToStaticMarkup(
      h(TwitchExtensionViewerSurface, {
        view: votingView(),
        selectedCandidateId: options[1].candidateId,
        pendingCandidateId: options[1].candidateId,
        now: NOW,
        onSelectCandidate: () => undefined,
        onVoteCandidate: () => undefined,
      }),
    );

    expect(html.match(/disabled=""/g)).toHaveLength(4);
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("Sending your vote. Keep this panel open for confirmation.");
    expect(html).not.toContain("4 votes");
  });

  it("presents typed command recovery without discarding the selected quest", () => {
    const html = renderToStaticMarkup(
      h(TwitchExtensionViewerSurface, {
        view: votingView(),
        selectedCandidateId: options[2].candidateId,
        commandError: {
          code: "stale-revision",
          message: "A newer quest revision is available.",
          retryable: true,
        },
        onSelectCandidate: () => undefined,
        onVoteCandidate: () => undefined,
        onRetry: () => undefined,
      }),
    );

    expect(html).toContain("The quest changed");
    expect(html).toContain("Your selection is preserved while ChatXPT refreshes.");
    expect(html).toContain("Selected");
    expect(html).toContain("Retry connection");
    expect(html).toContain("Voting and reactions are paused until recovery completes.");
    expect(html.match(/disabled=""/g)).toHaveLength(3);
  });

  it("offers Twitch reauthentication without asking for a separate viewer account", () => {
    const html = renderToStaticMarkup(
      h(TwitchExtensionViewerSurface, {
        view: votingView(),
        selectedCandidateId: options[0].candidateId,
        commandError: {
          code: "unauthenticated",
          message: "The Twitch viewer token expired.",
          retryable: true,
        },
        onSelectCandidate: () => undefined,
        onVoteCandidate: () => undefined,
        onReauthenticate: () => undefined,
      }),
    );

    expect(html).toContain("Reconnect with Twitch");
    expect(html).toContain("No separate ChatXPT account is needed.");
    expect(html).not.toContain("Retry connection");
    expect(html.match(/disabled=""/g)).toHaveLength(3);
  });

  it.each(["r5.vote.zero-vote.v1", "r5.vote.tie.v1"] as const)(
    "waits for an authoritative resolution for %s without declaring a local outcome",
    (fixtureId) => {
      const source = contractFixtureUiX06RoleViewCatalog[fixtureId].viewer;
      const view = viewerViewModelSchema.parse({
        ...source,
        canVote: false,
      });
      const html = renderToStaticMarkup(
        h(TwitchExtensionViewerSurface, {
          view,
          now: (view.questCycle.endsAt ?? NOW) + 1,
        }),
      );

      expect(html).toContain("Awaiting the official result");
      expect(html.match(/Option [123]\./g)).toHaveLength(3);
      expect(html).not.toContain("Winner confirmed");
      expect(html).not.toContain("Tie decided");
      expect(html).not.toContain("Zero votes");
    },
  );

  it("collapses the resolved vote into one authoritative active quest", () => {
    const view = contractFixtureUiX06RoleViewCatalog["r5.quest.active-automatic-progress.v1"].viewer;
    const active = view.questCycle.options.find(
      (option) => option.candidateId === view.questCycle.activeCandidateId,
    );
    const inactive = view.questCycle.options.find(
      (option) => option.candidateId !== view.questCycle.activeCandidateId,
    );
    const html = renderToStaticMarkup(
      h(TwitchExtensionViewerSurface, {
        view,
        now: NOW,
        onReact: () => undefined,
      }),
    );

    expect(active).toBeDefined();
    expect(inactive).toBeDefined();
    expect(html).toContain("Quest active");
    expect(html).toContain("Winner");
    expect(html).toContain(active?.title);
    expect(html).not.toContain(inactive?.title);
    expect(html).toContain("Winner confirmed. The quest is now active.");
    expect(html).toContain("75%");
    expect(html).toContain("Live game progress");
    expect(html).toContain("Send hype");
  });

  it("labels manual progress as a streamer update", () => {
    const view = contractFixtureUiX06RoleViewCatalog["r5.quest.active-manual-progress.v1"].viewer;
    const html = renderToStaticMarkup(h(TwitchExtensionViewerSurface, { view, now: NOW }));

    expect(html).toContain("50%");
    expect(html).toContain("Streamer updated");
    expect(html).not.toContain("Live game progress");
  });

  it("labels progress with unknown provenance without inventing a source", () => {
    const source =
      contractFixtureUiX06RoleViewCatalog["r5.quest.active-manual-progress.v1"].viewer;
    const view = viewerViewModelSchema.parse({
      ...source,
      questCycle: {
        ...source.questCycle,
        progress: source.questCycle.progress
          ? { ...source.questCycle.progress, method: "unknown" }
          : null,
      },
    });
    const html = renderToStaticMarkup(h(TwitchExtensionViewerSurface, { view, now: NOW }));

    expect(html).toContain("Progress unavailable");
    expect(html).not.toContain("Streamer updated");
    expect(html).not.toContain("Live game progress");
  });

  it("uses explicit community and private labels in the authoritative result state", () => {
    const view = contractFixtureUiX06RoleViewCatalog["r5.quest.succeeded-reward.v1"].viewer;
    const html = renderToStaticMarkup(
      h(TwitchExtensionViewerSurface, {
        view,
        now: NOW,
      }),
    );

    expect(html).toContain("Quest result");
    expect(html).toContain("Quest completed");
    expect(html).toContain("Awarded 100 pts.");
    expect(html).toContain("Community hype");
    expect(html).toContain("Your session points");
    expect(html).toContain("The authoritative quest result is shown above.");
  });

  it.each([
    ["r5.quest.failed.v1", "Quest attempt ended"],
    ["r5.quest.cancelled.v1", "Quest cancelled"],
    ["r5.quest.skipped.v1", "Quest skipped"],
    ["r5.quest.expired.v1", "Quest expired"],
  ] as const)("distinguishes the authoritative %s outcome", (fixtureId, title) => {
    const view = contractFixtureUiX06RoleViewCatalog[fixtureId].viewer;
    const html = renderToStaticMarkup(h(TwitchExtensionViewerSurface, { view, now: NOW }));

    expect(html).toContain(title);
    expect(html).not.toContain("Awarded 0 pts");
  });

  it("renders the authoritative cooldown without inventing a next quest", () => {
    const view = contractFixtureUiX06RoleViewCatalog["r4.quest.cooldown.v1"].viewer;
    const html = renderToStaticMarkup(
      h(TwitchExtensionViewerSurface, {
        view,
        now: view.questCycle.startsAt ?? NOW,
      }),
    );

    expect(html).toContain("Next vote soon");
    expect(html).toContain("The next vote opens after the official cooldown.");
    expect(html).not.toContain("<button");
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
    expect(html).toContain("ChatXPT replies with counted, duplicate, rejected, or late status");
  });

  it("keeps active and terminal quest status consistent in the chat fallback", () => {
    const activeSource =
      contractFixtureUiX06RoleViewCatalog["r5.quest.active-manual-progress.v1"].viewer;
    const resultSource = contractFixtureUiX06RoleViewCatalog["r5.quest.cancelled.v1"].viewer;
    const active = viewerViewModelSchema.parse({
      ...activeSource,
      participationMode: "twitch-chat",
    });
    const result = viewerViewModelSchema.parse({
      ...resultSource,
      participationMode: "twitch-chat",
    });
    const activeHtml = renderToStaticMarkup(h(ChatFallbackInstructions, { view: active }));
    const resultHtml = renderToStaticMarkup(h(ChatFallbackInstructions, { view: result }));

    expect(activeHtml).toContain("Quest active");
    expect(activeHtml).toContain(options[0].title);
    expect(resultHtml).toContain("Quest cancelled");
    expect(resultHtml).toContain("No separate viewer account is needed.");
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
    expect(html).toContain("Live game progress");
    expect(html).not.toContain("<button");
  });

  it("renders all three authoritative choices and tallies during overlay voting", () => {
    const source = contractFixtureUiX06RoleViewCatalog["r5.vote.tie.v1"].overlay;
    const html = renderToStaticMarkup(
      h(ObsQuestOverlaySurface, {
        view: source,
        now: source.questCycle.startsAt ?? NOW,
      }),
    );

    expect(html).toContain("Audience vote");
    expect(html).toContain("Vote now");
    expect(html).toContain(options[0].title);
    expect(html).toContain(options[1].title);
    expect(html).toContain(options[2].title);
    expect(html).toContain("2 votes");
    expect(html).not.toContain("<button");
  });

  it("shows a terminal overlay result even when no winning candidate exists", () => {
    const view = contractFixtureUiX06RoleViewCatalog["r5.quest.cancelled.v1"].overlay;
    const html = renderToStaticMarkup(h(ObsQuestOverlaySurface, { view, now: NOW }));

    expect(html).toContain("Quest cancelled");
    expect(html).toContain("Fixture streamer cancellation.");
    expect(html).not.toContain("Awarded");
    expect(html).not.toContain("<button");
  });

  it("shows a compact recovery state instead of silently disappearing", () => {
    const view = overlayViewModelSchema.parse({
      ...contractFixtureOverlayView,
      connection: {
        ...contractFixtureOverlayView.connection,
        status: "degraded",
        retryable: true,
        message: "Fixture reconnect",
      },
    });
    const html = renderToStaticMarkup(h(ObsQuestOverlaySurface, { view, now: NOW }));

    expect(html).toContain("Overlay reconnecting");
    expect(html).toContain("latest safe quest stays visible");
    expect(html).not.toContain("<button");
  });

  it("renders the authoritative overlay cooldown as a quiet status card", () => {
    const view = contractFixtureUiX06RoleViewCatalog["r4.quest.cooldown.v1"].overlay;
    const html = renderToStaticMarkup(
      h(ObsQuestOverlaySurface, {
        view,
        now: view.questCycle.startsAt ?? NOW,
      }),
    );

    expect(html).toContain("Next vote soon");
    expect(html).toContain("120s left");
    expect(html).not.toContain("<button");
  });
});
