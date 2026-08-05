import {
  CONTRACT_VERSION,
  audienceSnapshotSchema,
  candidateBatchSchema,
  contractEnvelopeSchema,
  gameplaySnapshotSchema,
  intelligenceSnapshotSchema,
  serviceHealthSchema,
  type CandidateBatch,
  type ContractEnvelope,
  type IntelligenceSnapshot,
  type QuestCandidate,
  type ServiceHealth,
  type SignalProvenance,
} from "../../core";

const FIXTURE_TIME = 1_786_100_000_000;
type MessageSource = ContractEnvelope["source"];

function envelope(source: MessageSource, messageId: string): ContractEnvelope {
  return contractEnvelopeSchema.parse({
    contractVersion: CONTRACT_VERSION,
    sessionId: "role-2-ui-x09-session",
    questCycleId: "role-2-ui-x09-cycle",
    messageId,
    correlationId: "role-2-ui-x09-correlation",
    revision: 3,
    occurredAt: FIXTURE_TIME,
    receivedAt: FIXTURE_TIME,
    source,
    evidenceClass: "fixture",
  });
}

function provenance(
  source: MessageSource,
  method: string,
  confidence: number,
  observedAt = FIXTURE_TIME,
): SignalProvenance {
  return {
    source,
    method,
    confidence,
    observedAt,
    receivedAt: observedAt,
    evidenceClass: "fixture",
  };
}

function intelligenceFixture(input: {
  id: string;
  gameplaySignals: unknown[];
  audienceSignals?: unknown[];
  sampleSize?: number;
}): IntelligenceSnapshot {
  const gameplay = gameplaySnapshotSchema.parse({
    envelope: envelope("obs-virtual-camera", `${input.id}-gameplay`),
    capabilities: {
      tier: "universal-visual",
      gameId: null,
      adapterId: null,
      supportedSignals: ["activity-intensity", "scene-transition"],
    },
    signals: input.gameplaySignals,
  });
  const audience = audienceSnapshotSchema.parse({
    envelope: envelope("twitch", `${input.id}-audience`),
    sampleSize: input.sampleSize ?? 0,
    signals: input.audienceSignals ?? [
      {
        signalId: `${input.id}-audience-energy`,
        kind: "audience-energy",
        observation: {
          status: "unknown",
          reason: "not-observed",
          provenance: provenance("twitch", "fixture-audience-window", 0),
        },
      },
    ],
  });
  return intelligenceSnapshotSchema.parse({
    envelope: envelope("algorithm", input.id),
    gameplay,
    audience,
  });
}

export const role2UiX09IntelligenceFixtures = {
  "r4.intelligence.known-live.v1": intelligenceFixture({
    id: "r4-intelligence-known-live-v1",
    sampleSize: 8,
    gameplaySignals: [
      {
        signalId: "known-activity",
        kind: "activity-intensity",
        observation: {
          status: "known",
          value: 0.82,
          provenance: provenance("obs-virtual-camera", "fixture-frame-difference", 0.88),
        },
      },
    ],
    audienceSignals: [
      {
        signalId: "known-audience-energy",
        kind: "audience-energy",
        observation: {
          status: "known",
          value: 0.76,
          provenance: provenance("twitch", "fixture-audience-window", 0.81),
        },
      },
    ],
  }),
  "r4.intelligence.low-confidence.v1": intelligenceFixture({
    id: "r4-intelligence-low-confidence-v1",
    gameplaySignals: [
      {
        signalId: "weak-transition",
        kind: "scene-transition",
        observation: {
          status: "unknown",
          reason: "low-confidence",
          provenance: provenance("obs-virtual-camera", "fixture-scene-difference", 0.31),
        },
      },
    ],
  }),
  "r4.intelligence.unknown.v1": intelligenceFixture({
    id: "r4-intelligence-unknown-v1",
    gameplaySignals: [
      {
        signalId: "unsupported-health",
        kind: "player-health",
        observation: {
          status: "unknown",
          reason: "unsupported",
          provenance: provenance("obs-virtual-camera", "fixture-universal-capability", 0),
        },
      },
    ],
  }),
  "r4.intelligence.stale.v1": intelligenceFixture({
    id: "r4-intelligence-stale-v1",
    gameplaySignals: [
      {
        signalId: "stale-activity",
        kind: "activity-intensity",
        observation: {
          status: "stale",
          reason: "Fixture observation exceeded its configured freshness window.",
          previousValue: 0.64,
          provenance: provenance(
            "obs-virtual-camera",
            "fixture-frame-difference",
            0.78,
            FIXTURE_TIME - 5_000,
          ),
        },
      },
    ],
  }),
  "r4.intelligence.capture-denied.v1": intelligenceFixture({
    id: "r4-intelligence-capture-denied-v1",
    gameplaySignals: [
      {
        signalId: "denied-activity",
        kind: "activity-intensity",
        observation: {
          status: "unknown",
          reason: "permission-denied",
          provenance: provenance("obs-virtual-camera", "fixture-capture-permission", 0),
        },
      },
    ],
  }),
} as const;

