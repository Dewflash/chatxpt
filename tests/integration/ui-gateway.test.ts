import { describe, expect, it } from "vitest";

import {
  CONTRACT_VERSION,
  uiGatewayCommandSchema,
  uiGatewaySnapshotSchema,
  type UiGatewayDispatchRequest,
  type UiGatewaySurface,
} from "../../src/core";
import {
  DiagnosticUiGateway,
  diagnosticHarnessEnabled,
  mutationRequestAllowed,
} from "../../src/realtime/server";

const surfaces: Array<[UiGatewaySurface, string, "streamer" | "viewer" | "overlay"]> = [
  ["studio", "diagnostic-broadcaster", "streamer"],
  ["config", "diagnostic-broadcaster", "streamer"],
  ["live-config", "diagnostic-broadcaster", "streamer"],
  ["viewer", "diagnostic-viewer", "viewer"],
  ["hosted-board", "diagnostic-anonymous", "viewer"],
  ["overlay", "diagnostic-overlay", "overlay"],
];

function viewerCommand(expectedRevision = 0): UiGatewayDispatchRequest {
  return {
    surface: "viewer",
    scenario: "ready",
    command: {
      contractVersion: CONTRACT_VERSION,
      sessionId: "fixture-session",
      questCycleId: "fixture-cycle",
      commandId: "fixture-ui-vote",
      correlationId: "fixture-ui-vote-correlation",
      expectedRevision,
      issuedAt: 1_786_000_001_000,
      actor: { kind: "viewer", actorId: "fixture-viewer" },
      type: "viewer.vote",
      candidateId: "fixture-candidate-1",
    },
  };
}

