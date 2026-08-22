import "server-only";

import { randomUUID } from "node:crypto";

import { z } from "zod";

import {
  CONTRACT_VERSION,
  CanonicalViewProjector,
  identifierSchema,
  overlayViewModelSchema,
  resolveEffectiveStreamerProfile,
  serviceHealthSchema,
  streamerQuestCommandSchema,
  streamerQuestGenerationCommandSchema,
  streamerViewModelSchema,
  systemVoteCloseCommandSchema,
  type AuthoritativeSessionState,
  type OverlayViewModel,
  type ProjectionContextResolver,
  type StreamerViewModel,
} from "@/core";
import {
  createLiveDirectorDockDescriptor,
  createObsBrowserSourceDescriptor,
  type LiveDirectorDockDescriptor,
  type ObsBrowserSourceDescriptor,
} from "@/integrations";
import {
  ObsOverlayAuthError,
  ObsOverlayGrantAuthority,
  readObsOverlayBearerToken,
} from "@/integrations/server";
import type { ChatXptPersistenceRuntime, VerifiedCommandActor } from "@/realtime";

import { getChatXptServerRuntime, type ChatXptServerRuntime } from "./runtime";
import { studioSessionSecret } from "./twitch-connection-grant";

const installationRequestSchema = z
  .object({
    width: z.number().int().positive().max(7680).optional(),
    height: z.number().int().positive().max(4320).optional(),
  })
  .strict();

export type ObsOverlayApplicationErrorCode =
  | "misconfigured"
  | "unauthenticated"
  | "forbidden"
  | "expired"
  | "session-not-found"
  | "session-inactive"
  | "validation"
  | "dependency-unavailable";

export class ObsOverlayApplicationError extends Error {
  constructor(
    readonly code: ObsOverlayApplicationErrorCode,
    message: string,
    readonly retryable = false,
  ) {
    super(message);
    this.name = "ObsOverlayApplicationError";
  }
}

export interface ObsOverlayApplicationDependencies {
  readonly runtime: ChatXptServerRuntime;
  readonly setupKey: string;
  readonly grantSecret?: string;
  readonly now?: () => number;
  readonly nextId?: () => string;
}

export interface ObsOverlayGrantResult {
  readonly descriptor: ObsBrowserSourceDescriptor;
}

export interface LiveDirectorDockGrantResult {
  readonly descriptor: LiveDirectorDockDescriptor;
}

export interface LiveDirectorCommandResult {
  readonly outcome: string;
  readonly message: string;
  readonly view: StreamerViewModel;
}

type LiveDirectorQuestAction = "approve" | "cancel" | "succeed";

function isLiveDirectorQuestAction(action: string): action is LiveDirectorQuestAction {
  return action === "approve" || action === "cancel" || action === "succeed";
}

function duplicateLiveDirectorQuestMessage(
  action: LiveDirectorQuestAction,
  automaticMode: boolean,
): string {
  if (action === "cancel") return "This quest was already cancelled.";
  if (action === "succeed") return "This quest was already marked complete.";
  return automaticMode
    ? "These quests were already pushed to viewers."
    : "The selected quest was already started.";
}

function committedLiveDirectorQuestMessage(
  action: LiveDirectorQuestAction,
  automaticMode: boolean,
  published: boolean,
): string {
  if (action === "cancel") {
    return published ? "Quest cancelled." : "Quest cancelled; realtime delivery is recovering.";
  }
  if (action === "succeed") {
    return published
      ? "Quest marked complete."
      : "Quest marked complete; realtime delivery is recovering.";
  }
  if (automaticMode) {
    return published
      ? "Three quests pushed to viewers for voting."
      : "Three quests pushed; realtime delivery is recovering.";
  }
  return published
    ? "Selected quest started without viewer voting."
    : "Selected quest started without viewer voting; realtime delivery is recovering.";
}

function authError(caught: unknown): ObsOverlayApplicationError {
  if (caught instanceof ObsOverlayAuthError) {
    return new ObsOverlayApplicationError(
      caught.code === "misconfigured"
        ? "misconfigured"
        : caught.code === "expired-token"
          ? "expired"
          : "unauthenticated",
      caught.message,
    );
  }
  return new ObsOverlayApplicationError(
    "dependency-unavailable",
    "OBS overlay authorization is unavailable",
    true,
  );
}

export class ObsOverlayApplication {
  private readonly persistence: ChatXptPersistenceRuntime;
  private readonly grants: ObsOverlayGrantAuthority;
  private readonly now: () => number;
  private readonly nextId: () => string;

