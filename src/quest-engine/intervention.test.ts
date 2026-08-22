import { describe, expect, it } from "vitest";

import {
  CONTRACT_VERSION,
  audiencePointerSchema,
  declaredStreamIntentSchema,
  intelligenceSnapshotSchema,
  questCycleStateSchema,
  streamerProfileSchema,
  type IntelligenceSnapshot,
  type NamedSignal,
  type AudiencePointer,
  type DeclaredStreamIntent,
} from "../core";
import {
  checkRecentQuestRepetition,
  createDirectorCueHistorySummary,
  decideActiveQuestInterruption,
  defaultCooldownEndsAt,
  DefaultDirectorCueSuitabilityPolicy,
  DefaultInterventionPolicy,
  DIRECTOR_CUE_ATTENTION_WINDOW_MILLISECONDS,
  DIRECTOR_CUE_COOLDOWN_MILLISECONDS,
  mergeDirectorCueHistory,
  type DirectorCueSuitabilityInput,
  type RecentDirectorCueSummary,
} from ".";
import { contractFixtureLiveDirectorState } from "../core/testing";
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

const fixtureDirectorIntent: Extract<DeclaredStreamIntent, { readonly status: "known" }> = {
  status: "known",
  intentId: "intent-build-safely",
  goal: "Build safely",
  objective: "Build safely while keeping chat involved",
  desiredAudienceInvolvement: "Choose the next safe build",
  inputMethod: "manual",
  confidence: 1,
  authorId: "role-3-streamer",
  updatedAt: ROLE_3_FIXTURE_TIME - 60_000,
  expiresAt: ROLE_3_FIXTURE_TIME + 60_000,
};

function directorAudience(
  patch: Partial<Extract<AudiencePointer, { readonly status: "known" }>> = {},
): Extract<AudiencePointer, { readonly status: "known" }> {
  const pointer = audiencePointerSchema.parse({
    status: "known",
    pointerId: "pointer-build-choice",
    topic: "Choose the next safe build",
    windowStartedAt: ROLE_3_FIXTURE_TIME - 10_000,
    windowEndedAt: ROLE_3_FIXTURE_TIME - 1_000,
    observedAt: ROLE_3_FIXTURE_TIME - 1_000,
    createdAt: ROLE_3_FIXTURE_TIME - 1_000,
    expiresAt: ROLE_3_FIXTURE_TIME + 29_000,
    confidence: 0.9,
    relevance: 0.8,
    intentAlignment: 0.8,
    uniqueParticipants: 3,
    qualifyingMessages: 4,
    sarcasmRisk: false,
    evidenceSignalIds: ["audience-build-choice"],
    ...patch,
  });
  if (pointer.status !== "known") {
    throw new Error("Director Cue fixture must remain a known audience pointer");
  }
  return pointer;
}

function directorInput(
  snapshot: IntelligenceSnapshot,
  patch: Partial<DirectorCueSuitabilityInput> = {},
): DirectorCueSuitabilityInput {
  return {
    currentState: role3FixtureIdleState,
    intelligence: snapshot,
    profile: fixtureProfile,
    emergencyPaused: false,
    declaredIntent: fixtureDirectorIntent,
    audiencePointer: directorAudience(),
    recentCues: [],
    now: ROLE_3_FIXTURE_TIME,
    ...patch,
  };
}

