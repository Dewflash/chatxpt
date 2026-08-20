import "server-only";

import { randomUUID } from "node:crypto";

import { z } from "zod";

import {
  CONTRACT_VERSION,
  CanonicalViewProjector,
  domainErrorSchema,
  serviceHealthSchema,
  viewerReactionCommandSchema,
  viewerViewModelSchema,
  viewerVoteCommandSchema,
  systemVoteCloseCommandSchema,
  type AuthoritativeSessionState,
  type DomainError,
  type ProjectionContext,
  type ProjectionContextResolver,
  type ViewerViewModel,
} from "@/core";
import {
  HostedBoardAuthError,
  HostedBoardGrantAuthority,
  type HostedBoardGrant,
} from "@/integrations/server";
import {
  HostedBoardAccessService,
  type ChatXptPersistenceRuntime,
  type VerifiedCommandActor,
} from "@/realtime";

import { getChatXptServerRuntime, type ChatXptServerRuntime } from "./runtime";

export const hostedBoardAccessRequestSchema = z
  .object({ roomCode: z.string().trim().min(1).max(32) })
  .strict();

export const hostedBoardVoteRequestSchema = z
  .object({
    commandId: z.string().trim().min(1).max(128),
    candidateId: z.string().trim().min(1).max(128),
  })
  .strict();

export const hostedBoardReactionRequestSchema = z
  .object({
    commandId: z.string().trim().min(1).max(128),
    reaction: z.literal("hype"),
  })
  .strict();

const GRANT_TTL_MS = 12 * 60 * 60 * 1_000;

export type HostedBoardApplicationErrorCode =
  | "misconfigured"
  | "unauthenticated"
  | "forbidden"
  | "session-not-found"
  | "session-unavailable"
  | "invalid-command"
  | "dependency-unavailable";

export class HostedBoardApplicationError extends Error {
  constructor(
    readonly code: HostedBoardApplicationErrorCode,
    message: string,
    readonly retryable = false,
  ) {
    super(message);
    this.name = "HostedBoardApplicationError";
  }
}

export interface HostedBoardOpenResult {
  readonly token: string;
  readonly sessionId: string;
  readonly roomCode: string;
  readonly expiresAt: number;
}

export type HostedBoardCommandResult =
  | { readonly ok: true; readonly outcome: "committed" | "duplicate"; readonly view: ViewerViewModel }
  | { readonly ok: false; readonly error: DomainError; readonly view: ViewerViewModel };

interface HostedBoardApplicationDependencies {
  readonly runtime: ChatXptServerRuntime;
  readonly secret: string;
  readonly now?: () => number;
  readonly nextId?: () => string;
}

interface AuthorizedHostedBoard {
  readonly grant: HostedBoardGrant;
  readonly state: AuthoritativeSessionState;
  readonly actor: VerifiedCommandActor;
}

class HostedBoardProjectionContext implements ProjectionContextResolver {
  constructor(
    private readonly persistence: ChatXptPersistenceRuntime,
    private readonly actor: VerifiedCommandActor,
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
      participationMode: "hosted-board",
      viewerId: null,
      sessionPoints: recovery?.sessionPoints ?? 0,
      acceptedCandidateId: recovery?.acceptedCandidateId ?? null,
      connection: serviceHealthSchema.parse({
        service: "hosted-quest-board",
        status: "ready",
        checkedAt: this.now(),
        message: "Anonymous hosted-board access is connected",
        retryable: false,
      }),
    };
  }
}

function authError(caught: unknown): HostedBoardApplicationError {
  if (caught instanceof HostedBoardAuthError) {
    return new HostedBoardApplicationError(
      caught.code === "misconfigured" ? "misconfigured" : "unauthenticated",
      caught.message,
      caught.code === "expired-token",
    );
  }
  return new HostedBoardApplicationError("unauthenticated", "Hosted Quest Board access is invalid");
}

