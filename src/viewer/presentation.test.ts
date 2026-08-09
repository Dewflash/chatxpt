import { describe, expect, it } from "vitest";

import {
  contractFixtureCandidateBatch,
  contractFixtureOverlayView,
  contractFixtureViewerView,
} from "../core/testing";
import { overlayViewModelSchema, viewerViewModelSchema } from "../core";
import { presentOverlay, presentViewer } from "./index";

const fixtureOptions = contractFixtureCandidateBatch.candidates;

function votingViewer() {
  return viewerViewModelSchema.parse({
    ...contractFixtureViewerView,
    session: {
      ...contractFixtureViewerView.session,
      status: "live",
    },
    canVote: true,
    questCycle: {
      ...contractFixtureViewerView.questCycle,
      status: "voting",
      options: fixtureOptions,
      voteTallies: [
        { candidateId: fixtureOptions[0].candidateId, votes: 4 },
        { candidateId: fixtureOptions[1].candidateId, votes: 2 },
      ],
      startsAt: contractFixtureViewerView.envelope.occurredAt,
      endsAt: contractFixtureViewerView.envelope.occurredAt + 30_000,
    },
  });
}

describe("Role 5 presentation boundary", () => {
  it("exposes a safe loading state before an authorised snapshot", () => {
    expect(presentViewer(null)).toMatchObject({
      phase: "loading",
      revision: null,
      canVote: false,
      options: [],
    });
    expect(presentOverlay(null)).toMatchObject({
      readOnly: true,
      phase: "loading",
      activeQuest: null,
    });
  });

  it("keeps exactly three options while hiding influential tallies before acknowledgement", () => {
    const presentation = presentViewer(votingViewer());

    expect(presentation.phase).toBe("voting");
    expect(presentation.canVote).toBe(true);
    expect(presentation.options).toHaveLength(3);
    expect(presentation.options.map((option) => option.votes)).toEqual([null, null, null]);
    expect(presentation.options.every((option) => option.acceptedByViewer === false)).toBe(true);
    expect(presentation.options[0]).not.toHaveProperty("rationale");
    expect(presentation.options[0]).not.toHaveProperty("generation");
  });

  it.each([
    ["offline", "hosted-board", "idle", "offline"],
    ["ended", "hosted-board", "idle", "ended"],
    ["live", "unavailable", "idle", "unavailable"],
    ["live", "twitch-extension", "succeeded", "result"],
  ] as const)(
    "maps authoritative session %s, mode %s, and cycle %s to %s",
    (sessionStatus, participationMode, cycleStatus, phase) => {
      const result = {
        outcome: "succeeded" as const,
        occurredAt: contractFixtureViewerView.envelope.occurredAt,
        reason: "Fixture terminal result",
        rewardPointsAwarded: 100,
      };
      const view = viewerViewModelSchema.parse({
        ...contractFixtureViewerView,
        session: {
          ...contractFixtureViewerView.session,
          status: sessionStatus,
          startedAt:
            sessionStatus === "ended" ? contractFixtureViewerView.envelope.occurredAt - 1_000 : null,
          endedAt:
            sessionStatus === "ended" ? contractFixtureViewerView.envelope.occurredAt : null,
        },
        participationMode,
        questCycle: {
          ...contractFixtureViewerView.questCycle,
          status: cycleStatus,
          result: cycleStatus === "succeeded" ? result : null,
        },
      });

      expect(presentViewer(view).phase).toBe(phase);
    },
  );

  it("uses only the authoritative private receipt to mark an accepted choice", () => {
    const view = viewerViewModelSchema.parse({
      ...votingViewer(),
      canVote: false,
      acceptedCandidateId: fixtureOptions[1].candidateId,
    });
    const presentation = presentViewer(view);

    expect(presentation.acceptedCandidateId).toBe(fixtureOptions[1].candidateId);
    expect(presentation.options.map((option) => option.acceptedByViewer)).toEqual([
      false,
      true,
      false,
    ]);
    expect(presentation.options.map((option) => option.votes)).toEqual([4, 2, null]);
  });

  it("retains the latest snapshot but disables commands when connection health degrades", () => {
    const view = viewerViewModelSchema.parse({
      ...votingViewer(),
      canReact: true,
      connection: {
        ...contractFixtureViewerView.connection,
        status: "degraded",
        retryable: true,
        message: "Fixture reconnect in progress",
      },
    });
    const presentation = presentViewer(view);

    expect(presentation.options).toHaveLength(3);
    expect(presentation.connection?.status).toBe("degraded");
    expect(presentation.canVote).toBe(false);
    expect(presentation.canReact).toBe(false);
  });

  it("keeps the overlay read-only while presenting authoritative active progress", () => {
    const view = overlayViewModelSchema.parse({
      ...contractFixtureOverlayView,
      session: {
        ...contractFixtureOverlayView.session,
        status: "live",
      },
      questCycle: {
        ...contractFixtureOverlayView.questCycle,
        status: "active",
        options: fixtureOptions,
        activeCandidateId: fixtureOptions[2].candidateId,
        startsAt: contractFixtureOverlayView.envelope.occurredAt,
        endsAt: contractFixtureOverlayView.envelope.occurredAt + 30_000,
        progress: {
          value: 0.5,
          updatedAt: contractFixtureOverlayView.envelope.occurredAt + 5_000,
          method: "automatic",
          evidenceSignalIds: [],
        },
      },
    });
    const presentation = presentOverlay(view);

    expect(presentation.readOnly).toBe(true);
    expect(presentation.phase).toBe("active");
    expect(presentation.activeQuest?.candidateId).toBe(fixtureOptions[2].candidateId);
    expect(presentation.progress).toEqual({
      value: 0.5,
      updatedAt: contractFixtureOverlayView.envelope.occurredAt + 5_000,
      method: "automatic",
    });
  });
});
