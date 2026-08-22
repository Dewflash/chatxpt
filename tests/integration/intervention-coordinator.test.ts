import { describe, expect, it } from "vitest";

import {
  Role1InterventionCoordinator,
  intelligenceSnapshotSchema,
  questCycleStateSchema,
  systemIntelligenceCommandSchema,
  type CandidateBatch,
  type CandidateInput,
  type CandidateProvider,
  type InterventionDecision,
  type InterventionPolicy,
} from "../../src/core";
import {
  contractFixtureAudienceSnapshot,
  contractFixtureCandidateBatch,
  contractFixtureEnvelope,
  contractFixtureGameplaySnapshot,
  contractFixtureLiveDirectorState,
  contractFixtureProfile,
  contractFixtureQuestCycle,
  contractFixtureSession,
} from "../../src/core/testing";
import { DefaultCandidateAssembler } from "../../src/quest-engine";
import { persistenceState } from "./persistence-fixtures";

const NOW = contractFixtureEnvelope.occurredAt + 1_000;

function intelligence() {
  return intelligenceSnapshotSchema.parse({
    envelope: contractFixtureEnvelope,
    gameplay: contractFixtureGameplaySnapshot,
    audience: contractFixtureAudienceSnapshot,
  });
}

class StaticPolicy implements InterventionPolicy {
  readonly calls: unknown[] = [];

  constructor(private readonly decision: InterventionDecision) {}

  decide(input: Parameters<InterventionPolicy["decide"]>[0]): InterventionDecision {
    this.calls.push(structuredClone(input));
    return this.decision;
  }
}

class RecordingCandidateProvider implements CandidateProvider {
  calls: CandidateInput[] = [];

  async generate(input: CandidateInput): Promise<CandidateBatch> {
    this.calls.push(structuredClone(input));
    return structuredClone(contractFixtureCandidateBatch);
  }
}

