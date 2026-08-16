import { describe, expect, it } from "vitest";

import {
  createObsBrowserSourceDescriptor,
  parseObsBrowserSourceRequest,
  redactObsBrowserSourceUrl,
} from "./browser-source";

describe("OBS browser source descriptor", () => {
  it("creates a read-only transparent overlay URL for OBS", () => {
    const descriptor = createObsBrowserSourceDescriptor({
      baseUrl: "https://chatxpt.example",
      sessionId: "fixture-session",
      accessToken: "fixture-overlay-token-0001",
    });

    expect(descriptor).toMatchObject({
      width: 1920,
      height: 1080,
      transparent: true,
      readOnly: true,
      hidesWhenInactive: true,
      latestSnapshotFirst: true,
      role: "overlay",
      sessionId: "fixture-session",
    });
    expect(parseObsBrowserSourceRequest(descriptor.url)).toEqual({
      sessionId: "fixture-session",
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
        sessionId: "fixture-session",
        accessToken: "fixture-overlay-token-0001",
      }).url,
    ).toContain("http://localhost:3000/obs-overlay");

    expect(() =>
      createObsBrowserSourceDescriptor({
        baseUrl: "http://chatxpt.example",
        sessionId: "fixture-session",
        accessToken: "fixture-overlay-token-0001",
      }),
    ).toThrow("HTTPS");
  });

  it("redacts the overlay access token before logging or documentation", () => {
    const descriptor = createObsBrowserSourceDescriptor({
      baseUrl: "https://chatxpt.example",
      sessionId: "fixture-session",
      accessToken: "fixture-overlay-token-0001",
    });

    const redacted = redactObsBrowserSourceUrl(descriptor.url);

    expect(redacted).toContain("#overlayAccessToken=redacted");
    expect(redacted).not.toContain("fixture-overlay-token-0001");
  });
});
