import "server-only";

import {
  serviceHealthSchema,
  type AuthoritativeSessionState,
  type ProjectionContext,
  type ProjectionContextResolver,
} from "@/core";
import { mapTwitchChatMessageToVoteCommand, parseTwitchChatVoteChoice } from "@/integrations";
import { pseudonymizeTwitchChatViewer } from "@/integrations/server";
import type { VerifiedCommandActor } from "@/realtime";

import { getChatXptServerRuntime, type ChatXptServerRuntime } from "./runtime";

export interface TwitchChatMessageInput {
  readonly broadcasterId: string;
  readonly chatterId: string;
  readonly messageId: string;
  readonly text: string;
  readonly occurredAt: number;
  readonly receivedAt: number;
}

export type TwitchChatIngestionResult =
  | { readonly status: "counted" | "duplicate"; readonly choice: 1 | 2 | 3 }
  | {
      readonly status: "ignored";
      readonly reason: "not-a-chat-vote" | "session-not-found" | "not-voting" | "late";
    }
  | { readonly status: "rejected"; readonly reason: string };

interface TwitchChatApplicationDependencies {
  readonly runtime: ChatXptServerRuntime;
  readonly eventSubSecret: string;
  readonly now?: () => number;
}

class TwitchChatProjectionContext implements ProjectionContextResolver {
  constructor(
    private readonly actor: VerifiedCommandActor,
    private readonly now: () => number,
  ) {}

  resolve(): ProjectionContext {
    return {
      participationMode: "twitch-chat",
      viewerId: this.actor.actorId,
      sessionPoints: 0,
      acceptedCandidateId: null,
      connection: serviceHealthSchema.parse({
        service: "twitch-eventsub-chat",
        status: "ready",
        checkedAt: this.now(),
        message: "Signed Twitch chat event accepted",
        retryable: false,
      }),
    };
  }
}

export class TwitchChatApplication {
  private readonly now: () => number;

  constructor(private readonly dependencies: TwitchChatApplicationDependencies) {
    this.now = dependencies.now ?? Date.now;
  }

  async ingest(input: TwitchChatMessageInput): Promise<TwitchChatIngestionResult> {
    const choice = parseTwitchChatVoteChoice(input.text);
    if (choice === null) return { status: "ignored", reason: "not-a-chat-vote" };

    const record = await this.dependencies.runtime.persistence.twitchChannelSessions
      .findTwitchChannelSession(input.broadcasterId);
    if (record === null) return { status: "ignored", reason: "session-not-found" };
    let state = await this.dependencies.runtime.persistence.sessions.load(record.sessionId);
    if (state === null || state.session.broadcasterId !== input.broadcasterId) {
      return { status: "ignored", reason: "session-not-found" };
    }
    if (
      state.session.status !== "live" ||
      state.questCycle.status !== "voting" ||
      state.questCycle.options.length !== 3 ||
      state.questCycle.envelope.questCycleId === null ||
      !state.session.capabilities.twitchChatVoting
    ) {
      return { status: "ignored", reason: "not-voting" };
    }
    if (state.questCycle.endsAt !== null && input.receivedAt >= state.questCycle.endsAt) {
      return { status: "ignored", reason: "late" };
    }

    const viewerId = pseudonymizeTwitchChatViewer(
      this.dependencies.eventSubSecret,
      state.session.sessionId,
      input.chatterId,
    );
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const mapped = this.map(input, state, viewerId);
      if (mapped.status !== "mapped") {
        if (mapped.status === "ignored") {
          return { status: "ignored", reason: "not-a-chat-vote" };
        }
        return { status: "rejected", reason: mapped.error.message };
      }
      const existing = await this.dependencies.runtime.persistence.sessions.findReceipt(
        mapped.command.commandId,
      );
      if (existing !== null) {
        const command = existing.command;
        if (
          command.type === "viewer.vote" &&
          command.sessionId === mapped.command.sessionId &&
          command.questCycleId === mapped.command.questCycleId &&
          command.candidateId === mapped.command.candidateId &&
          command.voterKey === mapped.command.voterKey
        ) {
          return { status: "duplicate", choice: mapped.choice };
        }
        return { status: "rejected", reason: "Twitch chat message ID was already used" };
      }
      const actor: VerifiedCommandActor = {
        kind: "viewer",
        actorId: viewerId,
        expiresAt: null,
        moderatorForBroadcasterIds: [],
        voterKey: mapped.command.voterKey,
        participationModes: ["twitch-chat"],
      };
      const result = await this.dependencies.runtime.execute(
        mapped.command,
        actor,
        new TwitchChatProjectionContext(actor, this.now),
      );
      if (result.ok) {
        return { status: result.outcome === "duplicate" ? "duplicate" : "counted", choice: mapped.choice };
      }
      if (result.error.code === "duplicate") {
        return { status: "duplicate", choice: mapped.choice };
      }
      if (result.error.code !== "stale-revision" || attempt === 1) {
        return { status: "rejected", reason: result.error.message };
      }
      const latest = await this.dependencies.runtime.persistence.sessions.load(state.session.sessionId);
      if (
        latest === null ||
        latest.questCycle.envelope.questCycleId !== state.questCycle.envelope.questCycleId ||
        latest.questCycle.status !== "voting"
      ) {
        return { status: "ignored", reason: "late" };
      }
      state = latest;
    }
    return { status: "rejected", reason: "Twitch chat vote processing is unavailable" };
  }

  private map(input: TwitchChatMessageInput, state: AuthoritativeSessionState, viewerId: string) {
    return mapTwitchChatMessageToVoteCommand({
      sessionId: state.session.sessionId,
      questCycleId: state.questCycle.envelope.questCycleId ?? "missing-cycle",
      expectedRevision: state.session.revision,
      messageId: input.messageId,
      viewerId,
      text: input.text,
      candidateIds: state.questCycle.options.map((option) => option.candidateId) as [string, string, string],
      occurredAt: input.occurredAt,
      receivedAt: input.receivedAt,
      evidenceClass: state.questCycle.envelope.evidenceClass,
      correlationId: `twitch-eventsub-${input.messageId}`,
    });
  }
}

const applicationKey = Symbol.for("chatxpt.twitchChatApplication.v1");
const globalApplication = globalThis as typeof globalThis & {
  [applicationKey]?: TwitchChatApplication;
};

export function getTwitchChatApplication(): TwitchChatApplication {
  if (globalApplication[applicationKey] !== undefined) return globalApplication[applicationKey];
  globalApplication[applicationKey] = new TwitchChatApplication({
    runtime: getChatXptServerRuntime(),
    eventSubSecret: process.env.TWITCH_EVENTSUB_SECRET ?? "",
  });
  return globalApplication[applicationKey];
}
