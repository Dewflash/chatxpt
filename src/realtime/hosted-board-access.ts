import "server-only";

import { z } from "zod";

import {
  domainErrorSchema,
  fallbackRoomCodeSchema,
  hostedBoardAccessViewSchema,
  type DomainError,
  type HostedBoardAccessView,
} from "../core";
import type { HostedSessionLookup, RealtimeAccessGrantStore } from "./types";

const DEFAULT_GRANT_TTL_MS = 60 * 60 * 1_000;
const COOKIE_NAME = "chatxpt_hosted_viewer";

const grantPayloadSchema = z
  .object({
    version: z.literal(1),
    grantId: z.uuid(),
    principalId: z.uuid(),
    sessionId: z.string().trim().min(1).max(128),
    actorKind: z.enum(["viewer", "anonymous"]),
    issuedAt: z.number().int().nonnegative(),
    expiresAt: z.number().int().nonnegative(),
  })
  .strict()
  .superRefine((payload, context) => {
    if (payload.expiresAt <= payload.issuedAt) {
      context.addIssue({
        code: "custom",
        message: "Hosted-board grants must expire after issuance",
        path: ["expiresAt"],
      });
    }
  });

type HostedBoardGrantPayload = z.infer<typeof grantPayloadSchema>;

export interface HostedBoardAuthenticatedIdentity {
  readonly kind: "viewer";
  /** Supplied only by a server-side Twitch identity verifier, never request JSON. */
  readonly externalViewerId: string;
}

export interface HostedBoardCredential {
  readonly cookieName: typeof COOKIE_NAME;
  readonly value: string;
  readonly httpOnly: true;
  readonly sameSite: "lax";
  readonly secure: boolean;
  readonly path: "/";
  readonly expiresAt: number;
}

export interface HostedBoardGrantIdentity {
  readonly principalId: string;
  readonly sessionId: string;
  readonly actorKind: "viewer" | "anonymous";
  readonly expiresAt: number;
}

export type HostedBoardExchangeResult =
  | {
      readonly ok: true;
      readonly view: HostedBoardAccessView;
      readonly credential: HostedBoardCredential;
    }
  | { readonly ok: false; readonly error: DomainError };

function failure(
  code: DomainError["code"],
  message: string,
  retryable = false,
): HostedBoardExchangeResult {
  return { ok: false, error: domainErrorSchema.parse({ code, message, retryable }) };
}

function encodeBase64Url(value: Uint8Array): string {
  return Buffer.from(value).toString("base64url");
}

function decodeBase64Url(value: string): Uint8Array | null {
  try {
    return new Uint8Array(Buffer.from(value, "base64url"));
  } catch {
    return null;
  }
}

function exactArrayBuffer(value: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(new ArrayBuffer(value.byteLength));
  copy.set(value);
  return copy.buffer;
}

export class HostedBoardGrantCodec {
  private readonly key: Promise<CryptoKey>;

  constructor(secret: Uint8Array) {
    if (secret.byteLength < 32) {
      throw new Error("Hosted-board grant secrets must contain at least 32 bytes");
    }
    this.key = crypto.subtle.importKey(
      "raw",
      exactArrayBuffer(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign", "verify"],
    );
  }

  async issue(payload: HostedBoardGrantPayload): Promise<string> {
    const parsed = grantPayloadSchema.parse(payload);
    const encodedPayload = new TextEncoder().encode(JSON.stringify(parsed));
    const signature = await crypto.subtle.sign(
      "HMAC",
      await this.key,
      exactArrayBuffer(encodedPayload),
    );
    return `${encodeBase64Url(encodedPayload)}.${encodeBase64Url(new Uint8Array(signature))}`;
  }

  async verify(token: string, at: number): Promise<HostedBoardGrantPayload | null> {
    if (token.length === 0 || token.length > 4_096) return null;
    const [payloadPart, signaturePart, extra] = token.split(".");
    if (payloadPart === undefined || signaturePart === undefined || extra !== undefined) return null;
    const payload = decodeBase64Url(payloadPart);
    const signature = decodeBase64Url(signaturePart);
    if (payload === null || signature === null) return null;
    const valid = await crypto.subtle.verify(
      "HMAC",
      await this.key,
      exactArrayBuffer(signature),
      exactArrayBuffer(payload),
    );
    if (!valid) return null;
    try {
      const parsed = grantPayloadSchema.parse(JSON.parse(new TextDecoder().decode(payload)));
      return parsed.expiresAt > at ? parsed : null;
    } catch {
      return null;
    }
  }
}

function canonicalRoomCode(raw: string): string | null {
  const roomCode = raw.trim().toUpperCase();
  return fallbackRoomCodeSchema.safeParse(roomCode).success ? roomCode : null;
}

function safeShareUrl(origin: string, roomCode: string): string | null {
  try {
    const source = new URL(origin);
    if (source.protocol !== "http:" && source.protocol !== "https:") return null;
    const target = new URL(`/quest-board/${roomCode}`, source.origin);
    return target.toString();
  } catch {
    return null;
  }
}

export class HostedBoardAccessService {
  constructor(
    private readonly sessions: HostedSessionLookup,
    private readonly accessGrants: RealtimeAccessGrantStore,
    private readonly codec: HostedBoardGrantCodec,
    private readonly now: () => number = Date.now,
    private readonly grantTtlMs = DEFAULT_GRANT_TTL_MS,
  ) {
    if (!Number.isSafeInteger(grantTtlMs) || grantTtlMs <= 0) {
      throw new Error("Hosted-board grant lifetime must be a positive integer");
    }
  }

