import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { z } from "zod";

import { identifierSchema, timestampSchema } from "../../core";

const sessionOverlayGrantSchema = z
  .object({
    version: z.literal(1),
    grantId: identifierSchema,
    sessionId: identifierSchema,
    broadcasterId: identifierSchema,
    expiresAt: timestampSchema,
  })
  .strict();

const broadcasterOverlayGrantSchema = z
  .object({
    version: z.literal(2),
    grantId: identifierSchema,
    broadcasterId: identifierSchema,
    issuedAt: timestampSchema,
  })
  .strict();

const overlayGrantSchema = z.discriminatedUnion("version", [
  sessionOverlayGrantSchema,
  broadcasterOverlayGrantSchema,
]);

export type ObsOverlayGrant = z.infer<typeof overlayGrantSchema>;

export type ObsOverlayAuthErrorCode =
  | "misconfigured"
  | "unauthenticated"
  | "malformed-token"
  | "invalid-signature"
  | "expired-token";

export class ObsOverlayAuthError extends Error {
  constructor(readonly code: ObsOverlayAuthErrorCode, message: string) {
    super(message);
    this.name = "ObsOverlayAuthError";
  }
}

function validatedSecret(secret: string): Buffer {
  const value = secret.trim();
  if (value.length < 32) {
    throw new ObsOverlayAuthError(
      "misconfigured",
      "OBS overlay setup key must contain at least 32 characters",
    );
  }
  return Buffer.from(value, "utf8");
}

function equal(left: Buffer, right: Buffer): boolean {
  return left.length === right.length && timingSafeEqual(left, right);
}

function signature(payload: string, secret: Buffer): Buffer {
  return createHmac("sha256", secret)
    .update("chatxpt:obs-overlay:v1:")
    .update(payload)
    .digest();
}

/** Server-only authority for the read-only OBS Browser Source capability. */
export class ObsOverlayGrantAuthority {
  constructor(private readonly setupKey: string) {}

  authenticateSetupKey(supplied: string | null): void {
    const expected = validatedSecret(this.setupKey);
    const candidate = Buffer.from((supplied ?? "").trim(), "utf8");
    if (!equal(candidate, expected)) {
      throw new ObsOverlayAuthError("unauthenticated", "OBS overlay setup key is invalid");
    }
  }

  issue(input: ObsOverlayGrant): string {
    const secret = validatedSecret(this.setupKey);
    const grant = overlayGrantSchema.parse(input);
    const payload = Buffer.from(JSON.stringify(grant), "utf8").toString("base64url");
    return `${payload}.${signature(payload, secret).toString("base64url")}`;
  }

  verify(token: string, now = Date.now()): ObsOverlayGrant {
    const secret = validatedSecret(this.setupKey);
    const segments = token.trim().split(".");
    if (
      segments.length !== 2 ||
      segments.some((segment) => segment.length === 0 || !/^[A-Za-z0-9_-]+$/.test(segment))
    ) {
      throw new ObsOverlayAuthError("malformed-token", "OBS overlay grant is malformed");
    }
    const supplied = Buffer.from(segments[1], "base64url");
    const expected = signature(segments[0], secret);
    if (!equal(supplied, expected)) {
      throw new ObsOverlayAuthError("invalid-signature", "OBS overlay grant signature is invalid");
    }
    let payload: unknown;
    try {
      payload = JSON.parse(Buffer.from(segments[0], "base64url").toString("utf8")) as unknown;
    } catch {
      throw new ObsOverlayAuthError("malformed-token", "OBS overlay grant is malformed");
    }
    const parsed = overlayGrantSchema.safeParse(payload);
    if (!parsed.success) {
      throw new ObsOverlayAuthError("malformed-token", "OBS overlay grant is malformed");
    }
    if (parsed.data.version === 1 && parsed.data.expiresAt <= now) {
      throw new ObsOverlayAuthError("expired-token", "OBS overlay grant has expired");
    }
    return parsed.data;
  }
}

export function readObsOverlayBearerToken(header: string | null): string {
  const match = /^Bearer\s+([^\s]+)$/i.exec(header ?? "");
  if (match === null) {
    throw new ObsOverlayAuthError("unauthenticated", "OBS overlay bearer grant is required");
  }
  return match[1];
}
