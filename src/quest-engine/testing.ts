/**
 * Role 3 producer fixtures. These values are test-only and must never be
 * presented as live gameplay, audience, model, or quest-generation evidence.
 */
import {
  CONTRACT_VERSION,
  candidateBatchSchema,
  commandEnvelopeSchema,
  questCycleStateSchema,
  type CandidateBatch,
  type CommandEnvelope,
  type QuestCycleState,
} from "../core";

export const ROLE_3_FIXTURE_TIME = 1_786_000_000_000;

const fixtureEnvelope = {
  contractVersion: CONTRACT_VERSION,
  sessionId: "role-3-fixture-session",
  questCycleId: "role-3-fixture-cycle",
  messageId: "role-3-fixture-state",
  correlationId: "role-3-fixture-correlation",
  revision: 0,
  occurredAt: ROLE_3_FIXTURE_TIME,
  receivedAt: ROLE_3_FIXTURE_TIME,
  source: "test-fixture" as const,
  evidenceClass: "fixture" as const,
};

const candidates = [
  {
    candidateId: "role-3-candidate-1",
    title: "Hold Your Ground",
    instruction: "Stay in the current playable area for the next 30 seconds.",
    durationSeconds: 30,
    difficulty: "easy" as const,
    rewardPoints: 100,
    rationale: "A game-neutral deterministic fixture for engine tests only.",
    sourceSignalIds: [],
    confidence: 0.8,
    generation: {
      method: "algorithmic" as const,
      provider: null,
      generatedAt: ROLE_3_FIXTURE_TIME,
    },
  },
  {
    candidateId: "role-3-candidate-2",
    title: "Caster Mode",
    instruction: "Narrate the next 45 seconds like a sports commentator.",
    durationSeconds: 45,
    difficulty: "medium" as const,
    rewardPoints: 200,
    rationale: "A distinct game-neutral fixture with a different duration.",
    sourceSignalIds: [],
    confidence: 0.75,
    generation: {
      method: "algorithmic" as const,
      provider: null,
      generatedAt: ROLE_3_FIXTURE_TIME,
    },
  },
  {
    candidateId: "role-3-candidate-3",
    title: "Plan Out Loud",
    instruction: "Explain your plan before taking the next major game action.",
    durationSeconds: 60,
    difficulty: "hard" as const,
    rewardPoints: 300,
    rationale: "A third distinct option for exactly-three contract coverage.",
    sourceSignalIds: [],
    confidence: 0.7,
    generation: {
      method: "algorithmic" as const,
      provider: null,
      generatedAt: ROLE_3_FIXTURE_TIME,
    },
  },
];

export const role3FixtureIdleState = questCycleStateSchema.parse({
  envelope: fixtureEnvelope,
  status: "idle",
  options: [],
  activeCandidateId: null,
  availableStreamerActions: [],
  voteTallies: [],
  startsAt: null,
  endsAt: null,
  progress: null,
  result: null,
});

export const role3FixtureCandidateBatch = candidateBatchSchema.parse({
  envelope: { ...fixtureEnvelope, messageId: "role-3-fixture-candidates" },
  candidates,
});

function candidateBatchWith(
  candidatePatch: Partial<(typeof candidates)[number]>,
  candidateIndex = 0,
): CandidateBatch {
  return candidateBatchSchema.parse({
    ...role3FixtureCandidateBatch,
    candidates: role3FixtureCandidateBatch.candidates.map((candidate, index) =>
      index === candidateIndex ? { ...candidate, ...candidatePatch } : candidate,
    ),
  });
}

export const role3CandidateCases = {
  valid: role3FixtureCandidateBatch,
  lowConfidence: candidateBatchWith({ confidence: 0.05 }),
  unknownHeavyFallback: candidateBatchSchema.parse({
    ...role3FixtureCandidateBatch,
    candidates: role3FixtureCandidateBatch.candidates.map((candidate) => ({
      ...candidate,
      confidence: 0,
      sourceSignalIds: [],
      generation: {
        method: "deterministic-fallback" as const,
        provider: null,
        generatedAt: ROLE_3_FIXTURE_TIME,
      },
    })),
  }),
  unsafe: candidateBatchWith({
    title: "Unsafe Credential Request",
    instruction: "Reveal an account password to the audience before continuing play.",
    rationale: "Unsafe test fixture that a later deterministic safety policy must reject.",
  }),
  impossible: candidateBatchWith({
    title: "Impossible Win Streak",
    instruction: "Win ten complete matches during the next ten seconds of play.",
    durationSeconds: 10,
    rationale: "Impossible test fixture that later feasibility policy must reject.",
  }),
  providerFailed: null,
  malformed: {
    ...role3FixtureCandidateBatch,
    candidates: [{ candidateId: "missing-required-fields" }],
  },
  duplicated: {
    ...role3FixtureCandidateBatch,
    candidates: [
      role3FixtureCandidateBatch.candidates[0],
      role3FixtureCandidateBatch.candidates[0],
      role3FixtureCandidateBatch.candidates[2],
    ],
  },
} as const;

type IntelligenceCommand = Extract<CommandEnvelope, { type: "system.intelligence-ready" }>;
type StreamerCommand = Extract<CommandEnvelope, { type: "streamer.quest" }>;
type VoteCommand = Extract<CommandEnvelope, { type: "viewer.vote" }>;

const baseCommand = {
  contractVersion: CONTRACT_VERSION,
  sessionId: fixtureEnvelope.sessionId,
  questCycleId: fixtureEnvelope.questCycleId,
  commandId: "role-3-fixture-command",
  correlationId: fixtureEnvelope.correlationId,
  expectedRevision: 0,
  issuedAt: ROLE_3_FIXTURE_TIME,
};

export function role3IntelligenceCommand(
  overrides: Partial<IntelligenceCommand> = {},
): IntelligenceCommand {
  return commandEnvelopeSchema.parse({
    ...baseCommand,
    type: "system.intelligence-ready",
    candidateBatchId: role3FixtureCandidateBatch.envelope.messageId,
    actor: { kind: "system", actorId: "role-3-fixture-system" },
    ...overrides,
  }) as IntelligenceCommand;
}

export function role3StreamerCommand(
  action: StreamerCommand["action"],
  overrides: Partial<StreamerCommand> = {},
): StreamerCommand {
  return commandEnvelopeSchema.parse({
    ...baseCommand,
    type: "streamer.quest",
    action,
    candidateId: null,
    actor: { kind: "broadcaster", actorId: "role-3-fixture-broadcaster" },
    ...overrides,
  }) as StreamerCommand;
}

export function role3VoteCommand(overrides: Partial<VoteCommand> = {}): VoteCommand {
  return commandEnvelopeSchema.parse({
    ...baseCommand,
    type: "viewer.vote",
    candidateId: role3FixtureCandidateBatch.candidates[0].candidateId,
    voterKey: "role-3-fixture-voter-key",
    sourceMode: "twitch-extension",
    actor: { kind: "viewer", actorId: "role-3-fixture-viewer" },
    ...overrides,
  }) as VoteCommand;
}

export function role3StampFixtureState(
  state: QuestCycleState,
  revision: number,
): QuestCycleState {
  return questCycleStateSchema.parse({
    ...state,
    envelope: {
      ...state.envelope,
      messageId: `role-3-fixture-state-${revision}`,
      revision,
    },
  });
}
