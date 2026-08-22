import { describe, expect, it, vi } from "vitest";

import { createAlgorithmicCandidateStrategy, createValidatingCandidateProvider } from "@/ai";
import {
  authoritativeSessionStateSchema,
  commandFingerprint,
  serviceHealthSchema,
  streamerQuestCommandSchema,
  systemQuestTickCommandSchema,
  type CandidateInput,
  type CandidateProvider,
  type ProjectionContextResolver,
} from "@/core";
import {
  contractFixtureAudienceSnapshot,
  contractFixtureEnvelope,
  contractFixtureGameplaySnapshot,
  contractFixtureProfile,
  contractFixtureQuestCycle,
  contractFixtureSession,
  contractFixtureUiX06QuestStateCatalog,
} from "@/core/testing";
import { createMemoryPersistenceRuntime } from "@/realtime";

import { ChatXptServerRuntime } from "./runtime";

const NOW = contractFixtureEnvelope.occurredAt + 1_000;

const projectionContext: ProjectionContextResolver = {
  resolve: () => ({
    participationMode: "unavailable",
    viewerId: null,
    sessionPoints: 0,
    acceptedCandidateId: null,
    connection: serviceHealthSchema.parse({
      service: "server-runtime-test",
      status: "ready",
      checkedAt: NOW,
      retryable: false,
    }),
  }),
};

function eligibleState() {
  return authoritativeSessionStateSchema.parse({
    session: {
      ...contractFixtureSession,
      status: "live",
      startedAt: contractFixtureSession.createdAt,
    },
    profile: contractFixtureProfile,
    services: [],
    gameplay: {
      ...contractFixtureGameplaySnapshot,
      envelope: {
        ...contractFixtureGameplaySnapshot.envelope,
        occurredAt: NOW,
        receivedAt: NOW,
      },
      signals: [{
        signalId: "runtime-quiet-activity",
        kind: "activity-intensity",
        observation: {
          status: "known",
          value: 0,
          provenance: {
            source: "test-fixture",
            method: "server-runtime-concurrency-test",
            confidence: 0.9,
            observedAt: NOW,
            receivedAt: NOW,
            evidenceClass: "fixture",
          },
        },
      }],
    },
    audience: contractFixtureAudienceSnapshot,
    questCycle: contractFixtureQuestCycle,
    emergencyPaused: false,
    communityHype: 0,
  });
}

