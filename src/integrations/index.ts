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
  type DeliveredTwitchChatVoteAcknowledgement,
  type DeliverTwitchChatFallbackAnnouncementInput,
  type DeliverTwitchChatVoteAcknowledgementInput,
  type TwitchChatOutboundAttempt,
  type TwitchChatOutboundMessage,
  type TwitchChatOutboundSender,
  type TwitchChatRateLimitDecision,
  type TwitchChatRateLimiter,
} from "./twitch/chat-delivery";
