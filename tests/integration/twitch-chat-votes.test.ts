import { describe, expect, it } from "vitest";

import {
  TwitchChatVerifiedVoteActorStore,
  handleTwitchChatVoteMessage,
  normaliseTwitchChatVote,
  submitTwitchChatVote,
  twitchChatActorId,
  twitchChatVoteAcknowledgementIntent,
  twitchChatVoterKey,
  type TwitchChatOutboundSender,
} from "../../src/integrations";
import {
  bindPersistenceRuntime,
  createMemoryPersistenceRuntime,
  ServerCommandAuthorizer,
  SessionLifecycleService,
  StaticVerifiedActorResolver,
  derivePrivateViewerVoterKey,
} from "../../src/realtime";
import {
  ChatXptOrchestrator,
  type OrchestratorDependencies,
} from "../../src/core";
import {
  CanonicalFixtureViewProjector,
  FixedFixtureClock,
  FixtureProjectionContextResolver,
  ScriptedFixtureQuestEngine,
  SequenceFixtureMessageIds,
  contractFixtureCandidateBatch,
  contractFixtureQuestCycle,
  contractFixtureSession,
} from "../../src/core/testing";
import { FIXTURE_NOW, persistenceState } from "./persistence-fixtures";

const candidateIds = contractFixtureCandidateBatch.candidates.map(
  ({ candidateId }) => candidateId,
) as [string, string, string];
const questCycleId = contractFixtureQuestCycle.envelope.questCycleId;
if (questCycleId === null) {
  throw new Error("Twitch chat vote tests require a fixture quest cycle ID");
}

function liveState() {
  const state = persistenceState();
  return {
    ...state,
    session: {
      ...state.session,
      status: "live" as const,
      startedAt: FIXTURE_NOW,
      capabilities: {
        ...state.session.capabilities,
        twitchChatVoting: true,
      },
    },
  };
}

function logicDependencies(
  actorStore: TwitchChatVerifiedVoteActorStore,
): Omit<OrchestratorDependencies, "repository" | "candidateBatches" | "acceptedVotes" | "publisher"> {
  return {
    authorizer: new ServerCommandAuthorizer(actorStore, () => FIXTURE_NOW + 2_000),
    engine: new ScriptedFixtureQuestEngine((input) => ({
      ok: true,
      decision: {
        nextState: structuredClone(input.currentState),
        events: [
          {
            eventType: "fixture.twitch-chat-vote",
            attributes: { commandType: input.command.type },
          },
        ],
      },
    })),
    projectionContext: new FixtureProjectionContextResolver({
      participationMode: "twitch-chat",
      viewerId: null,
      sessionPoints: 0,
      acceptedCandidateId: null,
      connection: {
        service: "twitch-chat-votes",
        status: "ready",
        checkedAt: FIXTURE_NOW + 2_000,
        retryable: false,
      },
    }),
    projector: new CanonicalFixtureViewProjector(),
    clock: new FixedFixtureClock(FIXTURE_NOW + 2_000),
    ids: new SequenceFixtureMessageIds(),
  };
}

async function preparedRuntime() {
  const runtime = createMemoryPersistenceRuntime();
  const initialState = persistenceState();
  const lifecycle = new SessionLifecycleService(
    runtime.lifecycle,
    { next: () => "CHATXPT2" },
    { next: (action) => `twitch-chat-${action}` },
  );
  const created = await lifecycle.create(
    {
      ...initialState,
      session: {
        ...initialState.session,
        capabilities: {
          ...initialState.session.capabilities,
          twitchChatVoting: true,
        },
      },
    },
    FIXTURE_NOW,
  );
  if (!created.ok) throw new Error(created.error.message);
  const started = await lifecycle.start(
    contractFixtureSession.sessionId,
    0,
    FIXTURE_NOW + 500,
    "twitch-chat-start",
  );
  if (!started.ok) throw new Error(started.error.message);
  return runtime;
}