describe("Role 1 diagnostic UI gateway", () => {
  it("publishes diagnostic health without claiming a live service", () => {
    const health = new DiagnosticUiGateway().health();

    expect(health.mode).toBe("diagnostic");
    expect(health.harnessEnabled).toBe(true);
    expect(health.services[0]?.status).toBe("ready");
  });

  it("accepts the setup, session, and profile command families required by Studio", () => {
    const common = {
      contractVersion: CONTRACT_VERSION,
      sessionId: "fixture-session",
      commandId: "fixture-streamer-gateway-command",
      correlationId: "fixture-streamer-gateway-correlation",
      expectedRevision: 0,
      issuedAt: 1_786_000_001_000,
      actor: { kind: "broadcaster" as const, actorId: "fixture-broadcaster" },
    };
    const commands = [
      {
        ...common,
        type: "streamer.setup",
        service: "obs-capture",
        action: "request-capture-permission",
      },
      { ...common, commandId: "fixture-session-start", type: "streamer.session", action: "start" },
      {
        ...common,
        commandId: "fixture-profile-update",
        type: "streamer.profile",
        profile: {
          profileId: "fixture-profile",
          streamerId: "fixture-broadcaster",
          revision: 0,
          displayName: "Fixture Streamer",
          gameId: null,
          gameName: null,
          experience: { intensity: 0.5 },
          restrictions: [],
          preferredQuestTypes: [],
          forbiddenQuestTypes: [],
          accessibilityNeeds: [],
        },
      },
    ];

    for (const command of commands) {
      expect(uiGatewayCommandSchema.safeParse(command).success).toBe(true);
    }
  });

  it("rejects quest and participation commands from the wrong actor class", () => {
    const vote = viewerCommand().command;
    const invalidVote = {
      ...vote,
      actor: { kind: "broadcaster" as const, actorId: "fixture-broadcaster" },
    };
    const invalidQuest = {
      contractVersion: CONTRACT_VERSION,
      sessionId: "fixture-session",
      questCycleId: "fixture-cycle",
      commandId: "fixture-invalid-quest",
      correlationId: "fixture-invalid-quest-correlation",
      expectedRevision: 0,
      issuedAt: 1_786_000_001_000,
      actor: { kind: "viewer" as const, actorId: "fixture-viewer" },
      type: "streamer.quest" as const,
      action: "skip" as const,
      candidateId: null,
    };

    expect(uiGatewayCommandSchema.safeParse(invalidVote).success).toBe(false);
    expect(uiGatewayCommandSchema.safeParse(invalidQuest).success).toBe(false);
  });

  it.each(surfaces)("provides a fixture-labelled %s host", async (surface, token, role) => {
    const gateway = new DiagnosticUiGateway();

    const result = await gateway.read(
      { surface, sessionId: "fixture-session", scenario: "ready" },
      token,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.snapshot.role).toBe(role);
    expect(result.snapshot.surface).toBe(surface);
    expect(result.snapshot.view.envelope.evidenceClass).toBe("fixture");
    expect(result.snapshot.currentRevision).toBe(0);
  });

  it("rejects successful snapshots with inactive or surface-incompatible actors", async () => {
    const gateway = new DiagnosticUiGateway();
    const studio = await gateway.read(
      { surface: "studio", sessionId: "fixture-session", scenario: "ready" },
      "diagnostic-broadcaster",
    );
    const liveConfig = await gateway.read(
      { surface: "live-config", sessionId: "fixture-session", scenario: "ready" },
      "diagnostic-moderator",
    );
    const viewer = await gateway.read(
      { surface: "viewer", sessionId: "fixture-session", scenario: "ready" },
      "diagnostic-viewer",
    );
    const hosted = await gateway.read(
      { surface: "hosted-board", sessionId: "fixture-session", scenario: "ready" },
      "diagnostic-anonymous",
    );
    const overlay = await gateway.read(
      { surface: "overlay", sessionId: "fixture-session", scenario: "ready" },
      "diagnostic-overlay",
    );

    expect(studio.ok && liveConfig.ok && viewer.ok && hosted.ok && overlay.ok).toBe(true);
    if (!studio.ok || !liveConfig.ok || !viewer.ok || !hosted.ok || !overlay.ok) return;

    const invalidSnapshots = [
      { ...studio.snapshot, auth: { status: "expired", actorKind: null, expiresAt: null } },
      {
        ...studio.snapshot,
        surface: "config",
        auth: liveConfig.snapshot.auth,
      },
      { ...liveConfig.snapshot, auth: viewer.snapshot.auth },
      { ...viewer.snapshot, auth: studio.snapshot.auth },
      { ...hosted.snapshot, auth: { status: "unauthenticated", actorKind: null, expiresAt: null } },
      { ...overlay.snapshot, auth: viewer.snapshot.auth },
    ];

    for (const snapshot of invalidSnapshots) {
      expect(uiGatewaySnapshotSchema.safeParse(snapshot).success).toBe(false);
    }
  });

  it("reproduces permission and configuration readiness failures", async () => {
    const gateway = new DiagnosticUiGateway();

    const denied = await gateway.read(
      { surface: "studio", sessionId: "fixture-session", scenario: "permission-denied" },
      "diagnostic-broadcaster",
    );
    const misconfigured = await gateway.read(
      { surface: "studio", sessionId: "fixture-session", scenario: "misconfigured" },
      "diagnostic-broadcaster",
    );

    expect(denied.ok).toBe(true);
    expect(misconfigured.ok).toBe(true);
    if (
      !denied.ok ||
      denied.snapshot.role !== "streamer" ||
      !misconfigured.ok ||
      misconfigured.snapshot.role !== "streamer"
    ) {
      return;
    }
    expect(denied.snapshot.readiness.blockerCodes).toContain("capture-not-ready");
    expect(misconfigured.snapshot.readiness.blockerCodes).toContain("twitch-not-ready");
  });

  it("limits moderator access to the live-control surface", async () => {
    const gateway = new DiagnosticUiGateway();
    const liveConfig = await gateway.read(
      { surface: "live-config", sessionId: "fixture-session", scenario: "ready" },
      "diagnostic-moderator",
    );
    const studio = await gateway.read(
      { surface: "studio", sessionId: "fixture-session", scenario: "ready" },
      "diagnostic-moderator",
    );
    const result = await gateway.dispatch(
      {
        surface: "live-config",
        scenario: "ready",
        command: {
          contractVersion: CONTRACT_VERSION,
          sessionId: "fixture-session",
          questCycleId: "fixture-cycle",
          commandId: "fixture-moderator-skip",
          correlationId: "fixture-moderator-skip-correlation",
          expectedRevision: 0,
          issuedAt: 1_786_000_001_000,
          actor: { kind: "moderator", actorId: "fixture-moderator" },
          type: "streamer.quest",
          action: "skip",
          candidateId: null,
        },
      },
      "diagnostic-moderator",
    );

    expect(liveConfig.ok).toBe(true);
    expect(!studio.ok && studio.error.code).toBe("forbidden");
    expect(result.ok).toBe(true);
  });

  it("distinguishes expired, forbidden, stale, and dependency failures", async () => {
    const gateway = new DiagnosticUiGateway();

    const expired = await gateway.read(
      { surface: "viewer", sessionId: "fixture-session", scenario: "ready" },
      "diagnostic-expired",
    );
    const forbidden = await gateway.read(
      { surface: "studio", sessionId: "fixture-session", scenario: "ready" },
      "diagnostic-viewer",
    );
    const stale = await gateway.dispatch(
      { ...viewerCommand(), scenario: "stale" },
      "diagnostic-viewer",
    );
    const failed = await gateway.dispatch(
      { ...viewerCommand(), scenario: "dependency-failure" },
      "diagnostic-viewer",
    );

    expect(!expired.ok && expired.error.code).toBe("expired");
    expect(!expired.ok && expired.error.details?.reason).toBe("token-expired");
    expect(!forbidden.ok && forbidden.error.code).toBe("forbidden");
    expect(!stale.ok && stale.error.code).toBe("stale-revision");
    expect(!stale.ok && stale.currentRevision).toBe(0);
    expect(!failed.ok && failed.error.code).toBe("dependency-unavailable");
  });

  it("returns a safe command receipt with the new authoritative revision", async () => {
    const result = await new DiagnosticUiGateway().dispatch(
      viewerCommand(),
      "diagnostic-viewer",
    );

    expect(result).toEqual({
      ok: true,
      outcome: "committed",
      commandId: "fixture-ui-vote",
      currentRevision: 1,
      delivery: "published",
    });
    expect("receipt" in result).toBe(false);
  });
});

