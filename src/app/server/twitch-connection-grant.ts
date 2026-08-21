import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { z } from "zod";

export const TWITCH_BROADCASTER_CONNECTION_COOKIE = "chatxpt_twitch_connection";
export const TWITCH_BROADCASTER_CONNECTION_TTL_MS = 30 * 24 * 60 * 60 * 1_000;

const broadcasterConnectionGrantSchema = z.object({
  version: z.literal(1),
  broadcasterId: z.string().trim().min(1).max(128),
  displayName: z.string().trim().min(1).max(128),
  gameId: z.string().trim().min(1).max(128).nullable(),
  gameName: z.string().trim().min(1).max(160).nullable(),
  expiresAt: z.number().int().positive(),
}).strict();

export type TwitchBroadcasterConnectionGrant = z.infer<typeof broadcasterConnectionGrantSchema>;

export class TwitchConnectionGrantError extends Error {
  constructor(
    readonly code: "misconfigured" | "malformed-token" | "invalid-signature" | "expired-token",
    message: string,
  ) {
    super(message);
    this.name = "TwitchConnectionGrantError";
  }
}

export function studioSessionSecret(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): string {
  const configured = environment.CHATXPT_STUDIO_SESSION_SECRET?.trim() ||
    environment.CHATXPT_STUDIO_SETUP_KEY?.trim();
  if (configured) return configured;
  const twitchClientSecret = environment.TWITCH_CLIENT_SECRET?.trim();
  if (!twitchClientSecret) return "";
  return createHmac("sha256", twitchClientSecret)
    .update("chatxpt:studio-session-secret:v1")
    .digest("hex");
}

function secretBytes(secret: string): Buffer {
  const value = secret.trim();
  if (value.length < 32) {
    throw new TwitchConnectionGrantError(
      "misconfigured",
      "Studio session signing secret must contain at least 32 characters",
    );
  }
  return Buffer.from(value, "utf8");
}

function sign(payload: string, secret: Buffer): Buffer {
  return createHmac("sha256", secret)
    .update("chatxpt:twitch-broadcaster-connection:v1:")
    .update(payload)
    .digest();
}

function equal(left: Buffer, right: Buffer): boolean {
  return left.length === right.length && timingSafeEqual(left, right);
}

export class TwitchBroadcasterConnectionAuthority {
  constructor(private readonly secret: string) {}

  issue(input: TwitchBroadcasterConnectionGrant): string {
    const grant = broadcasterConnectionGrantSchema.parse(input);
    const payload = Buffer.from(JSON.stringify(grant), "utf8").toString("base64url");
    return `${payload}.${sign(payload, secretBytes(this.secret)).toString("base64url")}`;
  }

  verify(token: string, now = Date.now()): TwitchBroadcasterConnectionGrant {
    const segments = token.trim().split(".");
    if (
      segments.length !== 2 ||
      segments.some((segment) => segment.length === 0 || !/^[A-Za-z0-9_-]+$/.test(segment))
    ) {
      throw new TwitchConnectionGrantError("malformed-token", "Twitch connection grant is malformed");
    }
    const supplied = Buffer.from(segments[1], "base64url");
    const expected = sign(segments[0], secretBytes(this.secret));
    if (!equal(supplied, expected)) {
      throw new TwitchConnectionGrantError("invalid-signature", "Twitch connection grant signature is invalid");
    }
    let decoded: unknown;
    try {
      decoded = JSON.parse(Buffer.from(segments[0], "base64url").toString("utf8")) as unknown;
    } catch {
      throw new TwitchConnectionGrantError("malformed-token", "Twitch connection grant is malformed");
    }
    const parsed = broadcasterConnectionGrantSchema.safeParse(decoded);
    if (!parsed.success) {
      throw new TwitchConnectionGrantError("malformed-token", "Twitch connection grant is malformed");
    }
    if (parsed.data.expiresAt <= now) {
      throw new TwitchConnectionGrantError("expired-token", "Twitch connection grant has expired");
    }
    return parsed.data;
  }
}