export class HostedBoardApplication {
  private readonly persistence: ChatXptPersistenceRuntime;
  private readonly grants: HostedBoardGrantAuthority;
  private readonly now: () => number;
  private readonly nextId: () => string;

  constructor(private readonly dependencies: HostedBoardApplicationDependencies) {
    this.persistence = dependencies.runtime.persistence;
    this.grants = new HostedBoardGrantAuthority(dependencies.secret);
    this.now = dependencies.now ?? Date.now;
    this.nextId = dependencies.nextId ?? randomUUID;
  }

  async open(roomCode: string, existingToken: string | null): Promise<HostedBoardOpenResult> {
    const normalizedRoomCode = roomCode.trim().toUpperCase().replace(/\s+/g, "");
    if (existingToken !== null) {
      try {
        const grant = this.grants.verify(existingToken, this.now());
        if (grant.roomCode === normalizedRoomCode) {
          await this.authorize(existingToken);
          return {
            token: existingToken,
            sessionId: grant.sessionId,
            roomCode: grant.roomCode,
            expiresAt: grant.expiresAt,
          };
        }
      } catch (caught) {
        if (caught instanceof HostedBoardAuthError && caught.code === "misconfigured") {
          throw authError(caught);
        }
      }
    }

    const requestedAt = this.now();
    const expiresAt = requestedAt + GRANT_TTL_MS;
    const principalId = `hosted-principal-${this.nextId()}`;
    const access = await new HostedBoardAccessService(
      this.persistence.hostedBoardSessions,
      this.persistence.accessGrants,
    ).resolve({
      roomCode: normalizedRoomCode,
      principalId,
      requestedAt,
      expiresAt,
      viewerPathPrefix: "/quest-board",
    });
    if (access.status !== "granted") {
      throw new HostedBoardApplicationError(
        access.status === "unavailable" ? "dependency-unavailable" : "session-not-found",
        access.message,
        access.retryable,
      );
    }
    let token;
    try {
      token = this.grants.issue({
        version: 1,
        grantId: `hosted-grant-${this.nextId()}`,
        sessionId: access.sessionId,
        principalId,
        voterKey: `hosted-voter-${this.nextId()}`,
        roomCode: access.roomCode,
        expiresAt,
      });
    } catch (caught) {
      throw authError(caught);
    }
    return { token, sessionId: access.sessionId, roomCode: access.roomCode, expiresAt };
  }

  async read(token: string | null): Promise<ViewerViewModel> {
    const authorized = await this.authorize(token);
    return this.projectViewer(authorized);
  }

