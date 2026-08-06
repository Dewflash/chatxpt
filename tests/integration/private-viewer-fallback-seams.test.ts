import { describe, expect, it } from "vitest";

import {
  ChatXptOrchestrator,
  viewerVoteCommandSchema,
  type OrchestratorDependencies,
  type QuestCandidate,
} from "../../src/core";
import {
  CanonicalFixtureViewProjector,
  FixedFixtureClock,
  FixtureOnlyAllowAuthorizer,
  FixtureProjectionContextResolver,
  ScriptedFixtureQuestEngine,
  SequenceFixtureMessageIds,
  contractFixtureCandidateBatch,
  contractFixtureQuestCycle,
  contractFixtureSession,
} from "../../src/core/testing";
import {
  bindPersistenceRuntime,
  buildTwitchChatPollOpenText,
  buildTwitchChatVoteAcknowledgement,
  createMemoryPersistenceRuntime,
  recordTwitchChatFallbackDelivery,
} from "../../src/realtime";
import { FIXTURE_NOW, persistenceState } from "./persistence-fixtures";

function logicDependencies(): Omit<
  OrchestratorDependencies,
  "repository" | "candidateBatches" | "acceptedVotes" | "publisher"
> {
  return {
    authorizer: new FixtureOnlyAllowAuthorizer(),
    engine: new ScriptedFixtureQuestEngine((input) => ({
      ok: true,
      decision: {
        nextState: structuredClone(input.currentState),
        events: [
          {
            eventType: "fixture.private-viewer-command",
            attributes: { commandType: input.command.type },
          },
        ],
      },
    })),
    projectionContext: new FixtureProjectionContextResolver({
      participationMode: "hosted-board",
      viewerId: "private-viewer-id",
      sessionPoints: 25,
      acceptedCandidateId: null,
      connection: {
        service: "private-viewer-fallback-seams",
        status: "ready",
        checkedAt: FIXTURE_NOW + 1_000,
        retryable: false,
      },
    }),
    projector: new CanonicalFixtureViewProjector(),
    clock: new FixedFixtureClock(FIXTURE_NOW + 1_000),
    ids: new SequenceFixtureMessageIds(),
  };
}

async function preparedRuntime() {
  const runtime = createMemoryPersistenceRuntime();
  await runtime.lifecycle.bootstrap({
    roomCode: "ABCDEFGH",
    state: persistenceState(),
    createdAt: FIXTURE_NOW,
  });
  return runtime;
}

function voteCommand(input: {
  readonly commandId: string;
  readonly expectedRevision: number;
  readonly candidateIndex: 0 | 1 | 2;
  readonly voterKey: string;
  readonly actorId: string;
  readonly sourceMode: "twitch-extension" | "hosted-board" | "twitch-chat";
}) {
  return viewerVoteCommandSchema.parse({
    contractVersion: "1.0.0",
    sessionId: contractFixtureSession.sessionId,
    questCycleId: contractFixtureQuestCycle.envelope.questCycleId,
    commandId: input.commandId,
    correlationId: `correlation-${input.commandId}`,
    expectedRevision: input.expectedRevision,
    issuedAt: FIXTURE_NOW + 1_000,
    actor: { kind: "viewer", actorId: input.actorId },
    type: "viewer.vote",
    candidateId: contractFixtureCandidateBatch.candidates[input.candidateIndex].candidateId,
    voterKey: input.voterKey,
    sourceMode: input.sourceMode,
  });
}