function recentCue(
  cueId: string,
  patch: Partial<RecentDirectorCueSummary> = {},
): RecentDirectorCueSummary {
  return {
    cueId,
    intentId: `intent-${cueId}`,
    topic: `Topic ${cueId}`,
    offeredAt: ROLE_3_FIXTURE_TIME - 180_000,
    resolvedAt: ROLE_3_FIXTURE_TIME - 180_000,
    disposition: "dismissed",
    ...patch,
  };
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

describe("DefaultDirectorCueSuitabilityPolicy", () => {
  const policy = new DefaultDirectorCueSuitabilityPolicy();

  it("offers one private cue during a fresh, quiet, source-labelled opportunity", () => {
    const snapshot = intelligence([knownSignal("activity", "activity-intensity", 0.1)]);

    expect(policy.decide(directorInput(snapshot))).toEqual({
      disposition: "offer-cue",
      score: 0.855,
      reasons: ["eligible"],
      evidenceReferences: [
        "intent-build-safely",
        "activity",
        "pointer-build-choice",
        "audience-build-choice",
      ],
    });
  });

  it("runs lifecycle, emergency, and safety gates before evidence scoring", () => {
    const unsafe = intelligence([
      unknownSignal("activity", "activity-intensity"),
      knownSignal("risk", "safety-risk", true),
    ]);
    const proposedState = questCycleStateSchema.parse({
      ...role3FixtureIdleState,
      status: "proposed",
      options: role3FixtureCandidateBatch.candidates,
    });

    expect(
      policy.decide(
        directorInput(unsafe, {
          currentState: proposedState,
          emergencyPaused: true,
          declaredIntent: {
            status: "unknown",
            reason: "not-set",
            observedAt: ROLE_3_FIXTURE_TIME,
          },
        }),
      ),
    ).toMatchObject({ disposition: "stay-silent", reasons: ["cycle-unavailable"] });
    expect(
      policy.decide(
        directorInput(unsafe, {
          emergencyPaused: true,
          declaredIntent: {
            status: "unknown",
            reason: "not-set",
            observedAt: ROLE_3_FIXTURE_TIME,
          },
        }),
      ),
    ).toMatchObject({ disposition: "stay-silent", reasons: ["emergency-paused"] });
    expect(policy.decide(directorInput(unsafe))).toMatchObject({
      disposition: "stay-silent",
      reasons: ["unsafe-moment"],
    });
  });

  it.each([
    {
      name: "active gameplay",
      snapshot: intelligence([knownSignal("activity", "activity-intensity", 0.7)]),
      reason: "active-gameplay",
    },
    {
      name: "high-focus gameplay",
      snapshot: intelligence([
        knownSignal("activity", "activity-intensity", 0.1),
        knownSignal("focus", "high-focus", true),
      ]),
      reason: "active-gameplay",
    },
    {
      name: "a transition",
      snapshot: intelligence([
        knownSignal("activity", "activity-intensity", 0.1),
        knownSignal("transition", "scene-transition", true),
      ]),
      reason: "transition",
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
      name: "unknown gameplay",
      snapshot: intelligence([unknownSignal("activity", "activity-intensity")]),
      reason: "insufficient-gameplay-evidence",
    },
  ])("waits through $name", ({ snapshot, reason }) => {
    expect(policy.decide(directorInput(snapshot))).toMatchObject({
      disposition: "wait",
      reasons: [reason],
    });
  });

  it("waits when the activity fact is not advertised as supported", () => {
    const snapshot = intelligence([knownSignal("activity", "activity-intensity", 0.1)]);
    const unsupported = intelligenceSnapshotSchema.parse({
      ...snapshot,
      gameplay: {
        ...snapshot.gameplay,
        capabilities: { ...snapshot.gameplay.capabilities, supportedSignals: [] },
      },
    });

    expect(policy.decide(directorInput(unsupported))).toMatchObject({
      disposition: "wait",
      reasons: ["unsupported-gameplay-evidence"],
    });
  });

  it.each([
    {
      name: "unknown audience context",
      audiencePointer: audiencePointerSchema.parse({
        status: "unknown",
        reason: "not-enough-evidence",
        observedAt: ROLE_3_FIXTURE_TIME,
        evidenceSignalIds: [],
      }),
      reason: "missing-audience-context",
    },
    {
      name: "conflicting chat",
      audiencePointer: audiencePointerSchema.parse({
        status: "conflicting",
        reason: "competing-topics",
        observedAt: ROLE_3_FIXTURE_TIME,
        evidenceSignalIds: ["chat-conflict"],
      }),
      reason: "conflicting-audience",
    },
    {
      name: "ambiguous chat",
      audiencePointer: audiencePointerSchema.parse({
        status: "ambiguous",
        reason: "sarcasm-or-humour",
        observedAt: ROLE_3_FIXTURE_TIME,
        evidenceSignalIds: ["chat-ambiguous"],
      }),
      reason: "ambiguous-audience",
    },
    {
      name: "permission-denied chat",
      audiencePointer: audiencePointerSchema.parse({
        status: "permission-denied",
        reason: "audience-analysis-disabled",
        observedAt: ROLE_3_FIXTURE_TIME,
        evidenceSignalIds: [],
      }),
      reason: "permission-denied-audience-context",
    },
    {
      name: "sparse chat",
      audiencePointer: directorAudience({ uniqueParticipants: 1, qualifyingMessages: 1 }),
      reason: "sparse-audience",
    },
    {
      name: "sarcastic chat",
      audiencePointer: directorAudience({ sarcasmRisk: true }),
      reason: "sarcasm-risk",
    },
    {
      name: "stale audience context",
      audiencePointer: directorAudience({
        windowStartedAt: ROLE_3_FIXTURE_TIME - 40_000,
        windowEndedAt: ROLE_3_FIXTURE_TIME - 31_000,
        observedAt: ROLE_3_FIXTURE_TIME - 30_001,
        createdAt: ROLE_3_FIXTURE_TIME - 30_001,
      }),
      reason: "stale-audience-context",
    },
    {
      name: "canonical stale audience pointer",
      audiencePointer: audiencePointerSchema.parse({
        ...directorAudience(),
        status: "stale",
        expiresAt: ROLE_3_FIXTURE_TIME - 1,
        staleAt: ROLE_3_FIXTURE_TIME,
      }),
      reason: "stale-audience-context",
    },
    {
      name: "weak audience context",
      audiencePointer: directorAudience({ confidence: 0.64 }),
      reason: "low-confidence-audience-context",
    },
  ])("does not fabricate suitability from $name", ({ audiencePointer, reason }) => {
    const snapshot = intelligence([knownSignal("activity", "activity-intensity", 0.1)]);
    expect(policy.decide(directorInput(snapshot, { audiencePointer }))).toMatchObject({
      disposition: "wait",
      reasons: [reason],
    });
  });

  it("stays silent without a streamer-declared objective", () => {
    const snapshot = intelligence([knownSignal("activity", "activity-intensity", 0.1)]);
    expect(
      policy.decide(
        directorInput(snapshot, {
          declaredIntent: declaredStreamIntentSchema.parse({
            status: "unknown",
            reason: "not-set",
            observedAt: ROLE_3_FIXTURE_TIME,
          }),
        }),
      ),
    ).toMatchObject({
      disposition: "stay-silent",
      reasons: ["missing-declared-intent"],
    });
  });

  it.each([
    {
      name: "stale",
      declaredIntent: declaredStreamIntentSchema.parse({
        ...fixtureDirectorIntent,
        status: "stale",
        expiresAt: ROLE_3_FIXTURE_TIME - 1,
        staleAt: ROLE_3_FIXTURE_TIME,
      }),
      reason: "stale-declared-intent",
    },
    {
      name: "permission denied",
      declaredIntent: declaredStreamIntentSchema.parse({
        status: "unknown",
        reason: "permission-denied",
        observedAt: ROLE_3_FIXTURE_TIME,
      }),
      reason: "permission-denied-declared-intent",
    },
  ])("fails closed when declared intent is $name", ({ declaredIntent, reason }) => {
    const snapshot = intelligence([knownSignal("activity", "activity-intensity", 0.1)]);
    expect(policy.decide(directorInput(snapshot, { declaredIntent }))).toMatchObject({
      disposition: "stay-silent",
      reasons: [reason],
    });
  });

  it.each([
    {
      name: "cooldown",
      recentCues: [
        recentCue("cooldown", {
          intentId: "other-intent",
          topic: "A different topic",
          offeredAt: ROLE_3_FIXTURE_TIME - DIRECTOR_CUE_COOLDOWN_MILLISECONDS + 1,
          resolvedAt: ROLE_3_FIXTURE_TIME - DIRECTOR_CUE_COOLDOWN_MILLISECONDS + 1,
        }),
      ],
      reason: "cue-cooldown",
    },
    {
      name: "attention budget",
      recentCues: [1, 2, 3].map((index) => recentCue(`attention-${index}`, {
        intentId: `intent-${index}`,
        topic: `Distinct topic ${index}`,
        offeredAt:
          ROLE_3_FIXTURE_TIME -
          DIRECTOR_CUE_COOLDOWN_MILLISECONDS -
          index * 1_000,
        resolvedAt:
          ROLE_3_FIXTURE_TIME -
          DIRECTOR_CUE_COOLDOWN_MILLISECONDS -
          index * 1_000,
      })),
      reason: "attention-budget-exhausted",
    },
    {
      name: "repeated topic",
      recentCues: [
        recentCue("repeated", {
          intentId: fixtureDirectorIntent.intentId,
          topic: "Choose next safe build",
          offeredAt: ROLE_3_FIXTURE_TIME - DIRECTOR_CUE_ATTENTION_WINDOW_MILLISECONDS - 1,
          resolvedAt: ROLE_3_FIXTURE_TIME - DIRECTOR_CUE_ATTENTION_WINDOW_MILLISECONDS - 1,
        }),
      ],
      reason: "repeated-cue",
    },
  ])("enforces the $name before another cue", ({ recentCues, reason }) => {
    const snapshot = intelligence([knownSignal("activity", "activity-intensity", 0.1)]);
    expect(policy.decide(directorInput(snapshot, { recentCues }))).toMatchObject({
      disposition: "stay-silent",
      reasons: [reason],
    });
  });

  it("lets saved intensity affect only scoring and busy thresholds", () => {
    const snapshot = intelligence([knownSignal("activity", "activity-intensity", 0.6)]);
    const lowIntensity = streamerProfileSchema.parse({
      ...fixtureProfile,
      experience: { intensity: 0 },
    });
    const highIntensity = streamerProfileSchema.parse({
      ...fixtureProfile,
      experience: { intensity: 1 },
    });

    expect(policy.decide(directorInput(snapshot, { profile: lowIntensity }))).toMatchObject({
      disposition: "wait",
      reasons: ["active-gameplay"],
    });
    expect(policy.decide(directorInput(snapshot, { profile: highIntensity }))).toMatchObject({
      disposition: "offer-cue",
      reasons: ["eligible"],
      score: 0.68,
    });
  });

  it("replays identical inputs deterministically", () => {
    const input = directorInput(
      intelligence([knownSignal("activity", "activity-intensity", 0.25)]),
    );
    expect(policy.decide(input)).toEqual(policy.decide(input));
  });

  it("starts post-dismissal cooldown at resolution and deduplicates reconnect replay", () => {
    const cue = {
      ...contractFixtureLiveDirectorState.cue!,
      state: "dismissed" as const,
      reason: "Streamer dismissed the cue",
      createdAt: ROLE_3_FIXTURE_TIME - 2_000,
      updatedAt: ROLE_3_FIXTURE_TIME - 1_000,
      availableActions: [],
    };
    const summary = createDirectorCueHistorySummary({
      cue,
      topic: contractFixtureLiveDirectorState.audiencePointer!.status === "known"
        ? contractFixtureLiveDirectorState.audiencePointer!.topic
        : "",
    });
    expect(summary).toMatchObject({
      cueId: cue.cueId,
      disposition: "dismissed",
      resolvedAt: ROLE_3_FIXTURE_TIME - 1_000,
    });
    if (summary === null) throw new Error("Expected a resolved cue history summary");
    const once = mergeDirectorCueHistory([], summary, ROLE_3_FIXTURE_TIME);
    expect(mergeDirectorCueHistory(once ?? [], summary, ROLE_3_FIXTURE_TIME)).toEqual(once);
    expect(
      mergeDirectorCueHistory(
        once ?? [],
        { ...summary, disposition: "converted" },
        ROLE_3_FIXTURE_TIME,
      ),
    ).toBeNull();

    const snapshot = intelligence([knownSignal("activity", "activity-intensity", 0.1)]);
    expect(policy.decide(directorInput(snapshot, { recentCues: once ?? [] }))).toMatchObject({
      disposition: "stay-silent",
      reasons: ["cue-cooldown"],
    });
  });

  it("does not fabricate history for a cue that is still active", () => {
    expect(
      createDirectorCueHistorySummary({
        cue: contractFixtureLiveDirectorState.cue!,
        topic: "Choose the next safe build",
      }),
    ).toBeNull();
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
