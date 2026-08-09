import type { QuestCandidate } from "../../core";

export type TwitchChatVoteAcknowledgementStatus =
  | "counted"
  | "duplicate"
  | "late"
  | "rejected"
  | "unavailable";

export interface TwitchChatPollOpenMessageInput {
  readonly options: readonly [QuestCandidate, QuestCandidate, QuestCandidate];
  readonly voteSeconds: number;
}

export interface TwitchChatResultMessageInput {
  readonly outcome: "winner" | "tie" | "zero-vote" | "cancelled" | "expired";
  readonly winningOption: QuestCandidate | null;
}

export interface TwitchChatVoteAcknowledgementInput {
  readonly status: TwitchChatVoteAcknowledgementStatus;
  readonly choice: 1 | 2 | 3 | null;
}

function compact(value: string, maxLength: number): string {
  const singleLine = value.replace(/\s+/g, " ").trim();
  if (singleLine.length <= maxLength) return singleLine;
  return `${singleLine.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

export function formatTwitchChatPollOpenMessage(
  input: TwitchChatPollOpenMessageInput,
): string {
  const options = input.options
    .map((option, index) => `${index + 1}) ${compact(option.title, 46)}`)
    .join(" | ");
  return compact(
    `ChatXPT vote open for ${input.voteSeconds}s: ${options}. Reply with only 1, 2, or 3.`,
    450,
  );
}

export function formatTwitchChatResultMessage(input: TwitchChatResultMessageInput): string {
  switch (input.outcome) {
    case "winner":
      return input.winningOption === null
        ? "ChatXPT result: winner unavailable."
        : compact(`ChatXPT result: ${input.winningOption.title} wins. Quest is now active.`, 450);
    case "tie":
      return "ChatXPT result: tied vote. The quest engine will resolve this safely.";
    case "zero-vote":
      return "ChatXPT result: no accepted votes, so no quest starts.";
    case "cancelled":
      return "ChatXPT result: vote cancelled by the stream controls.";
    case "expired":
      return "ChatXPT result: vote expired before a quest could start.";
  }
}

export function formatTwitchChatVoteAcknowledgement(
  input: TwitchChatVoteAcknowledgementInput,
): string {
  const choice = input.choice === null ? "that vote" : `vote ${input.choice}`;
  const messages: Record<TwitchChatVoteAcknowledgementStatus, string> = {
    counted: `ChatXPT counted ${choice}.`,
    duplicate: `ChatXPT already counted your first vote; ${choice} was ignored.`,
    late: `ChatXPT received ${choice} after voting closed.`,
    rejected: `ChatXPT could not count ${choice}.`,
    unavailable: "ChatXPT chat voting is not available right now.",
  };
  return messages[input.status];
}
