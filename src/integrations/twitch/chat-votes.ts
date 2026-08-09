import { createHash } from "node:crypto";

import {
  audienceEventSchema,
  domainErrorSchema,
  viewerVoteCommandSchema,
  type AudienceEvent,
  type DomainError,
  type ViewerVoteCommand,
} from "../../core";

export type TwitchChatVoteChoice = 1 | 2 | 3;
type TwitchChatVoteEvidenceClass = "live" | "diagnostic" | "fixture";

export interface TwitchChatVoteAdapterInput {
  readonly sessionId: string;
  readonly questCycleId: string;
  readonly expectedRevision: number;
  readonly messageId: string;
  readonly viewerId: string | null;
  readonly text: string;
  readonly candidateIds: readonly [string, string, string];
  readonly occurredAt: number;
  readonly receivedAt: number;
  readonly evidenceClass: TwitchChatVoteEvidenceClass;
  readonly correlationId?: string;
}

export type TwitchChatVoteAdapterResult =
  | {
      readonly status: "mapped";
      readonly choice: TwitchChatVoteChoice;
      readonly command: ViewerVoteCommand;
      readonly audienceEvent: AudienceEvent;
    }
  | {
      readonly status: "ignored";
      readonly reason: "not-a-chat-vote";
      readonly audienceEvent: AudienceEvent;
    }
  | {
      readonly status: "rejected";
      readonly reason: "missing-viewer-id" | "invalid-command";
      readonly error: DomainError;
      readonly audienceEvent: AudienceEvent;
    };

export function parseTwitchChatVoteChoice(text: string): TwitchChatVoteChoice | null {
  const trimmed = text.trim();
  if (trimmed === "1" || trimmed === "2" || trimmed === "3") return Number(trimmed) as TwitchChatVoteChoice;
  return null;
}

function stableId(prefix: string, input: TwitchChatVoteAdapterInput): string {
  const hash = createHash("sha256")
    .update(
      JSON.stringify({
        sessionId: input.sessionId,
        questCycleId: input.questCycleId,
        messageId: input.messageId,
        viewerId: input.viewerId,
        text: input.text.trim(),
      }),
    )
    .digest("hex")
    .slice(0, 24);
  return `${prefix}-${hash}`;
}

function audienceEvent(input: TwitchChatVoteAdapterInput, choice: TwitchChatVoteChoice | null): AudienceEvent {
  return audienceEventSchema.parse({
    envelope: {
      contractVersion: "1.0.0",
      sessionId: input.sessionId,
      questCycleId: input.questCycleId,
      messageId: stableId("twitch-chat", input),
      correlationId: input.correlationId ?? stableId("twitch-chat-correlation", input),
      revision: input.expectedRevision,
      occurredAt: input.occurredAt,
      receivedAt: input.receivedAt,
      source: "twitch",
      evidenceClass: input.evidenceClass,
    },
    eventType: choice === null ? "message" : "chat-vote",
    viewerId: input.viewerId,
    text: choice === null ? input.text.trim() : null,
    chatVoteChoice: choice,
    retentionClass: choice === null ? "raw-24h-max" : "aggregate",
  });
}

function rejection(
  reason: Extract<TwitchChatVoteAdapterResult, { status: "rejected" }>["reason"],
  message: string,
  event: AudienceEvent,
): TwitchChatVoteAdapterResult {
  return {
    status: "rejected",
    reason,
    error: domainErrorSchema.parse({ code: "validation", message, retryable: false }),
    audienceEvent: event,
  };
}

export function mapTwitchChatMessageToVoteCommand(
  input: TwitchChatVoteAdapterInput,
): TwitchChatVoteAdapterResult {
  const choice = parseTwitchChatVoteChoice(input.text);
  const event = audienceEvent(input, choice);
  if (choice === null) {
    return { status: "ignored", reason: "not-a-chat-vote", audienceEvent: event };
  }
  if (input.viewerId === null || input.viewerId.trim().length === 0) {
    return rejection("missing-viewer-id", "Twitch chat votes require a verified viewer identity", event);
  }

  const candidateId = input.candidateIds[choice - 1];
  const command = viewerVoteCommandSchema.safeParse({
    contractVersion: "1.0.0",
    sessionId: input.sessionId,
    questCycleId: input.questCycleId,
    commandId: stableId("twitch-chat-vote", input),
    correlationId: input.correlationId ?? stableId("twitch-chat-correlation", input),
    expectedRevision: input.expectedRevision,
    issuedAt: input.receivedAt,
    actor: { kind: "viewer", actorId: input.viewerId },
    type: "viewer.vote",
    candidateId,
    voterKey: `twitch-chat:${input.viewerId}`,
    sourceMode: "twitch-chat",
  });

  if (!command.success) {
    return rejection("invalid-command", "Twitch chat vote could not be mapped to a valid command", event);
  }

  return { status: "mapped", choice, command: command.data, audienceEvent: event };
}
