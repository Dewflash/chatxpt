import "server-only";

import { randomUUID } from "node:crypto";

import { z } from "zod";

import {
  CONTRACT_VERSION,
  CanonicalViewProjector,
  ChatXptOrchestrator,
  authoritativeSessionStateSchema,
  candidateBatchSchema,
  domainErrorSchema,
  serviceHealthSchema,
  viewerViewModelSchema,
  viewerReactionCommandSchema,
  viewerVoteCommandSchema,
  streamerQuestCommandSchema,
  streamerQuestProgressCommandSchema,
  systemIntelligenceCommandSchema,
  systemVoteCloseCommandSchema,
  type AuthoritativeSessionState,
  type DomainError,
  type MessageIdFactory,
  type ProjectionContext,
  type ProjectionContextResolver,
  type ViewerViewModel,
} from "@/core";
import {
  readTwitchExtensionBearerToken,
  toVerifiedTwitchParticipant,
  verifyTwitchExtensionJwt,
  type TwitchExtensionAuthorization,
} from "@/integrations";
import {
  createDefaultQuestEngine,
  DefaultDirectorCueConverter,
  DefaultDirectorCueLifecycle,
} from "@/quest-engine";
import {
  ServerCommandAuthorizer,
  SessionLifecycleService,
  StaticVerifiedActorResolver,
  bindPersistenceRuntime,
  type ChatXptPersistenceRuntime,
  type VerifiedCommandActor,
} from "@/realtime";
import { resolveServerPersistenceEnvironment } from "@/realtime/server";

import { getChatXptServerRuntime } from "./runtime";

export const twitchExtensionVoteRequestSchema = z
  .object({
    commandId: z.string().trim().min(1).max(128),
    candidateId: z.string().trim().min(1).max(128),
  })
  .strict();

export const twitchExtensionReactionRequestSchema = z
  .object({
    commandId: z.string().trim().min(1).max(128),
    reaction: z.literal("hype"),
  })
  .strict();

const localDiagnosticCandidatesSchema = z
  .array(
    z
      .object({
        id: z.string().trim().min(1).max(128),
        title: z.string().trim().min(3).max(80),
        instruction: z.string().trim().min(8).max(240),
        durationSeconds: z.number().int().min(10).max(900),
        difficulty: z.enum(["easy", "medium", "hard"]),
        rewardPoints: z.number().int().nonnegative().max(100_000),
        rationale: z.string().trim().min(8).max(320),
      })
      .strict(),
  )
  .length(3)
  .superRefine((candidates, context) => {
    if (new Set(candidates.map((candidate) => candidate.id)).size !== 3) {
      context.addIssue({ code: "custom", message: "Diagnostic candidate IDs must be distinct" });
    }
  });

export type LocalDiagnosticCandidate = z.infer<typeof localDiagnosticCandidatesSchema>[number];

export interface TwitchExtensionVoteRequest {
  readonly commandId: string;
  readonly candidateId: string;
}

export interface TwitchExtensionReactionRequest {
  readonly commandId: string;
  readonly reaction: "hype";
}

export type TwitchExtensionViewerApplicationErrorCode =
  | "unauthenticated"
  | "misconfigured"
  | "session-not-found"
  | "session-unavailable"
  | "invalid-command"
  | "dependency-unavailable";

export class TwitchExtensionViewerApplicationError extends Error {
  constructor(
    readonly code: TwitchExtensionViewerApplicationErrorCode,
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "TwitchExtensionViewerApplicationError";
  }
}

export type TwitchExtensionVoteResult =
  | {
      readonly ok: true;
      readonly outcome: "committed" | "duplicate";
      readonly view: ViewerViewModel;
    }
  | {
      readonly ok: false;
      readonly error: DomainError;
      readonly view: ViewerViewModel;
    };

interface ApplicationDependencies {
  readonly persistence: ChatXptPersistenceRuntime;
  readonly extensionSecret: string;
  readonly now?: () => number;
  readonly nextId?: () => string;
  readonly localDiagnostics?: boolean;
}

