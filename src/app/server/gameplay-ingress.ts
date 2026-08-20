import "server-only";

import { randomUUID } from "node:crypto";

import { z } from "zod";

import {
  gameplaySnapshotSchema,
  identifierSchema,
  serviceHealthSchema,
  type AuthoritativeSessionState,
  type GameplaySnapshot,
  type IngestGameplaySnapshotResult,
  type ProjectionContextResolver,
} from "@/core";
import {
  GameplayIngressAuthError,
  GameplayIngressGrantAuthority,
  readGameplayIngressBearerToken,
} from "@/integrations/server";
import type { ChatXptPersistenceRuntime } from "@/realtime";

import { getChatXptServerRuntime, type ChatXptServerRuntime } from "./runtime";

const grantRequestSchema = z.object({ sessionId: identifierSchema }).strict();

const GRANT_TTL_MS = 10 * 60 * 1_000;
const MAX_SNAPSHOT_AGE_MS = 15_000;
const MAX_CLOCK_LEAD_MS = 5_000;
const MINIMUM_NEW_SNAPSHOT_INTERVAL_MS = 90;

export interface GameplayIngressAuthoritySnapshot {
  readonly sessionId: string;
  readonly broadcasterId: string;
  readonly questCycleId: string | null;
  readonly revision: number;
  readonly evidenceClass: GameplaySnapshot["envelope"]["evidenceClass"];
}

export type GameplayIngressApplicationErrorCode =
  | "misconfigured"
  | "unauthenticated"
  | "forbidden"
  | "expired"
  | "session-not-found"
  | "session-inactive"
  | "validation"
  | "rate-limited"
  | "dependency-unavailable";

export class GameplayIngressApplicationError extends Error {
  constructor(
    readonly code: GameplayIngressApplicationErrorCode,
    message: string,
    readonly retryable = false,
  ) {
    super(message);
    this.name = "GameplayIngressApplicationError";
  }
}

export interface GameplayIngressApplicationDependencies {
  readonly persistence: ChatXptPersistenceRuntime;
  readonly runtime?: Pick<
    ChatXptServerRuntime,
    "requestEligibleCycleProposal" | "requestLiveDirectorContextRefresh"
  >;
  readonly setupKey: string;
  readonly now?: () => number;
  readonly nextId?: () => string;
}

export interface GameplayIngressGrantResult {
  readonly token: string;
  readonly expiresAt: number;
  readonly authority: GameplayIngressAuthoritySnapshot;
}

export interface GameplayIngressResult {
  readonly result: IngestGameplaySnapshotResult;
  readonly authority: GameplayIngressAuthoritySnapshot;
  readonly liveDirector: GameplayIngressLiveDirectorResult;
  readonly proposal: GameplayIngressProposalResult;
}

export type GameplayIngressLiveDirectorResult =
  | {
      readonly status: "not-requested";
      readonly reason:
        | "duplicate-snapshot"
        | "rejected-snapshot"
        | "runtime-unavailable"
        | "proposal-submitted";
    }
  | { readonly status: "submitted" | "duplicate" }
  | { readonly status: "failed"; readonly message: string; readonly retryable: boolean };

export type GameplayIngressProposalResult =
  | { readonly status: "not-requested"; readonly reason: "duplicate-snapshot" | "rejected-snapshot" | "preparing-session" | "runtime-unavailable" }
  | { readonly status: "not-eligible" }
  | { readonly status: "submitted" | "duplicate" }
  | { readonly status: "failed"; readonly message: string; readonly retryable: boolean };

class GameplayIngressProjectionContext implements ProjectionContextResolver {
  constructor(private readonly now: () => number) {}

  resolve() {
    return {
      participationMode: "unavailable" as const,
      viewerId: null,
      sessionPoints: 0,
      acceptedCandidateId: null,
      connection: serviceHealthSchema.parse({
        service: "gameplay-capture",
        status: "ready",
        checkedAt: this.now(),
        message: "Accepted gameplay snapshot triggered authoritative projection",
        retryable: false,
      }),
    };
  }
}

function active(state: AuthoritativeSessionState): boolean {
  return state.session.status === "preparing" || state.session.status === "live";
}

function authoritySnapshot(state: AuthoritativeSessionState): GameplayIngressAuthoritySnapshot {
  return {
    sessionId: state.session.sessionId,
    broadcasterId: state.session.broadcasterId,
    questCycleId: state.questCycle.envelope.questCycleId,
    revision: state.session.revision,
    evidenceClass: state.questCycle.envelope.evidenceClass,
  };
}

function authApplicationError(caught: unknown): GameplayIngressApplicationError {
  if (caught instanceof GameplayIngressAuthError) {
    if (caught.code === "misconfigured") {
      return new GameplayIngressApplicationError("misconfigured", caught.message);
    }
    if (caught.code === "expired-token") {
      return new GameplayIngressApplicationError("expired", caught.message);
    }
    return new GameplayIngressApplicationError("unauthenticated", caught.message);
  }
  return new GameplayIngressApplicationError(
    "dependency-unavailable",
    "Gameplay ingress authorization is unavailable",
    true,
  );
}

