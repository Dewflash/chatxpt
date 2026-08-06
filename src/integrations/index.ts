/** Role 1 public boundary for platform and capture adapters. */
export {
  audienceEventSchema,
  gameplayFrameObservationSchema,
  platformEventSchema,
} from "../core";
export type {
  AudienceEvent,
  AudienceEventSource,
  EphemeralGameplayFrame,
  FrameSource,
  GameplayFrameObservation,
  PlatformEvent,
} from "../core";
export {
  FixedWindowTwitchChatRateLimiter,
  deliverTwitchChatFallbackAnnouncement,
  deliverTwitchChatVoteAcknowledgement,
  deliverTwitchChatVoteSubmissionAcknowledgement,
  type DeliveredTwitchChatVoteAcknowledgement,
  type DeliveredTwitchChatVoteSubmissionAcknowledgement,
  type DeliverTwitchChatFallbackAnnouncementInput,
  type DeliverTwitchChatVoteAcknowledgementInput,
  type DeliverTwitchChatVoteSubmissionAcknowledgementInput,
  type TwitchChatOutboundAttempt,
  type TwitchChatOutboundMessage,
  type TwitchChatOutboundSender,
  type TwitchChatRateLimitDecision,
  type TwitchChatRateLimiter,
} from "./twitch/chat-delivery";
export {
  TwitchChatVerifiedVoteActorStore,
  normaliseTwitchChatVote,
  submitTwitchChatVote,
  twitchChatVoteAcknowledgementIntent,
  twitchChatActorId,
  twitchChatVoterKey,
  type TwitchChatVoteAcknowledgementIntent,
  type TwitchChatVoteExecutor,
  type TwitchChatVerifiedVoteActor,
  type TwitchChatVoteMessage,
  type TwitchChatVoteNormalisationResult,
  type TwitchChatVoteSubmissionDependencies,
  type TwitchChatVoteSubmissionResult,
} from "./twitch/chat-votes";
export {
  buildObsOverlaySnapshotUrl,
  readObsOverlaySnapshot,
  type ObsOverlaySnapshotReadDependencies,
  type ObsOverlaySnapshotReadInput,
  type ObsOverlaySnapshotReadResult,
} from "./obs/overlay-snapshot";
