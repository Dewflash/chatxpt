import { describe, expect, it } from "vitest";

import {
  normaliseTwitchChatVote,
  twitchChatActorId,
  twitchChatVoterKey,
} from "../../src/integrations";
import {
  ServerCommandAuthorizer,
  StaticVerifiedActorResolver,
} from "../../src/realtime";
import {
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
