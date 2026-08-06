import { describe, expect, it, beforeEach } from "vitest";

import {
  CONTRACT_VERSION,
  viewerViewModelSchema,
  viewerVoteCommandSchema,
} from "../../src/core";
import {
  diagnosticUiGatewayBroadcasterId,
  diagnosticUiGatewayDELETE,
  diagnosticUiGatewayGET,
  diagnosticUiGatewayPOST,
  diagnosticUiGatewayPrincipals,
  diagnosticUiGatewayQuestCycleId,
  diagnosticUiGatewaySessionId,
  getDiagnosticUiGateway,
  resetDiagnosticUiGateway,
} from "../../src/app";

function fixtureVote(commandId: string, expectedRevision: number) {
  return viewerVoteCommandSchema.parse({
    contractVersion: CONTRACT_VERSION,
    sessionId: diagnosticUiGatewaySessionId,
    questCycleId: diagnosticUiGatewayQuestCycleId,
    commandId,
    correlationId: `correlation-${commandId}`,
    expectedRevision,
    issuedAt: 1_786_200_001_000,
    actor: { kind: "anonymous", actorId: null },
    type: "viewer.vote",
    candidateId: "ui-gateway-candidate-1",
    voterKey: "ui-gateway-voter-one",
    sourceMode: "hosted-board",
  });
}