interface AuthorizedSession {
  readonly authorization: TwitchExtensionAuthorization;
  readonly state: AuthoritativeSessionState;
  readonly actor: VerifiedCommandActor;
  readonly viewerId: string | null;
}

class RandomMessageIds implements MessageIdFactory {
  nextId(kind: "quest-state" | "quest-event" | "view-model"): string {
    return `${kind}-${randomUUID()}`;
  }
}

class TwitchViewerProjectionContext implements ProjectionContextResolver {
  constructor(
    private readonly persistence: ChatXptPersistenceRuntime,
    private readonly actor: VerifiedCommandActor,
    private readonly viewerId: string | null,
    private readonly now: () => number,
  ) {}

  async resolve(state: AuthoritativeSessionState): Promise<ProjectionContext> {
    const questCycleId = state.questCycle.envelope.questCycleId;
    const recovery =
      questCycleId === null || this.actor.voterKey === null
        ? null
        : await this.persistence.viewerRecovery.readViewerRecovery({
            sessionId: state.session.sessionId,
            questCycleId,
            voterKey: this.actor.voterKey,
          });
    return {
      participationMode: "twitch-extension",
      viewerId: this.viewerId,
      sessionPoints: recovery?.sessionPoints ?? 0,
      acceptedCandidateId: recovery?.acceptedCandidateId ?? null,
      connection: serviceHealthSchema.parse({
        service: "twitch-extension-ebs",
        status: "ready",
        checkedAt: this.now(),
        message: "Twitch Extension authorization and ChatXPT session are connected",
        retryable: false,
      }),
    };
  }
}

function applicationError(
  code: TwitchExtensionViewerApplicationErrorCode,
  message: string,
  retryable = false,
): TwitchExtensionViewerApplicationError {
  return new TwitchExtensionViewerApplicationError(code, message, retryable);
}

export class TwitchExtensionViewerApplication {
  private readonly persistence: ChatXptPersistenceRuntime;
  private readonly extensionSecret: string;
  private readonly now: () => number;
  private readonly nextId: () => string;
  private readonly localDiagnostics: boolean;
  private pendingLocalDiagnostic:
    | { readonly batchId: string; readonly stagedAt: number; readonly candidates: readonly LocalDiagnosticCandidate[] }
    | null = null;
  private activeLocalDiagnosticBatchId: string | null = null;
  private activeLocalDiagnosticSessionId: string | null = null;
  private localBootstrap: Promise<void> | null = null;

  constructor(dependencies: ApplicationDependencies) {
    this.persistence = dependencies.persistence;
    this.extensionSecret = dependencies.extensionSecret;
    this.now = dependencies.now ?? Date.now;
    this.nextId = dependencies.nextId ?? randomUUID;
    this.localDiagnostics = dependencies.localDiagnostics ?? false;
  }

  stageLocalDiagnosticQuests(candidates: readonly LocalDiagnosticCandidate[]): { readonly batchId: string } {
    if (!this.localDiagnostics || this.persistence.mode !== "memory") {
      throw applicationError(
        "session-unavailable",
        "Local Twitch diagnostic staging is disabled outside credential-free local mode",
      );
    }
    const parsed = localDiagnosticCandidatesSchema.parse(candidates);
    const batchId = `local-diagnostic-${this.nextId()}`;
    this.pendingLocalDiagnostic = {
      batchId,
      stagedAt: this.now(),
      candidates: parsed,
    };
    return { batchId };
  }

