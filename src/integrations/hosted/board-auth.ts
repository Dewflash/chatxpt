import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { z } from "zod";

import { identifierSchema, timestampSchema } from "../../core";

const hostedBoardGrantSchema = z
  .object({
    version: z.literal(1),
    grantId: identifierSchema,
    sessionId: identifierSchema,
    principalId: identifierSchema,
    voterKey: identifierSchema,
    roomCode: z.string().trim().min(1).max(32),
    expiresAt: timestampSchema,
  })
  .strict();

export type HostedBoardGrant = z.infer<typeof hostedBoardGrantSchema>;

export type HostedBoardAuthErrorCode =
  | "misconfigured"
  | "unauthenticated"
  | "malformed-token"
  | "invalid-signature"
  | "expired-token";

export class HostedBoardAuthError extends Error {
  constructor(readonly code: HostedBoardAuthErrorCode, message: string) {
    super(message);
    this.name = "HostedBoardAuthError";
  }
}

function validatedSecret(secret: string): Buffer {
  const value = secret.trim();
  if (value.length < 32) {
    throw new HostedBoardAuthError(
      "misconfigured",
      "Hosted Quest Board secret must contain at least 32 characters",
    );
  }
  return Buffer.from(value, "utf8");
}

function equal(left: Buffer, right: Buffer): boolean {
  return left.length === right.length && timingSafeEqual(left, right);
}

function signature(payload: string, secret: Buffer): Buffer {
  return createHmac("sha256", secret)
    .update("chatxpt:hosted-board:v1:")
    .update(payload)
    .digest();
}

/** Server-only anonymous participation authority for the hosted fallback board. */
export class HostedBoardGrantAuthority {
  constructor(private readonly secret: string) {}

  issue(input: HostedBoardGrant): string {
    const secret = validatedSecret(this.secret);
    const grant = hostedBoardGrantSchema.parse(input);
    const payload = Buffer.from(JSON.stringify(grant), "utf8").toString("base64url");
    return `${payload}.${signature(payload, secret).toString("base64url")}`;
  }

  verify(token: string, now = Date.now()): HostedBoardGrant {
    const secret = validatedSecret(this.secret);
    const segments = token.trim().split(".");
    if (
      segments.length !== 2 ||
      segments.some((segment) => segment.length === 0 || !/^[A-Za-z0-9_-]+$/.test(segment))
    ) {
      throw new HostedBoardAuthError("malformed-token", "Hosted Quest Board grant is malformed");
    }
    const supplied = Buffer.from(segments[1], "base64url");
    const expected = signature(segments[0], secret);
    if (!equal(supplied, expected)) {
      throw new HostedBoardAuthError(
        "invalid-signature",
        "Hosted Quest Board grant signature is invalid",
      );
    }
    let payload: unknown;
    try {
      payload = JSON.parse(Buffer.from(segments[0], "base64url").toString("utf8")) as unknown;
    } catch {
      throw new HostedBoardAuthError("malformed-token", "Hosted Quest Board grant is malformed");
    }
    const parsed = hostedBoardGrantSchema.safeParse(payload);
    if (!parsed.success) {
      throw new HostedBoardAuthError("malformed-token", "Hosted Quest Board grant is malformed");
    }
    if (parsed.data.expiresAt <= now) {
      throw new HostedBoardAuthError("expired-token", "Hosted Quest Board grant has expired");
    }
    return parsed.data;
  }
}
