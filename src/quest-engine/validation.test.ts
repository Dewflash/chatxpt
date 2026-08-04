import { describe, expect, it } from "vitest";

import {
  intelligenceSnapshotSchema,
  questCycleStateSchema,
  streamerProfileSchema,
  type IntelligenceSnapshot,
  type QuestCandidate,
} from "../core";
import { DefaultCandidateAssembler, DefaultCandidateValidator } from ".";
import {
  ROLE_3_FIXTURE_TIME,
  role3CandidateCases,
  role3FixtureCandidateBatch,
  role3FixtureIdleState,
} from "./testing";

const profile = streamerProfileSchema.parse({
  profileId: "role-3-validation-profile",
  streamerId: "role-3-validation-streamer",
  revision: 0,
  displayName: "Role 3 Validation Fixture",
  gameId: null,
  gameName: null,
  experience: { intensity: 0.5 },
  restrictions: [],
  preferredQuestTypes: [],
  forbiddenQuestTypes: [],
  accessibilityNeeds: [],
});

function intelligence(
  signals: IntelligenceSnapshot["gameplay"]["signals"] = [],
  audienceSignals: IntelligenceSnapshot["audience"]["signals"] = [],
): IntelligenceSnapshot {
  const envelope = {
    ...role3FixtureIdleState.envelope,
    messageId: "role-3-validation-intelligence",
  };
  return intelligenceSnapshotSchema.parse({
    envelope,
    gameplay: {
      envelope: { ...envelope, messageId: "role-3-validation-gameplay" },
      capabilities: {
        tier: "universal-visual",
        gameId: null,
        adapterId: null,
        supportedSignals: signals.map((signal) => signal.kind),
      },
      signals,
    },
    audience: {
      envelope: { ...envelope, messageId: "role-3-validation-audience" },
      sampleSize: audienceSignals.length,
      signals: audienceSignals,
    },
  });
}

function assemblyInput(overrides: Partial<Parameters<DefaultCandidateAssembler["assemble"]>[0]> = {}) {
  return {
    envelope: { ...role3FixtureCandidateBatch.envelope, source: "quest-engine" as const },
    candidates: role3FixtureCandidateBatch.candidates,
    intelligence: intelligence(),
    profile,
    currentState: role3FixtureIdleState,
    recentQuests: [],
    now: ROLE_3_FIXTURE_TIME,
    seed: "role-3-validation-seed",
    ...overrides,
  };
}

function changedCandidate(
  base: QuestCandidate,
  patch: Partial<QuestCandidate>,
): QuestCandidate {
  return { ...base, ...patch };
}