const QUEST_TEXT = [
  ["Hold the Zone", "Stay within the current safe playable area for the next 30 seconds."],
  ["Caster Mode", "Narrate the next 30 seconds like a sports commentator."],
  ["Plan Out Loud", "Explain your next safe in-game move before taking action."],
] as const;

function candidates(
  method: QuestCandidate["generation"]["method"],
  provider: string | null,
  confidence: number,
): QuestCandidate[] {
  return QUEST_TEXT.map(([title, instruction], index) => ({
    candidateId: `ui-x09-${method}-${index + 1}`,
    title,
    instruction,
    durationSeconds: 30,
    difficulty: "easy",
    rewardPoints: 100,
    rationale: "Fixture-only candidate for provider and fallback presentation tests.",
    sourceSignalIds: [],
    confidence,
    generation: { method, provider, generatedAt: FIXTURE_TIME },
  }));
}

function generationFixture(input: {
  id: string;
  source: MessageSource;
  method: QuestCandidate["generation"]["method"];
  provider: string | null;
  confidence: number;
  health: ServiceHealth;
}): { readonly batch: CandidateBatch; readonly providerHealth: ServiceHealth } {
  return {
    batch: candidateBatchSchema.parse({
      envelope: envelope(input.source, input.id),
      candidates: candidates(input.method, input.provider, input.confidence),
    }),
    providerHealth: serviceHealthSchema.parse(input.health),
  };
}

export const role2UiX09GenerationFixtures = {
  "r4.generation.ai-provider.v1": generationFixture({
    id: "r4-generation-ai-provider-v1",
    source: "ai-provider",
    method: "ai-provider",
    provider: "fixture-free-provider",
    confidence: 0.75,
    health: {
      service: "fixture-free-provider",
      status: "ready",
      checkedAt: FIXTURE_TIME,
      retryable: false,
    },
  }),
  "r4.generation.algorithmic.v1": generationFixture({
    id: "r4-generation-algorithmic-v1",
    source: "algorithm",
    method: "algorithmic",
    provider: null,
    confidence: 0.55,
    health: {
      service: "fixture-free-provider",
      status: "unavailable",
      checkedAt: FIXTURE_TIME,
      message: "Fixture provider unavailable; credential-free algorithms used.",
      retryable: true,
    },
  }),
  "r4.generation.fallback.v1": generationFixture({
    id: "r4-generation-fallback-v1",
    source: "quest-engine",
    method: "deterministic-fallback",
    provider: null,
    confidence: 0,
    health: {
      service: "fixture-free-provider",
      status: "unavailable",
      checkedAt: FIXTURE_TIME,
      message: "Fixture provider and algorithmic generation unavailable; deterministic fallback used.",
      retryable: true,
    },
  }),
} as const;
