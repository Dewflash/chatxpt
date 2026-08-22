import { describe, expect, it } from "vitest";

import {
  createDesktopLinkUrl,
  DESKTOP_DIRECTOR_OPEN_URL,
  desktopProtocolClientAction,
  isDesktopDirectorOpenUrl,
  isPackagedDesktopRuntime,
  migrateLegacyPreferences,
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

  it("accepts only the token-free open action for an already-linked companion", () => {
    expect(DESKTOP_DIRECTOR_OPEN_URL).toBe("chatxpt://open");
    expect(isDesktopDirectorOpenUrl(DESKTOP_DIRECTOR_OPEN_URL)).toBe(true);
    expect(isDesktopDirectorOpenUrl("chatxpt://open/")).toBe(true);
    expect(isDesktopDirectorOpenUrl("chatxpt://open?directorAccessToken=secret")).toBe(false);
    expect(isDesktopDirectorOpenUrl("chatxpt://link")).toBe(false);
  });

  it("reserves the macOS protocol association for the packaged companion", () => {
    expect(desktopProtocolClientAction({
      isPackaged: true,
      platform: "darwin",
      isDefaultClient: false,
    })).toBe("register-packaged-client");
    expect(desktopProtocolClientAction({
      isPackaged: false,
      platform: "darwin",
      isDefaultClient: true,
    })).toBe("remove-development-client");
    expect(desktopProtocolClientAction({
      isPackaged: false,
      platform: "darwin",
      isDefaultClient: false,
    })).toBe("none");
  });

  it("recognises the hand-built macOS app even when Electron reports development mode", () => {
    expect(isPackagedDesktopRuntime({
      electronPackaged: false,
      platform: "darwin",
      runtimeDirectory: "/Applications/ChatXPT Live Director.app/Contents/Resources/app",
    })).toBe(true);
    expect(isPackagedDesktopRuntime({
      electronPackaged: false,
      platform: "darwin",
      runtimeDirectory: "/workspace/chatxpt/desktop/live-director",
    })).toBe(false);
    expect(isPackagedDesktopRuntime({
      electronPackaged: true,
      platform: "linux",
      runtimeDirectory: "/opt/chatxpt/resources/app.asar",
    })).toBe(true);
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

  it("defaults to the compact 2x2 director size and migrates the old tall default", () => {
    expect(normalizePreferences(null).bounds).toEqual({ width: 360, height: 240 });
    expect(migrateLegacyPreferences({ bounds: { width: 420, height: 760 } }, 1).bounds)
      .toEqual({ width: 360, height: 240 });
    expect(migrateLegacyPreferences({ bounds: { width: 700, height: 600 } }, 1).bounds)
      .toEqual({ width: 700, height: 600 });
  });
});
