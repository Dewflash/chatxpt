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
  handleTwitchChatVoteMessage,
  type TwitchChatVoteMessageHandlerDependencies,
  type TwitchChatVoteMessageHandlingResult,
} from "./twitch/chat-handler";
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
  TWITCH_EXTENSION_CONFIG_PATH,
  TWITCH_EXTENSION_LIVE_CONFIG_PATH,
  TWITCH_EXTENSION_VIEWER_PATH,
  TWITCH_OAUTH_CALLBACK_PATH,
  resolveTwitchSetupRegistrationManifest,
  resolveTwitchSetupReadiness,
  type TwitchSetupRegistrationManifest,
  type TwitchSetupReadiness,
} from "./twitch/setup";
export {
  MAX_OBS_OVERLAY_READ_GRANT_MILLISECONDS,
  buildObsOverlaySnapshotUrl,
  issueObsOverlayReadGrant,
  readObsOverlaySnapshot,
  type ObsOverlayReadGrantDependencies,
  type ObsOverlayReadGrantInput,
  type ObsOverlayReadGrantResult,
  type ObsOverlaySnapshotReadDependencies,
  type ObsOverlaySnapshotReadInput,
  type ObsOverlaySnapshotReadResult,
} from "./obs/overlay-snapshot";
