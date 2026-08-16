import "server-only";

import { randomUUID } from "node:crypto";

import { z } from "zod";

import {
  CONTRACT_VERSION,
  CanonicalViewProjector,
  identifierSchema,
  overlayViewModelSchema,
  serviceHealthSchema,
  type AuthoritativeSessionState,
  type OverlayViewModel,
} from "@/core";
import {
  createObsBrowserSourceDescriptor,
  type ObsBrowserSourceDescriptor,
} from "@/integrations";
import {
  ObsOverlayAuthError,
  ObsOverlayGrantAuthority,
  readObsOverlayBearerToken,
} from "@/integrations/server";
import type { ChatXptPersistenceRuntime } from "@/realtime";

import { getChatXptServerRuntime } from "./runtime";

const grantRequestSchema = z
  .object({
    sessionId: identifierSchema,
    width: z.number().int().positive().max(7680).optional(),
    height: z.number().int().positive().max(4320).optional(),
  })
  .strict();

const GRANT_TTL_MS = 12 * 60 * 60 * 1_000;

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
  readonly persistence: ChatXptPersistenceRuntime;
  readonly setupKey: string;
  readonly now?: () => number;
  readonly nextId?: () => string;
}

export interface ObsOverlayGrantResult {
  readonly descriptor: ObsBrowserSourceDescriptor;
  readonly expiresAt: number;
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
  private readonly grants: ObsOverlayGrantAuthority;
  private readonly now: () => number;
  private readonly nextId: () => string;

  constructor(private readonly dependencies: ObsOverlayApplicationDependencies) {
    this.grants = new ObsOverlayGrantAuthority(dependencies.setupKey);
    this.now = dependencies.now ?? Date.now;
    this.nextId = dependencies.nextId ?? randomUUID;
  }

  async issueGrant(
    setupKey: string | null,
    baseUrl: string,
    input: unknown,
  ): Promise<ObsOverlayGrantResult> {
    try {
      this.grants.authenticateSetupKey(setupKey);
    } catch (caught) {
      throw authError(caught);
    }
    const parsed = grantRequestSchema.safeParse(input);
    if (!parsed.success) {
      throw new ObsOverlayApplicationError("validation", "OBS Browser Source setup is invalid");
    }
    const state = await this.loadSession(parsed.data.sessionId);
    if (state.session.status !== "preparing" && state.session.status !== "live") {
      throw new ObsOverlayApplicationError(
        "session-inactive",
        "OBS Browser Source grants require an active broadcaster session",
      );
    }
    const expiresAt = this.now() + GRANT_TTL_MS;
    const token = this.grants.issue({
      version: 1,
      grantId: `overlay-${this.nextId()}`,
      sessionId: state.session.sessionId,
      broadcasterId: state.session.broadcasterId,
      expiresAt,
    });
    try {
      return {
        descriptor: createObsBrowserSourceDescriptor({
          baseUrl,
          sessionId: state.session.sessionId,
          accessToken: token,
          width: parsed.data.width,
          height: parsed.data.height,
        }),
        expiresAt,
      };
    } catch (caught) {
      throw new ObsOverlayApplicationError(
        "validation",
        caught instanceof Error ? caught.message : "OBS Browser Source URL is invalid",
      );
    }
  }

  async read(
    authorizationHeader: string | null,
    requestedSessionId: string | null,
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
    const parsedSessionId = identifierSchema.safeParse(requestedSessionId);
    if (!parsedSessionId.success || parsedSessionId.data !== grant.sessionId) {
      throw new ObsOverlayApplicationError(
        "forbidden",
        "OBS overlay grant does not belong to the requested session",
      );
    }
    const state = await this.loadSession(grant.sessionId);
    if (state.session.broadcasterId !== grant.broadcasterId) {
      throw new ObsOverlayApplicationError(
        "forbidden",
        "OBS overlay grant no longer belongs to this broadcaster",
      );
    }
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
    });
    return overlayViewModelSchema.parse(projected.overlay);
  }

  private async loadSession(sessionId: string): Promise<AuthoritativeSessionState> {
    let state;
    try {
      state = await this.dependencies.persistence.sessions.load(sessionId);
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
}

const applicationKey = Symbol.for("chatxpt.obsOverlayApplication.v1");
const globalApplication = globalThis as typeof globalThis & {
  [applicationKey]?: ObsOverlayApplication;
};

export function getObsOverlayApplication(): ObsOverlayApplication {
  if (globalApplication[applicationKey] !== undefined) return globalApplication[applicationKey];
  globalApplication[applicationKey] = new ObsOverlayApplication({
    persistence: getChatXptServerRuntime().persistence,
    setupKey: process.env.CHATXPT_OBS_OVERLAY_SETUP_KEY ?? "",
  });
  return globalApplication[applicationKey];
}