  async clearLocalDiagnosticQuests(): Promise<void> {
    if (!this.localDiagnostics || this.persistence.mode !== "memory") return;
    this.pendingLocalDiagnostic = null;
    this.activeLocalDiagnosticBatchId = null;
    const sessionId = this.activeLocalDiagnosticSessionId;
    this.activeLocalDiagnosticSessionId = null;
    if (sessionId === null) return;
    const state = await this.persistence.sessions.load(sessionId);
    if (state === null || (state.session.status !== "preparing" && state.session.status !== "live")) {
      return;
    }
    const ended = await new SessionLifecycleService(this.persistence.lifecycle).end(
      sessionId,
      state.session.revision,
      this.now(),
      "local-diagnostic-cleared",
      `end-${this.nextId()}`,
    );
    if (!ended.ok) {
      throw applicationError("dependency-unavailable", ended.error.message, ended.error.retryable);
    }
  }

  async readLocalDiagnosticSnapshot(): Promise<{
    readonly sessionId: string;
    readonly evidenceClass: "diagnostic";
    readonly quests: readonly LocalDiagnosticCandidate[];
    readonly votes: Readonly<Record<string, number>>;
    readonly updatedAt: number;
  } | null> {
    if (!this.localDiagnostics || this.activeLocalDiagnosticSessionId === null) return null;
    let state = await this.persistence.sessions.load(this.activeLocalDiagnosticSessionId);
    if (state === null) return null;
    state = await this.closeVoteIfDue(state);
    const votes = Object.fromEntries(
      state.questCycle.options.map((candidate) => [
        candidate.candidateId,
        state.questCycle.voteTallies.find((tally) => tally.candidateId === candidate.candidateId)
          ?.votes ?? 0,
      ]),
    );
    return {
      sessionId: state.session.sessionId,
      evidenceClass: "diagnostic",
      quests: state.questCycle.options.map((candidate) => ({
        id: candidate.candidateId,
        title: candidate.title,
        instruction: candidate.instruction,
        durationSeconds: candidate.durationSeconds,
        difficulty: candidate.difficulty,
        rewardPoints: candidate.rewardPoints,
        rationale: candidate.rationale,
      })),
      votes,
      updatedAt: state.questCycle.envelope.receivedAt,
    };
  }

  async updateLocalDiagnosticQuest(
    input:
      | { readonly type: "progress"; readonly value: number }
      | { readonly type: "result"; readonly outcome: "succeed" | "fail" },
  ): Promise<AuthoritativeSessionState> {
    if (
      !this.localDiagnostics ||
      this.persistence.mode !== "memory" ||
      this.activeLocalDiagnosticSessionId === null
    ) {
      throw applicationError("session-unavailable", "No local Twitch diagnostic quest is active");
    }
    let state = await this.persistence.sessions.load(this.activeLocalDiagnosticSessionId);
    if (state === null) {
      throw applicationError("session-not-found", "The local Twitch diagnostic session ended");
    }
    state = await this.closeVoteIfDue(state);
    const broadcasterActor: VerifiedCommandActor = {
      kind: "broadcaster",
      actorId: state.session.broadcasterId,
      expiresAt: null,
      moderatorForBroadcasterIds: [],
      voterKey: null,
      participationModes: [],
    };
    const command =
      input.type === "progress"
        ? streamerQuestProgressCommandSchema.parse({
            contractVersion: CONTRACT_VERSION,
            sessionId: state.session.sessionId,
            questCycleId: state.questCycle.envelope.questCycleId,
            commandId: `progress-${this.nextId()}`,
            correlationId: state.questCycle.envelope.correlationId,
            expectedRevision: state.session.revision,
            issuedAt: this.now(),
            actor: { kind: "broadcaster", actorId: state.session.broadcasterId },
            type: "streamer.quest-progress",
            requestedValue: input.value,
          })
        : streamerQuestCommandSchema.parse({
            contractVersion: CONTRACT_VERSION,
            sessionId: state.session.sessionId,
            questCycleId: state.questCycle.envelope.questCycleId,
            commandId: `${input.outcome}-${this.nextId()}`,
            correlationId: state.questCycle.envelope.correlationId,
            expectedRevision: state.session.revision,
            issuedAt: this.now(),
            actor: { kind: "broadcaster", actorId: state.session.broadcasterId },
            type: "streamer.quest",
            action: input.outcome,
            candidateId: state.questCycle.activeCandidateId,
          });
    const result = await this.executeTrusted(command, broadcasterActor, null);
    if (!result.ok) {
      throw applicationError("session-unavailable", result.error.message, result.error.retryable);
    }
    return result.receipt.state;
  }

