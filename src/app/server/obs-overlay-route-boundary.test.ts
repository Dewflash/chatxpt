import { describe, expect, it } from "vitest";

import {
  assertSecureObsOverlayRequest,
  obsOverlayErrorResponse,
} from "../api/obs/overlay/response";

describe("OBS overlay route boundary", () => {
  it("permits localhost and HTTPS, but rejects remote plaintext requests", () => {
    expect(() => assertSecureObsOverlayRequest(new Request("http://localhost:3000/api/obs/overlay/state")))
      .not.toThrow();
    expect(() => assertSecureObsOverlayRequest(new Request("https://chatxpt.example/api/obs/overlay/state")))
      .not.toThrow();
    expect(() => assertSecureObsOverlayRequest(new Request("http://chatxpt.example/api/obs/overlay/state")))
      .toThrow("HTTPS");
  });

  it("accepts a trusted HTTPS forwarding boundary", () => {
    expect(() => assertSecureObsOverlayRequest(new Request(
      "http://chatxpt.example/api/obs/overlay/state",
      { headers: { "x-forwarded-proto": "https" } },
    ))).not.toThrow();
  });

  it("preserves typed authorization failures across development module reloads", async () => {
    const staleModuleError = Object.assign(new Error("OBS overlay bearer grant is required"), {
      code: "unauthenticated",
      retryable: false,
    });

    const response = obsOverlayErrorResponse(staleModuleError);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: { code: "unauthenticated", retryable: false },
    });
  });
});
