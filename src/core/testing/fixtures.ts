import {
  CONTRACT_VERSION,
  audienceSnapshotSchema,
  candidateBatchSchema,
  contractEnvelopeSchema,
  gameplaySnapshotSchema,
  intelligenceSnapshotSchema,
  overlayViewModelSchema,
  questCycleStateSchema,
  serviceHealthSchema,
  streamSessionSchema,
  streamerViewModelSchema,
  streamerProfileSchema,
  viewerViewModelSchema,
  type ContractEnvelope,
  type QuestCandidate,
  type QuestCycleState,
  type RoleViewModels,
  type SignalProvenance,
} from "../contracts";

const FIXTURE_TIME = 1_786_000_000_000;

export const contractFixtureEnvelope = contractEnvelopeSchema.parse({
  contractVersion: CONTRACT_VERSION,
  sessionId: "fixture-session",
  questCycleId: "fixture-cycle",
  messageId: "fixture-message",
  correlationId: "fixture-correlation",
  revision: 0,
  occurredAt: FIXTURE_TIME,
  receivedAt: FIXTURE_TIME,
  source: "test-fixture",
  evidenceClass: "fixture",
});

const fixtureUnknownProvenance = {
  source: "test-fixture" as const,
  method: "contract-fixture",
  confidence: 0,
  observedAt: FIXTURE_TIME,
  receivedAt: FIXTURE_TIME,
  evidenceClass: "fixture" as const,
};

type MessageSource = ContractEnvelope["source"];

function fixtureEnvelope(source: MessageSource, messageId: string, revision = 0): ContractEnvelope {
  return contractEnvelopeSchema.parse({
    ...contractFixtureEnvelope,
    messageId,
    revision,
    source,
  });
}

