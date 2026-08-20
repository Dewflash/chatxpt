import "server-only";

import { createHmac } from "node:crypto";

import {
  CONTRACT_VERSION,
  audienceEventSchema,
  audiencePointerAggregateSchema,
  audienceSnapshotSchema,
  serviceHealthSchema,
  type AuthoritativeSessionState,
  type ProjectionContext,
  type ProjectionContextResolver,
} from "@/core";
import { AudienceAnalyticsAccumulator, type AudienceAnalyticsTopic } from "@/extraction";
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
  | { readonly status: "aggregated" | "duplicate-message"; readonly sampleSize: number }
  | {
      readonly status: "ignored";
      readonly reason: "session-not-found" | "not-voting" | "late" | "not-live";
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
  private readonly analyticsBySession = new Map<string, AudienceAnalyticsAccumulator>();

  constructor(private readonly dependencies: TwitchChatApplicationDependencies) {
    this.now = dependencies.now ?? Date.now;
  }

  async ingest(input: TwitchChatMessageInput): Promise<TwitchChatIngestionResult> {
    const choice = parseTwitchChatVoteChoice(input.text);
    const record = await this.dependencies.runtime.persistence.twitchChannelSessions
      .findTwitchChannelSession(input.broadcasterId);
    if (record === null) return { status: "ignored", reason: "session-not-found" };
    let state = await this.dependencies.runtime.persistence.sessions.load(record.sessionId);
    if (state === null || state.session.broadcasterId !== input.broadcasterId) {
      return { status: "ignored", reason: "session-not-found" };
    }
    if (choice === null) {
      if (state.session.status !== "live") return { status: "ignored", reason: "not-live" };
      return this.ingestAudienceMessage(input, state);
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
        if (mapped.status === "ignored") return { status: "ignored", reason: "not-voting" };
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

  private async ingestAudienceMessage(
    input: TwitchChatMessageInput,
    initialState: AuthoritativeSessionState,
  ): Promise<TwitchChatIngestionResult> {
    const viewerId = pseudonymizeTwitchChatViewer(
      this.dependencies.eventSubSecret,
      initialState.session.sessionId,
      input.chatterId,
    );
    const messageFingerprint = this.privateId(
      "message",
      `${initialState.session.sessionId}:${input.messageId}`,
    );
    const commandId = this.privateId(
      "audience-command",
      `${initialState.session.sessionId}:${input.messageId}`,
    );
    const existing = await this.dependencies.runtime.persistence.sessions.findReceipt(commandId);
    if (existing !== null) {
      return {
        status: "duplicate-message",
        sampleSize: existing.state.audience?.sampleSize ?? 0,
      };
    }
    const accumulator = this.analyticsBySession.get(initialState.session.sessionId) ??
      new AudienceAnalyticsAccumulator({ minimumConfidence: 0.3 });
    this.analyticsBySession.set(initialState.session.sessionId, accumulator);
    const event = audienceEventSchema.parse({
      envelope: {
        contractVersion: CONTRACT_VERSION,
        sessionId: initialState.session.sessionId,
        questCycleId: initialState.questCycle.envelope.questCycleId,
        messageId: messageFingerprint,
        correlationId: this.privateId(
          "audience-correlation",
          `${initialState.session.sessionId}:${input.messageId}`,
        ),
        revision: initialState.session.revision,
        occurredAt: input.occurredAt,
        receivedAt: input.receivedAt,
        source: "twitch",
        evidenceClass: initialState.questCycle.envelope.evidenceClass,
      },
      eventType: "message",
      viewerId,
      text: input.text,
      chatVoteChoice: null,
      retentionClass: "ephemeral",
    });
    const update = accumulator.ingest(event, initialState.profile.keywordWatchlist);
    if (update === null) {
      return { status: "duplicate-message", sampleSize: initialState.audience?.sampleSize ?? 0 };
    }

    let state = initialState;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const snapshot = audienceSnapshotSchema.parse({
        ...update.snapshot,
        envelope: {
          ...update.snapshot.envelope,
          questCycleId: state.questCycle.envelope.questCycleId,
          revision: state.session.revision,
          evidenceClass: state.questCycle.envelope.evidenceClass,
        },
      });
      const actor: VerifiedCommandActor = {
        kind: "system",
        actorId: "twitch-chat-audience-analysis",
        expiresAt: null,
        moderatorForBroadcasterIds: [],
        voterKey: null,
        participationModes: [],
      };
      const result = await this.dependencies.runtime.execute(
        {
          contractVersion: CONTRACT_VERSION,
          sessionId: state.session.sessionId,
          questCycleId: state.questCycle.envelope.questCycleId,
          commandId,
          correlationId: event.envelope.correlationId,
          expectedRevision: state.session.revision,
          issuedAt: this.now(),
          actor: { kind: actor.kind, actorId: actor.actorId },
          type: "system.audience-snapshot-ready",
          snapshot,
        },
        actor,
        new TwitchChatProjectionContext(actor, this.now),
      );
      if (result.ok) {
        if (result.outcome === "committed") {
          await this.refreshLiveDirector(result.receipt.state, update.primaryTopic, actor);
        }
        return {
          status: result.outcome === "duplicate" ? "duplicate-message" : "aggregated",
          sampleSize: result.receipt.state.audience?.sampleSize ?? update.snapshot.sampleSize,
        };
      }
      if (result.error.code !== "stale-revision" || attempt === 1) {
        return { status: "rejected", reason: result.error.message };
      }
      const latest = await this.dependencies.runtime.persistence.sessions.load(state.session.sessionId);
      if (latest === null || latest.session.status !== "live") {
        return { status: "ignored", reason: "not-live" };
      }
      state = latest;
    }
    return { status: "rejected", reason: "Twitch audience analysis is unavailable" };
  }

  private async refreshLiveDirector(
    state: AuthoritativeSessionState,
    topic: AudienceAnalyticsTopic | null,
    actor: VerifiedCommandActor,
  ): Promise<void> {
    if (topic === null || topic.evidence.length === 0) return;
    const createdAt = Math.max(this.now(), topic.evidence.at(-1)?.observedAt ?? this.now());
    const pointerId = this.privateId(
      "audience-pointer",
      `${state.session.sessionId}:${state.session.revision}:${topic.topic}`,
    );
    const evidence = topic.evidence.map((item, index) => ({
      evidenceSignalId: this.privateId(
        "audience-evidence",
        `${pointerId}:${item.messageFingerprint}:${index}`,
      ),
      participantKey: item.participantKey,
      messageFingerprint: item.messageFingerprint,
      observedAt: item.observedAt,
      deleted: false,
    }));
    const windowStartedAt = Math.min(...evidence.map((item) => item.observedAt));
    const windowEndedAt = Math.max(...evidence.map((item) => item.observedAt));
    const aggregate = audiencePointerAggregateSchema.parse({
      envelope: {
        contractVersion: CONTRACT_VERSION,
        sessionId: state.session.sessionId,
        questCycleId: state.questCycle.envelope.questCycleId,
        messageId: this.privateId("audience-aggregate", pointerId),
        correlationId: this.privateId("audience-correlation", pointerId),
        revision: state.session.revision,
        occurredAt: createdAt,
        receivedAt: createdAt,
        source: "algorithm",
        evidenceClass: state.questCycle.envelope.evidenceClass,
      },
      pointerId,
      observedAt: createdAt,
      status: "known",
      topic: topic.topic,
      windowStartedAt,
      windowEndedAt,
      createdAt,
      expiresAt: createdAt + 30_000,
      confidence: Math.min(1, 0.35 + topic.count * 0.12),
      relevance: Math.min(1, 0.45 + topic.count * 0.1),
      intentAlignment: 0.6,
      sarcasmRisk: false,
      evidence,
    });
    await this.dependencies.runtime.persistence.audiencePointers.store(aggregate);
    await this.dependencies.runtime.execute(
      {
        contractVersion: CONTRACT_VERSION,
        sessionId: state.session.sessionId,
        questCycleId: state.questCycle.envelope.questCycleId,
        commandId: this.privateId("live-context-command", pointerId),
        correlationId: aggregate.envelope.correlationId,
        expectedRevision: state.session.revision,
        issuedAt: createdAt,
        actor: { kind: actor.kind, actorId: actor.actorId },
        type: "system.live-director-context-ready",
        liveContextId: this.privateId("live-context", pointerId),
        audiencePointerId: pointerId,
      },
      actor,
      new TwitchChatProjectionContext(actor, this.now),
    );
  }

  private privateId(prefix: string, value: string): string {
    return `${prefix}-${createHmac("sha256", this.dependencies.eventSubSecret)
      .update(value)
      .digest("hex")
      .slice(0, 32)}`;
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
