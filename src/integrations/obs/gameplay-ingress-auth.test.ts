import { describe, expect, it } from "vitest";

import {
  GameplayIngressAuthError,
  GameplayIngressGrantAuthority,
  readGameplayIngressBearerToken,
} from "./gameplay-ingress-auth";

const KEY = "fixture-gameplay-ingress-key-0123456789abcdef";
const NOW = 2_000_000_000_000;

function grant(expiresAt = NOW + 60_000) {
  return {
    version: 1 as const,
    grantId: "capture-grant-1",
    sessionId: "session-1",
    broadcasterId: "broadcaster-1",
    expiresAt,
  };
}

describe("gameplay ingress grants", () => {
  it("authenticates the setup key and verifies a signed session grant", () => {
    const authority = new GameplayIngressGrantAuthority(KEY);
    authority.authenticateSetupKey(KEY);
    const token = authority.issue(grant());

    expect(authority.verify(token, NOW)).toEqual(grant());
    expect(readGameplayIngressBearerToken(`Bearer ${token}`)).toBe(token);
  });

  it("rejects wrong setup keys, tampering, expiry, and malformed bearer input", () => {
    const authority = new GameplayIngressGrantAuthority(KEY);
    expect(() => authority.authenticateSetupKey("wrong-key")).toThrow(GameplayIngressAuthError);

    const token = authority.issue(grant());
    const tampered = `${token.slice(0, -1)}${token.endsWith("a") ? "b" : "a"}`;
    expect(() => authority.verify(tampered, NOW)).toThrow(/signature/);
    expect(() => authority.verify(authority.issue(grant(NOW)), NOW)).toThrow(/expired/);
    expect(() => authority.verify("not-a-token", NOW)).toThrow(/malformed/);
    expect(() => readGameplayIngressBearerToken(null)).toThrow(/required/);
  });

  it("fails closed when the server setup key is missing or too short", () => {
    const authority = new GameplayIngressGrantAuthority("");
    expect(() => authority.authenticateSetupKey("")).toThrow(/not configured securely/);
    expect(() => authority.issue(grant())).toThrow(/not configured securely/);
  });
});