  constructor(private readonly dependencies: ObsOverlayApplicationDependencies) {
    this.persistence = dependencies.runtime.persistence;
    this.grants = new ObsOverlayGrantAuthority(
      dependencies.grantSecret ?? dependencies.setupKey,
    );
    this.now = dependencies.now ?? Date.now;
    this.nextId = dependencies.nextId ?? randomUUID;
  }

  async issueInstallation(
    broadcasterId: string,
    baseUrl: string,
    input: unknown,
  ): Promise<ObsOverlayGrantResult> {
    const parsedBroadcasterId = identifierSchema.safeParse(broadcasterId);
    const parsed = installationRequestSchema.safeParse(input);
    if (!parsedBroadcasterId.success) {
      throw new ObsOverlayApplicationError("validation", "OBS broadcaster installation is invalid");
    }
    if (!parsed.success) {
      throw new ObsOverlayApplicationError("validation", "OBS Browser Source setup is invalid");
    }
    const record = await this.persistence.twitchChannelSessions.findTwitchChannelSession(
      parsedBroadcasterId.data,
    );
    if (record === null) {
      throw new ObsOverlayApplicationError(
        "session-not-found",
        "Start the ChatXPT broadcaster session before installing the OBS Browser Source",
        true,
      );
    }
    const state = await this.loadSession(record.sessionId);
    if (state.session.status !== "preparing" && state.session.status !== "live") {
      throw new ObsOverlayApplicationError(
        "session-inactive",
        "OBS Browser Source grants require an active broadcaster session",
      );
    }
    let token: string;
    try {
      token = this.grants.issue({
        version: 2,
        grantId: `overlay-installation-${this.nextId()}`,
        broadcasterId: state.session.broadcasterId,
        issuedAt: this.now(),
      });
    } catch (caught) {
      throw authError(caught);
    }
    try {
      return {
        descriptor: createObsBrowserSourceDescriptor({
          baseUrl,
          broadcasterId: state.session.broadcasterId,
          accessToken: token,
          width: parsed.data.width,
          height: parsed.data.height,
        }),
      };
    } catch (caught) {
      throw new ObsOverlayApplicationError(
        "validation",
        caught instanceof Error ? caught.message : "OBS Browser Source URL is invalid",
      );
    }
  }

  async issueLiveDirectorInstallation(
    broadcasterId: string,
    baseUrl: string,
    input: unknown,
  ): Promise<LiveDirectorDockGrantResult> {
    const parsedBroadcasterId = identifierSchema.safeParse(broadcasterId);
    const parsed = installationRequestSchema.safeParse(input);
    if (!parsedBroadcasterId.success || !parsed.success) {
      throw new ObsOverlayApplicationError("validation", "Live Director Dock setup is invalid");
    }
    const record = await this.persistence.twitchChannelSessions.findTwitchChannelSession(
      parsedBroadcasterId.data,
    );
    if (record === null) {
      throw new ObsOverlayApplicationError(
        "session-not-found",
        "Start the ChatXPT broadcaster session before installing the Live Director Dock",
        true,
      );
    }
    const state = await this.loadSession(record.sessionId);
    if (state.session.status !== "preparing" && state.session.status !== "live") {
      throw new ObsOverlayApplicationError(
        "session-inactive",
        "Live Director Dock grants require an active broadcaster session",
      );
    }
    let token: string;
    try {
      token = this.grants.issue({
        version: 3,
        grantId: `live-director-installation-${this.nextId()}`,
        broadcasterId: state.session.broadcasterId,
        surface: "live-director",
        issuedAt: this.now(),
      });
    } catch (caught) {
      throw authError(caught);
    }
    try {
      return {
        descriptor: createLiveDirectorDockDescriptor({
          baseUrl,
          broadcasterId: state.session.broadcasterId,
          accessToken: token,
          width: parsed.data.width,
          height: parsed.data.height,
        }),
      };
    } catch (caught) {
      throw new ObsOverlayApplicationError(
        "validation",
        caught instanceof Error ? caught.message : "Live Director Dock URL is invalid",
      );
    }
  }

