import { createHmac, timingSafeEqual } from "node:crypto";

import { z } from "zod";

const jwtHeaderSchema = z
  .object({
    alg: z.literal("HS256"),
    typ: z.string().optional(),
  })
  .passthrough();

const jwtPayloadSchema = z
  .object({
    channel_id: z.string().trim().min(1).max(128),
    exp: z.number().int().positive(),
    opaque_user_id: z.string().trim().min(2).max(128),
    role: z.enum(["broadcaster", "moderator", "viewer", "external"]),
    user_id: z.string().trim().min(1).max(128).optional(),
  })
  .passthrough();

export type TwitchExtensionAuthErrorCode =
  | "missing-token"
  | "misconfigured-secret"
  | "malformed-token"
  | "invalid-signature"
  | "expired-token"
  | "invalid-role"
  | "invalid-identity";

export class TwitchExtensionAuthError extends Error {
  constructor(
    readonly code: TwitchExtensionAuthErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "TwitchExtensionAuthError";
  }
}

export interface TwitchExtensionAuthorization {
  readonly channelId: string;
  readonly expiresAt: number;
  readonly role: "broadcaster" | "moderator" | "viewer";
  readonly participantSubject: string;
  readonly actorKind: "viewer" | "anonymous";
  readonly actorId: string | null;
}

function decodeSegment(segment: string): unknown {
  try {
    return JSON.parse(Buffer.from(segment, "base64url").toString("utf8")) as unknown;
  } catch {
    throw new TwitchExtensionAuthError("malformed-token", "Twitch authorization token is malformed");
  }
}

function decodeExtensionSecret(secret: string): Buffer {
  if (secret.trim().length === 0) {
    throw new TwitchExtensionAuthError(
      "misconfigured-secret",
      "Twitch Extension secret is not configured",
    );
  }
  const decoded = Buffer.from(secret.trim(), "base64");
  if (decoded.length < 16) {
    throw new TwitchExtensionAuthError(
      "misconfigured-secret",
      "Twitch Extension secret is invalid",
    );
  }
  return decoded;
}

function pseudonym(secret: Buffer, scope: string, value: string): string {
  return createHmac("sha256", secret)
    .update(`chatxpt:twitch-extension:${scope}:`)
    .update(value)
    .digest("base64url");
}

/** Verifies a Twitch-signed Extension JWT and returns only pseudonymous identity data. */
export function verifyTwitchExtensionJwt(
  token: string,
  encodedSecret: string,
  now = Date.now(),
): TwitchExtensionAuthorization {
  const trimmed = token.trim();
  if (trimmed.length === 0) {
    throw new TwitchExtensionAuthError("missing-token", "Twitch authorization token is required");
  }
  const segments = trimmed.split(".");
  if (segments.length !== 3 || segments.some((segment) => segment.length === 0)) {
    throw new TwitchExtensionAuthError("malformed-token", "Twitch authorization token is malformed");
  }

  const secret = decodeExtensionSecret(encodedSecret);
  const header = jwtHeaderSchema.safeParse(decodeSegment(segments[0]));
  const payload = jwtPayloadSchema.safeParse(decodeSegment(segments[1]));
  if (!header.success || !payload.success) {
    throw new TwitchExtensionAuthError("malformed-token", "Twitch authorization token is malformed");
  }

  const suppliedSignature = Buffer.from(segments[2], "base64url");
  const expectedSignature = createHmac("sha256", secret)
    .update(`${segments[0]}.${segments[1]}`)
    .digest();
  if (
    suppliedSignature.length !== expectedSignature.length ||
    !timingSafeEqual(suppliedSignature, expectedSignature)
  ) {
    throw new TwitchExtensionAuthError(
      "invalid-signature",
      "Twitch authorization signature is invalid",
    );
  }

  const expiresAt = payload.data.exp * 1_000;
  if (expiresAt <= now) {
    throw new TwitchExtensionAuthError("expired-token", "Twitch authorization token has expired");
  }
  if (payload.data.role === "external") {
    throw new TwitchExtensionAuthError(
      "invalid-role",
      "Twitch authorization token is not valid for channel participation",
    );
  }
  const prefix = payload.data.opaque_user_id[0];
  if (prefix !== "U" && prefix !== "A") {
    throw new TwitchExtensionAuthError("invalid-identity", "Twitch viewer identity is invalid");
  }

  const participantSubject = pseudonym(
    secret,
    "participant",
    `${payload.data.channel_id}:${payload.data.opaque_user_id}`,
  );
  const actorKind = prefix === "A" ? "anonymous" : "viewer";
  return {
    channelId: payload.data.channel_id,
    expiresAt,
    role: payload.data.role,
    participantSubject,
    actorKind,
    actorId: actorKind === "anonymous" ? null : `twx-${participantSubject}`,
  };
}

/** Derives a non-reversible voter key scoped to one ChatXPT stream session. */
export function toVerifiedTwitchParticipant(
  authorization: TwitchExtensionAuthorization,
  sessionId: string,
  encodedSecret: string,
): {
  readonly actor: {
    readonly kind: "viewer" | "anonymous";
    readonly actorId: string | null;
    readonly expiresAt: number;
    readonly moderatorForBroadcasterIds: readonly string[];
    readonly voterKey: string;
    readonly participationModes: readonly ["twitch-extension"];
  };
  readonly viewerId: string | null;
} {
  const secret = decodeExtensionSecret(encodedSecret);
  const voterKey = `twx-voter-${pseudonym(
    secret,
    "session-voter",
    `${sessionId}:${authorization.participantSubject}`,
  )}`;
  return {
    actor: {
      kind: authorization.actorKind,
      actorId: authorization.actorId,
      expiresAt: authorization.expiresAt,
      moderatorForBroadcasterIds: [],
      voterKey,
      participationModes: ["twitch-extension"],
    },
    viewerId: authorization.actorId,
  };
}

export function readTwitchExtensionBearerToken(header: string | null): string {
  const match = /^Bearer\s+([^\s]+)$/i.exec(header ?? "");
  if (match === null) {
    throw new TwitchExtensionAuthError("missing-token", "Twitch authorization token is required");
  }
  return match[1];
}
