/** Role 1 public boundary for platform and capture adapters. */
export {
  audienceEventSchema,
  gameplayFrameObservationSchema,
  platformEventSchema,
} from "../core";
export {
  buildChatFallbackPoll,
  buildChatFallbackResultAnnouncement,
  describeChatVoteReceipt,
} from "./chat-fallback";
export type {
  AudienceEvent,
  AudienceEventSource,
  EphemeralGameplayFrame,
  FrameSource,
  GameplayFrameObservation,
  PlatformEvent,
} from "../core";
export type {
  ChatFallbackChoice,
  ChatFallbackOption,
  ChatFallbackPoll,
  ChatFallbackResultAnnouncement,
  ChatVoteReceiptPresentation,
  ChatVoteReceiptStatus,
} from "./chat-fallback";
export * from "./twitch";