  async read(
    authorizationHeader: string | null,
    requested: {
      readonly broadcasterId: string | null;
      readonly sessionId: string | null;
    },
  ): Promise<OverlayViewModel> {
    let grant;
    try {
      grant = this.grants.verify(
        readObsOverlayBearerToken(authorizationHeader),
        this.now(),
      );
    } catch (caught) {
      throw authError(caught);
    }
    let state: AuthoritativeSessionState;
    if (grant.version === 1) {
      const parsedSessionId = identifierSchema.safeParse(requested.sessionId);
      if (!parsedSessionId.success || parsedSessionId.data !== grant.sessionId) {
        throw new ObsOverlayApplicationError(
          "forbidden",
          "OBS overlay grant does not belong to the requested session",
        );
      }
      state = await this.loadSession(grant.sessionId);
    } else {
      if (grant.version === 3 && grant.surface !== "broadcast-overlay") {
        throw new ObsOverlayApplicationError(
          "forbidden",
          "Private Live Director grants cannot read the public broadcast overlay",
        );
      }
      const parsedBroadcasterId = identifierSchema.safeParse(requested.broadcasterId);
      if (!parsedBroadcasterId.success || parsedBroadcasterId.data !== grant.broadcasterId) {
        throw new ObsOverlayApplicationError(
          "forbidden",
          "OBS overlay installation does not belong to the requested broadcaster",
        );
      }
      const record = await this.persistence.twitchChannelSessions.findTwitchChannelSession(
        grant.broadcasterId,
      );
      if (record === null) {
        throw new ObsOverlayApplicationError(
          "session-not-found",
          "Waiting for this broadcaster's next ChatXPT session",
          true,
        );
      }
      state = await this.loadSession(record.sessionId);
    }
    if (state.session.broadcasterId !== grant.broadcasterId) {
      throw new ObsOverlayApplicationError(
        "forbidden",
        "OBS overlay grant no longer belongs to this broadcaster",
      );
    }
    state = await this.closeVoteIfDue(state);
    const now = this.now();
    const projected = new CanonicalViewProjector().project({
      envelope: {
        contractVersion: CONTRACT_VERSION,
        sessionId: state.session.sessionId,
        questCycleId: state.questCycle.envelope.questCycleId,
        messageId: `overlay-view-${this.nextId()}`,
        correlationId: `overlay-read-${this.nextId()}`,
        revision: state.session.revision,
        occurredAt: now,
        receivedAt: now,
        source: "overlay",
        evidenceClass: state.questCycle.envelope.evidenceClass,
      },
      session: state.session,
      profile: state.profile,
      services: state.services,
      gameplay: state.gameplay,
      audience: state.audience,
      questCycle: state.questCycle,
      emergencyPaused: state.emergencyPaused,
      participationMode: "unavailable",
      capabilities: state.session.capabilities,
      viewerId: null,
      sessionPoints: 0,
      communityHype: state.communityHype,
      acceptedCandidateId: null,
      connection: serviceHealthSchema.parse({
        service: "obs-overlay",
        status: "ready",
        checkedAt: now,
        message: "Authoritative overlay state is current",
        retryable: false,
      }),
      sessionOverride: state.sessionOverride,
      liveDirector: state.liveDirector,
    });
    return overlayViewModelSchema.parse(projected.overlay);
  }

  async readLiveDirector(
    authorizationHeader: string | null,
    broadcasterId: string | null,
  ): Promise<StreamerViewModel> {
    let grant;
    try {
      grant = this.grants.verify(readObsOverlayBearerToken(authorizationHeader), this.now());
    } catch (caught) {
      throw authError(caught);
    }
    const parsedBroadcasterId = identifierSchema.safeParse(broadcasterId);
    if (
      grant.version !== 3 ||
      grant.surface !== "live-director" ||
      !parsedBroadcasterId.success ||
      parsedBroadcasterId.data !== grant.broadcasterId
    ) {
      throw new ObsOverlayApplicationError(
        "forbidden",
        "Live Director Dock access does not belong to this broadcaster",
      );
    }
    const record = await this.persistence.twitchChannelSessions.findTwitchChannelSession(
      grant.broadcasterId,
    );
    if (record === null) {
      throw new ObsOverlayApplicationError(
        "session-not-found",
        "Waiting for this broadcaster's next ChatXPT session",
        true,
      );
    }
    let state = await this.loadSession(record.sessionId);
    if (state.session.broadcasterId !== grant.broadcasterId) {
      throw new ObsOverlayApplicationError(
        "forbidden",
        "Live Director Dock grant no longer belongs to this broadcaster",
      );
    }
    state = await this.closeVoteIfDue(state);
    return this.projectLiveDirectorState(state);
  }

