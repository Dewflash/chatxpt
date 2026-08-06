import { createHash } from "node:crypto";

import {
  commandFingerprint,
  viewerVoteCommandSchema,
  type CommandEnvelope,
  type ParticipationSourceMode,
  type ViewerVoteCommand,
} from "../../core";

export interface TwitchChatVoteMessage {
  readonly sessionId: string;
  readonly questCycleId: string;
  readonly expectedRevision: number;
  readonly candidateIds: readonly [string, string, string];
  readonly twitchMessageId: string;
  readonly twitchChannelId: string;
  readonly twitchUserId: string | null;
  readonly text: string;
  readonly receivedAt: number;
  readonly commandTtlMs?: number;
}

export interface TwitchChatVerifiedVoteActor {
  readonly kind: CommandEnvelope["actor"]["kind"];
  readonly actorId: string | null;
  readonly expiresAt: number | null;
  readonly moderatorForBroadcasterIds: readonly string[];
  readonly voterKey: string | null;
  readonly participationModes: readonly ParticipationSourceMode[];
}

export type TwitchChatVoteNormalisationResult =
  | {
      readonly status: "accepted";
      readonly selectedIndex: 0 | 1 | 2;
      readonly command: ViewerVoteCommand;
      readonly verifiedActor: TwitchChatVerifiedVoteActor;
    }
  | {
      readonly status: "ignored";
      readonly reason: "not-a-vote" | "missing-user-id" | "invalid-input";
    };

interface StoredVerifiedVoteActor {
  readonly fingerprint: string;
  readonly verifiedActor: TwitchChatVerifiedVoteActor;
}

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 24);
}

function parseVoteIndex(text: string): 0 | 1 | 2 | null {
  const trimmed = text.trim();
  if (trimmed === "1") return 0;
  if (trimmed === "2") return 1;
  if (trimmed === "3") return 2;
  return null;
}

export function twitchChatActorId(twitchUserId: string): string {
  return `twitch-viewer-${digest(twitchUserId)}`;
}

export function twitchChatVoterKey(input: {
  readonly sessionId: string;
  readonly twitchUserId: string;
}): string {
  return `twitch-voter-${digest(`${input.sessionId}:${input.twitchUserId}`)}`;
}

export function normaliseTwitchChatVote(
  input: TwitchChatVoteMessage,
): TwitchChatVoteNormalisationResult {
  const selectedIndex = parseVoteIndex(input.text);
  if (selectedIndex === null) {
    return { status: "ignored", reason: "not-a-vote" };
  }
  if (input.twitchUserId === null || input.twitchUserId.trim().length === 0) {
    return { status: "ignored", reason: "missing-user-id" };
  }

  const actorId = twitchChatActorId(input.twitchUserId);
  const voterKey = twitchChatVoterKey({
    sessionId: input.sessionId,
    twitchUserId: input.twitchUserId,
  });
  const commandSeed = [
    input.sessionId,
    input.questCycleId,
    input.twitchChannelId,
    input.twitchMessageId,
  ].join(":");
  const command = viewerVoteCommandSchema.safeParse({
    contractVersion: "1.0.0",
    sessionId: input.sessionId,
    questCycleId: input.questCycleId,
    commandId: `twitch-chat-vote-${digest(commandSeed)}`,
    correlationId: `twitch-chat-${digest(`${commandSeed}:correlation`)}`,
    expectedRevision: input.expectedRevision,
    issuedAt: input.receivedAt,
    actor: { kind: "viewer", actorId },
    type: "viewer.vote",
    candidateId: input.candidateIds[selectedIndex],
    voterKey,
    sourceMode: "twitch-chat",
  });

  if (!command.success) {
    return { status: "ignored", reason: "invalid-input" };
  }

  return {
    status: "accepted",
    selectedIndex,
    command: command.data,
    verifiedActor: {
      kind: "viewer",
      actorId,
      expiresAt: input.receivedAt + (input.commandTtlMs ?? 5 * 60_000),
      moderatorForBroadcasterIds: [],
      voterKey,
      participationModes: ["twitch-chat"],
    },
  };
}

export class TwitchChatVerifiedVoteActorStore {
  private readonly actorsByCommandId = new Map<string, StoredVerifiedVoteActor>();

  remember(result: TwitchChatVoteNormalisationResult): boolean {
    if (result.status !== "accepted") return false;
    this.actorsByCommandId.set(result.command.commandId, {
      fingerprint: commandFingerprint(result.command),
      verifiedActor: result.verifiedActor,
    });
    return true;
  }

  resolve(command: CommandEnvelope): TwitchChatVerifiedVoteActor | null {
    const stored = this.actorsByCommandId.get(command.commandId);
    if (stored === undefined || stored.fingerprint !== commandFingerprint(command)) {
      return null;
    }
    return stored.verifiedActor;
  }
}
