import { describe, expect, it, vi } from "vitest";

import {
  CONTRACT_VERSION,
  contractFixtureUiX01ReadinessCatalog,
  streamerSetupCommandSchema,
  viewerVoteCommandSchema,
} from "../core";
import {
  contractFixtureOverlayView,
  contractFixtureSession,
  contractFixtureStreamerView,
  contractFixtureViewerView,
} from "../core/testing";
import { FetchUiGatewayClient } from "./browser";

function voteCommand(commandId = "fixture-command") {
  return viewerVoteCommandSchema.parse({
    contractVersion: CONTRACT_VERSION,
    sessionId: contractFixtureSession.sessionId,
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

function setupCommand(commandId = "fixture-setup-command") {
  return streamerSetupCommandSchema.parse({
    contractVersion: CONTRACT_VERSION,
    sessionId: contractFixtureSession.sessionId,
    commandId,
    correlationId: `${commandId}-correlation`,
    expectedRevision: 1,
    issuedAt: 1_786_000_001_000,
    actor: { kind: "broadcaster", actorId: "fixture-broadcaster" },
    type: "streamer.setup",
    service: "obs-capture",
    action: "request-capture-permission",
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
        sessionId: contractFixtureSession.sessionId,
        role: "viewer",
        snapshot: contractFixtureViewerView,
        fixtureCatalog: { examples: true },
      }),
    );
    const client = new FetchUiGatewayClient({
      endpoint: "https://chatxpt.test/api/diagnostics/ui-gateway/",
      fetch: request as typeof fetch,
      getAccessToken: () => "scoped-token",
    });

    const result = await client.read({
      sessionId: contractFixtureSession.sessionId,
      role: "viewer",
      principalId: "fixture-principal",
    });

    expect(result).toMatchObject({
      ok: true,
      currentRevision: contractFixtureViewerView.envelope.revision,
      reality: fixtureReality,
      fixtureCatalog: { examples: true },
    });
    const [url, init] = request.mock.calls[0] as unknown as Parameters<typeof fetch>;
    expect(String(url)).toBe(
      `https://chatxpt.test/api/diagnostics/ui-gateway?sessionId=${contractFixtureSession.sessionId}&role=viewer&principalId=fixture-principal`,
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

  it("parses canonical command views before exposing them to UI clients", async () => {
    const command = voteCommand();
    const roleViews = {
      streamer: contractFixtureStreamerView,
      viewer: contractFixtureViewerView,
      overlay: contractFixtureOverlayView,
    };
    const request = vi.fn(async () =>
      Response.json({
        ok: true,
        reality: fixtureReality,
        outcome: "committed",
        revision: contractFixtureViewerView.envelope.revision,
        delivery: "published",
        receipt: {
          commandId: command.commandId,
          acceptedAt: 1_786_000_002_000,
          eventTypes: ["quest-cycle.vote-recorded"],
        },
        views: roleViews,
      }),
    );
    const client = new FetchUiGatewayClient({ fetch: request as typeof fetch });

    const result = await client.dispatch(command);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.views?.viewer.session.sessionId).toBe(command.sessionId);
  });

  it("dispatches setup service commands through the same browser boundary", async () => {
    const request = vi.fn(async () =>
      Response.json({
        ok: true,
        reality: fixtureReality,
        outcome: "committed",
        revision: 1,
        delivery: "not-republished",
        receipt: {
          commandId: "fixture-setup-command",
          acceptedAt: 1_786_000_002_000,
          eventTypes: ["streamer.setup.diagnostic-acknowledged"],
        },
        views: null,
        serviceCommand: {
          ok: true,
          commandId: "fixture-setup-command",
          currentRevision: 1,
          status: "diagnostic-only",
          readiness: contractFixtureUiX01ReadinessCatalog["r4.setup.permission-denied.v1"],
        },
      }),
    );
    const client = new FetchUiGatewayClient({ fetch: request as typeof fetch });

    const result = await client.dispatch(setupCommand());

    expect(result).toMatchObject({
      ok: true,
      commandId: "fixture-setup-command",
      currentRevision: 1,
      delivery: "not-republished",
      serviceCommand: {
        ok: true,
        commandId: "fixture-setup-command",
        currentRevision: 1,
        status: "diagnostic-only",
        readiness: {
          ready: false,
          blockerCodes: ["obs-capture-permission-denied"],
          recommendedAction: "request-capture-permission",
        },
      },
    });
    const init = (request.mock.calls[0] as unknown as Parameters<typeof fetch>)[1];
    expect(JSON.parse(String(init?.body))).toMatchObject({
      command: {
        type: "streamer.setup",
        service: "obs-capture",
        action: "request-capture-permission",
      },
    });
  });

  it("rejects incomplete role snapshots instead of exposing envelope-only views", async () => {
    const client = new FetchUiGatewayClient({
      fetch: vi.fn(async () =>
        Response.json({
          ok: true,
          reality: fixtureReality,
          sessionId: contractFixtureSession.sessionId,
          role: "viewer",
          snapshot: { envelope: { revision: 7 } },
        }),
      ) as typeof fetch,
    });

    const result = await client.read({
      sessionId: contractFixtureSession.sessionId,
      role: "viewer",
      principalId: "fixture-principal",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("internal");
  });

  it("rejects read responses for the wrong role or session", async () => {
    const client = new FetchUiGatewayClient({
      fetch: vi.fn(async () =>
        Response.json({
          ok: true,
          reality: fixtureReality,
          sessionId: contractFixtureSession.sessionId,
          role: "streamer",
          snapshot: contractFixtureViewerView,
        }),
      ) as typeof fetch,
    });

    const result = await client.read({
      sessionId: contractFixtureSession.sessionId,
      role: "viewer",
      principalId: "fixture-principal",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("internal");
  });

  it("rejects malformed command views instead of casting them", async () => {
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
        views: { viewer: { envelope: { revision: 2 } } },
      }),
    );
    const client = new FetchUiGatewayClient({ fetch: request as typeof fetch });

    const result = await client.dispatch(voteCommand());

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("internal");
  });

  it("rejects service command responses without a typed service result", async () => {
    const request = vi.fn(async () =>
      Response.json({
        ok: true,
        reality: fixtureReality,
        outcome: "committed",
        revision: 1,
        delivery: "not-republished",
        receipt: {
          commandId: "fixture-setup-command",
          acceptedAt: 1_786_000_002_000,
          eventTypes: ["streamer.setup.diagnostic-acknowledged"],
        },
        views: null,
      }),
    );
    const client = new FetchUiGatewayClient({ fetch: request as typeof fetch });

    const result = await client.dispatch(setupCommand());

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("internal");
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