describe("Twitch chat vote normalisation", () => {
  it("turns a bare 1/2/3 Twitch chat message into an authorised canonical viewer vote", async () => {
    const result = normaliseTwitchChatVote({
      sessionId: contractFixtureSession.sessionId,
      questCycleId,
      expectedRevision: contractFixtureSession.revision,
      candidateIds,
      twitchMessageId: "twitch-message-1",
      twitchChannelId: "twitch-channel-1",
      twitchUserId: "twitch-user-123",
      text: " 2 ",
      receivedAt: FIXTURE_NOW + 1_000,
    });

    expect(result.status).toBe("accepted");
    if (result.status !== "accepted") return;
    expect(result.selectedIndex).toBe(1);
    expect(result.command).toMatchObject({
      sessionId: contractFixtureSession.sessionId,
      questCycleId,
      expectedRevision: contractFixtureSession.revision,
      type: "viewer.vote",
      candidateId: candidateIds[1],
      sourceMode: "twitch-chat",
      actor: {
        kind: "viewer",
        actorId: twitchChatActorId("twitch-user-123"),
      },
      voterKey: twitchChatVoterKey({
        sessionId: contractFixtureSession.sessionId,
        twitchUserId: "twitch-user-123",
      }),
    });
    const principalId = result.command.actor.actorId;
    if (principalId === null) throw new Error("Accepted Twitch chat votes require viewer actor IDs");
    expect(result.command.voterKey).toBe(
      derivePrivateViewerVoterKey({
        principalId,
        identityKind: "authenticated",
      }),
    );
    expect(result.command.commandId).not.toContain("twitch-message-1");
    expect(result.command.voterKey).not.toContain("twitch-user-123");
    expect(result.verifiedActor).toMatchObject({
      kind: "viewer",
      actorId: result.command.actor.actorId,
      voterKey: result.command.voterKey,
      participationModes: ["twitch-chat"],
    });

    const authorizer = new ServerCommandAuthorizer(
      new StaticVerifiedActorResolver(new Map([[result.command.commandId, result.verifiedActor]])),
      () => FIXTURE_NOW + 2_000,
    );
    await expect(authorizer.authorize(result.command, liveState())).resolves.toBeNull();
  });

  it("commits a verified chat vote through the authoritative orchestrator path", async () => {
    const actorStore = new TwitchChatVerifiedVoteActorStore();
    const runtime = await preparedRuntime();
    const current = await runtime.sessions.load(contractFixtureSession.sessionId);
    if (current === null) throw new Error("Expected fixture session to be live");
    const orchestrator = new ChatXptOrchestrator(
      bindPersistenceRuntime(logicDependencies(actorStore), runtime),
    );
    const submitted = await submitTwitchChatVote(
      { actorStore, executor: orchestrator },
      {
        sessionId: contractFixtureSession.sessionId,
        questCycleId,
        expectedRevision: current.session.revision,
        candidateIds,
        twitchMessageId: "twitch-message-commit",
        twitchChannelId: "twitch-channel-1",
        twitchUserId: "twitch-user-commit",
        text: "3",
        receivedAt: FIXTURE_NOW + 1_000,
      },
    );

    expect(submitted.status).toBe("submitted");
    if (submitted.status !== "submitted") return;
    expect(submitted.selectedIndex).toBe(2);
    expect(twitchChatVoteAcknowledgementIntent(submitted)).toEqual({
      status: "counted",
      candidateId: candidateIds[2],
    });
    const committed = submitted.result;
    expect(committed.ok).toBe(true);
    if (!committed.ok) return;
    expect(committed.outcome).toBe("committed");
    expect(committed.receipt.command.type).toBe("viewer.vote");
    if (committed.receipt.command.type !== "viewer.vote") return;
    expect(committed.receipt.command.sourceMode).toBe("twitch-chat");
    expect(committed.receipt.events[0]?.event.eventType).toBe("fixture.twitch-chat-vote");

    const tally = await runtime.acceptedVotes.readAcceptedVoteTally({
      sessionId: contractFixtureSession.sessionId,
      questCycleId,
      revision: committed.receipt.state.session.revision,
      candidateIds,
      acceptedBefore: FIXTURE_NOW + 3_000,
      closedAt: FIXTURE_NOW + 3_000,
    });
    expect(tally.acceptedVoteCount).toBe(1);
    expect(tally.tallies[2]).toMatchObject({
      candidateId: candidateIds[2],
      votes: 1,
    });
  });

  it("handles a Twitch chat message through submit plus delivered acknowledgement", async () => {
    const actorStore = new TwitchChatVerifiedVoteActorStore();
    const runtime = await preparedRuntime();
    const current = await runtime.sessions.load(contractFixtureSession.sessionId);
    if (current === null) throw new Error("Expected fixture session to be live");
    const sentMessages: Array<{ readonly messageText: string; readonly correlationId: string }> = [];
    const sender: TwitchChatOutboundSender = {
      async sendMessage(message) {
        sentMessages.push({
          messageText: message.messageText,
          correlationId: message.correlationId,
        });
        return { status: "delivered", deliveredAt: message.sentAt + 12 };
      },
    };
    const orchestrator = new ChatXptOrchestrator(
      bindPersistenceRuntime(logicDependencies(actorStore), runtime),
    );

    const handled = await handleTwitchChatVoteMessage(
      {
        actorStore,
        executor: orchestrator,
        sender,
        now: () => FIXTURE_NOW + 2_000,
      },
      {
        sessionId: contractFixtureSession.sessionId,
        questCycleId,
        expectedRevision: current.session.revision,
        candidateIds,
        twitchMessageId: "twitch-message-handle-counted",
        twitchChannelId: "twitch-channel-1",
        twitchUserId: "twitch-user-handle-counted",
        text: "2",
        receivedAt: FIXTURE_NOW + 1_000,
      },
    );

    expect(handled.submission.status).toBe("submitted");
    if (handled.submission.status !== "submitted") return;
    expect(handled.submission.result).toMatchObject({ ok: true, outcome: "committed" });
    expect(sentMessages).toEqual([
      {
        messageText: "ChatXPT counted your vote.",
        correlationId: handled.submission.command.correlationId,
      },
    ]);
    expect(handled.acknowledgement).toMatchObject({
      status: "delivery-attempted",
      intent: { status: "counted", candidateId: candidateIds[1] },
      delivery: { status: "delivered", deliveredAt: FIXTURE_NOW + 2_012 },
      acknowledgement: {
        status: "counted",
        candidateId: candidateIds[1],
        deliveredAt: FIXTURE_NOW + 2_012,
      },
    });
  });

  it("handles ignored Twitch chat without executing or delivering acknowledgement", async () => {
    const actorStore = new TwitchChatVerifiedVoteActorStore();
    let executeCount = 0;
    let sendCount = 0;

    const handled = await handleTwitchChatVoteMessage(
      {
        actorStore,
        executor: {
          execute() {
            executeCount += 1;
            throw new Error("Ignored chat must not execute");
          },
        },
        sender: {
          async sendMessage() {
            sendCount += 1;
            throw new Error("Ignored chat must not send");
          },
        },
        now: () => FIXTURE_NOW,
      },
      {
        sessionId: contractFixtureSession.sessionId,
        questCycleId,
        expectedRevision: 0,
        candidateIds,
        twitchMessageId: "twitch-message-handle-ignored",
        twitchChannelId: "twitch-channel-1",
        twitchUserId: "twitch-user-ignored",
        text: "hello chat",
        receivedAt: FIXTURE_NOW,
      },
    );

    expect(handled.submission).toEqual({ status: "ignored", reason: "not-a-vote" });
    expect(handled.acknowledgement).toEqual({
      status: "not-required",
      intent: { status: "none", candidateId: null, reason: "not-a-vote" },
      delivery: null,
      acknowledgement: null,
    });
    expect(executeCount).toBe(0);
    expect(sendCount).toBe(0);
  });

  it("handles duplicate Twitch chat votes with an acknowledgement for the original candidate", async () => {
    const actorStore = new TwitchChatVerifiedVoteActorStore();
    const runtime = await preparedRuntime();
    const current = await runtime.sessions.load(contractFixtureSession.sessionId);
    if (current === null) throw new Error("Expected fixture session to be live");
    const sentMessages: string[] = [];
    const sender: TwitchChatOutboundSender = {
      async sendMessage(message) {
        sentMessages.push(message.messageText);
        return { status: "delivered", deliveredAt: message.sentAt };
      },
    };
    const orchestrator = new ChatXptOrchestrator(
      bindPersistenceRuntime(logicDependencies(actorStore), runtime),
    );

    const first = await handleTwitchChatVoteMessage(
      { actorStore, executor: orchestrator, sender, now: () => FIXTURE_NOW + 2_000 },
      {
        sessionId: contractFixtureSession.sessionId,
        questCycleId,
        expectedRevision: current.session.revision,
        candidateIds,
        twitchMessageId: "twitch-message-handle-duplicate-first",
        twitchChannelId: "twitch-channel-1",
        twitchUserId: "twitch-user-handle-duplicate",
        text: "1",
        receivedAt: FIXTURE_NOW + 1_000,
      },
    );
    expect(first.submission.status).toBe("submitted");
    if (first.submission.status !== "submitted" || !first.submission.result.ok) return;

    const second = await handleTwitchChatVoteMessage(
      { actorStore, executor: orchestrator, sender, now: () => FIXTURE_NOW + 3_000 },
      {
        sessionId: contractFixtureSession.sessionId,
        questCycleId,
        expectedRevision: first.submission.result.receipt.state.session.revision,
        candidateIds,
        twitchMessageId: "twitch-message-handle-duplicate-second",
        twitchChannelId: "twitch-channel-1",
        twitchUserId: "twitch-user-handle-duplicate",
        text: "3",
        receivedAt: FIXTURE_NOW + 2_000,
      },
    );

    expect(sentMessages).toEqual([
      "ChatXPT counted your vote.",
      "ChatXPT already counted your first vote.",
    ]);
    expect(second.submission).toMatchObject({
      status: "submitted",
      result: { ok: false, error: { code: "duplicate" } },
      acceptedCandidateId: candidateIds[0],
    });
    expect(second.acknowledgement).toMatchObject({
      status: "delivery-attempted",
      intent: { status: "duplicate", candidateId: candidateIds[0] },
      acknowledgement: {
        status: "duplicate",
        candidateId: candidateIds[0],
        deliveredAt: FIXTURE_NOW + 3_000,
      },
    });
  });

  it("does not execute ignored chat messages", async () => {
    const actorStore = new TwitchChatVerifiedVoteActorStore();
    let executeCount = 0;

    const submitted = await submitTwitchChatVote(
      {
        actorStore,
        executor: {
          execute() {
            executeCount += 1;
            throw new Error("Ignored chat must not execute");
          },
        },
      },
      {
        sessionId: contractFixtureSession.sessionId,
        questCycleId,
        expectedRevision: 0,
        candidateIds,
        twitchMessageId: "twitch-message-not-a-vote",
        twitchChannelId: "twitch-channel-1",
        twitchUserId: "twitch-user-123",
        text: "vote 2 maybe?",
        receivedAt: FIXTURE_NOW,
      },
    );

    expect(submitted).toEqual({ status: "ignored", reason: "not-a-vote" });
    expect(twitchChatVoteAcknowledgementIntent(submitted)).toEqual({
      status: "none",
      candidateId: null,
      reason: "not-a-vote",
    });
    expect(executeCount).toBe(0);
  });

  it("surfaces orchestrator rejections without converting them into accepted chat votes", async () => {
    const actorStore = new TwitchChatVerifiedVoteActorStore();
    const runtime = await preparedRuntime();
    const orchestrator = new ChatXptOrchestrator(
      bindPersistenceRuntime(logicDependencies(actorStore), runtime),
    );

    const submitted = await submitTwitchChatVote(
      { actorStore, executor: orchestrator },
      {
        sessionId: contractFixtureSession.sessionId,
        questCycleId,
        expectedRevision: 0,
        candidateIds,
        twitchMessageId: "twitch-message-stale",
        twitchChannelId: "twitch-channel-1",
        twitchUserId: "twitch-user-stale",
        text: "1",
        receivedAt: FIXTURE_NOW + 1_000,
      },
    );

    expect(submitted.status).toBe("submitted");
    if (submitted.status !== "submitted") return;
    expect(submitted.result).toMatchObject({
      ok: false,
      error: { code: "stale-revision" },
    });
    expect(twitchChatVoteAcknowledgementIntent(submitted)).toEqual({
      status: "late",
      candidateId: null,
    });
  });

  it("maps duplicate and rejected submissions into bounded acknowledgement intent", async () => {
    const actorStore = new TwitchChatVerifiedVoteActorStore();
    const runtime = await preparedRuntime();
    const current = await runtime.sessions.load(contractFixtureSession.sessionId);
    if (current === null) throw new Error("Expected fixture session to be live");
    const orchestrator = new ChatXptOrchestrator(
      bindPersistenceRuntime(logicDependencies(actorStore), runtime),
    );

    const first = await submitTwitchChatVote(
      { actorStore, executor: orchestrator },
      {
        sessionId: contractFixtureSession.sessionId,
        questCycleId,
        expectedRevision: current.session.revision,
        candidateIds,
        twitchMessageId: "twitch-message-duplicate-first",
        twitchChannelId: "twitch-channel-1",
        twitchUserId: "same-twitch-user",
        text: "1",
        receivedAt: FIXTURE_NOW + 1_000,
      },
    );
    expect(first.status).toBe("submitted");
    if (first.status !== "submitted" || !first.result.ok) return;

    const duplicateVote = await submitTwitchChatVote(
      { actorStore, executor: orchestrator },
      {
        sessionId: contractFixtureSession.sessionId,
        questCycleId,
        expectedRevision: first.result.receipt.state.session.revision,
        candidateIds,
        twitchMessageId: "twitch-message-duplicate-second",
        twitchChannelId: "twitch-channel-1",
        twitchUserId: "same-twitch-user",
        text: "2",
        receivedAt: FIXTURE_NOW + 1_500,
      },
    );
    expect(duplicateVote.status).toBe("submitted");
    if (duplicateVote.status !== "submitted") return;
    expect(duplicateVote.result).toMatchObject({
      ok: false,
      error: { code: "duplicate" },
    });
    expect(twitchChatVoteAcknowledgementIntent(duplicateVote)).toEqual({
      status: "duplicate",
      candidateId: candidateIds[0],
    });

    const duplicateDelivery = await submitTwitchChatVote(
      { actorStore, executor: orchestrator },
      {
        sessionId: contractFixtureSession.sessionId,
        questCycleId,
        expectedRevision: current.session.revision,
        candidateIds,
        twitchMessageId: "twitch-message-duplicate-first",
        twitchChannelId: "twitch-channel-1",
        twitchUserId: "same-twitch-user",
        text: "1",
        receivedAt: FIXTURE_NOW + 1_000,
      },
    );
    expect(duplicateDelivery.status).toBe("submitted");
    if (duplicateDelivery.status !== "submitted") return;
    expect(duplicateDelivery.result).toMatchObject({ ok: true, outcome: "duplicate" });
    expect(twitchChatVoteAcknowledgementIntent(duplicateDelivery)).toEqual({
      status: "duplicate",
      candidateId: candidateIds[0],
    });
  });

  it("does not let a reused command ID borrow Twitch verification for changed command content", () => {
    const actorStore = new TwitchChatVerifiedVoteActorStore();
    const normalised = normaliseTwitchChatVote({
      sessionId: contractFixtureSession.sessionId,
      questCycleId,
      expectedRevision: 4,
      candidateIds,
      twitchMessageId: "twitch-message-fingerprint",
      twitchChannelId: "twitch-channel-1",
      twitchUserId: "twitch-user-123",
      text: "1",
      receivedAt: FIXTURE_NOW,
    });
    expect(actorStore.remember(normalised)).toBe(true);
    if (normalised.status !== "accepted") return;

    const tampered = {
      ...normalised.command,
      candidateId: candidateIds[1],
    };

    expect(actorStore.resolve(normalised.command)).toEqual(normalised.verifiedActor);
    expect(actorStore.resolve(tampered)).toBeNull();
  });

  it("keeps Twitch message IDs idempotent without giving the adapter vote authority", () => {
    const first = normaliseTwitchChatVote({
      sessionId: contractFixtureSession.sessionId,
      questCycleId,
      expectedRevision: 4,
      candidateIds,
      twitchMessageId: "same-twitch-message",
      twitchChannelId: "twitch-channel-1",
      twitchUserId: "twitch-user-123",
      text: "1",
      receivedAt: FIXTURE_NOW,
    });
    const duplicateDelivery = normaliseTwitchChatVote({
      sessionId: contractFixtureSession.sessionId,
      questCycleId,
      expectedRevision: 4,
      candidateIds,
      twitchMessageId: "same-twitch-message",
      twitchChannelId: "twitch-channel-1",
      twitchUserId: "twitch-user-123",
      text: "1",
      receivedAt: FIXTURE_NOW + 500,
    });

    expect(first.status).toBe("accepted");
    expect(duplicateDelivery.status).toBe("accepted");
    if (first.status !== "accepted" || duplicateDelivery.status !== "accepted") return;
    expect(duplicateDelivery.command.commandId).toBe(first.command.commandId);
    expect(duplicateDelivery.command.candidateId).toBe(candidateIds[0]);
    expect(duplicateDelivery.command).not.toHaveProperty("winnerCandidateId");
  });

  it("ignores non-vote chat and messages without a trusted Twitch user identity", () => {
    expect(
      normaliseTwitchChatVote({
        sessionId: contractFixtureSession.sessionId,
        questCycleId,
        expectedRevision: 0,
        candidateIds,
        twitchMessageId: "chat-message",
        twitchChannelId: "twitch-channel-1",
        twitchUserId: "twitch-user-123",
        text: "I think 2 is funny",
        receivedAt: FIXTURE_NOW,
      }),
    ).toEqual({ status: "ignored", reason: "not-a-vote" });

    expect(
      normaliseTwitchChatVote({
        sessionId: contractFixtureSession.sessionId,
        questCycleId,
        expectedRevision: 0,
        candidateIds,
        twitchMessageId: "anonymous-chat-message",
        twitchChannelId: "twitch-channel-1",
        twitchUserId: null,
        text: "3",
        receivedAt: FIXTURE_NOW,
      }),
    ).toEqual({ status: "ignored", reason: "missing-user-id" });
  });
});
