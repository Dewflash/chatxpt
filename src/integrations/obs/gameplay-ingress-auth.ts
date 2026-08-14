import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { z } from "zod";

import { identifierSchema, timestampSchema } from "../../core";

const gameplayIngressGrantSchema = z
  .object({
    version: z.literal(1),
    grantId: identifierSchema,
    sessionId: identifierSchema,
    broadcasterId: identifierSchema,
    expiresAt: timestampSchema,
  })
  .strict();

export type GameplayIngressGrant = z.infer<typeof gameplayIngressGrantSchema>;

export type GameplayIngressAuthErrorCode =
  | "misconfigured"
  | "unauthenticated"
  | "malformed-token"
  | "invalid-signature"
  | "expired-token";

export class GameplayIngressAuthError extends Error {
  constructor(
    readonly code: GameplayIngressAuthErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "GameplayIngressAuthError";
  }
}

function validatedSecret(secret: string): Buffer {
  const value = secret.trim();
  if (value.length < 32) {
    throw new GameplayIngressAuthError(
      "misconfigured",
      "Gameplay ingress setup key is not configured securely",
    );
  }
  return Buffer.from(value, "utf8");
}

function equal(left: Buffer, right: Buffer): boolean {
  return left.length === right.length && timingSafeEqual(left, right);
}

function signature(payloadSegment: string, secret: Buffer): Buffer {
  return createHmac("sha256", secret)
    .update("chatxpt:gameplay-ingress:v1:")
    .update(payloadSegment)
    .digest();
}

/** Server-only bootstrap authority for an ephemeral, session-scoped capture grant. */
export class GameplayIngressGrantAuthority {
  constructor(private readonly setupKey: string) {}

  authenticateSetupKey(supplied: string | null): void {
    const expected = validatedSecret(this.setupKey);
    const candidate = Buffer.from((supplied ?? "").trim(), "utf8");
    if (!equal(candidate, expected)) {
      throw new GameplayIngressAuthError(
        "unauthenticated",
        "Gameplay ingress setup key is invalid",
      );
    }
  }

  issue(input: GameplayIngressGrant): string {
    const secret = validatedSecret(this.setupKey);
    const grant = gameplayIngressGrantSchema.parse(input);
    const payloadSegment = Buffer.from(JSON.stringify(grant), "utf8").toString("base64url");
    return `${payloadSegment}.${signature(payloadSegment, secret).toString("base64url")}`;
  }

  verify(token: string, now = Date.now()): GameplayIngressGrant {
    const secret = validatedSecret(this.setupKey);
    const segments = token.trim().split(".");
    if (
      segments.length !== 2 ||
      segments.some((segment) => segment.length === 0 || !/^[A-Za-z0-9_-]+$/.test(segment))
    ) {
      throw new GameplayIngressAuthError("malformed-token", "Gameplay ingress grant is malformed");
    }

    const suppliedSignature = Buffer.from(segments[1], "base64url");
    const expectedSignature = signature(segments[0], secret);
    if (!equal(suppliedSignature, expectedSignature)) {
      throw new GameplayIngressAuthError(
        "invalid-signature",
        "Gameplay ingress grant signature is invalid",
      );
    }

    let payload: unknown;
    try {
      payload = JSON.parse(Buffer.from(segments[0], "base64url").toString("utf8")) as unknown;
    } catch {
      throw new GameplayIngressAuthError("malformed-token", "Gameplay ingress grant is malformed");
    }
    const parsed = gameplayIngressGrantSchema.safeParse(payload);
    if (!parsed.success) {
      throw new GameplayIngressAuthError("malformed-token", "Gameplay ingress grant is malformed");
    }
    if (parsed.data.expiresAt <= now) {
      throw new GameplayIngressAuthError("expired-token", "Gameplay ingress grant has expired");
    }
    return parsed.data;
  }
}

export function readGameplayIngressBearerToken(header: string | null): string {
  const match = /^Bearer\s+([^\s]+)$/i.exec(header ?? "");
  if (match === null) {
    throw new GameplayIngressAuthError(
      "unauthenticated",
      "Gameplay ingress bearer grant is required",
    );
  }
  return match[1];
}
