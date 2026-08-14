import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  TwitchExtensionAuthError,
  readTwitchExtensionBearerToken,
  toVerifiedTwitchParticipant,
  verifyTwitchExtensionJwt,
} from "./extension-auth";

const NOW = 2_000_000_000_000;
const SECRET_BYTES = Buffer.from("0123456789abcdef0123456789abcdef", "utf8");
const SECRET = SECRET_BYTES.toString("base64");

function signedToken(payload: Record<string, unknown>) {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", SECRET_BYTES)
    .update(`${header}.${body}`)
    .digest("base64url");
  return `${header}.${body}.${signature}`;
}

function payload(overrides: Record<string, unknown> = {}) {
  return {
    channel_id: "channel-123",
    exp: Math.floor((NOW + 60_000) / 1_000),
    opaque_user_id: "Uopaque-viewer-secret",
    role: "viewer",
    ...overrides,
  };
}

describe("Twitch Extension JWT authorization", () => {
  it("verifies HS256 and exposes only pseudonymous viewer identity", () => {
    const authorization = verifyTwitchExtensionJwt(signedToken(payload()), SECRET, NOW);
    const participant = toVerifiedTwitchParticipant(authorization, "session-one", SECRET);

    expect(authorization.channelId).toBe("channel-123");
    expect(authorization.actorKind).toBe("viewer");
    expect(participant.actor.kind).toBe("viewer");
    expect(participant.actor.participationModes).toEqual(["twitch-extension"]);
    expect(participant.actor.voterKey).toMatch(/^twx-voter-/);
    expect(JSON.stringify({ authorization, participant })).not.toContain("opaque-viewer-secret");
  });

  it("keeps logged-out Twitch viewers anonymous and scopes voter keys per session", () => {
    const authorization = verifyTwitchExtensionJwt(
      signedToken(payload({ opaque_user_id: "Aanonymous-session-viewer" })),
      SECRET,
      NOW,
    );
    const first = toVerifiedTwitchParticipant(authorization, "session-one", SECRET);
    const second = toVerifiedTwitchParticipant(authorization, "session-two", SECRET);

    expect(authorization.actorKind).toBe("anonymous");
    expect(first).toMatchObject({ viewerId: null, actor: { kind: "anonymous", actorId: null } });
    expect(first.actor.voterKey).not.toBe(second.actor.voterKey);
  });

  it("rejects tampered, expired, malformed, and missing bearer tokens", () => {
    const valid = signedToken(payload());
    const tampered = `${valid.slice(0, -1)}${valid.endsWith("a") ? "b" : "a"}`;

    expect(() => verifyTwitchExtensionJwt(tampered, SECRET, NOW)).toThrow(
      TwitchExtensionAuthError,
    );
    expect(() =>
      verifyTwitchExtensionJwt(
        signedToken(payload({ exp: Math.floor((NOW - 1) / 1_000) })),
        SECRET,
        NOW,
      ),
    ).toThrow(/expired/);
    expect(() => verifyTwitchExtensionJwt("not-a-jwt", SECRET, NOW)).toThrow(/malformed/);
    expect(() => readTwitchExtensionBearerToken(null)).toThrow(/required/);
    expect(readTwitchExtensionBearerToken(`Bearer ${valid}`)).toBe(valid);
  });
});