  async executeLiveDirectorCommand(
    authorizationHeader: string | null,
    broadcasterId: string | null,
    input: unknown,
  ): Promise<LiveDirectorCommandResult> {
    let grant;
    try {
      grant = this.grants.verify(readObsOverlayBearerToken(authorizationHeader), this.now());
    } catch (caught) {
      throw authError(caught);
    }
    const parsedBroadcasterId = identifierSchema.safeParse(broadcasterId);
    if (
      grant.version !== 3 ||
      grant.surface !== "live-director" ||
      !parsedBroadcasterId.success ||
      parsedBroadcasterId.data !== grant.broadcasterId
    ) {
      throw new ObsOverlayApplicationError(
        "forbidden",
        "Live Director control access does not belong to this broadcaster",
      );
    }
    const parsedQuestCommand = streamerQuestCommandSchema.safeParse(input);
    const parsedGenerationCommand = streamerQuestGenerationCommandSchema.safeParse(input);
    if (!parsedQuestCommand.success && !parsedGenerationCommand.success) {
      throw new ObsOverlayApplicationError(
        "validation",
        "Live Director accepts only quest generation, recommendation routing, cancellation, or completion",
      );
    }
    if (
      parsedQuestCommand.success &&
      !isLiveDirectorQuestAction(parsedQuestCommand.data.action)
    ) {
      throw new ObsOverlayApplicationError(
        "validation",
        "Live Director does not permit this quest action",
      );
    }
    const parsedCommand = parsedQuestCommand.success
      ? parsedQuestCommand.data
      : parsedGenerationCommand.success ? parsedGenerationCommand.data : null;
    if (parsedCommand === null) {
      throw new ObsOverlayApplicationError("validation", "Live Director command is invalid");
    }
    const record = await this.persistence.twitchChannelSessions.findTwitchChannelSession(
      grant.broadcasterId,
    );
    if (record === null) {
      throw new ObsOverlayApplicationError(
        "session-not-found",
        "Waiting for this broadcaster's next ChatXPT session",
        true,
      );
    }
    let state = await this.loadSession(record.sessionId);
    if (
      state.session.broadcasterId !== grant.broadcasterId ||
      parsedCommand.sessionId !== state.session.sessionId ||
      parsedCommand.questCycleId !== state.questCycle.envelope.questCycleId ||
      parsedCommand.actor.kind !== "broadcaster" ||
      parsedCommand.actor.actorId !== grant.broadcasterId
    ) {
      throw new ObsOverlayApplicationError(
        "forbidden",
        "Live Director command does not belong to the current broadcaster session",
      );
    }
    const actor: VerifiedCommandActor = {
      kind: "broadcaster",
      actorId: grant.broadcasterId,
      expiresAt: null,
      moderatorForBroadcasterIds: [],
      voterKey: null,
      participationModes: [],
    };
    const maxRevisionAttempts = 20;

    if (parsedGenerationCommand.success) {
      for (let attempt = 0; attempt < maxRevisionAttempts; attempt += 1) {
        const result = await this.dependencies.runtime.requestDeterministicFallbackProposal(
          state,
          this.liveDirectorProjectionContext("Live Director quest generation is current"),
          {
            commandId: parsedGenerationCommand.data.commandId,
            correlationId: parsedGenerationCommand.data.correlationId,
            issuedAt: parsedGenerationCommand.data.issuedAt,
          },
        );
        if (result.ok) {
          const resultState = result.receipt.state;
          const mode = resolveEffectiveStreamerProfile(
            resultState.profile,
            resultState.sessionOverride,
            resultState.session.currentGame,
          ).voting.winnerActivationMode;
          return {
            outcome: result.outcome,
            message: mode === "automatic"
              ? "Three quests generated. Push them to viewers when ready."
              : "Three quests generated. Choose one to start directly.",
            view: this.projectLiveDirectorState(resultState),
          };
        }
        if (result.error.code !== "stale-revision" || attempt === maxRevisionAttempts - 1) {
          throw new ObsOverlayApplicationError(
            result.error.retryable ? "dependency-unavailable" : "session-inactive",
            result.error.message,
            result.error.retryable,
          );
        }
        state = await this.loadSession(state.session.sessionId);
      }
      throw new ObsOverlayApplicationError(
        "dependency-unavailable",
        "Live Director could not generate quests while live gameplay was updating",
        true,
      );
    }

    if (!parsedQuestCommand.success) {
      throw new ObsOverlayApplicationError("validation", "Live Director quest action is invalid");
    }
    const questCommand = parsedQuestCommand.data;
    const questAction = questCommand.action;
    if (!isLiveDirectorQuestAction(questAction)) {
      throw new ObsOverlayApplicationError("validation", "Live Director quest action is invalid");
    }
    const questMode = resolveEffectiveStreamerProfile(
      state.profile,
      state.sessionOverride,
      state.session.currentGame,
    ).voting.winnerActivationMode;
    const automaticMode = questMode === "automatic";
    if (
      questAction === "approve" &&
      questMode === "streamer-approval" &&
      questCommand.candidateId === null
    ) {
      throw new ObsOverlayApplicationError(
        "validation",
        "Manual mode requires one selected recommendation",
      );
    }
    if (questAction !== "approve" && questCommand.candidateId !== null) {
      throw new ObsOverlayApplicationError(
        "validation",
        "Active quest actions must not select another recommendation",
      );
    }
    const existing = await this.persistence.sessions.findReceipt(questCommand.commandId);
    if (existing !== null) {
      const accepted = existing.command;
      if (
        accepted.type !== "streamer.quest" ||
        accepted.sessionId !== questCommand.sessionId ||
        accepted.questCycleId !== questCommand.questCycleId ||
        accepted.action !== questAction ||
        accepted.candidateId !== questCommand.candidateId ||
        accepted.actor.kind !== "broadcaster" ||
        accepted.actor.actorId !== grant.broadcasterId
      ) {
        throw new ObsOverlayApplicationError(
          "validation",
          "Live Director command ID was already used for another action",
        );
      }
      return {
        outcome: "duplicate",
        message: duplicateLiveDirectorQuestMessage(questAction, automaticMode),
        view: this.projectLiveDirectorState(state),
      };
    }
    const actionIsAvailable = state.questCycle.availableStreamerActions.includes(questAction);
    const proposalIsCurrent =
      questAction === "approve" &&
      state.questCycle.status === "proposed" &&
      actionIsAvailable &&
      (questCommand.candidateId === null || state.questCycle.options.some(
        (option) => option.candidateId === questCommand.candidateId,
      ));
    const activeQuestIsCurrent =
      questAction !== "approve" &&
      state.questCycle.status === "active" &&
      state.questCycle.activeCandidateId !== null &&
      actionIsAvailable;
    if (!proposalIsCurrent && !activeQuestIsCurrent) {
      throw new ObsOverlayApplicationError(
        "session-inactive",
        questAction === "approve"
          ? "These recommendations are no longer available"
          : "This quest is no longer active",
        true,
      );
    }
    for (let attempt = 0; attempt < maxRevisionAttempts; attempt += 1) {
      const command = streamerQuestCommandSchema.parse({
        ...questCommand,
        expectedRevision: state.session.revision,
      });
      const result = await this.dependencies.runtime.execute(
        command,
        actor,
        this.liveDirectorProjectionContext("Live Director quest action is current"),
      );
      if (result.ok) {
        return {
          outcome: result.outcome,
          message: committedLiveDirectorQuestMessage(
            questAction,
            automaticMode,
            result.delivery === "published",
          ),
          view: this.projectLiveDirectorState(result.receipt.state),
        };
      }
      if (result.error.code !== "stale-revision" || attempt === maxRevisionAttempts - 1) {
        throw new ObsOverlayApplicationError(
          result.error.retryable ? "dependency-unavailable" : "session-inactive",
          result.error.message,
          result.error.retryable,
        );
      }
      state = await this.loadSession(state.session.sessionId);
      if (
        state.session.broadcasterId !== grant.broadcasterId ||
        state.questCycle.envelope.questCycleId !== questCommand.questCycleId
      ) {
        throw new ObsOverlayApplicationError(
          "session-inactive",
          "The quest cycle changed before Live Director could complete the action",
          true,
        );
      }
    }
    throw new ObsOverlayApplicationError(
      "dependency-unavailable",
      "Live Director could not complete the quest action while live gameplay was updating",
      true,
    );
  }