describe("Role 1 intervention coordinator", () => {
  it("does not call Role 2 candidate generation when Role 3 intervention policy denies", async () => {
    const policy = new StaticPolicy({
      shouldPropose: false,
      score: 0,
      reasons: ["emergency-paused"],
      evidenceSignalIds: [],
    });
    const provider = new RecordingCandidateProvider();
    const stored: CandidateBatch[] = [];
    const executed: unknown[] = [];
    const state = { ...persistenceState(), emergencyPaused: true };
    const coordinator = new Role1InterventionCoordinator(
      policy,
      provider,
      new DefaultCandidateAssembler(),
      { store: async (batch) => void stored.push(batch) },
      {
        execute: async (command) => {
          executed.push(command);
          return {
            ok: false,
            error: { code: "validation", message: "should not execute", retryable: false },
          };
        },
      },
      () => NOW,
    );

    const result = await coordinator.run({
      state,
      intelligence: intelligence(),
      recentQuests: [{ title: "Old quest", occurredAt: NOW - 10_000 }],
      candidateInputEnvelope: contractFixtureEnvelope,
      commandId: "fixture-intelligence-command",
      correlationId: "fixture-intelligence-correlation",
      systemActorId: "fixture-orchestrator",
      issuedAt: NOW,
    });

    expect(result).toMatchObject({ ok: true, outcome: "denied" });
    expect(policy.calls).toHaveLength(1);
    expect(policy.calls[0]).toMatchObject({
      emergencyPaused: true,
      profile: { profileId: state.profile.profileId },
      recentQuests: [{ title: "Old quest" }],
    });
    expect(provider.calls).toHaveLength(0);
    expect(stored).toHaveLength(0);
    expect(executed).toHaveLength(0);
  });

  it("generates, Role 3-validates, stores, and submits only after intervention is allowed", async () => {
    const state = persistenceState();
    const policy = new StaticPolicy({
      shouldPropose: true,
      score: 0.8,
      reasons: ["eligible"],
      evidenceSignalIds: ["fixture-signal"],
    });
    const provider = new RecordingCandidateProvider();
    const stored: CandidateBatch[] = [];
    const executed: unknown[] = [];
    const coordinator = new Role1InterventionCoordinator(
      policy,
      provider,
      new DefaultCandidateAssembler(),
      { store: async (batch) => void stored.push(batch) },
      {
        execute: async (command) => {
          executed.push(command);
          return {
            ok: true,
            outcome: "committed",
            receipt: {
              command: systemIntelligenceCommandSchema.parse(command),
              commandFingerprint: "fixture",
              state: {
                session: contractFixtureSession,
                profile: contractFixtureProfile,
                services: [],
                gameplay: contractFixtureGameplaySnapshot,
                audience: contractFixtureAudienceSnapshot,
                questCycle: contractFixtureQuestCycle,
                emergencyPaused: false,
                communityHype: 0,
              },
              events: [],
              acceptedAt: NOW,
            },
            views: null,
            delivery: "not-republished",
          };
        },
      },
      () => NOW,
    );

    const result = await coordinator.run({
      state,
      intelligence: intelligence(),
      recentQuests: [{ title: "Old quest", occurredAt: NOW - 10_000 }],
      candidateInputEnvelope: contractFixtureEnvelope,
      commandId: "fixture-intelligence-command",
      correlationId: "fixture-intelligence-correlation",
      systemActorId: "fixture-orchestrator",
      issuedAt: NOW,
    });

    expect(result).toMatchObject({ ok: true, outcome: "submitted" });
    expect(provider.calls).toHaveLength(1);
    expect(provider.calls[0]).toMatchObject({
      profile: { profileId: state.profile.profileId },
      recentQuestTitles: ["Old quest"],
    });
    expect(stored).toHaveLength(1);
    expect(stored[0].candidates).toHaveLength(3);
    expect(stored[0].candidates.every(({ generation }) => generation.method === "deterministic-fallback"))
      .toBe(true);
    expect(result).toMatchObject({
      candidateBatch: { candidates: stored[0].candidates },
    });
    const command = systemIntelligenceCommandSchema.parse(executed[0]);
    expect(command).toMatchObject({
      commandId: "fixture-intelligence-command",
      expectedRevision: 0,
      candidateBatchId: stored[0].envelope.messageId,
      actor: { kind: "system", actorId: "fixture-orchestrator" },
    });
  });

  it("passes active ChatXPT quest context separately into candidate generation", async () => {
    const base = persistenceState();
    const active = contractFixtureCandidateBatch.candidates[0];
    const state = {
      ...base,
      liveDirector: structuredClone(contractFixtureLiveDirectorState),
      questCycle: questCycleStateSchema.parse({
        ...base.questCycle,
        status: "active",
        options: contractFixtureCandidateBatch.candidates,
        activeCandidateId: active.candidateId,
        availableStreamerActions: ["cancel", "succeed", "fail"],
        startsAt: NOW - 5_000,
        endsAt: NOW + 55_000,
        progress: {
          value: 0,
          updatedAt: NOW - 5_000,
          method: "manual",
          evidenceSignalIds: [],
        },
      }),
    };
    const policy = new StaticPolicy({
      shouldPropose: true,
      score: 0.8,
      reasons: ["fixture-active-context"],
      evidenceSignalIds: [],
    });
    const provider = new RecordingCandidateProvider();
    const coordinator = new Role1InterventionCoordinator(
      policy,
      provider,
      new DefaultCandidateAssembler(),
      { store: async () => undefined },
      {
        execute: async () => ({
          ok: false,
          error: { code: "validation", message: "fixture stops after generation", retryable: false },
        }),
      },
      () => NOW,
    );

    await coordinator.run({
      state,
      intelligence: intelligence(),
      recentQuests: [],
      candidateInputEnvelope: contractFixtureEnvelope,
      commandId: "fixture-intelligence-command",
      correlationId: "fixture-intelligence-correlation",
      systemActorId: "fixture-orchestrator",
      issuedAt: NOW,
    });

    expect(provider.calls).toHaveLength(1);
    expect(provider.calls[0].streamerGoal).toBe(
      contractFixtureLiveDirectorState.declaredIntent.status === "known"
        ? contractFixtureLiveDirectorState.declaredIntent.goal
        : null,
    );
    expect(provider.calls[0].activeChatXptQuest).toBe(`${active.title}: ${active.instruction}`);
  });
});
