import { describe, expect, it } from "vitest";

import {
  CONTRACT_VERSION,
  intelligenceSnapshotSchema,
  streamerProfileSchema,
  type IntelligenceSnapshot,
  type NamedSignal,
} from "../core";
import {
  checkRecentQuestRepetition,
  decideActiveQuestInterruption,
  defaultCooldownEndsAt,
  DefaultInterventionPolicy,
} from ".";
import {
  ROLE_3_FIXTURE_TIME,
  role3FixtureIdleState,
  role3FixtureCandidateBatch,
} from "./testing";

const fixtureEnvelope = {
  contractVersion: CONTRACT_VERSION,
  sessionId: role3FixtureIdleState.envelope.sessionId,
  questCycleId: role3FixtureIdleState.envelope.questCycleId,
  messageId: "role-3-intelligence",
  correlationId: "role-3-intelligence-correlation",
  revision: 0,
  occurredAt: ROLE_3_FIXTURE_TIME,
  receivedAt: ROLE_3_FIXTURE_TIME,
  source: "test-fixture" as const,
  evidenceClass: "fixture" as const,
};

const fixtureProfile = streamerProfileSchema.parse({
  profileId: "role-3-profile",
  streamerId: "role-3-streamer",
  revision: 0,
  displayName: "Role 3 Fixture",
  gameId: null,
  gameName: null,
  experience: { intensity: 0.5 },
  restrictions: [],
  preferredQuestTypes: [],
  forbiddenQuestTypes: [],
  accessibilityNeeds: [],
});

function knownSignal(
  signalId: string,
  kind: string,
  value: string | number | boolean,
  options: { confidence?: number; observedAt?: number } = {},
): NamedSignal {
  return {
    signalId,
    kind,
    observation: {
      status: "known",
      value,
      provenance: {
        source: "test-fixture",
        method: "role-3-policy-fixture",
        confidence: options.confidence ?? 0.9,
        observedAt: options.observedAt ?? ROLE_3_FIXTURE_TIME,
        receivedAt: ROLE_3_FIXTURE_TIME,
        evidenceClass: "fixture",
      },
    },
  };
}

function unknownSignal(signalId: string, kind: string): NamedSignal {
  return {
    signalId,
    kind,
    observation: {
      status: "unknown",
      reason: "not-observed",
      provenance: {
        source: "test-fixture",
        method: "role-3-policy-fixture",
        confidence: 0,
        observedAt: ROLE_3_FIXTURE_TIME,
        receivedAt: ROLE_3_FIXTURE_TIME,
        evidenceClass: "fixture",
      },
    },
  };
}

function intelligence(
  gameplaySignals: readonly NamedSignal[],
  audienceSignals: readonly NamedSignal[] = [],
): IntelligenceSnapshot {
  return intelligenceSnapshotSchema.parse({
    envelope: fixtureEnvelope,
    gameplay: {
      envelope: { ...fixtureEnvelope, messageId: "role-3-gameplay" },
      capabilities: {
        tier: "universal-visual",
        gameId: null,
        adapterId: null,
        supportedSignals: gameplaySignals.map((signal) => signal.kind),
      },
      signals: gameplaySignals,
    },
    audience: {
      envelope: { ...fixtureEnvelope, messageId: "role-3-audience" },
      sampleSize: 3,
      signals: audienceSignals,
    },
  });
}

function policyInput(snapshot: IntelligenceSnapshot) {
  return {
    currentState: role3FixtureIdleState,
    intelligence: snapshot,
    profile: fixtureProfile,
    emergencyPaused: false,
    recentQuests: [],
    now: ROLE_3_FIXTURE_TIME,
  } as const;
}

function restampIntelligence(
  snapshot: IntelligenceSnapshot,
  patch: Partial<IntelligenceSnapshot["envelope"]>,
): IntelligenceSnapshot {
  return intelligenceSnapshotSchema.parse({
    ...snapshot,
    envelope: { ...snapshot.envelope, ...patch },
    gameplay: {
      ...snapshot.gameplay,
      envelope: { ...snapshot.gameplay.envelope, ...patch },
    },
    audience: {
      ...snapshot.audience,
      envelope: { ...snapshot.audience.envelope, ...patch },
    },
  });
}

