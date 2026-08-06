import {
  deliverTwitchChatVoteSubmissionAcknowledgement,
  type DeliveredTwitchChatVoteSubmissionAcknowledgement,
  type TwitchChatOutboundSender,
  type TwitchChatRateLimiter,
} from "./chat-delivery";
import {
  submitTwitchChatVote,
  type TwitchChatVoteMessage,
  type TwitchChatVoteSubmissionDependencies,
  type TwitchChatVoteSubmissionResult,
} from "./chat-votes";

export interface TwitchChatVoteMessageHandlerDependencies
  extends TwitchChatVoteSubmissionDependencies {
  readonly sender: TwitchChatOutboundSender | null;
  readonly rateLimiter?: TwitchChatRateLimiter | null;
  readonly now: () => number;
}

export interface TwitchChatVoteMessageHandlingResult {
  readonly submission: TwitchChatVoteSubmissionResult;
  readonly acknowledgement: DeliveredTwitchChatVoteSubmissionAcknowledgement;
}

export async function handleTwitchChatVoteMessage(
  dependencies: TwitchChatVoteMessageHandlerDependencies,
  message: TwitchChatVoteMessage,
): Promise<TwitchChatVoteMessageHandlingResult> {
  const submission = await submitTwitchChatVote(dependencies, message);
  const acknowledgement = await deliverTwitchChatVoteSubmissionAcknowledgement({
    submission,
    channelId: message.twitchChannelId.trim().length === 0 ? null : message.twitchChannelId,
    sender: dependencies.sender,
    rateLimiter: dependencies.rateLimiter,
    now: dependencies.now,
    correlationId:
      submission.status === "submitted"
        ? submission.command.correlationId
        : `twitch-chat-ignored-${message.receivedAt}`,
  });

  return { submission, acknowledgement };
}
