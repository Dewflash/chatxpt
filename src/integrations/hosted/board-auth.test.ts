import { describe, expect, it } from "vitest";

import { HostedBoardGrantAuthority } from "./board-auth";

const SECRET = "hosted-board-secret-at-least-32-characters";
const NOW = 1_780_000_000_000;

describe("HostedBoardGrantAuthority", () => {
  it("round-trips an opaque anonymous participation grant", () => {
    const authority = new HostedBoardGrantAuthority(SECRET);
    const token = authority.issue({
      version: 1,
      grantId: "grant-1",
      sessionId: "session-1",
      principalId: "principal-1",
      voterKey: "voter-1",
      roomCode: "ABCDEFGH",
      expiresAt: NOW + 60_000,
    });
    expect(authority.verify(token, NOW)).toMatchObject({
      sessionId: "session-1",
      principalId: "principal-1",
      voterKey: "voter-1",
    });
  });

  it("rejects tampering and expiry", () => {
    const authority = new HostedBoardGrantAuthority(SECRET);
    const token = authority.issue({
      version: 1,
      grantId: "grant-1",
      sessionId: "session-1",
      principalId: "principal-1",
      voterKey: "voter-1",
      roomCode: "ABCDEFGH",
      expiresAt: NOW,
    });
    expect(() => authority.verify(`${token}x`, NOW - 1)).toThrow("signature");
    expect(() => authority.verify(token, NOW)).toThrow("expired");
  });
});
