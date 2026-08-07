import type { QuestCycleState } from "../core";

export type ChatFallbackChoice = "1" | "2" | "3";
export type ChatVoteReceiptStatus = "counted" | "duplicate" | "rejected" | "late" | "unavailable";

export interface ChatFallbackOption {
  readonly choice: ChatFallbackChoice;
  readonly candidateId: string;
  readonly title: string;
  readonly commandText: ChatFallbackChoice;
}

export type ChatFallbackPoll =
  | {
      readonly ok: true;
      readonly message: string;
      readonly options: readonly [ChatFallbackOption, ChatFallbackOption, ChatFallbackOption];
      readonly closesAt: number | null;
      readonly perVoteChatAck: false;
    }
  | {
      readonly ok: false;
      readonly reason: "not-voting" | "not-three-options";
      readonly message: string;
      readonly perVoteChatAck: false;
    };

export interface ChatFallbackResultAnnouncement {
  readonly message: string;
  readonly winnerCandidateId: string | null;
  readonly shouldAnnounceToChat: true;
}

export interface ChatVoteReceiptPresentation {
  readonly status: ChatVoteReceiptStatus;
  readonly counted: boolean;
  readonly retryable: boolean;
  readonly viewerMessage: string;
  readonly shouldSendChatAcknowledgement: false;
}

const CHOICES = ["1", "2", "3"] as const;

function compact(text: string, maxLength: number): string {
  const trimmed = text.trim().replace(/\s+/g, " ");
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}

export function buildChatFallbackPoll(questCycle: QuestCycleState): ChatFallbackPoll {
  if (questCycle.status !== "voting") {
    return {
      ok: false,
      reason: "not-voting",
      message: "ChatXPT chat voting is unavailable because no vote is open.",
      perVoteChatAck: false,
    };
  }
  if (questCycle.options.length !== 3) {
    return {
      ok: false,
      reason: "not-three-options",
      message: "ChatXPT chat voting needs exactly three quest options.",
      perVoteChatAck: false,
    };
  }

  const options = questCycle.options.map((candidate, index) => ({
    choice: CHOICES[index],
    candidateId: candidate.candidateId,
    title: candidate.title,
    commandText: CHOICES[index],
  })) as [ChatFallbackOption, ChatFallbackOption, ChatFallbackOption];
  const optionText = options
    .map((option) => `${option.choice}=${compact(option.title, 36)}`)
    .join(" | ");
  return {
    ok: true,
    message: `ChatXPT vote open: reply 1, 2, or 3. ${optionText}`,
    options,
    closesAt: questCycle.endsAt,
    perVoteChatAck: false,
  };
}

export function buildChatFallbackResultAnnouncement(
  questCycle: QuestCycleState,
): ChatFallbackResultAnnouncement {
  const winnerCandidateId = questCycle.activeCandidateId;
  const winner = questCycle.options.find((candidate) => candidate.candidateId === winnerCandidateId);
  if (winner === undefined || winnerCandidateId === null) {
    return {
      message: "ChatXPT vote closed: no quest was activated.",
      winnerCandidateId: null,
      shouldAnnounceToChat: true,
    };
  }
  return {
    message: `ChatXPT vote result: ${compact(winner.title, 60)} won.`,
    winnerCandidateId,
    shouldAnnounceToChat: true,
  };
}

export function describeChatVoteReceipt(
  status: ChatVoteReceiptStatus,
  choice: ChatFallbackChoice | null,
): ChatVoteReceiptPresentation {
  const selected = choice === null ? "" : ` for option ${choice}`;
  switch (status) {
    case "counted":
      return {
        status,
        counted: true,
        retryable: false,
        viewerMessage: `Vote counted${selected}.`,
        shouldSendChatAcknowledgement: false,
      };
    case "duplicate":
      return {
        status,
        counted: true,
        retryable: false,
        viewerMessage: "Your first chat vote is already counted.",
        shouldSendChatAcknowledgement: false,
      };
    case "late":
      return {
        status,
        counted: false,
        retryable: false,
        viewerMessage: "That chat vote arrived after voting closed.",
        shouldSendChatAcknowledgement: false,
      };
    case "unavailable":
      return {
        status,
        counted: false,
        retryable: true,
        viewerMessage: "Chat vote acknowledgement is temporarily unavailable.",
        shouldSendChatAcknowledgement: false,
      };
    case "rejected":
      return {
        status,
        counted: false,
        retryable: false,
        viewerMessage: "That chat vote could not be counted.",
        shouldSendChatAcknowledgement: false,
      };
  }
}
