import "server-only";

import { createHash, randomUUID } from "node:crypto";

import { z } from "zod";

import {
  CONTRACT_VERSION,
  authoritativeSessionStateSchema,
  canonicalJsonStringify,
  commandEnvelopeSchema,
  createDefaultStreamerProfile,
  identifierSchema,
  serviceHealthSchema,
  streamerReadinessViewSchema,
  streamerServiceCommandSchema,
  streamerViewModelSchema,
  systemCurrentGameCommandSchema,
  type AuthoritativeSessionState,
  type ProjectionContextResolver,
  type StreamerReadinessView,
  type StreamerProfileConnection,
  type StreamerViewModel,
} from "@/core";
import {
  StudioSessionAuthError,
  StudioSessionGrantAuthority,
} from "@/integrations/server";
import {
  readTwitchExtensionBearerToken,
  resolveTwitchSetupReadiness,
  verifyTwitchExtensionJwt,
} from "@/integrations";
import {
  SessionLifecycleService,
  type VerifiedCommandActor,
} from "@/realtime";
import type { ConfiguredPersistenceRuntime } from "@/realtime/server";

import { getChatXptServerRuntime, type ChatXptServerRuntime } from "./runtime";
import { studioSessionSecret } from "./twitch-connection-grant";

const startSessionSchema = z
  .object({
    channelId: identifierSchema,
    displayName: z.string().trim().min(1).max(80),
    gameId: identifierSchema.nullable().default(null),
    gameName: z.string().trim().min(1).max(120).nullable().default(null),
  })
  .strict()
  .superRefine((input, context) => {
    if ((input.gameId === null) !== (input.gameName === null)) {
      context.addIssue({
        code: "custom",
        message: "Game ID and game name must be supplied together",
        path: ["gameId"],
      });
    }
  });

const STUDIO_GRANT_TTL_MS = 12 * 60 * 60 * 1_000;
const GAMEPLAY_CAPTURE_STALE_AFTER_MS = 10_000;
const studioPresenceSchema = z.object({ action: z.enum(["heartbeat", "disconnect"]) }).strict();
const twitchStreamEventSchema = z.object({
  broadcasterId: identifierSchema,
  displayName: z.string().trim().min(1).max(80),
  deliveryId: z.string().trim().min(1).max(128),
  occurredAt: z.number().int().nonnegative(),
}).strict();

export interface TwitchStreamSynchronizationResult {
  readonly status: "started" | "already-live" | "ended" | "not-found";
  readonly sessionId: string | null;
  readonly revision: number | null;
}

export type StudioSessionApplicationErrorCode =
  | "misconfigured"
  | "unauthenticated"
  | "forbidden"
  | "expired"
  | "session-not-found"
  | "validation"
  | "stale-revision"
  | "duplicate"
  | "unavailable-capability"
  | "dependency-unavailable"
  | "internal";

export class StudioSessionApplicationError extends Error {
  constructor(
    readonly code: StudioSessionApplicationErrorCode,
    message: string,
    readonly retryable = false,
  ) {
    super(message);
    this.name = "StudioSessionApplicationError";
  }
}

export interface StudioSurfaceState {
  readonly view: StreamerViewModel;
  readonly readiness: StreamerReadinessView;
  readonly roomCode: string | null;
}

export interface StudioSessionStartResult extends StudioSurfaceState {
  readonly grant: string;
  readonly expiresAt: number;
}

interface AuthorizedStudioSession {
  readonly state: AuthoritativeSessionState;
  readonly actor: VerifiedCommandActor;
  readonly twitchVerified: boolean;
}

class StudioProjectionContext implements ProjectionContextResolver {
  constructor(private readonly now: () => number) {}

  resolve() {
    return {
      participationMode: "unavailable" as const,
      viewerId: null,
      sessionPoints: 0,
      acceptedCandidateId: null,
      connection: serviceHealthSchema.parse({
        service: "realtime",
        status: "ready",
        checkedAt: this.now(),
        message: "Authoritative Studio request completed",
        retryable: false,
      }),
    };
  }
}

function authError(caught: unknown): StudioSessionApplicationError {
  if (caught instanceof StudioSessionAuthError) {
    return new StudioSessionApplicationError(
      caught.code === "misconfigured" ? "misconfigured" : caught.code === "expired-token" ? "expired" : "unauthenticated",
      caught.message,
    );
  }
  return new StudioSessionApplicationError("unauthenticated", "Studio authorization is invalid");
}

function commandError(code: string, message: string, retryable: boolean): StudioSessionApplicationError {
  const supported: StudioSessionApplicationErrorCode[] = [
    "unauthenticated",
    "forbidden",
    "expired",
    "validation",
    "stale-revision",
    "duplicate",
    "unavailable-capability",
    "dependency-unavailable",
    "internal",
  ];
  return new StudioSessionApplicationError(
    supported.includes(code as StudioSessionApplicationErrorCode)
      ? (code as StudioSessionApplicationErrorCode)
      : "internal",
    message,
    retryable,
  );
}

export interface StudioSessionApplicationDependencies {
  readonly runtime: ChatXptServerRuntime;
  readonly setupKey: string;
  readonly grantSecret?: string;
  readonly extensionSecret: string;
  readonly environment: Record<string, string | undefined>;
  readonly now?: () => number;
  readonly nextId?: () => string;
}

