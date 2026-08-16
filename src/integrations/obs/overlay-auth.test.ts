import { describe, expect, it } from "vitest";

import {
  ObsOverlayAuthError,
  ObsOverlayGrantAuthority,
  readObsOverlayBearerToken,
} from "./overlay-auth";

const KEY = "obs-overlay-test-key-at-least-32-characters";
const NOW = 1_780_000_000_000;

describe("OBS overlay grant authority", () => {
  it("issues and verifies an expiring session-scoped read grant", () => {
    const authority = new ObsOverlayGrantAuthority(KEY);
    const token = authority.issue({
      version: 1,
      grantId: "overlay-1",
      sessionId: "session-1",
      broadcasterId: "channel-1",
      expiresAt: NOW + 60_000,
    });

    expect(authority.verify(token, NOW)).toMatchObject({
      sessionId: "session-1",
      broadcasterId: "channel-1",
    });
    expect(readObsOverlayBearerToken(`Bearer ${token}`)).toBe(token);
  });

  it("rejects invalid bootstrap keys, signatures, and expiry", () => {
    const authority = new ObsOverlayGrantAuthority(KEY);
    expect(() => authority.authenticateSetupKey("wrong")).toThrow(ObsOverlayAuthError);
    const token = authority.issue({
      version: 1,
      grantId: "overlay-1",
      sessionId: "session-1",
      broadcasterId: "channel-1",
      expiresAt: NOW,
    });
    expect(() => authority.verify(`${token}x`, NOW - 1)).toThrow("signature");
    expect(() => authority.verify(token, NOW)).toThrow("expired");
  });
});
