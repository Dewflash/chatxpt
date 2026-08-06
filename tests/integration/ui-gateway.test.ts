import { describe, expect, it, beforeEach } from "vitest";

import {
  CONTRACT_VERSION,
  viewerViewModelSchema,
  viewerVoteCommandSchema,
} from "../../src/core";
import {
  diagnosticUiGatewayBroadcasterId,
  diagnosticUiGatewayDELETE,
  diagnosticUiGatewayChatFallbackGET,
  diagnosticUiGatewayChatFallbackPOST,
  diagnosticUiGatewayFixtureCatalog,
  diagnosticUiGatewayGET,
  diagnosticUiGatewayHostedBoardGET,
  diagnosticUiGatewayPOST,
  diagnosticUiGatewayPrincipals,
  diagnosticUiGatewayQuestCycleId,
  diagnosticUiGatewayRoomCode,
  diagnosticUiGatewaySessionId,
  diagnosticUiGatewayViewerReceiptGET,
  getDiagnosticUiGateway,
  resetDiagnosticUiGateway,
} from "../../src/app";
import { derivePrivateViewerVoterKey } from "../../src/realtime";

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
    voterKey: derivePrivateViewerVoterKey({
      principalId: diagnosticUiGatewayPrincipals.viewer,
      identityKind: "anonymous-token",
    }),
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
    expect(result.fixtureCatalog).toBe(diagnosticUiGatewayFixtureCatalog);
    expect(Object.keys(result.fixtureCatalog.intelligence)).toEqual(
      expect.arrayContaining([
        "r4.intelligence.known.v1",
        "r4.intelligence.low-confidence.v1",
        "r4.intelligence.unknown.v1",
        "r4.intelligence.stale.v1",
        "r4.intelligence.capture-denied.v1",
      ]),
    );
    expect(Object.keys(result.fixtureCatalog.generation)).toEqual(
      expect.arrayContaining([
        "r4.generation.ai-provider.v1",
        "r4.generation.algorithmic.v1",
        "r4.generation.fallback.v1",
      ]),
    );
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
    expect(result.views?.viewer.viewerId).toBe(
      derivePrivateViewerVoterKey({
        principalId: diagnosticUiGatewayPrincipals.viewer,
        identityKind: "anonymous-token",
      }),
    );
    expect(result.views?.viewer.questCycle.voteTallies[0]?.votes).toBe(1);
  });

  it("executes a broadcaster profile settings command through the gateway", async () => {
    const gateway = getDiagnosticUiGateway();
    const snapshot = await gateway.readSnapshot({
      sessionId: diagnosticUiGatewaySessionId,
      role: "streamer",
      principalId: diagnosticUiGatewayPrincipals.streamer,
    });
    if (!snapshot.ok) throw new Error(snapshot.error.message);

    const result = await gateway.executeCommand({
      contractVersion: CONTRACT_VERSION,
      sessionId: diagnosticUiGatewaySessionId,
      questCycleId: null,
      commandId: "ui-gateway-profile-settings",
      correlationId: "ui-gateway-profile-settings-correlation",
      expectedRevision: snapshot.snapshot.envelope.revision,
      issuedAt: 1_786_200_001_000,
      actor: { kind: "broadcaster", actorId: diagnosticUiGatewayBroadcasterId },
      type: "streamer.profile-settings",
      experiencePatch: { intensity: 0.8 },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.revision).toBe(snapshot.snapshot.envelope.revision + 1);
    expect(result.receipt.eventTypes).toEqual(["profile.settings-updated"]);
    expect(result.views?.streamer.profile.experience.intensity).toBe(0.8);
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
    expect(readBody.fixtureCatalog.generation["r4.generation.ai-provider.v1"].providerHealth.status).toBe("ready");

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

  it("exposes private viewer receipt recovery through a thin diagnostic route", async () => {
    const readResponse = await diagnosticUiGatewayGET(
      new Request(
        `http://localhost/api/diagnostics/ui-gateway?role=viewer&principalId=${diagnosticUiGatewayPrincipals.viewer}`,
      ),
    );
    const readBody = await readResponse.json();
    if (!readBody.ok) throw new Error(readBody.error.message);

    const voteResponse = await diagnosticUiGatewayPOST(
      new Request("http://localhost/api/diagnostics/ui-gateway", {
        method: "POST",
        body: JSON.stringify({
          command: fixtureVote("ui-gateway-receipt-route-vote", readBody.snapshot.envelope.revision),
        }),
      }),
    );
    expect(voteResponse.status).toBe(200);

    const receiptResponse = await diagnosticUiGatewayViewerReceiptGET(
      new Request(
        `http://localhost/api/diagnostics/ui-gateway/viewer-receipt?principalId=${diagnosticUiGatewayPrincipals.viewer}`,
      ),
    );
    const receiptBody = await receiptResponse.json();

    expect(receiptResponse.status).toBe(200);
    expect(receiptBody).toMatchObject({
      ok: true,
      receiptStatus: "available",
      receipt: {
        acceptedCandidateId: "ui-gateway-candidate-1",
        sourceMode: "hosted-board",
        principalId: diagnosticUiGatewayPrincipals.viewer,
      },
    });
  });

  it("exposes hosted-board discovery and share data through a thin diagnostic route", async () => {
    const response = await diagnosticUiGatewayHostedBoardGET(
      new Request(
        `http://localhost/api/diagnostics/ui-gateway/hosted-board?roomCode=${diagnosticUiGatewayRoomCode}&includeQrPayload=true`,
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      accessStatus: "available",
      access: {
        roomCode: diagnosticUiGatewayRoomCode,
        sessionId: diagnosticUiGatewaySessionId,
        shareUrl: `http://localhost/quest-board/${diagnosticUiGatewayRoomCode}`,
        qrPayload: `http://localhost/quest-board/${diagnosticUiGatewayRoomCode}`,
      },
    });
  });

  it("exposes Twitch-chat fallback copy and prevents acknowledgement overclaims", async () => {
    const deliveryResponse = await diagnosticUiGatewayChatFallbackGET(
      new Request("http://localhost/api/diagnostics/ui-gateway/chat-fallback"),
    );
    const deliveryBody = await deliveryResponse.json();

    expect(deliveryResponse.status).toBe(200);
    expect(deliveryBody.delivery).toMatchObject({
      kind: "poll-open",
      status: "not-attempted",
      deliveredAt: null,
    });
    expect(deliveryBody.delivery.messageText).toContain("Reply 1, 2, or 3");

    const acknowledgementResponse = await diagnosticUiGatewayChatFallbackPOST(
      new Request("http://localhost/api/diagnostics/ui-gateway/chat-fallback", {
        method: "POST",
        body: JSON.stringify({
          processingStatus: "counted",
          candidateId: "ui-gateway-candidate-1",
          deliveryStatus: "failed",
          deliveredAt: null,
        }),
      }),
    );
    const acknowledgementBody = await acknowledgementResponse.json();

    expect(acknowledgementResponse.status).toBe(200);
    expect(acknowledgementBody).toMatchObject({
      ok: true,
      acknowledgement: {
        status: "not-delivered",
        candidateId: null,
        deliveredAt: null,
      },
    });
  });
});
