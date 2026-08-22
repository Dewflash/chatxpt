import { describe, expect, it } from "vitest";

import {
  CONTRACT_VERSION,
  candidateBatchSchema,
  serviceHealthSchema,
  streamerQuestCommandSchema,
  systemIntelligenceCommandSchema,
  type ProjectionContextResolver,
} from "@/core";
import {
  SessionLifecycleService,
  createMemoryPersistenceRuntime,
  type VerifiedCommandActor,
} from "@/realtime";

import { HostedBoardApplication, HostedBoardApplicationError } from "./hosted-board";
import { ChatXptServerRuntime } from "./runtime";
import { StudioSessionApplication } from "./studio-session";

const NOW = 1_780_000_000_000;
const STUDIO_KEY = "studio-test-key-that-is-at-least-32-characters";
const HOSTED_SECRET = "hosted-board-secret-at-least-32-characters";

async function createContext() {
  let id = 0;
  const persistence = createMemoryPersistenceRuntime();
  const runtime = new ChatXptServerRuntime({ persistence, clock: { now: () => NOW } });
  const studio = new StudioSessionApplication({
    runtime,
    setupKey: STUDIO_KEY,
    extensionSecret: "",
    environment: {},
    now: () => NOW,
    nextId: () => `studio-${++id}`,
  });
  const started = await studio.start(STUDIO_KEY, {
    channelId: "channel-1",
    displayName: "Streamer One",
    gameId: null,
    gameName: null,
  });
  const live = await new SessionLifecycleService(persistence.lifecycle).start(
    started.view.session.sessionId,
    started.view.session.revision,
    NOW,
    `hosted-session-start-${++id}`,
  );
  if (!live.ok) throw new Error(live.error.message);
  const hosted = new HostedBoardApplication({
    runtime,
    secret: HOSTED_SECRET,
    now: () => NOW,
    nextId: () => `hosted-${++id}`,
  });
  return { hosted, started, runtime, persistence };
}

const projectionContext: ProjectionContextResolver = {
  resolve: () => ({
    participationMode: "unavailable",
    viewerId: null,
    sessionPoints: 0,
    acceptedCandidateId: null,
    connection: serviceHealthSchema.parse({
      service: "test",
      status: "ready",
      checkedAt: NOW,
      retryable: false,
    }),
  }),
};

async function openVotingCycle(context: Awaited<ReturnType<typeof createContext>>) {
  const state = await context.persistence.sessions.load(context.started.view.session.sessionId);
  if (state === null) throw new Error("test session is missing");
  const batchId = "hosted-test-batch";
  await context.persistence.candidates.store(candidateBatchSchema.parse({
    envelope: {
      ...state.questCycle.envelope,
      messageId: batchId,
      correlationId: batchId,
      source: "algorithm",
    },
    candidates: [
      ["candidate-one", "Hold Your Ground", "Stay in your current playable area for thirty seconds."],
      ["candidate-two", "Caster Mode", "Narrate the next thirty seconds like a sports commentator."],
      ["candidate-three", "Audience Check-In", "Explain your next move before taking another action."],
    ].map(([candidateId, title, instruction], index) => ({
      candidateId,
      title,
      instruction,
      durationSeconds: 30,
      difficulty: index === 1 ? "medium" : "easy",
      rewardPoints: 100,
      rationale: "Safe end-to-end hosted-board test candidate.",
      sourceSignalIds: [],
      confidence: 0.8,
      generation: { method: "algorithmic", provider: null, generatedAt: NOW },
    })),
  }));
  const systemActor: VerifiedCommandActor = {
    kind: "system",
    actorId: "hosted-test-system",
    expiresAt: null,
    moderatorForBroadcasterIds: [],
    voterKey: null,
    participationModes: [],
  };
  const proposed = await context.runtime.execute(systemIntelligenceCommandSchema.parse({
    contractVersion: CONTRACT_VERSION,
    sessionId: state.session.sessionId,
    questCycleId: state.questCycle.envelope.questCycleId,
    commandId: "hosted-test-intelligence",
    correlationId: batchId,
    expectedRevision: state.session.revision,
    issuedAt: NOW,
    actor: { kind: "system", actorId: systemActor.actorId },
    type: "system.intelligence-ready",
    candidateBatchId: batchId,
  }), systemActor, projectionContext);
  if (!proposed.ok) throw new Error(proposed.error.message);
  const broadcasterActor: VerifiedCommandActor = {
    kind: "broadcaster",
    actorId: state.session.broadcasterId,
    expiresAt: null,
    moderatorForBroadcasterIds: [],
    voterKey: null,
    participationModes: [],
  };
  const approved = await context.runtime.execute(streamerQuestCommandSchema.parse({
    contractVersion: CONTRACT_VERSION,
    sessionId: state.session.sessionId,
    questCycleId: state.questCycle.envelope.questCycleId,
    commandId: "hosted-test-approve",
    correlationId: batchId,
    expectedRevision: proposed.receipt.state.session.revision,
    issuedAt: NOW,
    actor: { kind: "broadcaster", actorId: broadcasterActor.actorId },
    type: "streamer.quest",
    action: "approve",
    candidateId: null,
  }), broadcasterActor, projectionContext);
  if (!approved.ok) throw new Error(approved.error.message);
}

