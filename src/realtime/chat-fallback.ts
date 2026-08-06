import {
  twitchChatFallbackDeliverySchema,
  twitchChatVoteAcknowledgementSchema,
  type QuestCandidate,
  type TwitchChatFallbackAnnouncementKind,
  type TwitchChatFallbackDelivery,
  type TwitchChatFallbackDeliveryStatus,
  type TwitchChatVoteAcknowledgement,
  type TwitchChatVoteAcknowledgementStatus,
} from "../core";

export type TwitchChatVoteProcessingStatus = Extract<
  TwitchChatVoteAcknowledgementStatus,
  "counted" | "duplicate" | "rejected" | "late"
>;

export interface TwitchChatFallbackDeliveryInput {
  readonly kind: TwitchChatFallbackAnnouncementKind;
  readonly messageText: string;
  readonly status: TwitchChatFallbackDeliveryStatus;
  readonly deliveredAt: number | null;
  readonly retryable: boolean;
}

export interface TwitchChatVoteAcknowledgementInput {
  readonly delivery: TwitchChatFallbackDelivery;
  readonly processingStatus: TwitchChatVoteProcessingStatus;
  readonly candidateId: string | null;
}

function optionLabel(candidate: QuestCandidate, index: number): string {
  return `${index + 1}) ${candidate.title.trim()}`;
}

export function buildTwitchChatPollOpenText(candidates: readonly [
  QuestCandidate,
  QuestCandidate,
  QuestCandidate,
]): string {
  return `ChatXPT vote is open: ${candidates.map(optionLabel).join(" | ")}. Reply 1, 2, or 3.`;
}

export function buildTwitchChatFinalResultText(input: {
  readonly winnerTitle: string | null;
  readonly outcome: "activated" | "cancelled" | "no-votes" | "expired";
}): string {
  if (input.outcome === "activated" && input.winnerTitle !== null) {
    return `ChatXPT quest selected: ${input.winnerTitle.trim()}.`;
  }
  if (input.outcome === "no-votes") return "ChatXPT vote closed with no accepted votes.";
  if (input.outcome === "expired") return "ChatXPT vote expired before a quest could start.";
  return "ChatXPT vote closed without starting a quest.";
}

export function recordTwitchChatFallbackDelivery(
  input: TwitchChatFallbackDeliveryInput,
): TwitchChatFallbackDelivery {
  return twitchChatFallbackDeliverySchema.parse(input);
}

export function buildTwitchChatVoteAcknowledgement(
  input: TwitchChatVoteAcknowledgementInput,
): TwitchChatVoteAcknowledgement {
  if (input.delivery.status !== "delivered" || input.delivery.deliveredAt === null) {
    return twitchChatVoteAcknowledgementSchema.parse({
      status: input.delivery.status === "unavailable" ? "unavailable" : "not-delivered",
      candidateId: null,
      messageText: "ChatXPT did not deliver a Twitch-chat vote acknowledgement.",
      deliveredAt: null,
    });
  }

  const messages: Record<TwitchChatVoteProcessingStatus, string> = {
    counted: "ChatXPT counted your vote.",
    duplicate: "ChatXPT already counted your first vote.",
    rejected: "ChatXPT could not count that vote.",
    late: "ChatXPT could not count that vote because voting has closed.",
  };
  return twitchChatVoteAcknowledgementSchema.parse({
    status: input.processingStatus,
    candidateId: input.processingStatus === "counted" ? input.candidateId : null,
    messageText: messages[input.processingStatus],
    deliveredAt: input.delivery.deliveredAt,
  });
}