describe("DefaultInterventionPolicy", () => {
  it("proposes during a fresh, confident, quiet opportunity", () => {
    const snapshot = intelligence(
      [knownSignal("activity", "activity-intensity", 0.1)],
      [knownSignal("boredom", "audience-boredom", 0.7)],
    );
    const result = new DefaultInterventionPolicy().decide(policyInput(snapshot));

    expect(result).toEqual({
      shouldPropose: true,
      score: 0.84,
      reasons: ["eligible"],
      evidenceSignalIds: ["activity", "boredom"],
    });
  });

  it.each([
    {
      name: "busy gameplay",
      snapshot: intelligence([knownSignal("activity", "activity-intensity", 0.9)]),
      reason: "busy-gameplay",
    },
    {
      name: "active fight",
      snapshot: intelligence([
        knownSignal("activity", "activity-intensity", 0.1),
        knownSignal("fight", "fight", true),
      ]),
      reason: "busy-gameplay",
    },
    {
      name: "unsafe moment",
      snapshot: intelligence([
        knownSignal("activity", "activity-intensity", 0.1),
        knownSignal("risk", "safety-risk", true),
      ]),
      reason: "unsafe-moment",
    },
    {
      name: "stale gameplay",
      snapshot: intelligence([
        knownSignal("activity", "activity-intensity", 0.1, {
          observedAt: ROLE_3_FIXTURE_TIME - 15_001,
        }),
      ]),
      reason: "insufficient-gameplay-evidence",
    },
    {
      name: "low-confidence gameplay",
      snapshot: intelligence([
        knownSignal("activity", "activity-intensity", 0.1, { confidence: 0.64 }),
      ]),
      reason: "insufficient-gameplay-evidence",
    },
    {
      name: "unknown-heavy gameplay",
      snapshot: intelligence([unknownSignal("activity", "activity-intensity")]),
      reason: "insufficient-gameplay-evidence",
    },
  ])("waits for $name", ({ snapshot, reason }) => {
    const result = new DefaultInterventionPolicy().decide(policyInput(snapshot));
    expect(result).toMatchObject({ shouldPropose: false, reasons: [reason] });
  });

  it("blocks intervention while the emergency latch is active", () => {
    const snapshot = intelligence([knownSignal("activity", "activity-intensity", 0.1)]);
    const result = new DefaultInterventionPolicy().decide({
      ...policyInput(snapshot),
      emergencyPaused: true,
    });
    expect(result).toMatchObject({ shouldPropose: false, reasons: ["emergency-paused"] });
  });

  it.each([
    { name: "another session", patch: { sessionId: "other-session" } },
    { name: "a stale revision", patch: { revision: 1 } },
  ])("rejects intelligence from $name", ({ patch }) => {
    const snapshot = intelligence(
      [knownSignal("activity", "activity-intensity", 0.1)],
      [knownSignal("boredom", "audience-boredom", 0.7)],
    );
    const result = new DefaultInterventionPolicy().decide(
      policyInput(restampIntelligence(snapshot, patch)),
    );

    expect(result).toEqual({
      shouldPropose: false,
      score: 0,
      reasons: ["invalid-context"],
      evidenceSignalIds: [],
    });
  });

  it("uses a deterministic threshold when the moment is safe but unsuitable", () => {
    const snapshot = intelligence([knownSignal("activity", "activity-intensity", 0.7)]);
    const input = policyInput(snapshot);
    const first = new DefaultInterventionPolicy().decide(input);
    const replay = new DefaultInterventionPolicy().decide(input);
    expect(first).toEqual(replay);
    expect(first).toMatchObject({
      shouldPropose: false,
      score: 0.33,
      reasons: ["below-suitability-threshold"],
    });
  });

  it("adapts intervention timing to the streamer's saved intensity", () => {
    const snapshot = intelligence(
      [knownSignal("activity", "activity-intensity", 0.7)],
      [knownSignal("hype", "audience-hype", 0.8)],
    );
    const lowIntensity = streamerProfileSchema.parse({
      ...fixtureProfile,
      experience: { intensity: 0 },
    });
    const highIntensity = streamerProfileSchema.parse({
      ...fixtureProfile,
      experience: { intensity: 1 },
    });
    const policy = new DefaultInterventionPolicy();

    expect(policy.decide({ ...policyInput(snapshot), profile: lowIntensity })).toMatchObject({
      shouldPropose: false,
      reasons: ["busy-gameplay"],
    });
    expect(policy.decide({ ...policyInput(snapshot), profile: highIntensity })).toEqual({
      shouldPropose: true,
      score: 0.57,
      reasons: ["eligible"],
      evidenceSignalIds: ["activity", "hype"],
    });
  });

  it("uses the neutral timing default when legacy profiles omit intensity", () => {
    const snapshot = intelligence(
      [knownSignal("activity", "activity-intensity", 0.1)],
      [knownSignal("boredom", "audience-boredom", 0.7)],
    );
    const legacyProfile = streamerProfileSchema.parse({
      ...fixtureProfile,
      experience: {},
    });

    expect(
      new DefaultInterventionPolicy().decide({
        ...policyInput(snapshot),
        profile: legacyProfile,
      }),
    ).toEqual({
      shouldPropose: true,
      score: 0.84,
      reasons: ["eligible"],
      evidenceSignalIds: ["activity", "boredom"],
    });
  });
});

