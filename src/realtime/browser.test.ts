import { describe, expect, it, vi } from "vitest";

import { CONTRACT_VERSION, viewerVoteCommandSchema } from "../core";
import { FetchUiGatewayClient } from "./browser";

function voteCommand(commandId = "fixture-command") {
  return viewerVoteCommandSchema.parse({
    contractVersion: CONTRACT_VERSION,
    sessionId: "fixture-session",
    questCycleId: "fixture-cycle",
    commandId,
    correlationId: `${commandId}-correlation`,
    expectedRevision: 1,
    issuedAt: 1_786_000_001_000,
    actor: { kind: "viewer", actorId: "fixture-viewer" },
    type: "viewer.vote",
    candidateId: "fixture-candidate-1",
    voterKey: "fixture-voter",
    sourceMode: "hosted-board",
  });
}

const fixtureReality = {
  evidenceClass: "fixture",
  liveInputsUsed: false,
  label: "local diagnostic UI gateway",
} as const;

describe("FetchUiGatewayClient", () => {
  it("reads snapshots with same-origin credentials and scoped bearer auth", async () => {
    const request = vi.fn(async () =>
      Response.json({
        ok: true,
        reality: fixtureReality,
        sessionId: "fixture-session",
        role: "viewer",
        snapshot: {
          envelope: { revision: 7 },
        },
        fixtureCatalog: { examples: true },
      }),
    );
    const client = new FetchUiGatewayClient({
      endpoint: "https://chatxpt.test/api/diagnostics/ui-gateway/",
      fetch: request as typeof fetch,
      getAccessToken: () => "scoped-token",
    });

    const result = await client.read({
      sessionId: "fixture-session",
      role: "viewer",
      principalId: "fixture-principal",
    });

    expect(result).toMatchObject({
      ok: true,
      currentRevision: 7,
      reality: fixtureReality,
      fixtureCatalog: { examples: true },
    });
    const [url, init] = request.mock.calls[0] as unknown as Parameters<typeof fetch>;
    expect(String(url)).toBe(
      "https://chatxpt.test/api/diagnostics/ui-gateway?sessionId=fixture-session&role=viewer&principalId=fixture-principal",
    );
    const headers = new Headers(init?.headers);
    expect(headers.get("authorization")).toBe("Bearer scoped-token");
    expect(init?.credentials).toBe("same-origin");
  });

  it("dispatches canonical commands with an anti-CSRF command marker", async () => {
    const request = vi.fn(async () =>
      Response.json({
        ok: true,
        reality: fixtureReality,
        outcome: "committed",
        revision: 2,
        delivery: "published",
        receipt: {
          commandId: "fixture-command",
          acceptedAt: 1_786_000_002_000,
          eventTypes: ["quest-cycle.vote-recorded"],
        },
        views: null,
      }),
    );
    const client = new FetchUiGatewayClient({
      fetch: request as typeof fetch,
      getAccessToken: () => "scoped-token",
    });

    const result = await client.dispatch(voteCommand());

    expect(result).toMatchObject({
      ok: true,
      commandId: "fixture-command",
      currentRevision: 2,
      delivery: "published",
    });
    const init = (request.mock.calls[0] as unknown as Parameters<typeof fetch>)[1];
    const headers = new Headers(init?.headers);
    expect(headers.get("authorization")).toBe("Bearer scoped-token");
    expect(headers.get("x-chatxpt-command")).toBe("1");
    expect(init?.credentials).toBe("same-origin");
    expect(JSON.parse(String(init?.body))).toMatchObject({
      command: { commandId: "fixture-command" },
    });
  });

  it("maps malformed read responses to a typed internal error", async () => {
    const client = new FetchUiGatewayClient({
      fetch: vi.fn(async () => new Response("not-json")) as typeof fetch,
    });

    const result = await client.read({
      sessionId: "fixture-session",
      role: "streamer",
      principalId: "fixture-principal",
    });

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

    const result = await client.read({
      sessionId: "fixture-session",
      role: "streamer",
      principalId: "fixture-principal",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("dependency-unavailable");
    expect(result.error.retryable).toBe(true);
  });

  it("maps rejected access-token retrieval to a typed dependency error without sending", async () => {
    const request = vi.fn();
    const client = new FetchUiGatewayClient({
      fetch: request as typeof fetch,
      getAccessToken: async () => {
        throw new Error("token provider unavailable");
      },
    });

    const result = await client.dispatch(voteCommand("fixture-token-failure"));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.commandId).toBe("fixture-token-failure");
    expect(result.error.code).toBe("dependency-unavailable");
    expect(result.error.retryable).toBe(true);
    expect(request).not.toHaveBeenCalled();
  });
});