  private liveDirectorProjectionContext(message: string): ProjectionContextResolver {
    return {
      resolve: () => ({
        participationMode: "unavailable",
        viewerId: null,
        sessionPoints: 0,
        acceptedCandidateId: null,
        connection: serviceHealthSchema.parse({
          service: "realtime",
          status: "ready",
          checkedAt: this.now(),
          message,
          retryable: false,
        }),
      }),
    };
  }

  private projectLiveDirectorState(state: AuthoritativeSessionState): StreamerViewModel {
    const now = this.now();
    const projected = new CanonicalViewProjector().project({
      envelope: {
        contractVersion: CONTRACT_VERSION,
        sessionId: state.session.sessionId,
        questCycleId: state.questCycle.envelope.questCycleId,
        messageId: `live-director-view-${this.nextId()}`,
        correlationId: `live-director-read-${this.nextId()}`,
        revision: state.session.revision,
        occurredAt: now,
        receivedAt: now,
        source: "studio",
        evidenceClass: state.questCycle.envelope.evidenceClass,
      },
      session: state.session,
      profile: state.profile,
      services: state.services,
      gameplay: state.gameplay,
      audience: state.audience,
      questCycle: state.questCycle,
      emergencyPaused: state.emergencyPaused,
      participationMode: "unavailable",
      capabilities: state.session.capabilities,
      viewerId: null,
      sessionPoints: 0,
      communityHype: state.communityHype,
      acceptedCandidateId: null,
      connection: serviceHealthSchema.parse({
        service: "realtime",
        status: "ready",
        checkedAt: now,
        message: "Private Live Director state is current",
        retryable: false,
      }),
      sessionOverride: state.sessionOverride,
      liveDirector: state.liveDirector,
    });
    return streamerViewModelSchema.parse(projected.streamer);
  }