describe("HostedBoardApplication", () => {
  it("opens one anonymous browser identity and projects the canonical hosted view", async () => {
    const { hosted, started } = await createContext();
    expect(started.roomCode).not.toBeNull();
    const opened = await hosted.open(started.roomCode ?? "", null);
    const reopened = await hosted.open(started.roomCode ?? "", opened.token);
    expect(reopened.token).toBe(opened.token);

    const view = await hosted.read(opened.token);
    expect(view).toMatchObject({
      participationMode: "hosted-board",
      viewerId: null,
      canReact: true,
      connection: { service: "hosted-quest-board", status: "ready" },
    });
  });

  it("routes reactions through the authoritative private participation actor", async () => {
    const { hosted, started } = await createContext();
    const opened = await hosted.open(started.roomCode ?? "", null);
    const result = await hosted.react(opened.token, {
      commandId: "reaction-1",
      reaction: "hype",
    });
    expect(result).toMatchObject({ ok: true, outcome: "committed" });
    expect(result.view.communityHype).toBeGreaterThan(0);

    const duplicate = await hosted.react(opened.token, {
      commandId: "reaction-1",
      reaction: "hype",
    });
    expect(duplicate).toMatchObject({ ok: true, outcome: "duplicate" });
  });

  it("accepts one hosted vote and privately restores its acknowledgement", async () => {
    const current = await createContext();
    await openVotingCycle(current);
    const opened = await current.hosted.open(current.started.roomCode ?? "", null);
    const before = await current.hosted.read(opened.token);
    expect(before).toMatchObject({ canVote: true, acceptedCandidateId: null });
    expect(before.questCycle.voteTallies).toEqual([]);

    const result = await current.hosted.vote(opened.token, {
      commandId: "hosted-vote-1",
      candidateId: "candidate-two",
    });
    expect(result).toMatchObject({
      ok: true,
      outcome: "committed",
      view: { canVote: false, acceptedCandidateId: "candidate-two" },
    });
    expect(result.view.questCycle.voteTallies).toContainEqual({
      candidateId: "candidate-two",
      votes: 1,
    });

    const restored = await current.hosted.read(opened.token);
    expect(restored.acceptedCandidateId).toBe("candidate-two");
  });

  it("rejects missing and tampered viewer grants", async () => {
    const { hosted, started } = await createContext();
    await expect(hosted.read(null)).rejects.toMatchObject({
      code: "unauthenticated",
    } satisfies Partial<HostedBoardApplicationError>);
    const opened = await hosted.open(started.roomCode ?? "", null);
    await expect(hosted.read(`${opened.token}x`)).rejects.toMatchObject({
      code: "unauthenticated",
    } satisfies Partial<HostedBoardApplicationError>);
  });
});