export class StudioSessionApplication {
  private readonly persistence: ConfiguredPersistenceRuntime;
  private readonly grants: StudioSessionGrantAuthority;
  private readonly diagnosticSetup: StudioSessionGrantAuthority;
  private readonly now: () => number;
  private readonly nextId: () => string;

  constructor(private readonly dependencies: StudioSessionApplicationDependencies) {
    this.persistence = dependencies.runtime.persistence;
    this.grants = new StudioSessionGrantAuthority(dependencies.grantSecret ?? dependencies.setupKey);
    this.diagnosticSetup = new StudioSessionGrantAuthority(dependencies.setupKey);
    this.now = dependencies.now ?? Date.now;
    this.nextId = dependencies.nextId ?? randomUUID;
  }

  async start(
    setupKey: string | null,
    input: unknown,
    twitchVerified = false,
  ): Promise<StudioSessionStartResult> {
    try {
      this.diagnosticSetup.authenticateSetupKey(setupKey);
    } catch (caught) {
      throw authError(caught);
    }
    return this.startAuthorized(input, twitchVerified);
  }

  async startFromVerifiedTwitch(input: unknown): Promise<StudioSessionStartResult> {
    return this.startAuthorized(input, true);
  }

  /** Issues a fresh browser grant only when Twitch already has an active mapped session. */
  async resumeExistingFromVerifiedTwitch(
    input: unknown,
  ): Promise<StudioSessionStartResult | null> {
    const parsed = startSessionSchema.safeParse(input);
    if (!parsed.success) {
      throw new StudioSessionApplicationError("validation", "Studio session setup is invalid");
    }
    const existing = await this.persistence.twitchChannelSessions.findTwitchChannelSession(
      parsed.data.channelId,
    );
    if (existing === null) return null;
    const state = await this.loadSession(existing.sessionId);
    if (state.session.broadcasterId !== parsed.data.channelId) {
      throw new StudioSessionApplicationError("forbidden", "Twitch session mapping is invalid");
    }
    return this.issueStudioGrant(state, true);
  }

  /**
   * Signed Twitch EventSub is authoritative for Twitch's broadcast lifecycle.
   * Going online creates/resumes the mapped session and makes chat ingestion live
   * without asking the streamer for IDs, keys, or a second start action.
   */
  async synchronizeVerifiedTwitchOnline(
    input: unknown,
  ): Promise<TwitchStreamSynchronizationResult> {
    const parsed = twitchStreamEventSchema.safeParse(input);
    if (!parsed.success) {
      throw new StudioSessionApplicationError("validation", "Twitch stream event is invalid");
    }
    const connected = await this.startAuthorized({
      channelId: parsed.data.broadcasterId,
      displayName: parsed.data.displayName,
      gameId: null,
      gameName: null,
    }, true);
    if (connected.view.session.status === "live") {
      return {
        status: "already-live",
        sessionId: connected.view.session.sessionId,
        revision: connected.view.session.revision,
      };
    }
    if (connected.view.session.status !== "preparing") {
      throw new StudioSessionApplicationError(
        "dependency-unavailable",
        "Twitch stream could not activate the broadcaster session",
        true,
      );
    }
    const occurredAt = Math.max(parsed.data.occurredAt, connected.view.session.createdAt);
    const operationId = `twitch-online-${createHash("sha256")
      .update(parsed.data.deliveryId)
      .digest("hex")}`;
    const started = await new SessionLifecycleService(this.persistence.lifecycle).start(
      connected.view.session.sessionId,
      connected.view.session.revision,
      occurredAt,
      operationId,
    );
    if (!started.ok) {
      if (started.error.code === "stale-revision") {
        const latest = await this.loadSession(connected.view.session.sessionId);
        if (latest.session.status === "live") {
          return {
            status: "already-live",
            sessionId: latest.session.sessionId,
            revision: latest.session.revision,
          };
        }
      }
      throw commandError(started.error.code, started.error.message, started.error.retryable);
    }
    return {
      status: "started",
      sessionId: started.value.sessionId,
      revision: started.value.revision,
    };
  }

  async synchronizeVerifiedTwitchOffline(
    input: unknown,
  ): Promise<TwitchStreamSynchronizationResult> {
    const parsed = twitchStreamEventSchema.safeParse(input);
    if (!parsed.success) {
      throw new StudioSessionApplicationError("validation", "Twitch stream event is invalid");
    }
    const record = await this.persistence.twitchChannelSessions.findTwitchChannelSession(
      parsed.data.broadcasterId,
    );
    if (record === null) {
      return { status: "not-found", sessionId: null, revision: null };
    }
    const state = await this.loadSession(record.sessionId);
    const occurredAt = Math.max(
      parsed.data.occurredAt,
      state.session.startedAt ?? state.session.createdAt,
    );
    const operationId = `twitch-offline-${createHash("sha256")
      .update(parsed.data.deliveryId)
      .digest("hex")}`;
    const ended = await new SessionLifecycleService(this.persistence.lifecycle).end(
      state.session.sessionId,
      state.session.revision,
      occurredAt,
      "twitch-stream-offline",
      operationId,
    );
    if (!ended.ok) {
      if (ended.error.code === "stale-revision") {
        const latest = await this.loadSession(state.session.sessionId);
        if (latest.session.status === "ended" || latest.session.status === "offline") {
          return {
            status: "ended",
            sessionId: latest.session.sessionId,
            revision: latest.session.revision,
          };
        }
      }
      throw commandError(ended.error.code, ended.error.message, ended.error.retryable);
    }
    return {
      status: "ended",
      sessionId: ended.value.sessionId,
      revision: ended.value.revision,
    };
  }

