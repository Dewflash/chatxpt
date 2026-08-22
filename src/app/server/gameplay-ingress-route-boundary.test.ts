import { describe, expect, it } from "vitest";

import {
  assertSecureGameplayIngressRequest,
  gameplayIngressErrorResponse,
} from "../api/gameplay/ingress/response";
import { BoundedJsonError, readBoundedJson } from "./bounded-json";

describe("gameplay ingress HTTP boundary", () => {
  it("reads a bounded JSON stream and rejects oversized payloads before completing it", async () => {
    await expect(
      readBoundedJson(
        new Request("http://localhost/api/gameplay/ingress/snapshot", {
          method: "POST",
          body: JSON.stringify({ ok: true }),
        }),
        64,
      ),
    ).resolves.toEqual({ ok: true });

    await expect(
      readBoundedJson(
        new Request("http://localhost/api/gameplay/ingress/snapshot", {
          method: "POST",
          body: JSON.stringify({ value: "x".repeat(128) }),
        }),
        64,
      ),
    ).rejects.toBeInstanceOf(BoundedJsonError);
  });

  it("allows localhost and HTTPS but rejects a non-local plaintext setup-key exchange", () => {
    expect(() =>
      assertSecureGameplayIngressRequest(
        new Request("http://localhost:3000/api/gameplay/ingress/grant"),
      ),
    ).not.toThrow();
    expect(() =>
      assertSecureGameplayIngressRequest(
        new Request("https://chatxpt.example/api/gameplay/ingress/grant"),
      ),
    ).not.toThrow();
    expect(() =>
      assertSecureGameplayIngressRequest(
        new Request("http://chatxpt.example/api/gameplay/ingress/grant"),
      ),
    ).toThrow(/requires HTTPS/);
  });

  it("maps Studio authorization failures during capture grant exchange to gameplay auth responses", async () => {
    const response = gameplayIngressErrorResponse({
      name: "StudioSessionApplicationError",
      code: "unauthenticated",
      message: "Start or reopen an authorised Studio session",
      retryable: false,
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: {
        code: "unauthenticated",
        message: "Start or reopen an authorised Studio session",
        retryable: false,
      },
    });
  });

  it("preserves gameplay ingress application error status across dev module boundaries", async () => {
    const response = gameplayIngressErrorResponse({
      name: "GameplayIngressApplicationError",
      code: "unauthenticated",
      message: "Gameplay ingress setup key is missing",
      retryable: false,
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: {
        code: "unauthenticated",
        message: "Gameplay ingress setup key is missing",
        retryable: false,
      },
    });
  });
});