describe("private viewer recovery and fallback delivery seams", () => {
  it("restores each viewer's private accepted choice without leaking it through shared snapshots", async () => {
    const runtime = await preparedRuntime();
    const orchestrator = new ChatXptOrchestrator(
      bindPersistenceRuntime(logicDependencies(), runtime),
    );
    await runtime.accessGrants.grant({
      principalId: "viewer-one-principal",
      sessionId: contractFixtureSession.sessionId,
      viewRole: "viewer",
      expiresAt: FIXTURE_NOW + 60_000,
    });
    await runtime.accessGrants.grant({
      principalId: "viewer-two-principal",
      sessionId: contractFixtureSession.sessionId,
      viewRole: "viewer",
      expiresAt: FIXTURE_NOW + 60_000,
    });

    const first = await orchestrator.execute(
      voteCommand({
        commandId: "viewer-one-vote",
        expectedRevision: 0,
        candidateIndex: 0,
        voterKey: "viewer-one-voter-key",
        actorId: "viewer-one",
        sourceMode: "twitch-extension",
      }),
    );
    const second = await orchestrator.execute(
      voteCommand({
        commandId: "viewer-two-vote",
        expectedRevision: 1,
        candidateIndex: 1,
        voterKey: "viewer-two-voter-key",
        actorId: "viewer-two",
        sourceMode: "hosted-board",
      }),
    );

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    const sharedViewerSnapshot = await runtime.snapshots.readSnapshot(
      contractFixtureSession.sessionId,
      "viewer",
    );
    const sharedLedgerTally = await runtime.acceptedVotes.readAcceptedVoteTally({
      sessionId: contractFixtureSession.sessionId,
      questCycleId: contractFixtureQuestCycle.envelope.questCycleId ?? "missing-cycle",
      revision: 2,
      candidateIds: contractFixtureCandidateBatch.candidates.map(({ candidateId }) => candidateId) as [
        string,
        string,
        string,
      ],
      acceptedBefore: FIXTURE_NOW + 2_000,
      closedAt: FIXTURE_NOW + 2_000,
    });
    expect(sharedLedgerTally.acceptedVoteCount).toBe(2);
    expect(sharedLedgerTally.tallies.map(({ votes }) => votes)).toEqual([1, 1, 0]);
    expect(sharedViewerSnapshot?.acceptedCandidateId).toBeNull();
    expect(sharedViewerSnapshot?.sessionPoints).toBe(0);
    expect(sharedViewerSnapshot?.viewerId).toBeNull();

    const viewerOneReceipt = await runtime.viewerReceipts.readViewerParticipationReceipt({
      principalId: "viewer-one-principal",
      sessionId: contractFixtureSession.sessionId,
      questCycleId: contractFixtureQuestCycle.envelope.questCycleId ?? "missing-cycle",
      voterKey: "viewer-one-voter-key",
      identityKind: "authenticated",
      at: FIXTURE_NOW + 2_000,
    });
    const viewerTwoReceipt = await runtime.viewerReceipts.readViewerParticipationReceipt({
      principalId: "viewer-two-principal",
      sessionId: contractFixtureSession.sessionId,
      questCycleId: contractFixtureQuestCycle.envelope.questCycleId ?? "missing-cycle",
      voterKey: "viewer-two-voter-key",
      identityKind: "authenticated",
      at: FIXTURE_NOW + 2_000,
    });

    expect(viewerOneReceipt.status).toBe("available");
    expect(viewerTwoReceipt.status).toBe("available");
    if (viewerOneReceipt.status !== "available" || viewerTwoReceipt.status !== "available") return;
    expect(viewerOneReceipt.receipt.acceptedCandidateId).toBe(
      contractFixtureCandidateBatch.candidates[0].candidateId,
    );
    expect(viewerOneReceipt.receipt.sourceMode).toBe("twitch-extension");
    expect(viewerTwoReceipt.receipt.acceptedCandidateId).toBe(
      contractFixtureCandidateBatch.candidates[1].candidateId,
    );
    expect(viewerTwoReceipt.receipt.sourceMode).toBe("hosted-board");
  });

  it("keeps duplicate cross-surface votes attached to the first accepted choice", async () => {
    const runtime = await preparedRuntime();
    const orchestrator = new ChatXptOrchestrator(
      bindPersistenceRuntime(logicDependencies(), runtime),
    );
    await runtime.accessGrants.grant({
      principalId: "same-viewer-principal",
      sessionId: contractFixtureSession.sessionId,
      viewRole: "viewer",
      expiresAt: FIXTURE_NOW + 60_000,
    });

    const first = await orchestrator.execute(
      voteCommand({
        commandId: "same-viewer-first",
        expectedRevision: 0,
        candidateIndex: 0,
        voterKey: "same-viewer-voter-key",
        actorId: "same-viewer",
        sourceMode: "twitch-extension",
      }),
    );
    const duplicate = await orchestrator.execute(
      voteCommand({
        commandId: "same-viewer-chat-duplicate",
        expectedRevision: 1,
        candidateIndex: 2,
        voterKey: "same-viewer-voter-key",
        actorId: "same-viewer",
        sourceMode: "twitch-chat",
      }),
    );

    expect(first.ok).toBe(true);
    expect(duplicate.ok).toBe(false);
    if (duplicate.ok) return;
    expect(duplicate.error.code).toBe("duplicate");

    const receipt = await runtime.viewerReceipts.readViewerParticipationReceipt({
      principalId: "same-viewer-principal",
      sessionId: contractFixtureSession.sessionId,
      questCycleId: contractFixtureQuestCycle.envelope.questCycleId ?? "missing-cycle",
      voterKey: "same-viewer-voter-key",
      identityKind: "authenticated",
      at: FIXTURE_NOW + 2_000,
    });

    expect(receipt.status).toBe("available");
    if (receipt.status !== "available") return;
    expect(receipt.receipt.acceptedCandidateId).toBe(
      contractFixtureCandidateBatch.candidates[0].candidateId,
    );
    expect(receipt.receipt.sourceMode).toBe("twitch-extension");
  });

  it("resolves hosted-board room access and grants viewer reconnect reads", async () => {
    const runtime = await preparedRuntime();
    const result = await runtime.hostedBoardAccess.resolveHostedBoardAccess({
      roomCode: "abcdefgh",
      principalId: "hosted-viewer-principal",
      baseUrl: "https://chatxpt.example",
      at: FIXTURE_NOW + 1_000,
      grantExpiresAt: FIXTURE_NOW + 60_000,
      includeQrPayload: true,
    });

    expect(result.status).toBe("available");
    if (result.status !== "available") return;
    expect(result.access.roomCode).toBe("ABCDEFGH");
    expect(result.access.directUrl).toBe(
      `https://chatxpt.example/quest-board/ABCDEFGH?sessionId=${contractFixtureSession.sessionId}`,
    );
    expect(result.access.qrPayload).toBe("https://chatxpt.example/quest-board/ABCDEFGH");
    await expect(
      runtime.accessGrants.canRead(
        "hosted-viewer-principal",
        contractFixtureSession.sessionId,
        "viewer",
        FIXTURE_NOW + 2_000,
      ),
    ).resolves.toBe(true);

    await expect(
      runtime.hostedBoardAccess.resolveHostedBoardAccess({
        roomCode: "bad-code",
        principalId: "hosted-viewer-principal",
        baseUrl: "https://chatxpt.example",
        at: FIXTURE_NOW + 1_000,
        grantExpiresAt: FIXTURE_NOW + 60_000,
      }),
    ).resolves.toMatchObject({ status: "invalid-room" });
  });

  it("does not claim Twitch-chat vote acknowledgement when delivery is unavailable", () => {
    const candidates = contractFixtureCandidateBatch.candidates as unknown as readonly [
      QuestCandidate,
      QuestCandidate,
      QuestCandidate,
    ];
    const pollText = buildTwitchChatPollOpenText(candidates);
    expect(pollText).toContain("Reply 1, 2, or 3");

    const failedDelivery = recordTwitchChatFallbackDelivery({
      kind: "poll-open",
      status: "failed",
      messageText: pollText,
      deliveredAt: null,
      retryable: true,
    });
    const notDelivered = buildTwitchChatVoteAcknowledgement({
      delivery: failedDelivery,
      processingStatus: "counted",
      candidateId: contractFixtureCandidateBatch.candidates[0].candidateId,
    });
    expect(notDelivered).toMatchObject({
      status: "not-delivered",
      candidateId: null,
      deliveredAt: null,
    });

    const delivered = recordTwitchChatFallbackDelivery({
      kind: "poll-open",
      status: "delivered",
      messageText: pollText,
      deliveredAt: FIXTURE_NOW + 1_000,
      retryable: false,
    });
    const counted = buildTwitchChatVoteAcknowledgement({
      delivery: delivered,
      processingStatus: "counted",
      candidateId: contractFixtureCandidateBatch.candidates[0].candidateId,
    });
    expect(counted).toMatchObject({
      status: "counted",
      candidateId: contractFixtureCandidateBatch.candidates[0].candidateId,
      deliveredAt: FIXTURE_NOW + 1_000,
    });
  });
});