  private async startAuthorized(
    input: unknown,
    twitchVerified: boolean,
  ): Promise<StudioSessionStartResult> {
    const parsed = startSessionSchema.safeParse(input);
    if (!parsed.success) {
      throw new StudioSessionApplicationError("validation", "Studio session setup is invalid");
    }
    const twitchSetup = resolveTwitchSetupReadiness(this.dependencies.environment, {
      checkedAt: this.now(),
    });
    const twitchExtensionReady = twitchSetup.services.some(
      (service) => service.service === "twitch-extension" && service.status === "ready",
    );

    const lifecycle = new SessionLifecycleService(this.persistence.lifecycle);
    await lifecycle.expireDue(this.now());
    let state: AuthoritativeSessionState;
    const existing = await this.persistence.twitchChannelSessions.findTwitchChannelSession(
      parsed.data.channelId,
    );
    if (existing !== null) {
      const loaded = await this.persistence.sessions.load(existing.sessionId);
      if (loaded === null) {
        throw new StudioSessionApplicationError(
          "dependency-unavailable",
          "The active broadcaster session could not be loaded",
          true,
        );
      }
      state = loaded;
      if (
        twitchVerified &&
        parsed.data.gameId !== null &&
        parsed.data.gameName !== null
      ) {
        state = await this.applyVerifiedTwitchCurrentGame(state, {
          gameId: parsed.data.gameId,
          gameName: parsed.data.gameName,
        });
      }
    } else {
      const createdAt = this.now();
      const sessionId = `session-${this.nextId()}`;
      const questCycleId = `cycle-${this.nextId()}`;
      const defaults = createDefaultStreamerProfile({
        profileId: `profile-${parsed.data.channelId}`,
        streamerId: parsed.data.channelId,
        displayName: parsed.data.displayName,
        gameId: parsed.data.gameId,
        gameName: parsed.data.gameName,
      });
      let profileResolution;
      try {
        profileResolution = twitchVerified
          ? await this.persistence.profiles.getOrCreateForVerifiedIdentity({
              provider: "twitch",
              providerSubjectId: parsed.data.channelId,
              displayName: parsed.data.displayName,
              verifiedAt: createdAt,
            }, defaults)
          : await this.persistence.profiles.getOrCreateForDiagnostic(defaults, createdAt);
      } catch {
        throw new StudioSessionApplicationError(
          "dependency-unavailable",
          "The streamer profile could not be loaded safely",
          true,
        );
      }
      const currentGame = parsed.data.gameId !== null && parsed.data.gameName !== null
        ? {
            gameId: parsed.data.gameId,
            gameName: parsed.data.gameName,
            source: twitchVerified ? "twitch" as const : "streamer" as const,
          }
        : profileResolution.profile.gameId !== null && profileResolution.profile.gameName !== null
          ? {
              gameId: profileResolution.profile.gameId,
              gameName: profileResolution.profile.gameName,
              source: "profile" as const,
            }
          : null;
      const stateAtRevisionZero = authoritativeSessionStateSchema.parse({
        session: {
          sessionId,
          broadcasterId: parsed.data.channelId,
          platform: "twitch",
          status: "preparing",
          revision: 0,
          createdAt,
          startedAt: null,
          endedAt: null,
          currentGame,
          capabilities: {
            twitchExtension: twitchExtensionReady,
            hostedViewerBoard: true,
            twitchChatVoting: true,
            twitchIdentity: true,
            anonymousParticipation: true,
            reactions: true,
          },
        },
        profile: profileResolution.profile,
        services: this.initialServices(createdAt),
        gameplay: null,
        audience: null,
        questCycle: {
          envelope: {
            contractVersion: CONTRACT_VERSION,
            sessionId,
            questCycleId,
            messageId: `studio-state-${this.nextId()}`,
            correlationId: `studio-bootstrap-${this.nextId()}`,
            revision: 0,
            occurredAt: createdAt,
            receivedAt: createdAt,
            source: "studio",
            evidenceClass: "live",
          },
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
      const created = await lifecycle.create(stateAtRevisionZero, createdAt);
      if (!created.ok) {
        throw commandError(created.error.code, created.error.message, created.error.retryable);
      }
      state = created.value.state;
    }

    return this.issueStudioGrant(state, twitchVerified);
  }

  private async applyVerifiedTwitchCurrentGame(
    initialState: AuthoritativeSessionState,
    game: { readonly gameId: string; readonly gameName: string },
  ): Promise<AuthoritativeSessionState> {
    let state = initialState;
    const actor: VerifiedCommandActor = {
      kind: "system",
      actorId: "role1-verified-twitch-game",
      expiresAt: null,
      moderatorForBroadcasterIds: [],
      voterKey: null,
      participationModes: [],
    };
    const commandId = `twitch-current-game-${this.nextId()}`;
    const correlationId = `twitch-current-game-correlation-${this.nextId()}`;
    const maxRevisionAttempts = 20;
    for (let attempt = 0; attempt < maxRevisionAttempts; attempt += 1) {
      if (
        state.session.currentGame?.gameId === game.gameId &&
        state.session.currentGame.gameName === game.gameName
      ) {
        return state;
      }
      const result = await this.dependencies.runtime.execute(
        systemCurrentGameCommandSchema.parse({
          contractVersion: CONTRACT_VERSION,
          sessionId: state.session.sessionId,
          questCycleId: state.questCycle.envelope.questCycleId,
          commandId,
          correlationId,
          expectedRevision: state.session.revision,
          issuedAt: this.now(),
          actor: { kind: actor.kind, actorId: actor.actorId },
          type: "system.current-game",
          game,
        }),
        actor,
        new StudioProjectionContext(this.now),
      );
      if (result.ok) return result.receipt.state;
      if (result.error.code !== "stale-revision" || attempt === maxRevisionAttempts - 1) {
        throw commandError(result.error.code, result.error.message, result.error.retryable);
      }
      state = await this.loadSession(state.session.sessionId);
      if (state.session.broadcasterId !== initialState.session.broadcasterId) {
        throw new StudioSessionApplicationError(
          "forbidden",
          "Twitch game update no longer belongs to this broadcaster session",
        );
      }
    }
    throw new StudioSessionApplicationError(
      "dependency-unavailable",
      "Twitch game could not update while live inputs were changing",
      true,
    );
  }

  private async issueStudioGrant(
    state: AuthoritativeSessionState,
    twitchVerified: boolean,
  ): Promise<StudioSessionStartResult> {
    const expiresAt = this.now() + STUDIO_GRANT_TTL_MS;
    const grant = this.grants.issue({
      version: 1,
      grantId: `studio-${this.nextId()}`,
      sessionId: state.session.sessionId,
      broadcasterId: state.session.broadcasterId,
      twitchVerified,
      expiresAt,
    });
    const surface = await this.surfaceState(state, twitchVerified);
    return { ...surface, grant, expiresAt };
  }

  async read(cookieGrant: string | null, authorizationHeader: string | null): Promise<StudioSurfaceState> {
    const authorized = await this.authorize(cookieGrant, authorizationHeader);
    const state = await this.dependencies.runtime.advanceQuestLifecycleIfDue(authorized.state);
    return this.surfaceState(state, authorized.twitchVerified);
  }

  async presence(
    cookieGrant: string | null,
    authorizationHeader: string | null,
    input: unknown,
  ) {
    const parsed = studioPresenceSchema.safeParse(input);
    if (!parsed.success) {
      throw new StudioSessionApplicationError("validation", "Studio presence request is invalid");
    }
    const authorized = await this.authorize(cookieGrant, authorizationHeader);
    const lifecycle = new SessionLifecycleService(this.persistence.lifecycle);
    const result = parsed.data.action === "heartbeat"
      ? await lifecycle.heartbeat(authorized.state.session.sessionId, this.now())
      : await lifecycle.disconnect(authorized.state.session.sessionId, this.now());
    if (!result.ok) {
      throw commandError(result.error.code, result.error.message, result.error.retryable);
    }
    return result.value;
  }

  async execute(
    cookieGrant: string | null,
    authorizationHeader: string | null,
    input: unknown,
  ): Promise<StudioSurfaceState & { readonly outcome: string; readonly message: string }> {
    const authorized = await this.authorize(cookieGrant, authorizationHeader);
    const serviceCommand = streamerServiceCommandSchema.safeParse(input);
    if (serviceCommand.success) {
      const command = serviceCommand.data;
      this.assertCommandIdentity(command, authorized);
      if (command.type === "streamer.session") {
        if (command.action === "start") {
          const hydratedState = await this.hydrateGameplay(authorized.state);
          const readiness = await this.readiness(hydratedState, authorized.twitchVerified, this.now());
          const sessionService = readiness.services.find((service) => service.service === "session");
          if (
            !readiness.ready ||
            !sessionService?.allowedActions.includes("start-session") ||
            hydratedState.session.status !== "preparing"
          ) {
            throw new StudioSessionApplicationError(
              "dependency-unavailable",
              readiness.label,
              readiness.blockerCodes.length > 0,
            );
          }
          const started = await new SessionLifecycleService(this.persistence.lifecycle).start(
            command.sessionId,
            command.expectedRevision,
            this.now(),
            command.commandId,
          );
          if (!started.ok) {
            throw commandError(started.error.code, started.error.message, started.error.retryable);
          }
          const startedState = { ...started.value.state, gameplay: hydratedState.gameplay };
          return {
            ...(await this.surfaceState(startedState, authorized.twitchVerified)),
            outcome: "committed",
            message: "ChatXPT session started.",
          };
        }
        if (command.action !== "end") {
          throw new StudioSessionApplicationError(
            "unavailable-capability",
            "This session action is unavailable",
          );
        }
        const ended = await new SessionLifecycleService(this.persistence.lifecycle).end(
          command.sessionId,
          command.expectedRevision,
          this.now(),
          "broadcaster-ended-session",
          command.commandId,
        );
        if (!ended.ok) {
          throw commandError(ended.error.code, ended.error.message, ended.error.retryable);
        }
        return {
          ...(await this.surfaceState(ended.value.state, authorized.twitchVerified)),
          outcome: "committed",
          message: "Stream session ended.",
        };
      }
      return {
        ...(await this.surfaceState(authorized.state, authorized.twitchVerified)),
        outcome: "diagnostic-only",
        message:
          command.action === "open-diagnostics"
            ? "Open Studio diagnostics to inspect this integration. No setup state was fabricated."
            : "The requested provider setup action is not automated yet. Current health was refreshed without changing authority.",
      };
    }

    const parsedCommand = commandEnvelopeSchema.safeParse(input);
    if (!parsedCommand.success) {
      throw new StudioSessionApplicationError("validation", "Studio command is invalid");
    }
    this.assertCommandActor(parsedCommand.data, authorized);
    let currentState = authorized.state;
    if (parsedCommand.data.type === "streamer.quest-generation") {
      const maxFallbackAttempts = 20;
      for (let attempt = 0; attempt < maxFallbackAttempts; attempt += 1) {
        const fallback = await this.dependencies.runtime.requestDeterministicFallbackProposal(
          currentState,
          new StudioProjectionContext(this.now),
          {
            commandId: parsedCommand.data.commandId,
            correlationId: parsedCommand.data.correlationId,
            issuedAt: parsedCommand.data.issuedAt,
          },
        );
        if (fallback.ok) {
          return {
            ...(await this.surfaceState(fallback.receipt.state, authorized.twitchVerified)),
            outcome: fallback.outcome,
            message:
              "Three deterministic fallback quests are ready for review. No gameplay or audience evidence was used.",
          };
        }
        if (fallback.error.code !== "stale-revision" || attempt === maxFallbackAttempts - 1) {
          throw commandError(fallback.error.code, fallback.error.message, fallback.error.retryable);
        }
        currentState = await this.loadSession(currentState.session.sessionId);
        if (currentState.session.broadcasterId !== authorized.state.session.broadcasterId) {
          throw new StudioSessionApplicationError(
            "forbidden",
            "Studio grant no longer owns this session",
          );
        }
      }
      throw new StudioSessionApplicationError(
        "dependency-unavailable",
        "Studio could not generate fallback quests while live gameplay was updating",
        true,
      );
    }
    let result;
    // Live capture can advance the shared authoritative revision several times
    // while a broadcaster command is in flight. Rebase the already-authenticated
    // command in a bounded loop so gameplay telemetry cannot starve Studio controls.
    const maxRevisionAttempts = 20;
    for (let attempt = 0; attempt < maxRevisionAttempts; attempt += 1) {
      const rebasedCommand = {
        ...parsedCommand.data,
        expectedRevision: currentState.session.revision,
      };
      result = await this.dependencies.runtime.execute(
        rebasedCommand,
        authorized.actor,
        new StudioProjectionContext(this.now),
      );
      if (result.ok) break;
      if (result.error.code !== "stale-revision" || attempt === maxRevisionAttempts - 1) {
        throw commandError(result.error.code, result.error.message, result.error.retryable);
      }
      currentState = await this.loadSession(currentState.session.sessionId);
      if (currentState.session.broadcasterId !== authorized.state.session.broadcasterId) {
        throw new StudioSessionApplicationError(
          "forbidden",
          "Studio grant no longer owns this session",
        );
      }
    }
    if (result === undefined || !result.ok) {
      throw new StudioSessionApplicationError(
        "dependency-unavailable",
        "Studio could not commit the command while live gameplay was updating",
        true,
      );
    }
    const state = result.receipt.state;
    let message =
      result.delivery === "published"
        ? "Authoritative change saved and broadcast."
        : "Authoritative change saved; realtime delivery is recovering.";
    if (
      parsedCommand.data.type === "streamer.live-director-cue" &&
      parsedCommand.data.action === "turn-into-vote" &&
      state.questCycle.status === "proposed" &&
      state.questCycle.options.length === 3
    ) {
      message =
        result.delivery === "published"
          ? "Three private quest options are ready for streamer approval."
          : "Three private quest options are saved; realtime delivery is recovering.";
    }
    return {
      ...(await this.surfaceState(state, authorized.twitchVerified)),
      outcome: result.outcome,
      message,
    };
  }

  private assertCommandIdentity(
    command: { readonly sessionId: string; readonly expectedRevision: number; readonly actor: { readonly kind: string; readonly actorId: string | null } },
    authorized: AuthorizedStudioSession,
  ): void {
    if (
      command.sessionId !== authorized.state.session.sessionId ||
      command.actor.kind !== "broadcaster" ||
      command.actor.actorId !== authorized.state.session.broadcasterId
    ) {
      throw new StudioSessionApplicationError("forbidden", "Command does not belong to this broadcaster session");
    }
    if (command.expectedRevision !== authorized.state.session.revision) {
      throw new StudioSessionApplicationError("stale-revision", "Studio state changed; refresh before retrying", true);
    }
  }

  private assertCommandActor(
    command: { readonly sessionId: string; readonly actor: { readonly kind: string; readonly actorId: string | null } },
    authorized: AuthorizedStudioSession,
  ): void {
    if (
      command.sessionId !== authorized.state.session.sessionId ||
      command.actor.kind !== "broadcaster" ||
      command.actor.actorId !== authorized.state.session.broadcasterId
    ) {
      throw new StudioSessionApplicationError("forbidden", "Command does not belong to this broadcaster session");
    }
  }

  private async authorize(
    cookieGrant: string | null,
    authorizationHeader: string | null,
  ): Promise<AuthorizedStudioSession> {
    if (authorizationHeader !== null) {
      try {
        const authorization = verifyTwitchExtensionJwt(
          readTwitchExtensionBearerToken(authorizationHeader),
          this.dependencies.extensionSecret,
          this.now(),
        );
        if (authorization.role !== "broadcaster") {
          throw new StudioSessionApplicationError(
            "forbidden",
            "Twitch Config and Live Config require the broadcaster role",
          );
        }
        const record = await this.persistence.twitchChannelSessions.findTwitchChannelSession(
          authorization.channelId,
        );
        if (record === null) {
          throw new StudioSessionApplicationError(
            "session-not-found",
            "Start the broadcaster session in ChatXPT Studio before opening Twitch controls",
            true,
          );
        }
        const state = await this.loadSession(record.sessionId);
        return {
          state,
          actor: this.broadcasterActor(state, authorization.expiresAt),
          twitchVerified: true,
        };
      } catch (caught) {
        if (caught instanceof StudioSessionApplicationError) throw caught;
        throw new StudioSessionApplicationError(
          "unauthenticated",
          caught instanceof Error ? caught.message : "Twitch broadcaster authorization failed",
        );
      }
    }
    if (cookieGrant === null) {
      throw new StudioSessionApplicationError("unauthenticated", "Start or reopen an authorised Studio session");
    }
    let grant;
    try {
      grant = this.grants.verify(cookieGrant, this.now());
    } catch (caught) {
      throw authError(caught);
    }
    const state = await this.loadSession(grant.sessionId);
    if (state.session.broadcasterId !== grant.broadcasterId) {
      throw new StudioSessionApplicationError("forbidden", "Studio grant no longer owns this session");
    }
    return {
      state,
      actor: this.broadcasterActor(state, grant.expiresAt),
      twitchVerified: grant.twitchVerified ?? false,
    };
  }

  private async loadSession(sessionId: string): Promise<AuthoritativeSessionState> {
    let state: AuthoritativeSessionState | null;
    try {
      state = await this.persistence.sessions.load(sessionId);
    } catch {
      throw new StudioSessionApplicationError("dependency-unavailable", "Studio session state is unavailable", true);
    }
    if (state === null) {
      throw new StudioSessionApplicationError("session-not-found", "Studio session was not found");
    }
    return state;
  }

  private broadcasterActor(state: AuthoritativeSessionState, expiresAt: number): VerifiedCommandActor {
    return {
      kind: "broadcaster",
      actorId: state.session.broadcasterId,
      expiresAt,
      moderatorForBroadcasterIds: [],
      voterKey: null,
      participationModes: [],
    };
  }

  private initialServices(checkedAt: number) {
    const twitch = resolveTwitchSetupReadiness(this.dependencies.environment, { checkedAt });
    return [
      serviceHealthSchema.parse({
        service: "twitch-extension-ebs",
        status: twitch.ok ? "ready" : "misconfigured",
        checkedAt,
        message: twitch.ok ? "Twitch application and Extension credentials are configured" : "Twitch credentials still need configuration",
        retryable: !twitch.ok,
      }),
      serviceHealthSchema.parse({
        service: "persistence",
        status: this.persistence.mode === "supabase" ? "ready" : "degraded",
        checkedAt,
        message: this.persistence.mode === "supabase" ? "Supabase authority is configured" : "Process-local memory authority is for local diagnostics only",
        retryable: this.persistence.mode !== "supabase",
      }),
      serviceHealthSchema.parse({
        service: "gameplay-capture",
        status: "unavailable",
        checkedAt,
        message: "No Gameplay Capture snapshot has arrived yet",
        retryable: true,
      }),
      serviceHealthSchema.parse({
        service: "quest-intelligence",
        status: "ready",
        checkedAt,
        message: "Credential-free algorithmic fallback is available",
        retryable: false,
      }),
    ];
  }

  private async surfaceState(
    inputState: AuthoritativeSessionState,
    twitchVerified: boolean,
  ): Promise<StudioSurfaceState> {
    const state = await this.hydrateGameplay(inputState);
    const at = this.now();
    const envelope = {
      contractVersion: CONTRACT_VERSION,
      sessionId: state.session.sessionId,
      questCycleId: state.questCycle.envelope.questCycleId,
      messageId: `studio-view-${this.nextId()}`,
      correlationId: `studio-read-${this.nextId()}`,
      revision: state.session.revision,
      occurredAt: at,
      receivedAt: at,
      source: "orchestrator" as const,
      evidenceClass: state.questCycle.envelope.evidenceClass,
    };
    const view = streamerViewModelSchema.parse({
      envelope,
      session: state.session,
      profile: state.profile,
      services: state.services,
      gameplay: state.gameplay,
      audience: state.audience,
      questCycle: state.questCycle,
      emergencyPaused: state.emergencyPaused,
      profileConnection: await this.profileConnection(state, twitchVerified, at),
      ...(state.sessionOverride === undefined ? {} : { sessionOverride: state.sessionOverride }),
      ...(state.liveDirector === undefined ? {} : { liveDirector: state.liveDirector }),
    });
    return {
      view,
      readiness: await this.readiness(state, twitchVerified, at),
      roomCode:
        (await this.persistence.hostedBoardSessions.findHostedBoardSessionBySessionId(
          state.session.sessionId,
        ))?.roomCode ?? null,
    };
  }

  private async profileConnection(
    state: AuthoritativeSessionState,
    twitchVerified: boolean,
    checkedAt: number,
  ): Promise<StreamerProfileConnection> {
    try {
      const stored = await this.persistence.profiles.loadByStreamerId(state.profile.streamerId);
      if (
        stored === null ||
        canonicalJsonStringify(stored.profile) !== canonicalJsonStringify(state.profile)
      ) {
        return {
          accountStatus: twitchVerified ? "twitch-verified" : "diagnostic",
          profileOrigin: this.persistence.mode,
          persistenceStatus: "unavailable",
          checkedAt,
          lastPersistedAt: stored?.updatedAt ?? null,
          message: "Profile storage does not match the active session. Reconnect before changing defaults.",
        };
      }
      if (this.persistence.mode === "supabase") {
        return {
          accountStatus: twitchVerified ? "twitch-verified" : "diagnostic",
          profileOrigin: "supabase",
          persistenceStatus: "synced",
          checkedAt,
          lastPersistedAt: stored.updatedAt,
          message: twitchVerified
            ? "Twitch is verified and profile changes are saved to your account."
            : "The diagnostic session is using an existing saved profile.",
        };
      }
      return {
        accountStatus: twitchVerified ? "twitch-verified" : "diagnostic",
        profileOrigin: "memory",
        persistenceStatus: "temporary",
        checkedAt,
        lastPersistedAt: stored.updatedAt,
        message: twitchVerified
          ? "Twitch is verified, but profile changes last only while this server is running."
          : "This diagnostic profile lasts only while the local server is running.",
      };
    } catch {
      return {
        accountStatus: twitchVerified ? "twitch-verified" : "diagnostic",
        profileOrigin: this.persistence.mode,
        persistenceStatus: "unavailable",
        checkedAt,
        lastPersistedAt: null,
        message: "Profile storage could not be checked. The live session can continue with its loaded settings.",
      };
    }
  }

  private async hydrateGameplay(
    inputState: AuthoritativeSessionState,
  ): Promise<AuthoritativeSessionState> {
    let state = inputState;
    try {
      const gameplay = await this.persistence.gameplaySnapshots.readCurrent({
        sessionId: state.session.sessionId,
        questCycleId: state.questCycle.envelope.questCycleId,
        revision: state.session.revision,
        evidenceClass: state.questCycle.envelope.evidenceClass,
      });
      if (gameplay !== null) state = { ...state, gameplay };
    } catch {
      // The stored state remains safe to render while Capture Health reports the missing input.
    }
    return state;
  }

  private async readiness(
    state: AuthoritativeSessionState,
    twitchVerified: boolean,
    checkedAt: number,
  ): Promise<StreamerReadinessView> {
    const twitch = resolveTwitchSetupReadiness(this.dependencies.environment, { checkedAt });
    const twitchAppReady = twitch.services.some(
      (service) => service.service === "twitch-app" && service.status === "ready",
    );
    const twitchEventSubReady = twitch.services.some(
      (service) => service.service === "twitch-eventsub-chat" && service.status === "ready",
    );
    const twitchExtensionReady = twitch.services.some(
      (service) => service.service === "twitch-extension" && service.status === "ready",
    );
    const twitchCoreReady = twitchAppReady && twitchEventSubReady;
    const missingTwitchCore = twitch.missing.filter(
      (name) => name !== "TWITCH_EXTENSION_CLIENT_ID" && name !== "TWITCH_EXTENSION_SECRET",
    );
    const gameplayLive = state.gameplay?.envelope.evidenceClass === "live";
    const gameplayCaptureFresh = state.gameplay !== null &&
      checkedAt - state.gameplay.envelope.occurredAt <= GAMEPLAY_CAPTURE_STALE_AFTER_MS &&
      state.gameplay.envelope.occurredAt <= checkedAt + 5_000;
    let realtimeHealth = serviceHealthSchema.parse({
      service: "realtime",
      status: this.persistence.mode === "supabase" ? "ready" : "degraded",
      checkedAt,
      message: this.persistence.mode === "supabase" ? "Supabase realtime authority is configured" : "Process-local memory mode does not provide cross-instance realtime",
      retryable: this.persistence.mode !== "supabase",
    });
    if (this.persistence.mode === "supabase") {
      try {
        realtimeHealth = await this.persistence.probe(checkedAt);
      } catch {
        realtimeHealth = serviceHealthSchema.parse({
          service: "realtime",
          status: "unavailable",
          checkedAt,
          message: "Supabase realtime health probe failed",
          retryable: true,
        });
      }
    }
    const captureHealth = serviceHealthSchema.parse({
      service: "gameplay-capture",
      status: gameplayCaptureFresh ? "ready" : "unavailable",
      checkedAt,
      message: state.gameplay === null
        ? "No Gameplay Capture snapshot is available"
        : gameplayCaptureFresh
          ? `${state.gameplay.signals.length} Detected Game Facts are available with explicit confidence`
          : `Gameplay Capture stopped reporting frames ${Math.max(1, Math.floor((checkedAt - state.gameplay.envelope.occurredAt) / 1_000))} seconds ago; keep the persistent Capture tab open and reconnect it`,
      retryable: !gameplayCaptureFresh,
    });
    const integrationBlockers = [
      ...(!twitchCoreReady ? ["twitch-configuration"] : []),
      ...(!gameplayCaptureFresh ? [state.gameplay === null ? "gameplay-capture" : "gameplay-capture-stale"] : []),
    ];
    const canStartSession = state.session.status === "preparing" && integrationBlockers.length === 0;
    const sessionReady = state.session.status === "live" || canStartSession;
    const sessionHealth = serviceHealthSchema.parse({
      service: "session",
      status: sessionReady ? "ready" : "unavailable",
      checkedAt,
      message: state.session.status === "live"
        ? "ChatXPT session is live"
        : canStartSession
          ? twitchVerified
            ? "Twitch is connected; ChatXPT starts automatically when the stream goes live"
            : "ChatXPT can start after diagnostic confirmation"
          : state.session.status === "preparing"
            ? "Resolve blocking setup before starting ChatXPT"
            : `ChatXPT session is ${state.session.status}`,
      retryable: state.session.status !== "ended",
    });
    const intelligenceHealth = serviceHealthSchema.parse({
      service: "intelligence",
      status: "ready",
      checkedAt,
      message: "Credential-free algorithmic sidequest fallback is available",
      retryable: false,
    });
    const twitchHealth = serviceHealthSchema.parse({
      service: "twitch",
      status: twitchCoreReady ? "ready" : "misconfigured",
      checkedAt,
      message: twitchCoreReady
        ? twitchVerified
          ? twitchExtensionReady
            ? "Twitch broadcaster authorization is verified; Extension delivery is configured"
            : "Twitch broadcaster authorization is verified; the Extension is not configured, so viewer fallbacks remain available"
          : twitchExtensionReady
            ? "Twitch app, chat, and Extension credentials are configured"
            : "Twitch app and chat are configured; the Extension is not configured, so viewer fallbacks remain available"
        : `Missing ${missingTwitchCore.join(", ")}`,
      retryable: !twitchCoreReady,
    });
    const realtimeBlocksStart =
      realtimeHealth.status === "unavailable" &&
      !state.session.capabilities.hostedViewerBoard &&
      !state.session.capabilities.twitchChatVoting;
    const sessionBlocksStart = state.session.status === "ended" || state.session.status === "offline";
    const ready =
      integrationBlockers.length === 0 &&
      !realtimeBlocksStart &&
      !sessionBlocksStart &&
      (state.session.status === "preparing" || state.session.status === "live");
    const blockers = [
      ...integrationBlockers,
      ...(realtimeBlocksStart ? ["viewer-voting-unavailable"] : []),
      ...(sessionBlocksStart ? ["session-ended"] : []),
    ];
    const liveInputsUsed = twitchVerified || gameplayLive;
    const sessionActions =
      state.session.status === "live"
        ? ["end-session", "open-diagnostics"]
        : canStartSession && !realtimeBlocksStart && !twitchVerified
          ? ["start-session", "open-diagnostics"]
          : ["open-diagnostics"];
    const recommendedAction =
      canStartSession && !realtimeBlocksStart && !twitchVerified
        ? "start-session"
        : !gameplayCaptureFresh
          ? "request-capture-permission"
          : !twitchCoreReady
            ? "connect-twitch"
            : realtimeBlocksStart
              ? "retry-service"
              : null;
    return streamerReadinessViewSchema.parse({
      evidenceClass: liveInputsUsed ? "live" : "diagnostic",
      liveInputsUsed,
      ready,
      status: ready ? "ready" : "blocked",
      services: [
        {
          service: "twitch",
          configured: twitchCoreReady,
          health: twitchHealth,
          allowedActions: twitchCoreReady
            ? twitchExtensionReady
              ? ["retry-service", "open-diagnostics"]
              : ["install-extension", "retry-service", "open-diagnostics"]
            : ["connect-twitch", "open-diagnostics"],
        },
        { service: "obs-capture", configured: state.gameplay !== null, health: captureHealth, allowedActions: gameplayCaptureFresh ? ["open-diagnostics"] : ["request-capture-permission", "select-capture-source", "open-diagnostics"] },
        { service: "realtime", configured: this.persistence.mode === "supabase", health: realtimeHealth, allowedActions: ["retry-service", "open-diagnostics"] },
        { service: "intelligence", configured: true, health: intelligenceHealth, allowedActions: ["retry-service", "open-diagnostics"] },
        { service: "session", configured: true, health: sessionHealth, allowedActions: sessionActions },
      ],
      blockerCodes: blockers,
      recommendedAction,
      label: !gameplayCaptureFresh && state.gameplay !== null
        ? "Gameplay Capture stopped — reopen Gameplay Engine"
        : ready
        ? state.session.status === "live"
          ? "Ready for the Twitch workflow"
          : twitchVerified
            ? "Twitch connected — waiting for the stream"
            : "Ready to start diagnostic ChatXPT session"
        : `${blockers.length} readiness ${blockers.length === 1 ? "blocker" : "blockers"}`,
    });
  }
}

const applicationKey = Symbol.for("chatxpt.studioSessionApplication.v1");
const globalApplication = globalThis as typeof globalThis & {
  [applicationKey]?: StudioSessionApplication;
};

export function getStudioSessionApplication(): StudioSessionApplication {
  if (globalApplication[applicationKey] !== undefined) return globalApplication[applicationKey];
  const grantSecret = studioSessionSecret(process.env);
  globalApplication[applicationKey] = new StudioSessionApplication({
    runtime: getChatXptServerRuntime(),
    setupKey: process.env.CHATXPT_STUDIO_SETUP_KEY ?? "",
    grantSecret,
    extensionSecret: process.env.TWITCH_EXTENSION_SECRET ?? "",
    environment: process.env,
  });
  return globalApplication[applicationKey];
}
