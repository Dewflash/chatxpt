import { describe, expect, it } from "vitest";

import {
  TwitchBroadcasterConnectionAuthority,
  TwitchConnectionGrantError,
  studioSessionSecret,
} from "./twitch-connection-grant";

const NOW = 1_780_000_000_000;
const SECRET = "studio-connection-test-secret-at-least-32-characters";

describe("Twitch broadcaster connection grant", () => {
  it("round-trips verified public broadcaster metadata without a Twitch token", () => {
    const authority = new TwitchBroadcasterConnectionAuthority(SECRET);
    const token = authority.issue({
      version: 1,
      broadcasterId: "broadcaster-1",
      displayName: "Streamer One",
      gameId: "27471",
      gameName: "Minecraft",
      expiresAt: NOW + 60_000,
    });

    expect(authority.verify(token, NOW)).toEqual({
      version: 1,
      broadcasterId: "broadcaster-1",
      displayName: "Streamer One",
      gameId: "27471",
      gameName: "Minecraft",
      expiresAt: NOW + 60_000,
    });
    expect(token).not.toContain("access_token");
    expect(token).not.toContain("refresh_token");
  });

  it("rejects tampering and expiry", () => {
    const authority = new TwitchBroadcasterConnectionAuthority(SECRET);
    const token = authority.issue({
      version: 1,
      broadcasterId: "broadcaster-1",
      displayName: "Streamer One",
      gameId: null,
      gameName: null,
      expiresAt: NOW + 1,
    });

    expect(() => authority.verify(`${token}x`, NOW)).toThrow(TwitchConnectionGrantError);
    expect(() => authority.verify(token, NOW + 1)).toThrowError("expired");
  });

  it("derives the Studio signer from the existing Twitch client secret", () => {
    const derived = studioSessionSecret({ TWITCH_CLIENT_SECRET: "existing-twitch-secret" });
    expect(derived).toMatch(/^[a-f0-9]{64}$/);
    expect(derived).not.toContain("existing-twitch-secret");
  });
});