export class GameplayIngressApplication {
  private readonly persistence: ChatXptPersistenceRuntime;
  private readonly grants: GameplayIngressGrantAuthority;
  private readonly runtime?: Pick<
    ChatXptServerRuntime,
    "requestEligibleCycleProposal" | "requestLiveDirectorContextRefresh"
  >;
  private readonly now: () => number;
  private readonly nextId: () => string;
  private readonly recentByGrant = new Map<
    string,
    { messageId: string; acceptedAt: number; expiresAt: number }
  >();

  constructor(dependencies: GameplayIngressApplicationDependencies) {
    this.persistence = dependencies.persistence;
    this.runtime = dependencies.runtime;
    this.grants = new GameplayIngressGrantAuthority(dependencies.setupKey);
    this.now = dependencies.now ?? Date.now;
    this.nextId = dependencies.nextId ?? randomUUID;
  }

  async issueGrant(setupKey: string | null, input: unknown): Promise<GameplayIngressGrantResult> {
    try {
      this.grants.authenticateSetupKey(setupKey);
    } catch (caught) {
      throw authApplicationError(caught);
    }
    const parsed = grantRequestSchema.safeParse(input);
    if (!parsed.success) {
      throw new GameplayIngressApplicationError("validation", "Gameplay ingress grant is invalid");
    }
    const state = await this.loadActiveSession(parsed.data.sessionId);
    const expiresAt = this.now() + GRANT_TTL_MS;
    return {
      token: this.grants.issue({
        version: 1,
        grantId: `capture-${this.nextId()}`,
        sessionId: state.session.sessionId,
        broadcasterId: state.session.broadcasterId,
        expiresAt,
      }),
      expiresAt,
      authority: authoritySnapshot(state),
    };
  }

  async readAuthority(authorizationHeader: string | null): Promise<GameplayIngressAuthoritySnapshot> {
    const { state } = await this.authorize(authorizationHeader);
    return authoritySnapshot(state);
  }

  async ingest(
    authorizationHeader: string | null,
    input: unknown,
  ): Promise<GameplayIngressResult> {
    const { grant, state } = await this.authorize(authorizationHeader);
    const parsed = gameplaySnapshotSchema.safeParse(input);
    if (!parsed.success) {
      throw new GameplayIngressApplicationError("validation", "Gameplay snapshot is invalid");
    }
    const snapshot = parsed.data;
    if (snapshot.envelope.sessionId !== grant.sessionId) {
      throw new GameplayIngressApplicationError(
        "forbidden",
        "Gameplay snapshot does not belong to this capture grant",
      );
    }
    if (
      snapshot.envelope.source !== "obs-virtual-camera" ||
      snapshot.envelope.evidenceClass === "fixture"
    ) {
      throw new GameplayIngressApplicationError(
        "validation",
        "Gameplay ingress accepts only real or diagnostic OBS Virtual Camera snapshots",
      );
    }
    const now = this.now();
    if (
      snapshot.envelope.occurredAt < now - MAX_SNAPSHOT_AGE_MS ||
      snapshot.envelope.occurredAt > now + MAX_CLOCK_LEAD_MS
    ) {
      throw new GameplayIngressApplicationError(
        "validation",
        "Gameplay snapshot timestamp is outside the live capture window",
      );
    }
    const recent = this.recentByGrant.get(grant.grantId);
    if (
      recent !== undefined &&
      recent.messageId !== snapshot.envelope.messageId &&
      now - recent.acceptedAt < MINIMUM_NEW_SNAPSHOT_INTERVAL_MS
    ) {
      throw new GameplayIngressApplicationError(
        "rate-limited",
        "Gameplay snapshots exceed the supported 10 FPS burst cadence",
        true,
      );
    }

    let result: IngestGameplaySnapshotResult;
    try {
      result = await this.persistence.gameplaySnapshots.ingest(snapshot);
    } catch {
      throw new GameplayIngressApplicationError(
        "dependency-unavailable",
        "Gameplay snapshot persistence is unavailable",
        true,
      );
    }
    if (result.status === "accepted" || result.status === "duplicate") {
      for (const [grantId, recentGrant] of this.recentByGrant) {
        if (recentGrant.expiresAt <= now) this.recentByGrant.delete(grantId);
      }
      if (!this.recentByGrant.has(grant.grantId) && this.recentByGrant.size >= 256) {
        const oldestGrantId = this.recentByGrant.keys().next().value as string | undefined;
        if (oldestGrantId !== undefined) this.recentByGrant.delete(oldestGrantId);
      }
      this.recentByGrant.set(grant.grantId, {
        messageId: result.snapshot.envelope.messageId,
        acceptedAt: now,
        expiresAt: grant.expiresAt,
      });
    }
    const proposal = await this.maybeRequestEligibleCycleProposal(state, result);
    const liveDirector =
      proposal.status === "submitted" || proposal.status === "duplicate"
        ? { status: "not-requested" as const, reason: "proposal-submitted" as const }
        : await this.maybeRefreshLiveDirectorContext(state, result);
    const latestState =
      (result.status === "rejected" && result.reason === "state-mismatch") ||
      proposal.status === "submitted" ||
      proposal.status === "duplicate" ||
      liveDirector.status === "submitted" ||
      liveDirector.status === "duplicate"
        ? await this.loadActiveSession(grant.sessionId)
        : state;
    return { result, authority: authoritySnapshot(latestState), liveDirector, proposal };
  }

