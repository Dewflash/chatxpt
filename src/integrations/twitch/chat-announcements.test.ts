import { describe, expect, it } from "vitest";

import { contractFixtureCandidateBatch } from "../../core/testing";
import {
  formatTwitchChatPollOpenMessage,
  formatTwitchChatResultMessage,
  formatTwitchChatVoteAcknowledgement,
} from "./chat-announcements";

const options = contractFixtureCandidateBatch.candidates as [
  (typeof contractFixtureCandidateBatch.candidates)[number],
  (typeof contractFixtureCandidateBatch.candidates)[number],
  (typeof contractFixtureCandidateBatch.candidates)[number],
];

describe("Twitch chat announcements", () => {
  it("formats a concise poll-open message with the exact 1/2/3 mapping", () => {
    const message = formatTwitchChatPollOpenMessage({ options, voteSeconds: 30 });

    expect(message).toContain("ChatXPT vote open for 30s");
    expect(message).toContain(`1) ${options[0].title}`);
    expect(message).toContain(`2) ${options[1].title}`);
    expect(message).toContain(`3) ${options[2].title}`);
    expect(message).toContain("Reply with only 1, 2, or 3");
    expect(message.length).toBeLessThanOrEqual(450);
  });

  it("formats final result messages without choosing winners itself", () => {
    expect(
      formatTwitchChatResultMessage({ outcome: "winner", winningOption: options[1] }),
    ).toContain(`${options[1].title} wins`);
    expect(formatTwitchChatResultMessage({ outcome: "zero-vote", winningOption: null })).toBe(
      "ChatXPT result: no accepted votes, so no quest starts.",
    );
    expect(formatTwitchChatResultMessage({ outcome: "tie", winningOption: null })).toContain(
      "quest engine",
    );
  });

  it("formats bounded acknowledgement states without promising unverified delivery", () => {
    expect(formatTwitchChatVoteAcknowledgement({ status: "counted", choice: 2 })).toBe(
      "ChatXPT counted vote 2.",
    );
    expect(formatTwitchChatVoteAcknowledgement({ status: "duplicate", choice: 3 })).toContain(
      "already counted your first vote",
    );
    expect(formatTwitchChatVoteAcknowledgement({ status: "late", choice: 1 })).toContain(
      "after voting closed",
    );
    expect(formatTwitchChatVoteAcknowledgement({ status: "unavailable", choice: null })).toBe(
      "ChatXPT chat voting is not available right now.",
    );
  });

  it("truncates long option titles to keep Twitch chat output bounded", () => {
    const long = {
      ...options[0],
      title: "A very long quest title that would otherwise make the Twitch poll announcement noisy and hard to scan",
    };
    const message = formatTwitchChatPollOpenMessage({
      options: [long, options[1], options[2]],
      voteSeconds: 45,
    });

    expect(message).toContain("A very long quest title that would otherwise…");
    expect(message.length).toBeLessThanOrEqual(450);
  });
});