  async readViewer(authorizationHeader: string | null): Promise<ViewerViewModel> {
    const session = await this.authorize(authorizationHeader);
    return this.projectViewer(session);
  }

  async vote(
    authorizationHeader: string | null,
    input: TwitchExtensionVoteRequest,
  ): Promise<TwitchExtensionVoteResult> {
    const parsedInput = twitchExtensionVoteRequestSchema.safeParse(input);
    if (!parsedInput.success) {
      throw applicationError("invalid-command", "Vote command is invalid");
    }
    const authorized = await this.authorize(authorizationHeader);
    const questCycleId = authorized.state.questCycle.envelope.questCycleId;
    if (questCycleId === null || authorized.actor.voterKey === null) {
      throw applicationError("session-unavailable", "No Twitch vote is currently available", true);
    }

    const existing = await this.persistence.sessions.findReceipt(parsedInput.data.commandId);
    if (existing !== null) {
      const command = existing.command;
      if (
        command.type !== "viewer.vote" ||
        command.sessionId !== authorized.state.session.sessionId ||
        command.questCycleId !== questCycleId ||
        command.candidateId !== parsedInput.data.candidateId ||
        command.voterKey !== authorized.actor.voterKey
      ) {
        throw applicationError("invalid-command", "Vote command ID was already used");
      }
      return { ok: true, outcome: "duplicate", view: await this.projectViewer(authorized) };
    }

    let latest = authorized;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const command = viewerVoteCommandSchema.parse({
        contractVersion: CONTRACT_VERSION,
        sessionId: latest.state.session.sessionId,
        questCycleId,
        commandId: parsedInput.data.commandId,
        correlationId: `twitch-extension-${parsedInput.data.commandId}`,
        expectedRevision: latest.state.session.revision,
        issuedAt: this.now(),
        actor: { kind: latest.actor.kind, actorId: latest.actor.actorId },
        type: "viewer.vote",
        candidateId: parsedInput.data.candidateId,
        voterKey: latest.actor.voterKey,
        sourceMode: "twitch-extension",
      });
      const actors = new Map<string, VerifiedCommandActor>([[command.commandId, latest.actor]]);
      const projectionContext = new TwitchViewerProjectionContext(
        this.persistence,
        latest.actor,
        latest.viewerId,
        this.now,
      );
      const orchestrator = new ChatXptOrchestrator(
        bindPersistenceRuntime(
          {
            authorizer: new ServerCommandAuthorizer(
              new StaticVerifiedActorResolver(actors),
              this.now,
            ),
            engine: createDefaultQuestEngine(),
            directorCues: new DefaultDirectorCueLifecycle(),
            directorCueConverter: new DefaultDirectorCueConverter(),
            projectionContext,
            projector: new CanonicalViewProjector(),
            clock: { now: this.now },
            ids: new RandomMessageIds(),
          },
          this.persistence,
        ),
      );
      const result = await orchestrator.execute(command);
      if (result.ok) {
        return {
          ok: true,
          outcome: result.outcome,
          view: await this.readViewer(authorizationHeader),
        };
      }
      if (result.error.code !== "stale-revision" || attempt === 1) {
        return {
          ok: false,
          error: domainErrorSchema.parse(result.error),
          view: await this.readViewer(authorizationHeader),
        };
      }
      latest = await this.authorize(authorizationHeader);
      if (latest.state.questCycle.envelope.questCycleId !== questCycleId) {
        return {
          ok: false,
          error: domainErrorSchema.parse({
            code: "expired",
            message: "The voting cycle changed before this vote could be accepted",
            retryable: false,
          }),
          view: await this.projectViewer(latest),
        };
      }
    }
    throw applicationError("dependency-unavailable", "Vote processing is unavailable", true);
  }

  async react(
    authorizationHeader: string | null,
    input: TwitchExtensionReactionRequest,
  ): Promise<TwitchExtensionVoteResult> {
    const parsedInput = twitchExtensionReactionRequestSchema.safeParse(input);
    if (!parsedInput.success) {
      throw applicationError("invalid-command", "Reaction command is invalid");
    }
    const authorized = await this.authorize(authorizationHeader);
    const existing = await this.persistence.sessions.findReceipt(parsedInput.data.commandId);
    if (existing !== null) {
      const command = existing.command;
      if (
        command.type !== "viewer.react" ||
        command.sessionId !== authorized.state.session.sessionId ||
        command.reaction !== parsedInput.data.reaction ||
        command.actor.kind !== authorized.actor.kind ||
        command.actor.actorId !== authorized.actor.actorId
      ) {
        throw applicationError("invalid-command", "Reaction command ID was already used");
      }
      return { ok: true, outcome: "duplicate", view: await this.projectViewer(authorized) };
    }
    const result = await this.executeTrusted(
      viewerReactionCommandSchema.parse({
        contractVersion: CONTRACT_VERSION,
        sessionId: authorized.state.session.sessionId,
        questCycleId: authorized.state.questCycle.envelope.questCycleId,
        commandId: parsedInput.data.commandId,
        correlationId: `twitch-extension-${parsedInput.data.commandId}`,
        expectedRevision: authorized.state.session.revision,
        issuedAt: this.now(),
        actor: {
          kind: authorized.actor.kind,
          actorId: authorized.actor.actorId,
        },
        type: "viewer.react",
        reaction: parsedInput.data.reaction,
      }),
      authorized.actor,
      authorized.viewerId,
    );
    if (result.ok) {
      return {
        ok: true,
        outcome: result.outcome,
        view: await this.readViewer(authorizationHeader),
      };
    }
    return {
      ok: false,
      error: domainErrorSchema.parse(result.error),
      view: await this.readViewer(authorizationHeader),
    };
  }

  private async authorize(authorizationHeader: string | null): Promise<AuthorizedSession> {
    let authorization: TwitchExtensionAuthorization;
    try {
      authorization = verifyTwitchExtensionJwt(
        readTwitchExtensionBearerToken(authorizationHeader),
        this.extensionSecret,
        this.now(),
      );
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Twitch authorization failed";
      const misconfigured = message.includes("secret");
      throw applicationError(
        misconfigured ? "misconfigured" : "unauthenticated",
        message,
        !misconfigured,
      );
    }

    await this.ensureLocalDiagnosticSession(authorization.channelId);

    let sessionRecord;
    try {
      sessionRecord = await this.persistence.twitchChannelSessions.findTwitchChannelSession(
        authorization.channelId,
      );
    } catch {
      throw applicationError(
        "dependency-unavailable",
        "ChatXPT session lookup is temporarily unavailable",
        true,
      );
    }
    if (sessionRecord === null) {
      throw applicationError(
        "session-not-found",
        "The streamer has not started a ChatXPT session for this channel",
        true,
      );
    }
    let state = await this.persistence.sessions.load(sessionRecord.sessionId);
    if (state === null || state.session.broadcasterId !== authorization.channelId) {
      throw applicationError(
        "session-not-found",
        "The active Twitch channel session could not be loaded",
        true,
      );
    }
    state = await this.closeVoteIfDue(state);
    const participant = toVerifiedTwitchParticipant(
      authorization,
      state.session.sessionId,
      this.extensionSecret,
    );
    return { authorization, state, actor: participant.actor, viewerId: participant.viewerId };
  }

  private async closeVoteIfDue(
    state: AuthoritativeSessionState,
  ): Promise<AuthoritativeSessionState> {
    if (
      state.questCycle.status !== "voting" ||
      state.questCycle.endsAt === null ||
      state.questCycle.endsAt > this.now() ||
      state.questCycle.envelope.questCycleId === null
    ) {
      return state;
    }
    const systemActor: VerifiedCommandActor = {
      kind: "system",
      actorId: "chatxpt-vote-close",
      expiresAt: null,
      moderatorForBroadcasterIds: [],
      voterKey: null,
      participationModes: [],
    };
    const result = await this.executeTrusted(
      systemVoteCloseCommandSchema.parse({
        contractVersion: CONTRACT_VERSION,
        sessionId: state.session.sessionId,
        questCycleId: state.questCycle.envelope.questCycleId,
        commandId: `vote-close-${this.nextId()}`,
        correlationId: state.questCycle.envelope.correlationId,
        expectedRevision: state.session.revision,
        issuedAt: this.now(),
        actor: { kind: "system", actorId: systemActor.actorId },
        type: "system.vote-close",
      }),
      systemActor,
      null,
    );
    if (result.ok) return result.receipt.state;
    if (result.error.code === "stale-revision") {
      return (await this.persistence.sessions.load(state.session.sessionId)) ?? state;
    }
    throw applicationError("dependency-unavailable", result.error.message, result.error.retryable);
  }

  private async ensureLocalDiagnosticSession(channelId: string): Promise<void> {
    const staged = this.pendingLocalDiagnostic;
    if (
      !this.localDiagnostics ||
      this.persistence.mode !== "memory" ||
      staged === null ||
      staged.batchId === this.activeLocalDiagnosticBatchId
    ) {
      return;
    }
    if (this.localBootstrap !== null) {
      await this.localBootstrap;
      if (staged.batchId === this.activeLocalDiagnosticBatchId) return;
    }
    this.localBootstrap = this.replaceLocalDiagnosticSession(channelId, staged);
    try {
      await this.localBootstrap;
    } finally {
      this.localBootstrap = null;
    }
  }

  private async replaceLocalDiagnosticSession(
    channelId: string,
    staged: NonNullable<TwitchExtensionViewerApplication["pendingLocalDiagnostic"]>,
  ): Promise<void> {
    const lifecycle = new SessionLifecycleService(this.persistence.lifecycle);
    const existing = await this.persistence.twitchChannelSessions.findTwitchChannelSession(channelId);
    if (existing !== null) {
      const ended = await lifecycle.end(
        existing.sessionId,
        existing.revision,
        this.now(),
        "local-diagnostic-cycle-replaced",
        `end-${this.nextId()}`,
      );
      if (!ended.ok) {
        throw applicationError(
          "dependency-unavailable",
          "The previous local Twitch diagnostic session could not be replaced",
          true,
        );
      }
    }

    const createdAt = this.now();
    const sessionId = `local-twitch-session-${this.nextId()}`;
    const questCycleId = `local-twitch-cycle-${this.nextId()}`;
    const initialEnvelope = {
      contractVersion: CONTRACT_VERSION,
      sessionId,
      questCycleId,
      messageId: `local-state-${this.nextId()}`,
      correlationId: staged.batchId,
      revision: 0,
      occurredAt: createdAt,
      receivedAt: createdAt,
      source: "studio" as const,
      evidenceClass: "diagnostic" as const,
    };
    const initialState = authoritativeSessionStateSchema.parse({
      session: {
        sessionId,
        broadcasterId: channelId,
        platform: "twitch",
        status: "preparing",
        revision: 0,
        createdAt,
        startedAt: null,
        endedAt: null,
        capabilities: {
          twitchExtension: true,
          hostedViewerBoard: true,
          twitchChatVoting: true,
          twitchIdentity: true,
          anonymousParticipation: true,
          reactions: true,
        },
      },
      profile: {
        profileId: `local-profile-${channelId}`,
        streamerId: channelId,
        revision: 0,
        displayName: "Local Test Streamer",
        gameId: null,
        gameName: null,
        experience: { intensity: 0.5, creativity: 0.5 },
        restrictions: [],
        preferredQuestTypes: [],
        forbiddenQuestTypes: [],
        accessibilityNeeds: [],
      },
      services: [
        {
          service: "twitch-extension-ebs",
          status: "ready",
          checkedAt: createdAt,
          message: "Signed Twitch Local Test viewer path",
          retryable: false,
        },
        {
          service: "persistence",
          status: "ready",
          checkedAt: createdAt,
          message: "Credential-free local memory mode",
          retryable: false,
        },
      ],
      gameplay: null,
      audience: null,
      questCycle: {
        envelope: initialEnvelope,
        status: "idle",
        options: [],
        activeCandidateId: null,
        availableStreamerActions: [],
        voteTallies: [],
        startsAt: null,
        endsAt: null,
        progress: null,
        completionRule: null,
        result: null,
      },
      emergencyPaused: false,
      communityHype: 0,
    });
    const created = await lifecycle.create(initialState, createdAt);
    if (!created.ok) {
      throw applicationError("dependency-unavailable", created.error.message, created.error.retryable);
    }
    const started = await lifecycle.start(
      sessionId,
      0,
      this.now(),
      `start-${this.nextId()}`,
    );
    if (!started.ok) {
      throw applicationError("dependency-unavailable", started.error.message, started.error.retryable);
    }

    const current = started.value.state;
    const candidateBatchId = `candidate-batch-${staged.batchId}`;
    const batch = candidateBatchSchema.parse({
      envelope: {
        ...current.questCycle.envelope,
        messageId: candidateBatchId,
        correlationId: staged.batchId,
        occurredAt: staged.stagedAt,
        receivedAt: this.now(),
        source: "algorithm",
        evidenceClass: "diagnostic",
      },
      candidates: staged.candidates.map((candidate) => ({
        candidateId: candidate.id,
        title: candidate.title,
        instruction: candidate.instruction,
        durationSeconds: candidate.durationSeconds,
        difficulty: candidate.difficulty,
        rewardPoints: candidate.rewardPoints,
        rationale: candidate.rationale,
        sourceSignalIds: [],
        confidence: 0.5,
        generation: {
          method: "algorithmic",
          provider: null,
          generatedAt: staged.stagedAt,
        },
      })),
    });
    await this.persistence.candidates.store(batch);

    const systemActor: VerifiedCommandActor = {
      kind: "system",
      actorId: "chatxpt-local-diagnostic",
      expiresAt: null,
      moderatorForBroadcasterIds: [],
      voterKey: null,
      participationModes: [],
    };
    const proposed = await this.executeTrusted(
      systemIntelligenceCommandSchema.parse({
        contractVersion: CONTRACT_VERSION,
        sessionId,
        questCycleId,
        commandId: `intelligence-${this.nextId()}`,
        correlationId: staged.batchId,
        expectedRevision: current.session.revision,
        issuedAt: this.now(),
        actor: { kind: "system", actorId: systemActor.actorId },
        type: "system.intelligence-ready",
        candidateBatchId,
      }),
      systemActor,
      null,
    );
    if (!proposed.ok) {
      throw applicationError("dependency-unavailable", proposed.error.message, proposed.error.retryable);
    }

    const broadcasterActor: VerifiedCommandActor = {
      kind: "broadcaster",
      actorId: channelId,
      expiresAt: null,
      moderatorForBroadcasterIds: [],
      voterKey: null,
      participationModes: [],
    };
    const approved = await this.executeTrusted(
      streamerQuestCommandSchema.parse({
        contractVersion: CONTRACT_VERSION,
        sessionId,
        questCycleId,
        commandId: `approve-${this.nextId()}`,
        correlationId: staged.batchId,
        expectedRevision: proposed.receipt.state.session.revision,
        issuedAt: this.now(),
        actor: { kind: "broadcaster", actorId: channelId },
        type: "streamer.quest",
        action: "approve",
        candidateId: null,
      }),
      broadcasterActor,
      null,
    );
    if (!approved.ok) {
      throw applicationError("dependency-unavailable", approved.error.message, approved.error.retryable);
    }
    this.activeLocalDiagnosticBatchId = staged.batchId;
    this.activeLocalDiagnosticSessionId = sessionId;
  }

  private executeTrusted(
    command: Parameters<ChatXptOrchestrator["execute"]>[0],
    actor: VerifiedCommandActor,
    viewerId: string | null,
  ) {
    const actors = new Map<string, VerifiedCommandActor>([
      [(command as { commandId: string }).commandId, actor],
    ]);
    return new ChatXptOrchestrator(
      bindPersistenceRuntime(
        {
          authorizer: new ServerCommandAuthorizer(
            new StaticVerifiedActorResolver(actors),
            this.now,
          ),
          engine: createDefaultQuestEngine(),
          directorCues: new DefaultDirectorCueLifecycle(),
          directorCueConverter: new DefaultDirectorCueConverter(),
          projectionContext: new TwitchViewerProjectionContext(
            this.persistence,
            actor,
            viewerId,
            this.now,
          ),
          projector: new CanonicalViewProjector(),
          clock: { now: this.now },
          ids: new RandomMessageIds(),
        },
        this.persistence,
      ),
    ).execute(command);
  }

  private async projectViewer(authorized: AuthorizedSession): Promise<ViewerViewModel> {
    const state = await this.persistence.sessions.load(authorized.state.session.sessionId);
    if (state === null) {
      throw applicationError("session-not-found", "The ChatXPT session ended", true);
    }
    const context = await new TwitchViewerProjectionContext(
      this.persistence,
      authorized.actor,
      authorized.viewerId,
      this.now,
    ).resolve(state);
    const projected = new CanonicalViewProjector().project({
      envelope: {
        contractVersion: CONTRACT_VERSION,
        sessionId: state.session.sessionId,
        questCycleId: state.questCycle.envelope.questCycleId,
        messageId: `view-model-${this.nextId()}`,
        correlationId: `twitch-extension-${this.nextId()}`,
        revision: state.session.revision,
        occurredAt: this.now(),
        receivedAt: this.now(),
        source: "orchestrator",
        evidenceClass: state.questCycle.envelope.evidenceClass,
      },
      session: state.session,
      profile: state.profile,
      services: state.services,
      gameplay: state.gameplay,
      audience: state.audience,
      questCycle: state.questCycle,
      emergencyPaused: state.emergencyPaused,
      participationMode: context.participationMode,
      capabilities: state.session.capabilities,
      viewerId: context.viewerId,
      sessionPoints: context.sessionPoints,
      communityHype: state.communityHype,
      acceptedCandidateId: context.acceptedCandidateId,
      connection: context.connection,
      sessionOverride: state.sessionOverride,
    });
    const viewer = viewerViewModelSchema.parse(projected.viewer);
    return viewerViewModelSchema.parse(
      viewer.questCycle.status === "voting" && viewer.acceptedCandidateId === null
        ? {
            ...viewer,
            questCycle: { ...viewer.questCycle, voteTallies: [] },
          }
        : viewer,
    );
  }
}

const applicationKey = Symbol.for("chatxpt.twitchExtensionViewerApplication");
const globalApplication = globalThis as typeof globalThis & {
  [applicationKey]?: TwitchExtensionViewerApplication;
};

export function getTwitchExtensionViewerApplication(): TwitchExtensionViewerApplication {
  if (globalApplication[applicationKey] !== undefined) return globalApplication[applicationKey];
  const environment = resolveServerPersistenceEnvironment(process.env);
  globalApplication[applicationKey] = new TwitchExtensionViewerApplication({
    persistence: getChatXptServerRuntime().persistence,
    extensionSecret: process.env.TWITCH_EXTENSION_SECRET ?? "",
    localDiagnostics: environment.mode === "memory" && environment.deployment === "local",
  });
  return globalApplication[applicationKey];
}