describe("DefaultCandidateValidator", () => {
  it("hard-rejects unsafe output without claiming it can be repaired", () => {
    const result = new DefaultCandidateValidator().validate(
      role3CandidateCases.unsafe.candidates[0],
      {
        intelligence: intelligence(),
        profile,
        currentState: role3FixtureIdleState,
        recentQuests: [],
        acceptedCandidates: [],
        now: ROLE_3_FIXTURE_TIME,
      },
    );

    expect(result.accepted).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "unsafe", severity: "reject", repairable: false }),
    );
  });

  it("rejects streamer boundaries, accessibility conflicts, and recent repetition", () => {
    const candidate = role3FixtureCandidateBatch.candidates[1];
    const result = new DefaultCandidateValidator().validate(candidate, {
      intelligence: intelligence(),
      profile: streamerProfileSchema.parse({
        ...profile,
        restrictions: ["sports commentator"],
        accessibilityNeeds: ["narrate seconds"],
      }),
      currentState: role3FixtureIdleState,
      recentQuests: [{ title: "Caster Mode", occurredAt: ROLE_3_FIXTURE_TIME - 1_000 }],
      acceptedCandidates: [],
      now: ROLE_3_FIXTURE_TIME,
    });

    expect(result.accepted).toBe(false);
    expect(result.issues.map(({ code }) => code)).toEqual(
      expect.arrayContaining(["streamer-restricted", "accessibility-conflict", "recently-repeated"]),
    );
  });

  it("requires fresh supported evidence for fact-specific candidates", () => {
    const healthCandidate = changedCandidate(role3FixtureCandidateBatch.candidates[0], {
      candidateId: "health-specific-candidate",
      title: "Health Hold",
      instruction: "Stay above half health for the next 30 seconds.",
      rationale: "Uses a calibrated health fact.",
      sourceSignalIds: [],
    });
    const withoutEvidence = new DefaultCandidateValidator().validate(healthCandidate, {
      intelligence: intelligence(),
      profile,
      currentState: role3FixtureIdleState,
      recentQuests: [],
      acceptedCandidates: [],
      now: ROLE_3_FIXTURE_TIME,
    });
    expect(withoutEvidence).toMatchObject({
      accepted: false,
      issues: expect.arrayContaining([expect.objectContaining({ code: "unknown-dependent" })]),
    });

    const healthSignal = {
      signalId: "known-health",
      kind: "health",
      observation: {
        status: "known" as const,
        value: 0.8,
        provenance: {
          source: "test-fixture" as const,
          method: "role-3-validation-fixture",
          confidence: 0.9,
          observedAt: ROLE_3_FIXTURE_TIME,
          receivedAt: ROLE_3_FIXTURE_TIME,
          evidenceClass: "fixture" as const,
        },
      },
    };
    const withEvidence = new DefaultCandidateValidator().validate(
      changedCandidate(healthCandidate, { sourceSignalIds: [healthSignal.signalId] }),
      {
        intelligence: intelligence([healthSignal]),
        profile,
        currentState: role3FixtureIdleState,
        recentQuests: [],
        acceptedCandidates: [],
        now: ROLE_3_FIXTURE_TIME,
      },
    );
    expect(withEvidence.accepted).toBe(true);
  });

  it("accepts a fresh known audience signal as candidate citation evidence", () => {
    const audienceSignal = {
      signalId: "known-audience-hype",
      kind: "audience-hype",
      observation: {
        status: "known" as const,
        value: 0.8,
        provenance: {
          source: "test-fixture" as const,
          method: "role-3-validation-fixture",
          confidence: 0.9,
          observedAt: ROLE_3_FIXTURE_TIME,
          receivedAt: ROLE_3_FIXTURE_TIME,
          evidenceClass: "fixture" as const,
        },
      },
    };
    const candidate = changedCandidate(role3FixtureCandidateBatch.candidates[1], {
      candidateId: "audience-backed-candidate",
      sourceSignalIds: [audienceSignal.signalId],
      rationale: "Fresh audience energy supports a commentary challenge.",
    });
    const result = new DefaultCandidateValidator().validate(candidate, {
      intelligence: intelligence([], [audienceSignal]),
      profile,
      currentState: role3FixtureIdleState,
      recentQuests: [],
      acceptedCandidates: [],
      now: ROLE_3_FIXTURE_TIME,
    });

    expect(result.accepted).toBe(true);
  });

  it("rejects low confidence, bad duration/difficulty fit, duplicates, and lifecycle conflicts", () => {
    const candidate = changedCandidate(role3FixtureCandidateBatch.candidates[0], {
      confidence: 0.49,
      durationSeconds: 10,
    });
    const activeState = questCycleStateSchema.parse({
      ...role3FixtureIdleState,
      status: "active",
      options: role3FixtureCandidateBatch.candidates,
      activeCandidateId: role3FixtureCandidateBatch.candidates[0].candidateId,
      availableStreamerActions: ["cancel"],
      startsAt: ROLE_3_FIXTURE_TIME,
      endsAt: ROLE_3_FIXTURE_TIME + 30_000,
      progress: {
        value: 0,
        updatedAt: ROLE_3_FIXTURE_TIME,
        method: "unknown",
        evidenceSignalIds: [],
      },
    });
    const result = new DefaultCandidateValidator().validate(candidate, {
      intelligence: intelligence(),
      profile,
      currentState: activeState,
      recentQuests: [],
      acceptedCandidates: [role3FixtureCandidateBatch.candidates[0]],
      now: ROLE_3_FIXTURE_TIME,
    });

    expect(result.accepted).toBe(false);
    expect(result.issues.map(({ code }) => code)).toEqual(
      expect.arrayContaining([
        "low-confidence",
        "duration-out-of-range",
        "difficulty-mismatch",
        "duplicate",
        "lifecycle-conflict",
      ]),
    );
  });
});

describe("DefaultCandidateAssembler", () => {
  it("preserves three valid, distinct provided candidates", () => {
    const result = new DefaultCandidateAssembler().assemble(assemblyInput());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.batch.candidates.map(({ candidateId }) => candidateId)).toEqual(
      role3FixtureCandidateBatch.candidates.map(({ candidateId }) => candidateId),
    );
    expect(result.audit).toHaveLength(3);
  });

  it.each([0, 1, 2])("assembles exactly three options from %i usable provided candidates", (usableCount) => {
    const unsafe = role3CandidateCases.unsafe.candidates[0];
    const candidates = [
      ...role3FixtureCandidateBatch.candidates.slice(0, usableCount),
      ...Array.from({ length: 3 - usableCount }, (_, index) => ({
        ...unsafe,
        candidateId: `unsafe-${usableCount}-${index}`,
      })),
    ];
    const result = new DefaultCandidateAssembler().assemble(assemblyInput({ candidates }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.batch.candidates).toHaveLength(3);
    expect(result.batch.candidates.filter(({ generation }) => generation.method === "deterministic-fallback")).toHaveLength(3 - usableCount);
    expect(result.audit.some((entry) => !entry.accepted && entry.source === "provided")).toBe(usableCount < 3);
  });

  it("is deterministic for the same seed and history", () => {
    const first = new DefaultCandidateAssembler().assemble(assemblyInput({ candidates: [] }));
    const replay = new DefaultCandidateAssembler().assemble(assemblyInput({ candidates: [] }));
    expect(first).toEqual(replay);
  });

  it("uses history-sensitive fallbacks and reports exhaustion rather than weakening rules", () => {
    const fallbackTitles = [
      "Plan Out Loud",
      "Caster Mode",
      "Calm Focus",
      "Three-Step Preview",
      "Audience Coach",
      "Dramatic Recap",
      "Decision Spotlight",
      "One-Minute Mentor",
      "Positive Commentary",
    ];
    const result = new DefaultCandidateAssembler().assemble(
      assemblyInput({
        candidates: [],
        recentQuests: fallbackTitles.map((title, index) => ({
          title,
          occurredAt: ROLE_3_FIXTURE_TIME - index * 1_000,
        })),
      }),
    );

    expect(result).toMatchObject({ ok: false, code: "fallback-exhausted" });
    if (result.ok) return;
    expect(result.audit).toHaveLength(fallbackTitles.length);
    expect(result.audit.every((entry) => entry.issues.some(({ code }) => code === "recently-repeated"))).toBe(true);
  });
});