  async vote(token: string | null, input: unknown): Promise<HostedBoardCommandResult> {
    const parsed = hostedBoardVoteRequestSchema.safeParse(input);
    if (!parsed.success) {
      throw new HostedBoardApplicationError("invalid-command", "Hosted-board vote is invalid");
    }
    let authorized = await this.authorize(token);
    const questCycleId = authorized.state.questCycle.envelope.questCycleId;
    if (questCycleId === null || authorized.actor.voterKey === null) {
      throw new HostedBoardApplicationError(
        "session-unavailable",
        "No hosted-board vote is currently available",
        true,
      );
    }
    const existing = await this.persistence.sessions.findReceipt(parsed.data.commandId);
    if (existing !== null) {
      const command = existing.command;
      if (
        command.type !== "viewer.vote" ||
        command.sessionId !== authorized.state.session.sessionId ||
        command.questCycleId !== questCycleId ||
        command.candidateId !== parsed.data.candidateId ||
        command.voterKey !== authorized.actor.voterKey
      ) {
        throw new HostedBoardApplicationError("invalid-command", "Vote command ID was already used");
      }
      return { ok: true, outcome: "duplicate", view: await this.projectViewer(authorized) };
    }

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const command = viewerVoteCommandSchema.parse({
        contractVersion: CONTRACT_VERSION,
        sessionId: authorized.state.session.sessionId,
        questCycleId,
        commandId: parsed.data.commandId,
        correlationId: `hosted-board-${parsed.data.commandId}`,
        expectedRevision: authorized.state.session.revision,
        issuedAt: this.now(),
        actor: { kind: "anonymous", actorId: null },
        type: "viewer.vote",
        candidateId: parsed.data.candidateId,
        voterKey: authorized.actor.voterKey,
        sourceMode: "hosted-board",
      });
      const result = await this.dependencies.runtime.execute(
        command,
        authorized.actor,
        new HostedBoardProjectionContext(this.persistence, authorized.actor, this.now),
      );
      if (result.ok) {
        return { ok: true, outcome: result.outcome, view: await this.read(token) };
      }
      if (result.error.code !== "stale-revision" || attempt === 1) {
        return {
          ok: false,
          error: domainErrorSchema.parse(result.error),
          view: await this.read(token),
        };
      }
      authorized = await this.authorize(token);
      if (authorized.state.questCycle.envelope.questCycleId !== questCycleId) {
        return {
          ok: false,
          error: domainErrorSchema.parse({
            code: "expired",
            message: "The voting cycle changed before this vote could be accepted",
            retryable: false,
          }),
          view: await this.projectViewer(authorized),
        };
      }
    }
    throw new HostedBoardApplicationError(
      "dependency-unavailable",
      "Hosted-board vote processing is unavailable",
      true,
    );
  }

  async react(token: string | null, input: unknown): Promise<HostedBoardCommandResult> {
    const parsed = hostedBoardReactionRequestSchema.safeParse(input);
    if (!parsed.success) {
      throw new HostedBoardApplicationError("invalid-command", "Hosted-board reaction is invalid");
    }
    const authorized = await this.authorize(token);
    const existing = await this.persistence.sessions.findReceipt(parsed.data.commandId);
    if (existing !== null) {
      const command = existing.command;
      if (
        command.type !== "viewer.react" ||
        command.sessionId !== authorized.state.session.sessionId ||
        command.reaction !== parsed.data.reaction ||
        command.actor.kind !== "anonymous" ||
        command.actor.actorId !== null
      ) {
        throw new HostedBoardApplicationError("invalid-command", "Reaction command ID was already used");
      }
      return { ok: true, outcome: "duplicate", view: await this.projectViewer(authorized) };
    }
    const result = await this.dependencies.runtime.execute(
      viewerReactionCommandSchema.parse({
        contractVersion: CONTRACT_VERSION,
        sessionId: authorized.state.session.sessionId,
        questCycleId: authorized.state.questCycle.envelope.questCycleId,
        commandId: parsed.data.commandId,
        correlationId: `hosted-board-${parsed.data.commandId}`,
        expectedRevision: authorized.state.session.revision,
        issuedAt: this.now(),
        actor: { kind: "anonymous", actorId: null },
        type: "viewer.react",
        reaction: parsed.data.reaction,
      }),
      authorized.actor,
      new HostedBoardProjectionContext(this.persistence, authorized.actor, this.now),
    );
    if (result.ok) {
      return { ok: true, outcome: result.outcome, view: await this.read(token) };
    }
    return {
      ok: false,
      error: domainErrorSchema.parse(result.error),
      view: await this.read(token),
    };
  }

  private async authorize(token: string | null): Promise<AuthorizedHostedBoard> {
    let grant;
    try {
      grant = this.grants.verify(token ?? "", this.now());
    } catch (caught) {
      throw authError(caught);
    }
    let canRead;
    try {
      canRead = await this.persistence.accessGrants.canRead(
        grant.principalId,
        grant.sessionId,
        "viewer",
        this.now(),
      );
    } catch {
      throw new HostedBoardApplicationError(
        "dependency-unavailable",
        "Hosted Quest Board access could not be checked",
        true,
      );
    }
    if (!canRead) {
      throw new HostedBoardApplicationError("forbidden", "Hosted Quest Board access was revoked");
    }
    let state = await this.persistence.sessions.load(grant.sessionId);
    if (state === null) {
      throw new HostedBoardApplicationError("session-not-found", "Hosted Quest Board session ended");
    }
    state = await this.closeVoteIfDue(state);
    return {
      grant,
      state,
      actor: {
        kind: "anonymous",
        actorId: null,
        expiresAt: grant.expiresAt,
        moderatorForBroadcasterIds: [],
        voterKey: grant.voterKey,
        participationModes: ["hosted-board"],
      },
    };
  }

  private async closeVoteIfDue(state: AuthoritativeSessionState): Promise<AuthoritativeSessionState> {
    if (
      state.questCycle.status !== "voting" ||
      state.questCycle.endsAt === null ||
      state.questCycle.endsAt > this.now() ||
      state.questCycle.envelope.questCycleId === null
    ) {
      return state;
    }
    const actor: VerifiedCommandActor = {
      kind: "system",
      actorId: "chatxpt-vote-close",
      expiresAt: null,
      moderatorForBroadcasterIds: [],
      voterKey: null,
      participationModes: [],
    };
    const result = await this.dependencies.runtime.execute(
      systemVoteCloseCommandSchema.parse({
        contractVersion: CONTRACT_VERSION,
        sessionId: state.session.sessionId,
        questCycleId: state.questCycle.envelope.questCycleId,
        commandId: `hosted-vote-close-${this.nextId()}`,
        correlationId: state.questCycle.envelope.correlationId,
        expectedRevision: state.session.revision,
        issuedAt: this.now(),
        actor: { kind: "system", actorId: actor.actorId },
        type: "system.vote-close",
      }),
      actor,
      new HostedBoardProjectionContext(this.persistence, actor, this.now),
    );
    if (result.ok) return result.receipt.state;
    if (result.error.code === "stale-revision") {
      return (await this.persistence.sessions.load(state.session.sessionId)) ?? state;
    }
    throw new HostedBoardApplicationError(
      "dependency-unavailable",
      result.error.message,
      result.error.retryable,
    );
  }

  private async projectViewer(authorized: AuthorizedHostedBoard): Promise<ViewerViewModel> {
    const state = await this.persistence.sessions.load(authorized.state.session.sessionId);
    if (state === null) {
      throw new HostedBoardApplicationError("session-not-found", "Hosted Quest Board session ended");
    }
    const context = await new HostedBoardProjectionContext(
      this.persistence,
      authorized.actor,
      this.now,
    ).resolve(state);
    const now = this.now();
    const viewer = viewerViewModelSchema.parse(new CanonicalViewProjector().project({
      envelope: {
        contractVersion: CONTRACT_VERSION,
        sessionId: state.session.sessionId,
        questCycleId: state.questCycle.envelope.questCycleId,
        messageId: `hosted-view-${this.nextId()}`,
        correlationId: `hosted-read-${this.nextId()}`,
        revision: state.session.revision,
        occurredAt: now,
        receivedAt: now,
        source: "viewer-board",
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
      viewerId: null,
      sessionPoints: context.sessionPoints,
      communityHype: state.communityHype,
      acceptedCandidateId: context.acceptedCandidateId,
      connection: context.connection,
      sessionOverride: state.sessionOverride,
    }).viewer);
    return viewerViewModelSchema.parse(
      viewer.questCycle.status === "voting" && viewer.acceptedCandidateId === null
        ? { ...viewer, questCycle: { ...viewer.questCycle, voteTallies: [] } }
        : viewer,
    );
  }
}

const applicationKey = Symbol.for("chatxpt.hostedBoardApplication.v1");
const globalApplication = globalThis as typeof globalThis & {
  [applicationKey]?: HostedBoardApplication;
};

export function getHostedBoardApplication(): HostedBoardApplication {
  if (globalApplication[applicationKey] !== undefined) return globalApplication[applicationKey];
  globalApplication[applicationKey] = new HostedBoardApplication({
    runtime: getChatXptServerRuntime(),
    secret: process.env.CHATXPT_HOSTED_BOARD_SECRET ?? "",
  });
  return globalApplication[applicationKey];
}
