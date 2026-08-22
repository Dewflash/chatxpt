import { describe, expect, it } from "vitest";

import {
  createDesktopLinkUrl,
  normalizeDirectorUrl,
  normalizePreferences,
  parseDesktopLinkUrl,
  redactDirectorUrl,
} from "./link.mjs";

const directorUrl = "https://chatxpt.example/live-director-overlay?broadcasterId=622566236#directorAccessToken=fixture-director-token-0001";

describe("Desktop Live Director linking", () => {
  it("round-trips a permanent broadcaster link through the desktop protocol", () => {
    const desktopLink = createDesktopLinkUrl(directorUrl);

    expect(desktopLink).toContain("chatxpt://link?");
    expect(parseDesktopLinkUrl(desktopLink)).toBe(directorUrl);
  });

  it("allows local development and rejects unsafe or unrelated links", () => {
    expect(normalizeDirectorUrl(
      "http://localhost:3000/live-director-overlay?broadcasterId=fixture#directorAccessToken=fixture-director-token-0001",
    )).toContain("http://localhost:3000/live-director-overlay");
    expect(() => normalizeDirectorUrl(
      "http://chatxpt.example/live-director-overlay?broadcasterId=fixture#directorAccessToken=fixture-director-token-0001",
    )).toThrow("HTTPS");
    expect(() => normalizeDirectorUrl(
      "https://chatxpt.example/obs-overlay?broadcasterId=fixture#directorAccessToken=fixture-director-token-0001",
    )).toThrow("not a private Live Director");
  });

  it("redacts grants and clamps unsafe saved window preferences", () => {
    expect(redactDirectorUrl(directorUrl)).toContain("directorAccessToken=redacted");
    expect(redactDirectorUrl(directorUrl)).not.toContain("fixture-director-token-0001");
    expect(normalizePreferences({
      alwaysOnTop: false,
      allWorkspaces: false,
      autoLaunch: true,
      opacity: 0.1,
      bounds: { width: 10, height: 9000, x: 12, y: 24 },
    })).toEqual({
      alwaysOnTop: false,
      allWorkspaces: false,
      autoLaunch: true,
      opacity: 0.7,
      bounds: { width: 320, height: 1400, x: 12, y: 24 },
    });
  });
});