describe("ChatXptServerRuntime eligible proposal coordination", () => {
  it("shares one in-flight candidate generation request for the same cycle revision", async () => {
    let releaseProvider!: () => void;
    const gate = new Promise<void>((resolve) => {
      releaseProvider = resolve;
    });
    const algorithmic = createValidatingCandidateProvider(createAlgorithmicCandidateStrategy());
    const generate = vi.fn(async (input: CandidateInput) => {
      await gate;
      return algorithmic.generate(input);
    });
    const candidateProvider: CandidateProvider = { generate };
    const runtime = new ChatXptServerRuntime({
      persistence: createMemoryPersistenceRuntime(),
      candidateProvider,
      clock: { now: () => NOW },
    });
    const state = eligibleState();

    const first = runtime.requestEligibleCycleProposal(state, projectionContext);
    const second = runtime.requestEligibleCycleProposal(state, projectionContext);
    await vi.waitFor(() => expect(generate).toHaveBeenCalledTimes(1));
    releaseProvider();
    const [firstResult, secondResult] = await Promise.all([first, second]);

    expect(generate).toHaveBeenCalledTimes(1);
    expect(secondResult).toEqual(firstResult);
  });

  it("keeps a fresh same-cycle audience aggregate when gameplay advanced the revision", async () => {
    const base = eligibleState();
    const currentRevision = base.session.revision + 1;
    const observedAt = NOW - 2_000;
    const state = authoritativeSessionStateSchema.parse({
      ...base,
      session: { ...base.session, revision: currentRevision },
      gameplay: {
        ...base.gameplay,
        envelope: { ...base.gameplay?.envelope, revision: currentRevision },
      },
      audience: {
        ...contractFixtureAudienceSnapshot,
        envelope: {
          ...contractFixtureAudienceSnapshot.envelope,
          revision: currentRevision - 1,
          occurredAt: observedAt,
          receivedAt: observedAt,
        },
        sampleSize: 3,
        signals: [{
          signalId: "runtime-fresh-audience-energy",
          kind: "audience-energy",
          observation: {
            status: "known",
            value: 0.8,
            provenance: {
              source: "test-fixture",
              method: "server-runtime-audience-rebase-test",
              confidence: 0.9,
              observedAt,
              receivedAt: observedAt,
              evidenceClass: "fixture",
            },
          },
        }],
      },
      questCycle: {
        ...base.questCycle,
        envelope: { ...base.questCycle.envelope, revision: currentRevision },
      },
    });
    const algorithmic = createValidatingCandidateProvider(createAlgorithmicCandidateStrategy());
    const generate = vi.fn(async (input: CandidateInput) => algorithmic.generate(input));
    const runtime = new ChatXptServerRuntime({
      persistence: createMemoryPersistenceRuntime(),
      candidateProvider: { generate },
      clock: { now: () => NOW },
    });

    await runtime.requestEligibleCycleProposal(state, projectionContext);

    const receivedInput = generate.mock.calls[0]?.[0];
    expect(receivedInput?.intelligence.audience).toMatchObject({
      envelope: { revision: currentRevision },
      sampleSize: 3,
      signals: [{
        signalId: "runtime-fresh-audience-energy",
        observation: { provenance: { observedAt } },
      }],
    });
  });

  it("preserves algorithmic candidates for the live Minecraft Java Edition profile name", async () => {
    const base = eligibleState();
    const state = authoritativeSessionStateSchema.parse({
      ...base,
      session: { ...base.session, revision: 1 },
      profile: {
        ...base.profile,
        gameId: "minecraft",
        gameName: "Minecraft Java Edition",
      },
      gameplay: {
        ...base.gameplay,
        envelope: { ...base.gameplay?.envelope, revision: 1 },
      },
      audience: {
        ...base.audience,
        envelope: { ...base.audience?.envelope, revision: 1 },
      },
      questCycle: {
        ...base.questCycle,
        envelope: { ...base.questCycle.envelope, revision: 1 },
      },
    });
    const initial = authoritativeSessionStateSchema.parse({
      ...state,
      session: { ...state.session, status: "preparing", revision: 0, startedAt: null },
      gameplay: null,
      audience: null,
      questCycle: {
        ...state.questCycle,
        envelope: { ...state.questCycle.envelope, revision: 0 },
      },
    });
    const persistence = createMemoryPersistenceRuntime();
    await persistence.lifecycle.bootstrap({
      roomCode: "MNCRAFT2",
      state: initial,
      createdAt: initial.session.createdAt,
    });
    const seedCommand = systemQuestTickCommandSchema.parse({
      contractVersion: state.questCycle.envelope.contractVersion,
      sessionId: state.session.sessionId,
      questCycleId: state.questCycle.envelope.questCycleId,
      commandId: "seed-live-minecraft-java-profile",
      correlationId: "seed-live-minecraft-java-profile",
      expectedRevision: 0,
      issuedAt: NOW,
      actor: { kind: "system", actorId: "runtime-test-seed" },
      type: "system.quest-tick",
    });
    await persistence.sessions.commit({
      command: seedCommand,
      commandFingerprint: commandFingerprint(seedCommand),
      expectedRevision: 0,
      nextState: state,
      events: [],
      acceptedAt: NOW,
    });
    const runtime = new ChatXptServerRuntime({
      persistence,
      candidateProvider: createValidatingCandidateProvider(createAlgorithmicCandidateStrategy()),
      clock: { now: () => NOW },
    });

    const result = await runtime.requestEligibleCycleProposal(state, projectionContext);

    if (!result.ok) throw new Error(result.error.message);
    expect(result).toMatchObject({ ok: true, outcome: "committed" });
    if (!("receipt" in result)) throw new Error("Expected a committed candidate proposal");
    expect(result.receipt.state.questCycle.options).toHaveLength(3);
    expect(result.receipt.state.questCycle.options.every(
      ({ generation }) => generation.method === "algorithmic",
    )).toBe(true);

    const proposed = result.receipt.state;
    const approved = await runtime.execute(
      streamerQuestCommandSchema.parse({
        contractVersion: proposed.questCycle.envelope.contractVersion,
        sessionId: proposed.session.sessionId,
        questCycleId: proposed.questCycle.envelope.questCycleId,
        commandId: "approve-live-minecraft-java-profile",
        correlationId: "approve-live-minecraft-java-profile",
        expectedRevision: proposed.session.revision,
        issuedAt: NOW,
        actor: { kind: "broadcaster", actorId: proposed.session.broadcasterId },
        type: "streamer.quest",
        action: "approve",
        candidateId: proposed.questCycle.options[0]?.candidateId,
      }),
      {
        kind: "broadcaster",
        actorId: proposed.session.broadcasterId,
        expiresAt: null,
        moderatorForBroadcasterIds: [],
        voterKey: null,
        participationModes: [],
      },
      projectionContext,
    );

    if (!approved.ok) throw new Error(approved.error.message);
    expect(approved.delivery).toBe("published");
  });

  it("advances a terminal quest through its elapsed cooldown into a new idle cycle", async () => {
    const persistence = createMemoryPersistenceRuntime();
    const terminalCycle = structuredClone(
      contractFixtureUiX06QuestStateCatalog["r5.quest.succeeded-reward.v1"],
    );
    const resultAt = terminalCycle.result?.occurredAt;
    if (resultAt === undefined) throw new Error("Expected terminal fixture result");
    const initial = authoritativeSessionStateSchema.parse({
      ...eligibleState(),
      session: {
        ...eligibleState().session,
        status: "preparing",
        revision: 0,
        startedAt: null,
      },
      questCycle: {
        ...contractFixtureQuestCycle,
        envelope: { ...contractFixtureQuestCycle.envelope, revision: 0 },
      },
    });
    const state = authoritativeSessionStateSchema.parse({
      ...eligibleState(),
      session: {
        ...eligibleState().session,
        revision: 1,
      },
      questCycle: {
        ...terminalCycle,
        envelope: { ...terminalCycle.envelope, revision: 1 },
      },
    });
    await persistence.lifecycle.bootstrap({
      roomCode: "TCKTST23",
      state: initial,
      createdAt: initial.session.createdAt,
    });
    const seedCommand = systemQuestTickCommandSchema.parse({
        contractVersion: state.questCycle.envelope.contractVersion,
        sessionId: state.session.sessionId,
        questCycleId: state.questCycle.envelope.questCycleId,
        commandId: "seed-terminal-cycle",
        correlationId: "seed-terminal-cycle",
        expectedRevision: 0,
        issuedAt: resultAt,
        actor: { kind: "system", actorId: "runtime-test-seed" },
        type: "system.quest-tick",
      });
    await persistence.sessions.commit({
      command: seedCommand,
      commandFingerprint: commandFingerprint(seedCommand),
      expectedRevision: 0,
      nextState: state,
      events: [],
      acceptedAt: resultAt,
    });
    const runtime = new ChatXptServerRuntime({
      persistence,
      clock: { now: () => resultAt + 121_000 },
    });

    const advanced = await runtime.advanceQuestLifecycleIfDue(state);

    expect(advanced.questCycle).toMatchObject({
      status: "idle",
      options: [],
      activeCandidateId: null,
      startsAt: null,
      endsAt: null,
      result: null,
    });
    await expect(persistence.sessions.load(state.session.sessionId)).resolves.toMatchObject({
      questCycle: { status: "idle" },
    });
  });
});
