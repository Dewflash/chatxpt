import { describe, expect, it } from "vitest";

import { assertSecureGameplayIngressRequest } from "../api/gameplay/ingress/response";
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
});