  private async maybeRefreshLiveDirectorContext(
    state: AuthoritativeSessionState,
    result: IngestGameplaySnapshotResult,
  ): Promise<GameplayIngressLiveDirectorResult> {
    if (result.status === "rejected") return { status: "not-requested", reason: "rejected-snapshot" };
    if (result.status === "duplicate") return { status: "not-requested", reason: "duplicate-snapshot" };
    if (this.runtime === undefined) return { status: "not-requested", reason: "runtime-unavailable" };
    let refresh: Awaited<ReturnType<ChatXptServerRuntime["requestLiveDirectorContextRefresh"]>>;
    try {
      refresh = await this.runtime.requestLiveDirectorContextRefresh(
        { ...state, gameplay: result.snapshot },
        new GameplayIngressProjectionContext(this.now),
      );
    } catch {
      return {
        status: "failed",
        message: "Live Director context refresh runtime failed",
        retryable: true,
      };
    }
    if (!refresh.ok) {
      return {
        status: "failed",
        message: refresh.error.message,
        retryable: refresh.error.retryable,
      };
    }
    return { status: refresh.outcome === "duplicate" ? "duplicate" : "submitted" };
  }

  private async maybeRequestEligibleCycleProposal(
    state: AuthoritativeSessionState,
    result: IngestGameplaySnapshotResult,
  ): Promise<GameplayIngressProposalResult> {
    if (result.status === "rejected") return { status: "not-requested", reason: "rejected-snapshot" };
    if (result.status === "duplicate") return { status: "not-requested", reason: "duplicate-snapshot" };
    if (state.session.status !== "live") return { status: "not-requested", reason: "preparing-session" };
    if (this.runtime === undefined) return { status: "not-requested", reason: "runtime-unavailable" };
    let proposal: Awaited<ReturnType<ChatXptServerRuntime["requestEligibleCycleProposal"]>>;
    try {
      proposal = await this.runtime.requestEligibleCycleProposal(
        { ...state, gameplay: result.snapshot },
        new GameplayIngressProjectionContext(this.now),
      );
    } catch {
      return {
        status: "failed",
        message: "Eligible-cycle proposal runtime failed",
        retryable: true,
      };
    }
    if (!proposal.ok) {
      return {
        status: "failed",
        message: proposal.error.message,
        retryable: proposal.error.retryable,
      };
    }
    if (proposal.outcome === "not-eligible") return { status: "not-eligible" };
    return { status: proposal.outcome === "duplicate" ? "duplicate" : "submitted" };
  }

  private async authorize(authorizationHeader: string | null) {
    let grant;
    try {
      grant = this.grants.verify(
        readGameplayIngressBearerToken(authorizationHeader),
        this.now(),
      );
    } catch (caught) {
      throw authApplicationError(caught);
    }
    const state = await this.loadActiveSession(grant.sessionId);
    if (state.session.broadcasterId !== grant.broadcasterId) {
      throw new GameplayIngressApplicationError(
        "forbidden",
        "Gameplay ingress grant no longer belongs to this broadcaster",
      );
    }
    return { grant, state };
  }

  private async loadActiveSession(sessionId: string): Promise<AuthoritativeSessionState> {
    let state;
    try {
      state = await this.persistence.sessions.load(sessionId);
    } catch {
      throw new GameplayIngressApplicationError(
        "dependency-unavailable",
        "Gameplay ingress session lookup is unavailable",
        true,
      );
    }
    if (state === null) {
      throw new GameplayIngressApplicationError("session-not-found", "ChatXPT session was not found");
    }
    if (!active(state)) {
      throw new GameplayIngressApplicationError(
        "session-inactive",
        "ChatXPT session is not accepting gameplay snapshots",
      );
    }
    return state;
  }
}

const applicationKey = Symbol.for("chatxpt.gameplayIngressApplication.v1");
const globalApplication = globalThis as typeof globalThis & {
  [applicationKey]?: GameplayIngressApplication;
};

export function getGameplayIngressApplication(): GameplayIngressApplication {
  if (globalApplication[applicationKey] !== undefined) return globalApplication[applicationKey];
  const runtime = getChatXptServerRuntime();
  globalApplication[applicationKey] = new GameplayIngressApplication({
    persistence: runtime.persistence,
    runtime,
    setupKey: process.env.CHATXPT_GAMEPLAY_INGRESS_SETUP_KEY ?? "",
  });
  return globalApplication[applicationKey];
}
