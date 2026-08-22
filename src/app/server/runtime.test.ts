import { describe, expect, it, vi } from "vitest";

import { createAlgorithmicCandidateStrategy, createValidatingCandidateProvider } from "@/ai";
import {
  authoritativeSessionStateSchema,
  commandFingerprint,
  serviceHealthSchema,
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
