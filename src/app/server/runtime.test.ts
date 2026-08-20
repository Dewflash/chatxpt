import { describe, expect, it, vi } from "vitest";

import { createAlgorithmicCandidateStrategy, createValidatingCandidateProvider } from "@/ai";
import {
  authoritativeSessionStateSchema,
  serviceHealthSchema,
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
});
