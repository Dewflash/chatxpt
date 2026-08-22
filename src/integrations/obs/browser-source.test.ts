import { describe, expect, it } from "vitest";

import {
  createLiveDirectorDesktopLinkUrl,
  createLiveDirectorDockDescriptor,
  createObsBrowserSourceDescriptor,
  parseObsBrowserSourceRequest,
  redactObsBrowserSourceUrl,
} from "./browser-source";

describe("OBS browser source descriptor", () => {
  it("creates a read-only transparent overlay URL for OBS", () => {
    const descriptor = createObsBrowserSourceDescriptor({
      baseUrl: "https://chatxpt.example",
      broadcasterId: "fixture-broadcaster",
      accessToken: "fixture-overlay-token-0001",
    });

    expect(descriptor).toMatchObject({
      width: 1920,
      height: 1080,
      transparent: true,
      readOnly: true,
      hidesWhenInactive: true,
      latestSnapshotFirst: true,
      reusableAcrossSessions: true,
      role: "overlay",
      broadcasterId: "fixture-broadcaster",
    });
    expect(parseObsBrowserSourceRequest(descriptor.url)).toEqual({
      broadcasterId: "fixture-broadcaster",
      accessToken: "fixture-overlay-token-0001",
    });
    const url = new URL(descriptor.url);
    expect(url.searchParams.has("overlayAccessToken")).toBe(false);
    expect(url.hash).toContain("overlayAccessToken=");
  });

  it("allows localhost during development but requires HTTPS elsewhere", () => {
    expect(
      createObsBrowserSourceDescriptor({
        baseUrl: "http://localhost:3000",
        broadcasterId: "fixture-broadcaster",
        accessToken: "fixture-overlay-token-0001",
      }).url,
    ).toContain("http://localhost:3000/obs-overlay");

    expect(() =>
      createObsBrowserSourceDescriptor({
        baseUrl: "http://chatxpt.example",
        broadcasterId: "fixture-broadcaster",
        accessToken: "fixture-overlay-token-0001",
      }),
    ).toThrow("HTTPS");
  });

  it("creates a permanent broadcaster-linked private Live Director URL", () => {
    const descriptor = createLiveDirectorDockDescriptor({
      baseUrl: "https://chatxpt.example",
      broadcasterId: "fixture-broadcaster",
      accessToken: "fixture-director-token-0001",
    });

    expect(descriptor).toMatchObject({
      width: 420,
      height: 900,
      readOnly: false,
      commandScope: [
        "quest-generation",
        "quest-approval",
        "quest-cancel",
        "quest-complete",
      ],
      reusableAcrossSessions: true,
      role: "live-director",
      broadcasterId: "fixture-broadcaster",
    });
    const url = new URL(descriptor.url);
    expect(url.pathname).toBe("/live-director-overlay");
    expect(url.searchParams.get("broadcasterId")).toBe("fixture-broadcaster");
    expect(url.searchParams.has("directorAccessToken")).toBe(false);
    expect(new URLSearchParams(url.hash.slice(1)).get("directorAccessToken"))
      .toBe("fixture-director-token-0001");

    const desktopLink = new URL(createLiveDirectorDesktopLinkUrl(descriptor.url));
    expect(desktopLink.protocol).toBe("chatxpt:");
    expect(desktopLink.hostname).toBe("link");
    expect(desktopLink.searchParams.get("url")).toBe(descriptor.url);
  });

  it("rejects unsafe or unrelated Desktop Live Director links", () => {
    expect(() => createLiveDirectorDesktopLinkUrl(
      "http://chatxpt.example/live-director-overlay?broadcasterId=fixture#directorAccessToken=fixture-director-token-0001",
    )).toThrow("HTTPS");
    expect(() => createLiveDirectorDesktopLinkUrl(
      "https://chatxpt.example/obs-overlay?broadcasterId=fixture#directorAccessToken=fixture-director-token-0001",
    )).toThrow("private overlay surface");
  });

  it("redacts the overlay access token before logging or documentation", () => {
    const descriptor = createObsBrowserSourceDescriptor({
      baseUrl: "https://chatxpt.example",
      broadcasterId: "fixture-broadcaster",
      accessToken: "fixture-overlay-token-0001",
    });

    const redacted = redactObsBrowserSourceUrl(descriptor.url);

    expect(redacted).toContain("#overlayAccessToken=redacted");
    expect(redacted).not.toContain("fixture-overlay-token-0001");
  });
});
