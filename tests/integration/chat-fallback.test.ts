import { describe, expect, it } from "vitest";

import {
  buildChatFallbackPoll,
  buildChatFallbackResultAnnouncement,
  describeChatVoteReceipt,
} from "../../src/integrations";
import { questCycleStateSchema } from "../../src/core";
import {
  contractFixtureCandidateBatch,
  contractFixtureQuestCycle,
} from "../../src/core/testing";

const votingCycle = questCycleStateSchema.parse({
  ...contractFixtureQuestCycle,
  status: "voting",
  options: contractFixtureCandidateBatch.candidates,
  endsAt: contractFixtureQuestCycle.envelope.occurredAt + 30_000,
});

describe("Twitch chat fallback policy", () => {
  it("formats exactly three visible options into 1/2/3 chat instructions", () => {
    const poll = buildChatFallbackPoll(votingCycle);

    expect(poll.ok).toBe(true);
    if (!poll.ok) return;
    expect(poll.message).toContain("reply 1, 2, or 3");
    expect(poll.options.map((option) => option.commandText)).toEqual(["1", "2", "3"]);
    expect(poll.options.map((option) => option.candidateId)).toEqual(
      contractFixtureCandidateBatch.candidates.map((candidate) => candidate.candidateId),
    );
    expect(poll.closesAt).toBe(votingCycle.endsAt);
    expect(poll.perVoteChatAck).toBe(false);
  });

  it("refuses unavailable chat voting states instead of fabricating options", () => {
    expect(buildChatFallbackPoll(contractFixtureQuestCycle)).toMatchObject({
      ok: false,
      reason: "not-voting",
      perVoteChatAck: false,
    });
    expect(buildChatFallbackPoll({ ...votingCycle, options: votingCycle.options.slice(0, 2) })).toMatchObject({
      ok: false,
      reason: "not-three-options",
      perVoteChatAck: false,
    });
  });

  it("announces only an authoritative active candidate as the result", () => {
    expect(buildChatFallbackResultAnnouncement(votingCycle)).toEqual({
      message: "ChatXPT vote closed: no quest was activated.",
      winnerCandidateId: null,
      shouldAnnounceToChat: true,
    });

    const active = questCycleStateSchema.parse({
      ...votingCycle,
      status: "active",
      activeCandidateId: contractFixtureCandidateBatch.candidates[1].candidateId,
    });
    expect(buildChatFallbackResultAnnouncement(active)).toEqual({
      message: "ChatXPT vote result: Caster Mode won.",
      winnerCandidateId: contractFixtureCandidateBatch.candidates[1].candidateId,
      shouldAnnounceToChat: true,
    });
  });

  it("describes per-viewer receipt statuses without promising chat acknowledgement spam", () => {
    expect(describeChatVoteReceipt("counted", "2")).toEqual({
      status: "counted",
      counted: true,
      retryable: false,
      viewerMessage: "Vote counted for option 2.",
      shouldSendChatAcknowledgement: false,
    });
    expect(describeChatVoteReceipt("duplicate", "1")).toMatchObject({
      counted: true,
      shouldSendChatAcknowledgement: false,
    });
    expect(describeChatVoteReceipt("late", "3")).toMatchObject({
      counted: false,
      retryable: false,
      shouldSendChatAcknowledgement: false,
    });
    expect(describeChatVoteReceipt("unavailable", null)).toMatchObject({
      counted: false,
      retryable: true,
      shouldSendChatAcknowledgement: false,
    });
  });
});
