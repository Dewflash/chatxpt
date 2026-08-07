import { describe, expect, it } from "vitest";

import {
  ChatXptOrchestrator,
  commandFingerprint,
  streamerQuestCommandSchema,
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
  normaliseTwitchChatVote,
} from "../../src/integrations";
import {
  bindPersistenceRuntime,
  buildTwitchChatPollOpenText,
  buildTwitchChatVoteAcknowledgement,
  createMemoryPersistenceRuntime,
  derivePrivateViewerVoterKey,
  recordTwitchChatAcknowledgementDelivery,
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
  readonly questCycleId?: string;
  readonly candidateIndex: 0 | 1 | 2;
  readonly voterKey: string;
  readonly actorId: string;
  readonly sourceMode: "twitch-extension" | "hosted-board" | "twitch-chat";
}) {
  return viewerVoteCommandSchema.parse({
    contractVersion: "1.0.0",
    sessionId: contractFixtureSession.sessionId,
    questCycleId: input.questCycleId ?? contractFixtureQuestCycle.envelope.questCycleId,
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

function successfulStateAfterVote(input: {
  readonly state: ReturnType<typeof persistenceState>;
  readonly questCycleId: string;
  readonly activeCandidateId: string;
  readonly rewardPointsAwarded: number;
}) {
  return {
    ...structuredClone(input.state),
    session: {
      ...input.state.session,
      revision: input.state.session.revision + 1,
    },
    questCycle: {
      ...structuredClone(input.state.questCycle),
      envelope: {
        ...input.state.questCycle.envelope,
        questCycleId: input.questCycleId,
        revision: input.state.session.revision + 1,
        messageId: `result-${input.questCycleId}`,
      },
      status: "succeeded" as const,
      options: contractFixtureCandidateBatch.candidates,
      activeCandidateId: input.activeCandidateId,
      result: {
        outcome: "succeeded" as const,
        occurredAt: FIXTURE_NOW + 1_500,
        reason: "Fixture successful completion.",
        rewardPointsAwarded: input.rewardPointsAwarded,
      },
    },
  };
}

async function commitSuccessfulResult(input: {
  readonly runtime: Awaited<ReturnType<typeof preparedRuntime>>;
  readonly current: ReturnType<typeof persistenceState>;
  readonly commandId: string;
  readonly questCycleId: string;
  readonly activeCandidateId: string;
  readonly rewardPointsAwarded: number;
}) {
  const command = streamerQuestCommandSchema.parse({
    contractVersion: "1.0.0",
    sessionId: contractFixtureSession.sessionId,
    questCycleId: input.questCycleId,
    commandId: input.commandId,
    correlationId: `correlation-${input.commandId}`,
    expectedRevision: input.current.session.revision,
    issuedAt: FIXTURE_NOW + 1_500,
    actor: { kind: "broadcaster", actorId: contractFixtureSession.broadcasterId },
    type: "streamer.quest",
    action: "succeed",
    candidateId: input.activeCandidateId,
  });
  const nextState = successfulStateAfterVote({
    state: input.current,
    questCycleId: input.questCycleId,
    activeCandidateId: input.activeCandidateId,
    rewardPointsAwarded: input.rewardPointsAwarded,
  });
  const result = await input.runtime.sessions.commit({
    command,
    commandFingerprint: commandFingerprint(command),
    expectedRevision: input.current.session.revision,
    nextState,
    events: [],
    acceptedAt: FIXTURE_NOW + 1_500,
  });
  if (result.status !== "committed") {
    throw new Error(`Could not commit result: ${result.status}`);
  }
  return result.receipt.state;
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
    await runtime.accessGrants.grant({
      principalId: "viewer-three-principal",
      sessionId: contractFixtureSession.sessionId,
      viewRole: "viewer",
      expiresAt: FIXTURE_NOW + 60_000,
    });

    const first = await orchestrator.execute(
      voteCommand({
        commandId: "viewer-one-vote",
        expectedRevision: 0,
        candidateIndex: 0,
        voterKey: derivePrivateViewerVoterKey({
          principalId: "viewer-one-principal",
          identityKind: "authenticated",
        }),
        actorId: "viewer-one",
        sourceMode: "twitch-extension",
      }),
    );
    const second = await orchestrator.execute(
      voteCommand({
        commandId: "viewer-two-vote",
        expectedRevision: 1,
        candidateIndex: 1,
        voterKey: derivePrivateViewerVoterKey({
          principalId: "viewer-two-principal",
          identityKind: "authenticated",
        }),
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
      identityKind: "authenticated",
      at: FIXTURE_NOW + 2_000,
    });
    const viewerTwoReceipt = await runtime.viewerReceipts.readViewerParticipationReceipt({
      principalId: "viewer-two-principal",
      sessionId: contractFixtureSession.sessionId,
      questCycleId: contractFixtureQuestCycle.envelope.questCycleId ?? "missing-cycle",
      identityKind: "authenticated",
      at: FIXTURE_NOW + 2_000,
    });
    const crossPrincipalReceipt = await runtime.viewerReceipts.readViewerParticipationReceipt({
      principalId: "viewer-three-principal",
      sessionId: contractFixtureSession.sessionId,
      questCycleId: contractFixtureQuestCycle.envelope.questCycleId ?? "missing-cycle",
      identityKind: "authenticated",
      at: FIXTURE_NOW + 2_000,
    });

    expect(viewerOneReceipt.status).toBe("available");
    expect(viewerTwoReceipt.status).toBe("available");
    expect(crossPrincipalReceipt.status).toBe("available");
    if (
      viewerOneReceipt.status !== "available" ||
      viewerTwoReceipt.status !== "available" ||
      crossPrincipalReceipt.status !== "available"
    ) return;
    expect(viewerOneReceipt.receipt.acceptedCandidateId).toBe(
      contractFixtureCandidateBatch.candidates[0].candidateId,
    );
    expect(viewerOneReceipt.receipt.sourceMode).toBe("twitch-extension");
    expect(viewerTwoReceipt.receipt.acceptedCandidateId).toBe(
      contractFixtureCandidateBatch.candidates[1].candidateId,
    );
    expect(viewerTwoReceipt.receipt.sourceMode).toBe("hosted-board");
    expect(crossPrincipalReceipt.receipt.acceptedCandidateId).toBeNull();
    expect(crossPrincipalReceipt.receipt.sourceMode).toBeNull();
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
        voterKey: derivePrivateViewerVoterKey({
          principalId: "same-viewer-principal",
          identityKind: "authenticated",
        }),
        actorId: "same-viewer",
        sourceMode: "twitch-extension",
      }),
    );
    const duplicate = await orchestrator.execute(
      voteCommand({
        commandId: "same-viewer-chat-duplicate",
        expectedRevision: 1,
        candidateIndex: 2,
        voterKey: derivePrivateViewerVoterKey({
          principalId: "same-viewer-principal",
          identityKind: "authenticated",
        }),
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

  it("recovers a Twitch-chat-normalised vote through the private receipt path", async () => {
    const runtime = await preparedRuntime();
    const orchestrator = new ChatXptOrchestrator(
      bindPersistenceRuntime(logicDependencies(), runtime),
    );
    const questCycleId = contractFixtureQuestCycle.envelope.questCycleId ?? "missing-cycle";
    const candidateIds = contractFixtureCandidateBatch.candidates.map(
      ({ candidateId }) => candidateId,
    ) as [string, string, string];
    const normalised = normaliseTwitchChatVote({
      sessionId: contractFixtureSession.sessionId,
      questCycleId,
      expectedRevision: 0,
      candidateIds,
      twitchMessageId: "private-receipt-chat-message",
      twitchChannelId: "private-receipt-chat-channel",
      twitchUserId: "private-receipt-chat-user",
      text: "3",
      receivedAt: FIXTURE_NOW + 1_000,
    });

    expect(normalised.status).toBe("accepted");
    if (normalised.status !== "accepted") return;
    const principalId = normalised.command.actor.actorId;
    if (principalId === null) throw new Error("Accepted Twitch chat votes require viewer actor IDs");
    await runtime.accessGrants.grant({
      principalId,
      sessionId: contractFixtureSession.sessionId,
      viewRole: "viewer",
      expiresAt: FIXTURE_NOW + 60_000,
    });
    expect(normalised.command.voterKey).toBe(
      derivePrivateViewerVoterKey({
        principalId,
        identityKind: "authenticated",
      }),
    );

    const submitted = await orchestrator.execute(normalised.command);

    expect(submitted.ok).toBe(true);
    const receipt = await runtime.viewerReceipts.readViewerParticipationReceipt({
      principalId,
      sessionId: contractFixtureSession.sessionId,
      questCycleId,
      identityKind: "authenticated",
      at: FIXTURE_NOW + 2_000,
    });

    expect(receipt.status).toBe("available");
    if (receipt.status !== "available") return;
    expect(receipt.receipt.acceptedCandidateId).toBe(
      contractFixtureCandidateBatch.candidates[2].candidateId,
    );
    expect(receipt.receipt.sourceMode).toBe("twitch-chat");
  });

  it("restores accumulated session-scoped points across completed cycles", async () => {
    const runtime = await preparedRuntime();
    const voterKey = derivePrivateViewerVoterKey({
      principalId: "points-viewer-principal",
      identityKind: "authenticated",
    });
    await runtime.accessGrants.grant({
      principalId: "points-viewer-principal",
      sessionId: contractFixtureSession.sessionId,
      viewRole: "viewer",
      expiresAt: FIXTURE_NOW + 60_000,
    });

    const firstVote = voteCommand({
      commandId: "points-viewer-first-vote",
      expectedRevision: 0,
      candidateIndex: 0,
      voterKey,
      actorId: "points-viewer",
      sourceMode: "hosted-board",
    });
    const firstAfterVote = await runtime.sessions.commit({
      command: firstVote,
      commandFingerprint: commandFingerprint(firstVote),
      expectedRevision: 0,
      nextState: { ...persistenceState(), session: { ...persistenceState().session, revision: 1 }, questCycle: { ...persistenceState().questCycle, envelope: { ...persistenceState().questCycle.envelope, revision: 1 } } },
      events: [],
      acceptedAt: FIXTURE_NOW + 1_000,
    });
    if (firstAfterVote.status !== "committed") throw new Error("Could not commit first vote");
    const firstResult = await commitSuccessfulResult({
      runtime,
      current: firstAfterVote.receipt.state,
      commandId: "points-viewer-first-result",
      questCycleId: contractFixtureQuestCycle.envelope.questCycleId ?? "missing-cycle",
      activeCandidateId: contractFixtureCandidateBatch.candidates[0].candidateId,
      rewardPointsAwarded: 100,
    });

    const secondCycleId = "fixture-cycle-two";
    const secondVotingState = {
      ...structuredClone(firstResult),
      session: { ...firstResult.session, revision: firstResult.session.revision + 1 },
      questCycle: {
        ...structuredClone(firstResult.questCycle),
        envelope: {
          ...firstResult.questCycle.envelope,
          questCycleId: secondCycleId,
          revision: firstResult.session.revision + 1,
          messageId: "cycle-two",
        },
        status: "voting" as const,
        options: contractFixtureCandidateBatch.candidates,
        activeCandidateId: null,
        result: null,
      },
    };
    const secondSetupCommand = streamerQuestCommandSchema.parse({
      contractVersion: "1.0.0",
      sessionId: contractFixtureSession.sessionId,
      questCycleId: secondCycleId,
      commandId: "points-viewer-second-cycle",
      correlationId: "correlation-points-viewer-second-cycle",
      expectedRevision: firstResult.session.revision,
      issuedAt: FIXTURE_NOW + 2_000,
      actor: { kind: "broadcaster", actorId: contractFixtureSession.broadcasterId },
      type: "streamer.quest",
      action: "approve",
      candidateId: null,
    });
    const secondSetup = await runtime.sessions.commit({
      command: secondSetupCommand,
      commandFingerprint: commandFingerprint(secondSetupCommand),
      expectedRevision: firstResult.session.revision,
      nextState: secondVotingState,
      events: [],
      acceptedAt: FIXTURE_NOW + 2_000,
    });
    if (secondSetup.status !== "committed") throw new Error("Could not commit second cycle");

    const secondVote = voteCommand({
      commandId: "points-viewer-second-vote",
      expectedRevision: secondSetup.receipt.state.session.revision,
      questCycleId: secondCycleId,
      candidateIndex: 1,
      voterKey,
      actorId: "points-viewer",
      sourceMode: "twitch-chat",
    });
    const secondVoteState = {
      ...structuredClone(secondSetup.receipt.state),
      session: {
        ...secondSetup.receipt.state.session,
        revision: secondSetup.receipt.state.session.revision + 1,
      },
      questCycle: {
        ...structuredClone(secondSetup.receipt.state.questCycle),
        envelope: {
          ...secondSetup.receipt.state.questCycle.envelope,
          revision: secondSetup.receipt.state.session.revision + 1,
        },
      },
    };
    const secondAfterVote = await runtime.sessions.commit({
      command: secondVote,
      commandFingerprint: commandFingerprint(secondVote),
      expectedRevision: secondSetup.receipt.state.session.revision,
      nextState: secondVoteState,
      events: [],
      acceptedAt: FIXTURE_NOW + 2_500,
    });
    if (secondAfterVote.status !== "committed") throw new Error("Could not commit second vote");
    await commitSuccessfulResult({
      runtime,
      current: secondAfterVote.receipt.state,
      commandId: "points-viewer-second-result",
      questCycleId: secondCycleId,
      activeCandidateId: contractFixtureCandidateBatch.candidates[1].candidateId,
      rewardPointsAwarded: 75,
    });

    const receipt = await runtime.viewerReceipts.readViewerParticipationReceipt({
      principalId: "points-viewer-principal",
      sessionId: contractFixtureSession.sessionId,
      questCycleId: secondCycleId,
      identityKind: "authenticated",
      at: FIXTURE_NOW + 3_000,
    });

    expect(receipt.status).toBe("available");
    if (receipt.status !== "available") return;
    expect(receipt.receipt.acceptedCandidateId).toBe(
      contractFixtureCandidateBatch.candidates[1].candidateId,
    );
    expect(receipt.receipt.sessionPoints).toBe(175);
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

    const failedDelivery = recordTwitchChatAcknowledgementDelivery({
      status: "failed",
      messageText: "Could not acknowledge that vote.",
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

    const delivered = recordTwitchChatAcknowledgementDelivery({
      status: "delivered",
      messageText: "ChatXPT counted your vote.",
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

    const duplicate = buildTwitchChatVoteAcknowledgement({
      delivery: delivered,
      processingStatus: "duplicate",
      candidateId: contractFixtureCandidateBatch.candidates[0].candidateId,
    });
    expect(duplicate).toMatchObject({
      status: "duplicate",
      candidateId: contractFixtureCandidateBatch.candidates[0].candidateId,
      deliveredAt: FIXTURE_NOW + 1_000,
    });
  });
});