function fixtureProvenance(
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

export const contractFixtureGameplaySnapshot = gameplaySnapshotSchema.parse({
  envelope: { ...contractFixtureEnvelope, messageId: "fixture-gameplay" },
  capabilities: {
    tier: "universal-visual",
    gameId: null,
    adapterId: null,
    supportedSignals: ["activity-intensity"],
  },
  signals: [
    {
      signalId: "fixture-activity",
      kind: "activity-intensity",
      observation: {
        status: "unknown",
        reason: "not-observed",
        provenance: fixtureUnknownProvenance,
      },
    },
  ],
});

export const contractFixtureAudienceSnapshot = audienceSnapshotSchema.parse({
  envelope: { ...contractFixtureEnvelope, messageId: "fixture-audience" },
  sampleSize: 0,
  signals: [
    {
      signalId: "fixture-energy",
      kind: "audience-energy",
      observation: {
        status: "unknown",
        reason: "not-observed",
        provenance: fixtureUnknownProvenance,
      },
    },
  ],
});

function uiX09IntelligenceFixture(input: {
  readonly id: string;
  readonly gameplaySignals: readonly unknown[];
  readonly audienceSignals?: readonly unknown[];
  readonly sampleSize?: number;
}) {
  const gameplay = gameplaySnapshotSchema.parse({
    envelope: fixtureEnvelope("obs-virtual-camera", `${input.id}-gameplay`, 3),
    capabilities: {
      tier: "universal-visual",
      gameId: null,
      adapterId: null,
      supportedSignals: ["activity-intensity", "scene-transition"],
    },
    signals: input.gameplaySignals,
  });
  const audience = audienceSnapshotSchema.parse({
    envelope: fixtureEnvelope("twitch", `${input.id}-audience`, 3),
    sampleSize: input.sampleSize ?? 0,
    signals:
      input.audienceSignals ??
      [
        {
          signalId: `${input.id}-audience-energy`,
          kind: "audience-energy",
          observation: {
            status: "unknown",
            reason: "not-observed",
            provenance: fixtureProvenance("twitch", "fixture-audience-window", 0),
          },
        },
      ],
  });
  return intelligenceSnapshotSchema.parse({
    envelope: fixtureEnvelope("algorithm", input.id, 3),
    gameplay,
    audience,
  });
}

export const contractFixtureUiX09IntelligenceCatalog = {
  "r4.intelligence.known.v1": uiX09IntelligenceFixture({
    id: "r4-intelligence-known-v1",
    sampleSize: 8,
    gameplaySignals: [
      {
        signalId: "known-activity",
        kind: "activity-intensity",
        observation: {
          status: "known",
          value: 0.82,
          provenance: fixtureProvenance("obs-virtual-camera", "fixture-frame-difference", 0.88),
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
          provenance: fixtureProvenance("twitch", "fixture-audience-window", 0.81),
        },
      },
    ],
  }),
  "r4.intelligence.low-confidence.v1": uiX09IntelligenceFixture({
    id: "r4-intelligence-low-confidence-v1",
    gameplaySignals: [
      {
        signalId: "weak-transition",
        kind: "scene-transition",
        observation: {
          status: "unknown",
          reason: "low-confidence",
          provenance: fixtureProvenance("obs-virtual-camera", "fixture-scene-difference", 0.31),
        },
      },
    ],
  }),
  "r4.intelligence.unknown.v1": uiX09IntelligenceFixture({
    id: "r4-intelligence-unknown-v1",
    gameplaySignals: [
      {
        signalId: "unsupported-health",
        kind: "player-health",
        observation: {
          status: "unknown",
          reason: "unsupported",
          provenance: fixtureProvenance("obs-virtual-camera", "fixture-universal-capability", 0),
        },
      },
    ],
  }),
  "r4.intelligence.stale.v1": uiX09IntelligenceFixture({
    id: "r4-intelligence-stale-v1",
    gameplaySignals: [
      {
        signalId: "stale-activity",
        kind: "activity-intensity",
        observation: {
          status: "stale",
          reason: "Fixture observation exceeded its configured freshness window.",
          previousValue: 0.64,
          provenance: fixtureProvenance(
            "obs-virtual-camera",
            "fixture-frame-difference",
            0.78,
            FIXTURE_TIME - 5_000,
          ),
        },
      },
    ],
  }),
  "r4.intelligence.capture-denied.v1": uiX09IntelligenceFixture({
    id: "r4-intelligence-capture-denied-v1",
    gameplaySignals: [
      {
        signalId: "denied-activity",
        kind: "activity-intensity",
        observation: {
          status: "unknown",
          reason: "permission-denied",
          provenance: fixtureProvenance("obs-virtual-camera", "fixture-capture-permission", 0),
        },
      },
    ],
  }),
} as const;

const uiX09QuestText = [
  ["Hold the Zone", "Stay within the current safe playable area for the next 30 seconds."],
  ["Caster Mode", "Narrate the next 30 seconds like a sports commentator."],
  ["Plan Out Loud", "Explain your next safe in-game move before taking action."],
] as const;

function uiX09Candidates(
  method: QuestCandidate["generation"]["method"],
  provider: string | null,
  confidence: number,
) {
  return uiX09QuestText.map(([title, instruction], index) => ({
    candidateId: `ui-x09-${method}-${index + 1}`,
    title,
    instruction,
    durationSeconds: 30,
    difficulty: "easy" as const,
    rewardPoints: 100,
    rationale: "Fixture-only candidate for provider and fallback presentation tests.",
    sourceSignalIds: [],
    confidence,
    generation: { method, provider, generatedAt: FIXTURE_TIME },
  }));
}

function uiX09GenerationFixture(input: {
  readonly id: string;
  readonly source: MessageSource;
  readonly method: QuestCandidate["generation"]["method"];
  readonly provider: string | null;
  readonly confidence: number;
  readonly providerHealth: unknown;
}) {
  return {
    batch: candidateBatchSchema.parse({
      envelope: fixtureEnvelope(input.source, input.id, 3),
      candidates: uiX09Candidates(input.method, input.provider, input.confidence),
    }),
    providerHealth: serviceHealthSchema.parse(input.providerHealth),
  };
}

export const contractFixtureUiX09GenerationCatalog = {
  "r4.generation.ai-provider.v1": uiX09GenerationFixture({
    id: "r4-generation-ai-provider-v1",
    source: "ai-provider",
    method: "ai-provider",
    provider: "fixture-free-provider",
    confidence: 0.75,
    providerHealth: {
      service: "fixture-free-provider",
      status: "ready",
      checkedAt: FIXTURE_TIME,
      retryable: false,
    },
  }),
  "r4.generation.algorithmic.v1": uiX09GenerationFixture({
    id: "r4-generation-algorithmic-v1",
    source: "algorithm",
    method: "algorithmic",
    provider: null,
    confidence: 0.55,
    providerHealth: {
      service: "fixture-free-provider",
      status: "unavailable",
      checkedAt: FIXTURE_TIME,
      message: "Fixture provider unavailable; credential-free algorithms used.",
      retryable: true,
    },
  }),
  "r4.generation.fallback.v1": uiX09GenerationFixture({
    id: "r4-generation-fallback-v1",
    source: "quest-engine",
    method: "deterministic-fallback",
    provider: null,
    confidence: 0,
    providerHealth: {
      service: "fixture-free-provider",
      status: "unavailable",
      checkedAt: FIXTURE_TIME,
      message: "Fixture provider and algorithmic generation unavailable; deterministic fallback used.",
      retryable: true,
    },
  }),
} as const;

export const contractFixtureProfile = streamerProfileSchema.parse({
  profileId: "fixture-profile",
  streamerId: "fixture-broadcaster",
  revision: 0,
  displayName: "Fixture Streamer",
  gameId: null,
  gameName: null,
  experience: {
    intensity: 0.5,
    creativity: 0.5,
  },
  restrictions: [],
  preferredQuestTypes: [],
  forbiddenQuestTypes: [],
  accessibilityNeeds: [],
});

export const contractFixtureSession = streamSessionSchema.parse({
  sessionId: "fixture-session",
  broadcasterId: "fixture-broadcaster",
  platform: "twitch",
  status: "preparing",
  revision: 0,
  createdAt: FIXTURE_TIME,
  startedAt: null,
  endedAt: null,
  capabilities: {
    twitchExtension: false,
    hostedViewerBoard: true,
    twitchChatVoting: false,
    twitchIdentity: false,
    anonymousParticipation: true,
    reactions: false,
  },
});

export const contractFixtureCandidateBatch = candidateBatchSchema.parse({
  envelope: { ...contractFixtureEnvelope, messageId: "fixture-candidates" },
  candidates: [
    {
      candidateId: "fixture-candidate-1",
      title: "Hold Your Ground",
      instruction: "Stay in your current playable area for the next 30 seconds.",
      durationSeconds: 30,
      difficulty: "easy",
      rewardPoints: 100,
      rationale: "Unknown-safe contract fixture for integration tests only.",
      sourceSignalIds: [],
      confidence: 0,
      generation: {
        method: "deterministic-fallback",
        provider: null,
        generatedAt: FIXTURE_TIME,
      },
    },
    {
      candidateId: "fixture-candidate-2",
      title: "Caster Mode",
      instruction: "Narrate the next 30 seconds like a sports commentator.",
      durationSeconds: 30,
      difficulty: "easy",
      rewardPoints: 100,
      rationale: "Unknown-safe contract fixture for integration tests only.",
      sourceSignalIds: [],
      confidence: 0,
      generation: {
        method: "deterministic-fallback",
        provider: null,
        generatedAt: FIXTURE_TIME,
      },
    },
    {
      candidateId: "fixture-candidate-3",
      title: "Team Check-In",
      instruction: "Give your audience a quick plan before your next action.",
      durationSeconds: 30,
      difficulty: "easy",
      rewardPoints: 100,
      rationale: "Unknown-safe contract fixture for integration tests only.",
      sourceSignalIds: [],
      confidence: 0,
      generation: {
        method: "deterministic-fallback",
        provider: null,
        generatedAt: FIXTURE_TIME,
      },
    },
  ],
});

export const contractFixtureQuestCycle = questCycleStateSchema.parse({
  envelope: { ...contractFixtureEnvelope, messageId: "fixture-cycle-state" },
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

function uiX06QuestEnvelope(messageId: string, revision: number): ContractEnvelope {
  return contractEnvelopeSchema.parse({
    ...contractFixtureEnvelope,
    messageId,
    revision,
    source: "quest-engine",
  });
}

function uiX06QuestState(
  id: string,
  status: QuestCycleState["status"],
  patch: Partial<Omit<QuestCycleState, "envelope" | "status">> = {},
): QuestCycleState {
  return questCycleStateSchema.parse({
    envelope: uiX06QuestEnvelope(id, 6),
    status,
    options: [],
    activeCandidateId: null,
    availableStreamerActions: [],
    voteTallies: [],
    startsAt: null,
    endsAt: null,
    progress: null,
    completionRule: null,
    result: null,
    ...patch,
  });
}

const uiX06Options = contractFixtureCandidateBatch.candidates;
const uiX06VoteTallies = [
  { candidateId: uiX06Options[0].candidateId, votes: 2 },
  { candidateId: uiX06Options[1].candidateId, votes: 1 },
  { candidateId: uiX06Options[2].candidateId, votes: 0 },
] as const;

function uiX06Tallies(): Array<{ candidateId: string; votes: number }> {
  return uiX06VoteTallies.map((tally) => ({ ...tally }));
}

export const contractFixtureUiX06QuestStateCatalog = {
  "r5.quest.idle.v1": uiX06QuestState("r5-quest-idle-v1", "idle"),
  "r4.quest.proposed.v1": uiX06QuestState("r4-quest-proposed-v1", "proposed", {
    options: uiX06Options,
    availableStreamerActions: ["approve", "reject", "skip", "emergency-pause"],
  }),
  "r5.vote.zero-vote.v1": uiX06QuestState("r5-vote-zero-vote-v1", "voting", {
    options: uiX06Options,
    availableStreamerActions: ["cancel", "skip", "emergency-pause"],
    voteTallies: uiX06Options.map(({ candidateId }) => ({ candidateId, votes: 0 })),
    startsAt: FIXTURE_TIME,
    endsAt: FIXTURE_TIME + 30_000,
  }),
  "r5.vote.tie.v1": uiX06QuestState("r5-vote-tie-v1", "voting", {
    options: uiX06Options,
    availableStreamerActions: ["cancel", "skip", "emergency-pause"],
    voteTallies: [
      { candidateId: uiX06Options[0].candidateId, votes: 2 },
      { candidateId: uiX06Options[1].candidateId, votes: 2 },
      { candidateId: uiX06Options[2].candidateId, votes: 1 },
    ],
    startsAt: FIXTURE_TIME,
    endsAt: FIXTURE_TIME + 30_000,
  }),
  "r5.quest.active-manual-progress.v1": uiX06QuestState("r5-quest-active-manual-progress-v1", "active", {
    options: uiX06Options,
    activeCandidateId: uiX06Options[0].candidateId,
    availableStreamerActions: ["cancel", "skip", "succeed", "fail", "emergency-pause"],
    voteTallies: uiX06Tallies(),
    startsAt: FIXTURE_TIME,
    endsAt: FIXTURE_TIME + 30_000,
    progress: {
      value: 0.5,
      updatedAt: FIXTURE_TIME + 10_000,
      method: "manual",
      evidenceSignalIds: [],
    },
    completionRule: { mode: "manual", allowedSignalKinds: [] },
  }),
  "r5.quest.active-automatic-progress.v1": uiX06QuestState("r5-quest-active-automatic-progress-v1", "active", {
    options: uiX06Options,
    activeCandidateId: uiX06Options[0].candidateId,
    availableStreamerActions: ["cancel", "skip", "succeed", "fail", "emergency-pause"],
    voteTallies: uiX06Tallies(),
    startsAt: FIXTURE_TIME,
    endsAt: FIXTURE_TIME + 30_000,
    progress: {
      value: 0.75,
      updatedAt: FIXTURE_TIME + 15_000,
      method: "automatic",
      evidenceSignalIds: ["fixture-activity"],
    },
    completionRule: { mode: "signal", allowedSignalKinds: ["activity-intensity"] },
  }),
  "r5.quest.succeeded-reward.v1": uiX06QuestState("r5-quest-succeeded-reward-v1", "succeeded", {
    options: uiX06Options,
    activeCandidateId: uiX06Options[0].candidateId,
    voteTallies: uiX06Tallies(),
    progress: {
      value: 1,
      updatedAt: FIXTURE_TIME + 20_000,
      method: "manual",
      evidenceSignalIds: [],
    },
    result: {
      outcome: "succeeded",
      occurredAt: FIXTURE_TIME + 20_000,
      reason: "Fixture quest succeeded.",
      rewardPointsAwarded: uiX06Options[0].rewardPoints,
    },
  }),
  "r5.quest.failed.v1": uiX06QuestState("r5-quest-failed-v1", "failed", {
    options: uiX06Options,
    activeCandidateId: uiX06Options[0].candidateId,
    voteTallies: uiX06Tallies(),
    progress: {
      value: 0.4,
      updatedAt: FIXTURE_TIME + 20_000,
      method: "manual",
      evidenceSignalIds: [],
    },
    result: {
      outcome: "failed",
      occurredAt: FIXTURE_TIME + 20_000,
      reason: "Fixture quest failed.",
      rewardPointsAwarded: 0,
    },
  }),
  "r5.quest.cancelled.v1": uiX06QuestState("r5-quest-cancelled-v1", "cancelled", {
    options: uiX06Options,
    voteTallies: uiX06Tallies(),
    result: {
      outcome: "cancelled",
      occurredAt: FIXTURE_TIME + 12_000,
      reason: "Fixture streamer cancellation.",
      rewardPointsAwarded: 0,
    },
  }),
  "r5.quest.skipped.v1": uiX06QuestState("r5-quest-skipped-v1", "skipped", {
    options: uiX06Options,
    voteTallies: uiX06Tallies(),
    result: {
      outcome: "skipped",
      occurredAt: FIXTURE_TIME + 12_000,
      reason: "Fixture streamer skip.",
      rewardPointsAwarded: 0,
    },
  }),
  "r5.quest.expired.v1": uiX06QuestState("r5-quest-expired-v1", "expired", {
    options: uiX06Options,
    voteTallies: uiX06Tallies(),
    result: {
      outcome: "expired",
      occurredAt: FIXTURE_TIME + 30_000,
      reason: "Fixture authoritative timer expired.",
      rewardPointsAwarded: 0,
    },
  }),
  "r4.quest.cooldown.v1": uiX06QuestState("r4-quest-cooldown-v1", "cooldown", {
    startsAt: FIXTURE_TIME + 20_000,
    endsAt: FIXTURE_TIME + 140_000,
  }),
} as const;

function uiX06Session(revision: number) {
  return streamSessionSchema.parse({
    ...contractFixtureSession,
    status: "live",
    revision,
    startedAt: FIXTURE_TIME - 60_000,
    capabilities: {
      twitchExtension: true,
      hostedViewerBoard: true,
      twitchChatVoting: true,
      twitchIdentity: true,
      anonymousParticipation: true,
      reactions: true,
    },
  });
}

function uiX06Views(questCycle: QuestCycleState): RoleViewModels {
  const session = uiX06Session(questCycle.envelope.revision);
  const envelope = contractEnvelopeSchema.parse({
    ...contractFixtureEnvelope,
    messageId: `${questCycle.envelope.messageId}-view`,
    revision: questCycle.envelope.revision,
    source: "orchestrator",
  });
  const connection = serviceHealthSchema.parse({
    service: "fixture-realtime",
    status: "ready",
    checkedAt: FIXTURE_TIME,
    retryable: false,
  });
  return {
    streamer: streamerViewModelSchema.parse({
      envelope,
      session,
      profile: contractFixtureProfile,
      services: [connection],
      gameplay: contractFixtureGameplaySnapshot,
      audience: contractFixtureAudienceSnapshot,
      questCycle,
      emergencyPaused: false,
    }),
    viewer: viewerViewModelSchema.parse({
      envelope,
      session,
      capabilities: session.capabilities,
      participationMode: "twitch-extension",
      canVote: questCycle.status === "voting",
      canReact: session.capabilities.reactions,
      viewerId: "fixture-viewer",
      sessionPoints: questCycle.result?.outcome === "succeeded" ? questCycle.result.rewardPointsAwarded : 0,
      communityHype:
        questCycle.result?.outcome === "succeeded" ? 10 : questCycle.result?.outcome === "failed" ? 2 : 0,
      acceptedCandidateId: questCycle.status === "voting" ? uiX06Options[0].candidateId : null,
      questCycle,
      connection,
    }),
    overlay: overlayViewModelSchema.parse({
      envelope,
      session,
      readOnly: true,
      communityHype:
        questCycle.result?.outcome === "succeeded" ? 10 : questCycle.result?.outcome === "failed" ? 2 : 0,
      questCycle,
      connection,
    }),
  };
}

export const contractFixtureUiX06RoleViewCatalog = Object.fromEntries(
  Object.entries(contractFixtureUiX06QuestStateCatalog).map(([fixtureId, questCycle]) => [
    fixtureId,
    uiX06Views(questCycle),
  ]),
) as {
  readonly [FixtureId in keyof typeof contractFixtureUiX06QuestStateCatalog]: RoleViewModels;
};

const contractFixtureConnection = {
  service: "fixture-realtime",
  status: "ready" as const,
  checkedAt: FIXTURE_TIME,
  retryable: false,
};

export const contractFixtureStreamerView = streamerViewModelSchema.parse({
  envelope: { ...contractFixtureEnvelope, messageId: "fixture-streamer-view" },
  session: contractFixtureSession,
  profile: contractFixtureProfile,
  services: [contractFixtureConnection],
  gameplay: contractFixtureGameplaySnapshot,
  audience: contractFixtureAudienceSnapshot,
  questCycle: contractFixtureQuestCycle,
  emergencyPaused: false,
});

export const contractFixtureViewerView = viewerViewModelSchema.parse({
  envelope: { ...contractFixtureEnvelope, messageId: "fixture-viewer-view" },
  session: contractFixtureSession,
  capabilities: contractFixtureSession.capabilities,
  participationMode: "hosted-board",
  canVote: false,
  canReact: false,
  viewerId: null,
  sessionPoints: 0,
  communityHype: 0,
  acceptedCandidateId: null,
  questCycle: contractFixtureQuestCycle,
  connection: contractFixtureConnection,
});

export const contractFixtureOverlayView = overlayViewModelSchema.parse({
  envelope: { ...contractFixtureEnvelope, messageId: "fixture-overlay-view" },
  session: contractFixtureSession,
  readOnly: true,
  communityHype: 0,
  questCycle: contractFixtureQuestCycle,
  connection: contractFixtureConnection,
});