  async exchange(input: {
    readonly roomCode: string;
    /** Trusted deployment origin from server configuration, never a client-supplied redirect. */
    readonly trustedShareOrigin: string;
    readonly includeQr?: boolean;
    /** This must already have been verified server-side; request JSON is not an identity. */
    readonly verifiedIdentity?: HostedBoardAuthenticatedIdentity;
  }): Promise<HostedBoardExchangeResult> {
    const roomCode = canonicalRoomCode(input.roomCode);
    if (roomCode === null) return failure("validation", "Room code is invalid");
    const shareUrl = safeShareUrl(input.trustedShareOrigin, roomCode);
    if (shareUrl === null) return failure("validation", "Hosted-board share origin is invalid");

    let state;
    try {
      state = await this.sessions.findByRoomCode(roomCode);
    } catch {
      return failure("dependency-unavailable", "Room lookup is temporarily unavailable", true);
    }
    if (state === null) return failure("expired", "Room does not exist or has expired");
    if (state.session.status === "offline" || state.session.status === "ended") {
      return failure("expired", "This stream session has ended");
    }
    if (!state.session.capabilities.hostedViewerBoard) {
      return failure("unavailable-capability", "Hosted viewer access is unavailable for this stream");
    }

    const actorKind = input.verifiedIdentity === undefined ? "anonymous" : "viewer";
    if (
      input.verifiedIdentity !== undefined &&
      input.verifiedIdentity.externalViewerId.trim().length === 0
    ) {
      return failure("unauthenticated", "Authenticated viewer identity is invalid");
    }
    if (actorKind === "anonymous" && !state.session.capabilities.anonymousParticipation) {
      return failure("forbidden", "Anonymous hosted-board access is disabled for this stream");
    }
    if (actorKind === "viewer" && !state.session.capabilities.twitchIdentity) {
      return failure("unavailable-capability", "Authenticated Twitch viewer access is unavailable");
    }

    const issuedAt = this.now();
    const expiresAt = issuedAt + this.grantTtlMs;
    const principalId = crypto.randomUUID();
    const payload = grantPayloadSchema.parse({
      version: 1,
      grantId: crypto.randomUUID(),
      principalId,
      sessionId: state.session.sessionId,
      actorKind,
      issuedAt,
      expiresAt,
    });

    try {
      const value = await this.codec.issue(payload);
      await this.accessGrants.grant({
        principalId,
        sessionId: state.session.sessionId,
        viewRole: "viewer",
        expiresAt,
      });
      return {
        ok: true,
        view: hostedBoardAccessViewSchema.parse({
          sessionId: state.session.sessionId,
          revision: state.session.revision,
          roomCode,
          participationMode: "hosted-board",
          actorKind,
          expiresAt,
          share: {
            roomCode,
            shareUrl,
            qrPayload: input.includeQr === true ? shareUrl : null,
          },
        }),
        credential: {
          cookieName: COOKIE_NAME,
          value,
          httpOnly: true,
          sameSite: "lax",
          secure: new URL(shareUrl).protocol === "https:",
          path: "/",
          expiresAt,
        },
      };
    } catch {
      return failure("dependency-unavailable", "Hosted-board access could not be issued", true);
    }
  }

  async authenticate(token: string): Promise<HostedBoardGrantIdentity | null> {
    const at = this.now();
    const payload = await this.codec.verify(token, at);
    if (payload === null) return null;
    try {
      const state = await this.sessions.loadSession(payload.sessionId);
      if (
        state === null ||
        state.session.status === "offline" ||
        state.session.status === "ended" ||
        !state.session.capabilities.hostedViewerBoard
      ) {
        return null;
      }
      const permitted = await this.accessGrants.canRead(
        payload.principalId,
        payload.sessionId,
        "viewer",
        at,
      );
      return permitted
        ? {
            principalId: payload.principalId,
            sessionId: payload.sessionId,
            actorKind: payload.actorKind,
            expiresAt: payload.expiresAt,
          }
        : null;
    } catch {
      return null;
    }
  }
}
