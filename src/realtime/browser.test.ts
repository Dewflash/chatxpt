import { describe, expect, it, vi } from "vitest";

import { CONTRACT_VERSION } from "../core";
import { FetchUiGatewayClient } from "./browser";

describe("FetchUiGatewayClient", () => {
  it("sends a scoped bearer token and anti-CSRF command marker", async () => {
    const request = vi.fn(async (...args: Parameters<typeof fetch>) => {
      void args;
      return new Response(
        JSON.stringify({
          ok: true,
          outcome: "committed",
          commandId: "fixture-command",
          currentRevision: 2,
          delivery: "published",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    const client = new FetchUiGatewayClient({
      baseUrl: "https://chatxpt.test",
      fetch: request as typeof fetch,
      getAccessToken: () => "scoped-token",
    });

    const result = await client.dispatch({
      surface: "viewer",
      scenario: "ready",
      command: {
        contractVersion: CONTRACT_VERSION,
        sessionId: "fixture-session",
        questCycleId: "fixture-cycle",
        commandId: "fixture-command",
        correlationId: "fixture-correlation",
        expectedRevision: 1,
        issuedAt: 1_786_000_001_000,
        actor: { kind: "viewer", actorId: "fixture-viewer" },
        type: "viewer.vote",
        candidateId: "fixture-candidate-1",
      },
    });

    expect(result.ok).toBe(true);
    const init = request.mock.calls[0]?.[1];
    const headers = new Headers(init?.headers);
    expect(headers.get("authorization")).toBe("Bearer scoped-token");
    expect(headers.get("x-chatxpt-command")).toBe("1");
    expect(init?.credentials).toBe("same-origin");
  });

  it("maps malformed responses to a typed internal error", async () => {
    const client = new FetchUiGatewayClient({
      fetch: vi.fn(async () => new Response("not-json")) as typeof fetch,
    });

    const result = await client.read({ surface: "studio", sessionId: "fixture-session" });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("internal");
    expect(result.currentRevision).toBeNull();
  });

  it("maps transport failure to a retryable dependency error", async () => {
    const client = new FetchUiGatewayClient({
      fetch: vi.fn(async () => {
        throw new Error("offline");
      }) as typeof fetch,
    });

    const result = await client.read({ surface: "studio", sessionId: "fixture-session" });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("dependency-unavailable");
    expect(result.error.retryable).toBe(true);
  });
});
