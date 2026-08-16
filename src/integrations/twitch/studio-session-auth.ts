import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { z } from "zod";

import { identifierSchema, timestampSchema } from "../../core";

const studioSessionGrantSchema = z
  .object({
    version: z.literal(1),
    grantId: identifierSchema,
    sessionId: identifierSchema,
    broadcasterId: identifierSchema,
    expiresAt: timestampSchema,
  })
  .strict();

export type StudioSessionGrant = z.infer<typeof studioSessionGrantSchema>;

export class StudioSessionAuthError extends Error {
  constructor(
    readonly code: "misconfigured" | "unauthenticated" | "malformed-token" | "invalid-signature" | "expired-token",
    message: string,
  ) {
    super(message);
    this.name = "StudioSessionAuthError";
  }
}

function secretBytes(value: string): Buffer {
  const secret = value.trim();
  if (secret.length < 32) {
    throw new StudioSessionAuthError(
      "misconfigured",
      "Studio setup key must contain at least 32 characters",
    );
  }
  return Buffer.from(secret, "utf8");
}

function equal(left: Buffer, right: Buffer): boolean {
  return left.length === right.length && timingSafeEqual(left, right);
}

function sign(payload: string, secret: Buffer): Buffer {
  return createHmac("sha256", secret)
    .update("chatxpt:studio-session:v1:")
    .update(payload)
    .digest();
}

/** Server-only authority for the manual broadcaster bootstrap in D-065. */
export class StudioSessionGrantAuthority {
  constructor(private readonly setupKey: string) {}

  authenticateSetupKey(supplied: string | null): void {
    const expected = secretBytes(this.setupKey);
    const candidate = Buffer.from((supplied ?? "").trim(), "utf8");
    if (!equal(candidate, expected)) {
      throw new StudioSessionAuthError("unauthenticated", "Studio setup key is invalid");
    }
  }

  issue(input: StudioSessionGrant): string {
    const secret = secretBytes(this.setupKey);
    const grant = studioSessionGrantSchema.parse(input);
    const payload = Buffer.from(JSON.stringify(grant), "utf8").toString("base64url");
    return `${payload}.${sign(payload, secret).toString("base64url")}`;
  }

  verify(token: string, now = Date.now()): StudioSessionGrant {
    const secret = secretBytes(this.setupKey);
    const segments = token.trim().split(".");
    if (
      segments.length !== 2 ||
      segments.some((segment) => segment.length === 0 || !/^[A-Za-z0-9_-]+$/.test(segment))
    ) {
      throw new StudioSessionAuthError("malformed-token", "Studio session grant is malformed");
    }
    const supplied = Buffer.from(segments[1], "base64url");
    const expected = sign(segments[0], secret);
    if (!equal(supplied, expected)) {
      throw new StudioSessionAuthError("invalid-signature", "Studio session grant signature is invalid");
    }
    let payload: unknown;
    try {
      payload = JSON.parse(Buffer.from(segments[0], "base64url").toString("utf8")) as unknown;
    } catch {
      throw new StudioSessionAuthError("malformed-token", "Studio session grant is malformed");
    }
    const parsed = studioSessionGrantSchema.safeParse(payload);
    if (!parsed.success) {
      throw new StudioSessionAuthError("malformed-token", "Studio session grant is malformed");
    }
    if (parsed.data.expiresAt <= now) {
      throw new StudioSessionAuthError("expired-token", "Studio session grant has expired");
    }
    return parsed.data;
  }
}