describe("diagnostic route protection", () => {
  it("requires explicit non-production enablement", () => {
    expect(
      diagnosticHarnessEnabled({ NODE_ENV: "development", CHATXPT_ENABLE_DIAGNOSTIC_HARNESS: "true" }),
    ).toBe(true);
    expect(
      diagnosticHarnessEnabled({ NODE_ENV: "development", CHATXPT_ENABLE_DIAGNOSTIC_HARNESS: "false" }),
    ).toBe(false);
    expect(
      diagnosticHarnessEnabled({ NODE_ENV: "production", CHATXPT_ENABLE_DIAGNOSTIC_HARNESS: "true" }),
    ).toBe(false);
  });

  it("requires the command marker and bearer or same-origin request", () => {
    expect(
      mutationRequestAllowed(
        new Request("https://chatxpt.test/api/ui-gateway/v1/commands", {
          method: "POST",
          headers: {
            authorization: "Bearer diagnostic-viewer",
            "x-chatxpt-command": "1",
          },
        }),
      ),
    ).toBe(true);
    expect(
      mutationRequestAllowed(
        new Request("https://chatxpt.test/api/ui-gateway/v1/commands", {
          method: "POST",
          headers: { origin: "https://evil.example", "x-chatxpt-command": "1" },
        }),
      ),
    ).toBe(false);
  });
});
