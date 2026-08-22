import { afterEach, describe, expect, it, vi } from "vitest";

import {
  isAllowedStudioCorsOrigin,
  studioCorsHeaders,
  studioErrorResponse,
  studioPreflightResponse,
} from "./response";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Studio Twitch Asset Hosting CORS", () => {
  it("allows only the registered hosted Extension origin", () => {
    const source = { TWITCH_EXTENSION_CLIENT_ID: "abc123extension" };

    expect(isAllowedStudioCorsOrigin("https://abc123extension.ext-twitch.tv", source)).toBe(true);
    expect(isAllowedStudioCorsOrigin("https://evil.ext-twitch.tv", source)).toBe(false);
    expect(isAllowedStudioCorsOrigin("https://abc123extension.ext-twitch.tv.evil.example", source)).toBe(false);
  });

  it("allows one exact configured Local Test origin without accepting insecure remote origins", () => {
    const source = { TWITCH_EXTENSION_ASSET_ORIGIN: "http://localhost:8080" };

    expect(isAllowedStudioCorsOrigin("http://localhost:8080", source)).toBe(true);
    expect(isAllowedStudioCorsOrigin("http://localhost:8081", source)).toBe(false);
    expect(isAllowedStudioCorsOrigin("http://extension-assets.example", {
      TWITCH_EXTENSION_ASSET_ORIGIN: "http://extension-assets.example",
    })).toBe(false);
  });

  it("returns a credential-free preflight response only to an allowed origin", () => {
    vi.stubEnv("TWITCH_EXTENSION_CLIENT_ID", "abc123extension");
    const allowedRequest = new Request("https://chatxpt.example/api/studio/commands", {
      method: "OPTIONS",
      headers: { origin: "https://abc123extension.ext-twitch.tv" },
    });
    const deniedRequest = new Request("https://chatxpt.example/api/studio/commands", {
      method: "OPTIONS",
      headers: { origin: "https://evil.example" },
    });

    const headers = studioCorsHeaders(allowedRequest, ["POST", "OPTIONS"]);
    const allowed = studioPreflightResponse(allowedRequest, ["POST", "OPTIONS"]);
    const denied = studioPreflightResponse(deniedRequest, ["POST", "OPTIONS"]);

    expect(allowed.status).toBe(204);
    expect(headers.get("access-control-allow-origin")).toBe("https://abc123extension.ext-twitch.tv");
    expect(headers.get("access-control-allow-methods")).toBe("POST, OPTIONS");
    expect(headers.get("access-control-allow-headers")).toBe("Authorization, Content-Type");
    expect(headers.get("access-control-allow-credentials")).toBeNull();
    expect(denied.status).toBe(403);
    expect(denied.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("preserves typed Studio errors across development hot reload boundaries", async () => {
    const staleError = Object.assign(new Error("Studio state changed; refresh before retrying"), {
      code: "stale-revision",
      retryable: true,
    });

    const response = studioErrorResponse(staleError);

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: { code: "stale-revision", retryable: true },
    });
  });
});
