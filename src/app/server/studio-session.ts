import "server-only";

import { randomUUID } from "node:crypto";

import { z } from "zod";

import {
  CONTRACT_VERSION,
  authoritativeSessionStateSchema,
  commandEnvelopeSchema,
  identifierSchema,
  serviceHealthSchema,
  streamerReadinessViewSchema,
  streamerServiceCommandSchema,
  streamerViewModelSchema,
  type AuthoritativeSessionState,
  type ProjectionContextResolver,
  type StreamerReadinessView,
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
  readonly extensionSecret: string;
  readonly environment: Record<string, string | undefined>;
  readonly now?: () => number;
  readonly nextId?: () => string;
}

export class StudioSessionApplication {
  private readonly persistence: ConfiguredPersistenceRuntime;
  private readonly grants: StudioSessionGrantAuthority;
  private readonly now: () => number;
  private readonly nextId: () => string;

  constructor(private readonly dependencies: StudioSessionApplicationDependencies) {
    this.persistence = dependencies.runtime.persistence;
    this.grants = new StudioSessionGrantAuthority(dependencies.setupKey);
    this.now = dependencies.now ?? Date.now;
    this.nextId = dependencies.nextId ?? randomUUID;
  }

  async start(setupKey: string | null, input: unknown): Promise<StudioSessionStartResult> {
    try {
      this.grants.authenticateSetupKey(setupKey);
    } catch (caught) {
      throw authError(caught);
    }
    const parsed = startSessionSchema.safeParse(input);
    if (!parsed.success) {
      throw new StudioSessionApplicationError("validation", "Studio session setup is invalid");
    }

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
      if (state.session.status === "preparing") {
        const started = await new SessionLifecycleService(this.persistence.lifecycle).start(
          state.session.sessionId,
          state.session.revision,
          this.now(),
          `studio-start-${this.nextId()}`,
        );
        if (!started.ok) {
          throw commandError(started.error.code, started.error.message, started.error.retryable);
        }
        state = started.value.state;
      }
    } else {
      const createdAt = this.now();
      const sessionId = `session-${this.nextId()}`;
      const questCycleId = `cycle-${this.nextId()}`;
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
          profileId: `profile-${parsed.data.channelId}`,
          streamerId: parsed.data.channelId,
          revision: 0,
          displayName: parsed.data.displayName,
          gameId: parsed.data.gameId,
          gameName: parsed.data.gameName,
          experience: { intensity: 0.5, creativity: 0.5 },
          restrictions: [],
          preferredQuestTypes: [],
          forbiddenQuestTypes: [],
          accessibilityNeeds: [],
        },
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
      const lifecycle = new SessionLifecycleService(this.persistence.lifecycle);
      const created = await lifecycle.create(stateAtRevisionZero, createdAt);
      if (!created.ok) {
        throw commandError(created.error.code, created.error.message, created.error.retryable);
      }
      const started = await lifecycle.start(
        sessionId,
        0,
        this.now(),
        `studio-start-${this.nextId()}`,
      );
      if (!started.ok) {
        throw commandError(started.error.code, started.error.message, started.error.retryable);
      }
      state = started.value.state;
    }

    const expiresAt = this.now() + STUDIO_GRANT_TTL_MS;
    const grant = this.grants.issue({
      version: 1,
      grantId: `studio-${this.nextId()}`,
      sessionId: state.session.sessionId,
      broadcasterId: state.session.broadcasterId,
      expiresAt,
    });
    const surface = await this.surfaceState(state, false);
    return { ...surface, grant, expiresAt };
  }

  async read(cookieGrant: string | null, authorizationHeader: string | null): Promise<StudioSurfaceState> {
    const authorized = await this.authorize(cookieGrant, authorizationHeader);
    return this.surfaceState(authorized.state, authorized.twitchVerified);
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
        if (command.action !== "end") {
          throw new StudioSessionApplicationError(
            "unavailable-capability",
            "This session is already started",
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
    this.assertCommandIdentity(parsedCommand.data, authorized);
    const result = await this.dependencies.runtime.execute(
      parsedCommand.data,
      authorized.actor,
      new StudioProjectionContext(this.now),
    );
    if (!result.ok) {
      throw commandError(result.error.code, result.error.message, result.error.retryable);
    }
    const state = result.receipt.state;
    return {
      ...(await this.surfaceState(state, authorized.twitchVerified)),
      outcome: result.outcome,
      message:
        result.delivery === "published"
          ? "Authoritative change saved and broadcast."
          : "Authoritative change saved; realtime delivery is recovering.",
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
    return { state, actor: this.broadcasterActor(state, grant.expiresAt), twitchVerified: false };
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

  private async readiness(
    state: AuthoritativeSessionState,
    twitchVerified: boolean,
    checkedAt: number,
  ): Promise<StreamerReadinessView> {
    const twitch = resolveTwitchSetupReadiness(this.dependencies.environment, { checkedAt });
    const gameplayLive = state.gameplay?.envelope.evidenceClass === "live";
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
      status: state.gameplay === null ? "unavailable" : "ready",
      checkedAt,
      message: state.gameplay === null
        ? "No Gameplay Capture snapshot is available"
        : `${state.gameplay.signals.length} Detected Game Facts are available with explicit confidence`,
      retryable: state.gameplay === null,
    });
    const sessionHealth = serviceHealthSchema.parse({
      service: "session",
      status: state.session.status === "live" ? "ready" : "unavailable",
      checkedAt,
      message: state.session.status === "live" ? "Broadcaster session is live" : `Broadcaster session is ${state.session.status}`,
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
      status: twitch.ok ? "ready" : "misconfigured",
      checkedAt,
      message: twitch.ok
        ? twitchVerified
          ? "Signed Twitch broadcaster authorization verified for this request"
          : "Twitch credentials are configured; open through Twitch to verify channel authorization"
        : `Missing ${twitch.missing.join(", ")}`,
      retryable: !twitch.ok,
    });
    const ready =
      twitch.ok &&
      state.gameplay !== null &&
      state.session.status === "live" &&
      realtimeHealth.status === "ready";
    const blockers = [
      ...(!twitch.ok ? ["twitch-configuration"] : []),
      ...(state.gameplay === null ? ["gameplay-capture"] : []),
      ...(state.session.status !== "live" ? ["session-not-live"] : []),
      ...(realtimeHealth.status !== "ready" ? ["realtime-authority"] : []),
    ];
    const liveInputsUsed = twitchVerified || gameplayLive;
    return streamerReadinessViewSchema.parse({
      evidenceClass: liveInputsUsed ? "live" : "diagnostic",
      liveInputsUsed,
      ready,
      status: ready ? "ready" : "blocked",
      services: [
        { service: "twitch", configured: twitch.ok, health: twitchHealth, allowedActions: twitch.ok ? ["retry-service", "open-diagnostics"] : ["open-diagnostics"] },
        { service: "obs-capture", configured: state.gameplay !== null, health: captureHealth, allowedActions: ["open-diagnostics"] },
        { service: "realtime", configured: this.persistence.mode === "supabase", health: realtimeHealth, allowedActions: ["retry-service", "open-diagnostics"] },
        { service: "intelligence", configured: true, health: intelligenceHealth, allowedActions: ["retry-service", "open-diagnostics"] },
        { service: "session", configured: true, health: sessionHealth, allowedActions: state.session.status === "live" ? ["end-session", "open-diagnostics"] : ["open-diagnostics"] },
      ],
      blockerCodes: blockers,
      recommendedAction: state.gameplay === null ? "open-diagnostics" : !twitch.ok ? "open-diagnostics" : realtimeHealth.status !== "ready" ? "retry-service" : null,
      label: ready ? "Ready for the Twitch workflow" : `${blockers.length} readiness ${blockers.length === 1 ? "blocker" : "blockers"}`,
    });
  }
}

const applicationKey = Symbol.for("chatxpt.studioSessionApplication.v1");
const globalApplication = globalThis as typeof globalThis & {
  [applicationKey]?: StudioSessionApplication;
};

export function getStudioSessionApplication(): StudioSessionApplication {
  if (globalApplication[applicationKey] !== undefined) return globalApplication[applicationKey];
  globalApplication[applicationKey] = new StudioSessionApplication({
    runtime: getChatXptServerRuntime(),
    setupKey: process.env.CHATXPT_STUDIO_SETUP_KEY ?? "",
    extensionSecret: process.env.TWITCH_EXTENSION_SECRET ?? "",
    environment: process.env,
  });
  return globalApplication[applicationKey];
}