  private async loadSession(sessionId: string): Promise<AuthoritativeSessionState> {
    let state;
    try {
      state = await this.persistence.sessions.load(sessionId);
    } catch {
      throw new ObsOverlayApplicationError(
        "dependency-unavailable",
        "Authoritative overlay state is unavailable",
        true,
      );
    }
    if (state === null) {
      throw new ObsOverlayApplicationError("session-not-found", "OBS overlay session was not found");
    }
    return state;
  }

  private async closeVoteIfDue(state: AuthoritativeSessionState): Promise<AuthoritativeSessionState> {
    if (
      state.questCycle.status !== "voting" ||
      state.questCycle.endsAt === null ||
      state.questCycle.endsAt > this.now() ||
      state.questCycle.envelope.questCycleId === null
    ) {
      return this.dependencies.runtime.advanceQuestLifecycleIfDue(state);
    }
    const actor: VerifiedCommandActor = {
      kind: "system",
      actorId: "chatxpt-vote-close",
      expiresAt: null,
      moderatorForBroadcasterIds: [],
      voterKey: null,
      participationModes: [],
    };
    const projectionContext: ProjectionContextResolver = {
      resolve: () => ({
        participationMode: "unavailable",
        viewerId: null,
        sessionPoints: 0,
        acceptedCandidateId: null,
        connection: serviceHealthSchema.parse({
          service: "obs-overlay",
          status: "ready",
          checkedAt: this.now(),
          message: "OBS overlay closed the due authoritative vote",
          retryable: false,
        }),
      }),
    };
    const result = await this.dependencies.runtime.execute(
      systemVoteCloseCommandSchema.parse({
        contractVersion: CONTRACT_VERSION,
        sessionId: state.session.sessionId,
        questCycleId: state.questCycle.envelope.questCycleId,
        commandId: `overlay-vote-close-${this.nextId()}`,
        correlationId: state.questCycle.envelope.correlationId,
        expectedRevision: state.session.revision,
        issuedAt: this.now(),
        actor: { kind: "system", actorId: actor.actorId },
        type: "system.vote-close",
      }),
      actor,
      projectionContext,
    );
    if (result.ok) {
      return this.dependencies.runtime.advanceQuestLifecycleIfDue(result.receipt.state);
    }
    if (result.error.code === "stale-revision") {
      const latest = (await this.persistence.sessions.load(state.session.sessionId)) ?? state;
      return this.dependencies.runtime.advanceQuestLifecycleIfDue(latest);
    }
    throw new ObsOverlayApplicationError(
      "dependency-unavailable",
      result.error.message,
      result.error.retryable,
    );
  }
}

const applicationKey = Symbol.for("chatxpt.obsOverlayApplication.v1");
const globalApplication = globalThis as typeof globalThis & {
  [applicationKey]?: ObsOverlayApplication;
};

export function getObsOverlayApplication(): ObsOverlayApplication {
  if (globalApplication[applicationKey] !== undefined) return globalApplication[applicationKey];
  const setupKey = process.env.CHATXPT_OBS_OVERLAY_SETUP_KEY ?? "";
  globalApplication[applicationKey] = new ObsOverlayApplication({
    runtime: getChatXptServerRuntime(),
    setupKey,
    grantSecret: setupKey.trim() || studioSessionSecret(process.env),
  });
  return globalApplication[applicationKey];
}