describe("Phase 2 timing and interruption policy", () => {
  it("applies the accepted 120-second cooldown", () => {
    expect(defaultCooldownEndsAt(ROLE_3_FIXTURE_TIME)).toBe(ROLE_3_FIXTURE_TIME + 120_000);
    expect(defaultCooldownEndsAt(Number.MAX_SAFE_INTEGER)).toBeNull();
  });

  it("blocks substantially similar titles in the accepted history window", () => {
    const recent = [
      { title: "Caster Mode Challenge", occurredAt: ROLE_3_FIXTURE_TIME - 31 * 60_000 },
      { title: "Plan Out Loud", occurredAt: ROLE_3_FIXTURE_TIME - 10_000 },
    ];
    expect(
      checkRecentQuestRepetition("Caster Mode Challenge!", recent, ROLE_3_FIXTURE_TIME),
    ).toEqual({ repeated: true, matchedQuestTitle: "Caster Mode Challenge" });
    expect(checkRecentQuestRepetition("Hold Your Ground", recent, ROLE_3_FIXTURE_TIME)).toEqual({
      repeated: false,
      matchedQuestTitle: null,
    });
  });

  it("continues through minor change and cancels only for accepted hard reasons", () => {
    const safe = intelligence([knownSignal("activity", "activity-intensity", 0.5)]);
    const unsafe = intelligence([
      knownSignal("activity", "activity-intensity", 0.5),
      knownSignal("risk", "safety-risk", true),
    ]);
    const base = {
      intelligence: safe,
      now: ROLE_3_FIXTURE_TIME,
      emergencyPaused: false,
      sessionEnded: false,
      questImpossible: false,
    };
    expect(decideActiveQuestInterruption(base)).toEqual({ action: "continue", reason: "continue" });
    expect(decideActiveQuestInterruption({ ...base, intelligence: unsafe })).toEqual({
      action: "cancel",
      reason: "unsafe-moment",
    });
    expect(decideActiveQuestInterruption({ ...base, emergencyPaused: true })).toEqual({
      action: "cancel",
      reason: "emergency-paused",
    });
    expect(decideActiveQuestInterruption({ ...base, sessionEnded: true })).toEqual({
      action: "cancel",
      reason: "session-ended",
    });
    expect(decideActiveQuestInterruption({ ...base, questImpossible: true })).toEqual({
      action: "cancel",
      reason: "quest-impossible",
    });
  });

  it("keeps policy fixtures separate from generated candidate claims", () => {
    expect(role3FixtureCandidateBatch.envelope.evidenceClass).toBe("fixture");
  });
});