describe("Role 1 diagnostic UI gateway", () => {
  beforeEach(() => {
    resetDiagnosticUiGateway();
  });

  it("returns authorised fixture snapshots without exposing live-evidence claims", async () => {
    const result = await getDiagnosticUiGateway().readSnapshot({
      sessionId: diagnosticUiGatewaySessionId,
      role: "viewer",
      principalId: diagnosticUiGatewayPrincipals.viewer,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.reality).toMatchObject({
      evidenceClass: "fixture",
      liveInputsUsed: false,
      label: "local diagnostic UI gateway",
    });
    expect(result.snapshot.session.sessionId).toBe(diagnosticUiGatewaySessionId);
    expect(result.snapshot.envelope.evidenceClass).toBe("fixture");
    expect(result.snapshot.questCycle.status).toBe("voting");
  });

  it("executes a canonical viewer command and returns the current revision plus private receipt view", async () => {
    const gateway = getDiagnosticUiGateway();
    const snapshot = await gateway.readSnapshot({
      sessionId: diagnosticUiGatewaySessionId,
      role: "viewer",
      principalId: diagnosticUiGatewayPrincipals.viewer,
    });
    if (!snapshot.ok) throw new Error(snapshot.error.message);
    const result = await gateway.executeCommand(
      fixtureVote("ui-gateway-vote-one", snapshot.snapshot.envelope.revision),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.revision).toBe(snapshot.snapshot.envelope.revision + 1);
    expect(result.delivery).toBe("published");
    expect(result.receipt).toMatchObject({
      commandId: "ui-gateway-vote-one",
      eventTypes: ["quest-cycle.vote-recorded"],
    });
    expect(result.views?.viewer.acceptedCandidateId).toBe("ui-gateway-candidate-1");
    expect(result.views?.viewer.viewerId).toBe("ui-gateway-voter-one");
    expect(result.views?.viewer.questCycle.voteTallies[0]?.votes).toBe(1);
  });

  it("keeps reconnect snapshots sanitised after a private viewer command", async () => {
    const gateway = getDiagnosticUiGateway();
    const initial = await gateway.readSnapshot({
      sessionId: diagnosticUiGatewaySessionId,
      role: "viewer",
      principalId: diagnosticUiGatewayPrincipals.viewer,
    });
    if (!initial.ok) throw new Error(initial.error.message);
    await gateway.executeCommand(fixtureVote("ui-gateway-private-vote", initial.snapshot.envelope.revision));

    const snapshot = await gateway.readSnapshot({
      sessionId: diagnosticUiGatewaySessionId,
      role: "viewer",
      principalId: diagnosticUiGatewayPrincipals.viewer,
    });

    expect(snapshot.ok).toBe(true);
    if (!snapshot.ok) return;
    const viewerSnapshot = viewerViewModelSchema.parse(snapshot.snapshot);
    expect(viewerSnapshot.envelope.revision).toBe(initial.snapshot.envelope.revision + 1);
    expect(viewerSnapshot.viewerId).toBeNull();
    expect(viewerSnapshot.acceptedCandidateId).toBeNull();
    expect(viewerSnapshot.sessionPoints).toBe(0);
    expect(viewerSnapshot.questCycle.voteTallies[0]?.votes).toBe(1);
  });

  it("rejects missing read grants and stale browser commands with typed errors", async () => {
    const denied = await getDiagnosticUiGateway().readSnapshot({
      sessionId: diagnosticUiGatewaySessionId,
      role: "overlay",
      principalId: diagnosticUiGatewayPrincipals.viewer,
    });
    expect(denied.ok).toBe(false);
    if (!denied.ok) expect(denied.error.code).toBe("unauthenticated");

    const gateway = getDiagnosticUiGateway();
    const initial = await gateway.readSnapshot({
      sessionId: diagnosticUiGatewaySessionId,
      role: "viewer",
      principalId: diagnosticUiGatewayPrincipals.viewer,
    });
    if (!initial.ok) throw new Error(initial.error.message);
    await gateway.executeCommand(fixtureVote("ui-gateway-first-revision", initial.snapshot.envelope.revision));
    const stale = await gateway.executeCommand(
      fixtureVote("ui-gateway-stale-revision", initial.snapshot.envelope.revision),
    );

    expect(stale.ok).toBe(false);
    if (!stale.ok) expect(stale.error.code).toBe("stale-revision");
  });

  it("exposes the gateway through thin local diagnostic GET and POST routes", async () => {
    const readResponse = await diagnosticUiGatewayGET(
      new Request(
        `http://localhost/api/diagnostics/ui-gateway?role=streamer&principalId=${diagnosticUiGatewayPrincipals.streamer}`,
      ),
    );
    const readBody = await readResponse.json();

    expect(readResponse.status).toBe(200);
    expect(readBody.ok).toBe(true);
    expect(readBody.snapshot.profile.streamerId).toBe(diagnosticUiGatewayBroadcasterId);

    const commandResponse = await diagnosticUiGatewayPOST(
      new Request("http://localhost/api/diagnostics/ui-gateway", {
        method: "POST",
        body: JSON.stringify({
          command: fixtureVote("ui-gateway-route-vote", readBody.snapshot.envelope.revision),
        }),
      }),
    );
    const commandBody = await commandResponse.json();

    expect(commandResponse.status).toBe(200);
    expect(commandBody).toMatchObject({
      ok: true,
      revision: readBody.snapshot.envelope.revision + 1,
      reality: {
        evidenceClass: "fixture",
        liveInputsUsed: false,
      },
    });
  });

  it("resets the fixture route for repeatable browser verification", async () => {
    const gateway = getDiagnosticUiGateway();
    const initial = await gateway.readSnapshot({
      sessionId: diagnosticUiGatewaySessionId,
      role: "viewer",
      principalId: diagnosticUiGatewayPrincipals.viewer,
    });
    if (!initial.ok) throw new Error(initial.error.message);
    await gateway.executeCommand(fixtureVote("ui-gateway-before-reset", initial.snapshot.envelope.revision));

    const reset = await diagnosticUiGatewayDELETE();
    const body = await reset.json();

    expect(reset.status).toBe(200);
    expect(body).toMatchObject({ ok: true, reset: true });

    const after = await getDiagnosticUiGateway().readSnapshot({
      sessionId: diagnosticUiGatewaySessionId,
      role: "viewer",
      principalId: diagnosticUiGatewayPrincipals.viewer,
    });
    expect(after.ok).toBe(true);
    if (after.ok) {
      expect(after.snapshot.envelope.revision).toBe(3);
      expect(after.snapshot.questCycle.voteTallies[0]?.votes).toBe(0);
    }
  });
});
