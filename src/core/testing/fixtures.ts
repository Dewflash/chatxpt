import {
  CONTRACT_VERSION,
  audienceSnapshotSchema,
  audiencePointerAggregateSchema,
  candidateBatchSchema,
  contractEnvelopeSchema,
  gameplaySnapshotSchema,
  liveDirectorInterventionRecordSchema,
  liveDirectorStateSchema,
  overlayViewModelSchema,
  questCycleStateSchema,
  sessionHistorySnapshotSchema,
  serviceHealthSchema,
  streamSessionSchema,
  streamerReadinessViewSchema,
  streamerViewModelSchema,
  streamerProfileSchema,
  viewerViewModelSchema,
  type ContractEnvelope,
  type AudiencePointerAggregate,
  type QuestCycleState,
  type RoleViewModels,
  type SessionHistorySnapshot,
  type LiveDirectorInterventionRecord,
  type LiveDirectorState,
  type StreamerReadinessView,
  type StreamerSetupAction,
  type StreamerSetupService,
  type StreamerSetupServiceId,
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

export const contractFixtureAudiencePointerAggregate = audiencePointerAggregateSchema.parse({
  envelope: {
    ...contractFixtureEnvelope,
    messageId: "fixture-pointer-aggregate",
    occurredAt: FIXTURE_TIME - 5_000,
    receivedAt: FIXTURE_TIME - 5_000,
  },
  pointerId: "fixture-pointer",
  status: "known",
  topic: "Try the quieter route",
  observedAt: FIXTURE_TIME - 5_000,
  windowStartedAt: FIXTURE_TIME - 30_000,
  windowEndedAt: FIXTURE_TIME - 5_000,
  createdAt: FIXTURE_TIME,
  expiresAt: FIXTURE_TIME + 30_000,
  confidence: 0.82,
  relevance: 0.88,
  intentAlignment: 0.9,
  sarcasmRisk: false,
  evidence: [
    {
      evidenceSignalId: "fixture-audience-topic-1",
      participantKey: "ephemeral-participant-a",
      messageFingerprint: "ephemeral-message-a",
      observedAt: FIXTURE_TIME - 12_000,
      deleted: false,
    },
    {
      evidenceSignalId: "fixture-audience-topic-1-duplicate",
      participantKey: "ephemeral-participant-a",
      messageFingerprint: "ephemeral-message-a",
      observedAt: FIXTURE_TIME - 12_000,
      deleted: false,
    },
    {
      evidenceSignalId: "fixture-audience-topic-2",
      participantKey: "ephemeral-participant-a",
      messageFingerprint: "ephemeral-message-b",
      observedAt: FIXTURE_TIME - 10_000,
      deleted: false,
    },
    {
      evidenceSignalId: "fixture-audience-topic-3",
      participantKey: "ephemeral-participant-b",
      messageFingerprint: "ephemeral-message-c",
      observedAt: FIXTURE_TIME - 9_000,
      deleted: false,
    },
    {
      evidenceSignalId: "fixture-audience-topic-4",
      participantKey: "ephemeral-participant-c",
      messageFingerprint: "ephemeral-message-d",
      observedAt: FIXTURE_TIME - 8_000,
      deleted: false,
    },
    {
      evidenceSignalId: "fixture-audience-topic-5",
      participantKey: "ephemeral-participant-c",
      messageFingerprint: "ephemeral-message-e",
      observedAt: FIXTURE_TIME - 7_000,
      deleted: false,
    },
  ],
}) as Extract<AudiencePointerAggregate, { status: "known" }>;

export const contractFixtureLiveDirectorState = liveDirectorStateSchema.parse({
  declaredIntent: {
    status: "known",
    intentId: "fixture-intent",
    goal: "Reach the next safe shelter",
    objective: "Explore carefully while involving chat in the route choice.",
    desiredAudienceInvolvement: "Vote on the next safe route.",
    authorId: "fixture-broadcaster",
    updatedAt: FIXTURE_TIME - 20_000,
    expiresAt: FIXTURE_TIME + 600_000,
  },
  audiencePointer: {
    status: "known",
    pointerId: "fixture-pointer",
    topic: "Try the quieter route",
    observedAt: FIXTURE_TIME - 5_000,
    windowStartedAt: FIXTURE_TIME - 30_000,
    windowEndedAt: FIXTURE_TIME - 5_000,
    createdAt: FIXTURE_TIME,
    expiresAt: FIXTURE_TIME + 30_000,
    confidence: 0.82,
    relevance: 0.88,
    intentAlignment: 0.9,
    uniqueParticipants: 3,
    qualifyingMessages: 5,
    sarcasmRisk: false,
    evidenceSignalIds: ["fixture-audience-topic"],
  },
  liveContext: {
    contextId: "fixture-live-context",
    declaredIntentId: "fixture-intent",
    audiencePointerId: "fixture-pointer",
    compiledAt: FIXTURE_TIME,
    expiresAt: FIXTURE_TIME + 30_000,
    facts: [
      {
        factId: "fixture-context-streamer",
        sourceClass: "streamer-declared",
        kind: "current-objective",
        status: "known",
        value: "Explore carefully while involving chat in the route choice.",
        method: "declared-intent",
        confidence: 1,
        observedAt: FIXTURE_TIME - 20_000,
        expiresAt: FIXTURE_TIME + 600_000,
        evidenceClass: "fixture",
        evidenceSignalIds: ["fixture-intent"],
      },
      {
        factId: "fixture-context-gameplay",
        sourceClass: "gameplay-observed",
        kind: "activity-intensity",
        status: "unknown",
        value: null,
        method: "contract-fixture",
        confidence: 0,
        observedAt: FIXTURE_TIME,
        expiresAt: FIXTURE_TIME + 15_000,
        evidenceClass: "fixture",
        evidenceSignalIds: ["fixture-activity"],
      },
      {
        factId: "fixture-context-audience",
        sourceClass: "audience-derived",
        kind: "route-request",
        status: "known",
        value: "Try the quieter route",
        method: "aggregate-fixture",
        confidence: 0.82,
        observedAt: FIXTURE_TIME - 5_000,
        expiresAt: FIXTURE_TIME + 30_000,
        evidenceClass: "fixture",
        evidenceSignalIds: ["fixture-audience-topic"],
      },
    ],
  },
  cue: {
    cueId: "fixture-director-cue",
    contextId: "fixture-live-context",
    intentId: "fixture-intent",
    audiencePointerId: "fixture-pointer",
    state: "proposed",
    reason: "Chat is asking for a route choice during a low-pressure moment.",
    evidenceReferences: [
      "fixture-intent",
      "fixture-activity",
      "fixture-pointer",
      "fixture-audience-topic",
    ],
    createdAt: FIXTURE_TIME,
    updatedAt: FIXTURE_TIME,
    expiresAt: FIXTURE_TIME + 30_000,
    availableActions: ["acknowledge", "turn-into-vote", "later", "dismiss"],
  },
  publicContext: {
    contextId: "fixture-public-context",
    sourceContextId: "fixture-live-context",
    goal: "Reach the next safe shelter",
    phase: "Exploring",
    recentEvent: null,
    currentDecision: "Choose the next route",
    activeSidequest: null,
    result: null,
    publishedAt: FIXTURE_TIME,
    expiresAt: FIXTURE_TIME + 30_000,
  },
  privacy: {
    rawChatRetained: false,
    usernamesIncluded: false,
    viewerIdentifiersIncluded: false,
    providerPayloadIncluded: false,
  },
  updatedAt: FIXTURE_TIME,
});

export const contractFixtureLiveDirectorStateCatalog = {
  "live-director.known.v1": contractFixtureLiveDirectorState,
  "live-director.unknown.v1": liveDirectorStateSchema.parse({
    declaredIntent: {
      status: "unknown",
      reason: "not-set",
      observedAt: FIXTURE_TIME,
    },
    audiencePointer: {
      status: "unknown",
      reason: "No qualifying audience aggregate is available.",
      observedAt: FIXTURE_TIME,
      evidenceSignalIds: [],
    },
    liveContext: null,
    cue: null,
    publicContext: null,
    privacy: contractFixtureLiveDirectorState.privacy,
    updatedAt: FIXTURE_TIME,
  }),
  "live-director.stale.v1": liveDirectorStateSchema.parse({
    ...structuredClone(contractFixtureLiveDirectorState),
    declaredIntent: {
      ...structuredClone(contractFixtureLiveDirectorState.declaredIntent),
      status: "stale",
      staleAt: FIXTURE_TIME + 600_000,
    },
    audiencePointer: {
      ...structuredClone(contractFixtureLiveDirectorState.audiencePointer!),
      status: "stale",
      staleAt: FIXTURE_TIME + 30_000,
    },
    cue: {
      ...structuredClone(contractFixtureLiveDirectorState.cue!),
      state: "stale",
      updatedAt: FIXTURE_TIME + 30_000,
      availableActions: [],
    },
    publicContext: null,
    updatedAt: FIXTURE_TIME + 30_000,
  }),
  "live-director.conflicting.v1": liveDirectorStateSchema.parse({
    ...structuredClone(contractFixtureLiveDirectorState),
    audiencePointer: {
      status: "conflicting",
      reason: "Audience aggregates disagree about the requested route.",
      observedAt: FIXTURE_TIME,
      evidenceSignalIds: ["fixture-audience-topic", "fixture-audience-conflict"],
    },
    liveContext: {
      ...structuredClone(contractFixtureLiveDirectorState.liveContext!),
      audiencePointerId: null,
      facts: contractFixtureLiveDirectorState.liveContext!.facts.map((fact) =>
        fact.sourceClass === "audience-derived"
          ? { ...fact, status: "conflicting" as const, value: null }
          : fact,
      ),
    },
    cue: null,
    publicContext: null,
  }),
  "live-director.privacy-denied.v1": liveDirectorStateSchema.parse({
    declaredIntent: {
      status: "unknown",
      reason: "permission-denied",
      observedAt: FIXTURE_TIME,
    },
    audiencePointer: {
      status: "permission-denied",
      reason: "Audience aggregate access is not authorised.",
      observedAt: FIXTURE_TIME,
      evidenceSignalIds: [],
    },
    liveContext: {
      contextId: "fixture-live-context-privacy-denied",
      declaredIntentId: null,
      audiencePointerId: null,
      compiledAt: FIXTURE_TIME,
      expiresAt: FIXTURE_TIME + 30_000,
      facts: contractFixtureLiveDirectorState.liveContext!.facts.map((fact) => ({
        ...fact,
        factId: `${fact.factId}-privacy-denied`,
        status: "permission-denied" as const,
        value: null,
        confidence: 0,
        evidenceSignalIds: [],
      })),
    },
    cue: null,
    publicContext: null,
    privacy: contractFixtureLiveDirectorState.privacy,
    updatedAt: FIXTURE_TIME,
  }),
} satisfies Record<string, LiveDirectorState>;

export const contractFixtureLiveDirectorIntervention =
  liveDirectorInterventionRecordSchema.parse({
    interventionId: "fixture-intervention",
    sessionId: "fixture-session",
    cueId: "fixture-director-cue",
    sourceContextId: "fixture-live-context",
    questCycleId: "fixture-cycle",
    cueShownAt: FIXTURE_TIME,
    action: "turn-into-vote",
    actionAt: FIXTURE_TIME + 2_000,
    acceptedVoteCount: 3,
    reactionCount: 2,
    outcome: "succeeded",
    evidenceClass: "fixture",
    limitations: ["Fixture-only contract evidence; no live audience activity was used."],
    privacy: {
      rawChatIncluded: false,
      usernamesIncluded: false,
      viewerIdentifiersIncluded: false,
      privateVoteReceiptsIncluded: false,
      providerPayloadIncluded: false,
    },
  }) satisfies LiveDirectorInterventionRecord;

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
  "r5.quest.active-automatic-progress.v1": uiX06QuestState(
    "r5-quest-active-automatic-progress-v1",
    "active",
    {
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
    },
  ),
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
  const acceptedCandidateId =
    questCycle.status === "voting" && questCycle.voteTallies.some((tally) => tally.votes > 0)
      ? uiX06Options[0].candidateId
      : null;
  const communityHype =
    questCycle.result?.outcome === "succeeded" ? 10 : questCycle.result?.outcome === "failed" ? 2 : 0;
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
      communityHype,
      acceptedCandidateId,
      questCycle,
      connection,
    }),
    overlay: overlayViewModelSchema.parse({
      envelope,
      session,
      readOnly: true,
      communityHype,
      upNext:
        questCycle.status === "voting"
          ? {
              label: "Up next",
              title: "Winning quest goes live",
              detail: "The official winner appears here after the audience vote closes.",
              expiresAt: questCycle.endsAt,
            }
          : questCycle.status === "active"
            ? {
                label: "Quest payoff",
                title:
                  uiX06Options.find(
                    (option) => option.candidateId === questCycle.activeCandidateId,
                  )?.title ?? "Sidequest active",
                detail:
                  uiX06Options.find(
                    (option) => option.candidateId === questCycle.activeCandidateId,
                  )?.instruction ?? "The active quest is visible on the broadcast.",
                expiresAt: questCycle.endsAt,
              }
            : questCycle.status === "cooldown"
              ? {
                  label: "Up next",
                  title: "Next vote soon",
                  detail: "ChatXPT is waiting for another safe sidequest moment.",
                  expiresAt: questCycle.endsAt,
                }
              : questCycle.result !== null
                ? {
                    label: "Result",
                    title: `Sidequest ${questCycle.result.outcome}`,
                    detail: questCycle.result.reason,
                    expiresAt: questCycle.endsAt,
                  }
                : null,
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

export const contractFixtureUiX04SessionHistory = sessionHistorySnapshotSchema.parse({
  contractVersion: CONTRACT_VERSION,
  broadcasterId: contractFixtureSession.broadcasterId,
  generatedAt: FIXTURE_TIME + 30_000,
  source: "test-fixture",
  evidenceClass: "fixture",
  limit: 25,
  entries: [
    {
      sessionId: contractFixtureSession.sessionId,
      questCycleId: "fixture-cycle-success",
      sessionRevision: 12,
      title: "Hold Your Ground",
      activeCandidateId: uiX06Options[0].candidateId,
      outcome: "succeeded",
      reason: "Fixture quest succeeded.",
      startedAt: FIXTURE_TIME,
      endedAt: FIXTURE_TIME + 20_000,
      durationSeconds: 20,
      acceptedVoteCount: 3,
      voteTallies: uiX06Tallies(),
      rewardPointsAwarded: uiX06Options[0].rewardPoints,
      evidenceClass: "fixture",
    },
    {
      sessionId: contractFixtureSession.sessionId,
      questCycleId: "fixture-cycle-skipped",
      sessionRevision: 8,
      title: null,
      activeCandidateId: null,
      outcome: "skipped",
      reason: "Fixture streamer skip.",
      startedAt: null,
      endedAt: FIXTURE_TIME - 120_000,
      durationSeconds: null,
      acceptedVoteCount: 0,
      voteTallies: [],
      rewardPointsAwarded: 0,
      evidenceClass: "fixture",
    },
  ],
  summary: {
    totalQuestCycles: 2,
    succeeded: 1,
    failed: 0,
    cancelled: 0,
    skipped: 1,
    expired: 0,
    totalAcceptedVotes: 3,
    totalRewardPointsAwarded: 100,
    averageCompletionSeconds: 20,
  },
  privacy: {
    rawChatHistoryRetained: false,
    viewerIdentifiersIncluded: false,
    privateVoteReceiptsIncluded: false,
    retentionNote:
      "Session history stores terminal quest outcomes and aggregate engagement only; raw chat and viewer identifiers are not retained in this read model.",
  },
}) satisfies SessionHistorySnapshot;

function readinessHealth(
  service: StreamerSetupServiceId,
  status: "ready" | "degraded" | "unavailable" | "permission-denied" | "misconfigured",
  message: string,
) {
  return serviceHealthSchema.parse({
    service,
    status,
    checkedAt: FIXTURE_TIME,
    message,
    retryable: ["degraded", "unavailable", "permission-denied"].includes(status),
  });
}

const readinessServiceOrder: readonly StreamerSetupServiceId[] = [
  "twitch",
  "obs-capture",
  "realtime",
  "intelligence",
  "session",
];

const readyReadinessServices: Record<StreamerSetupServiceId, StreamerSetupService> = {
  twitch: {
    service: "twitch",
    configured: true,
    health: readinessHealth("twitch", "ready", "Fixture Twitch setup is ready."),
    allowedActions: [],
  },
  "obs-capture": {
    service: "obs-capture",
    configured: true,
    health: readinessHealth("obs-capture", "ready", "Fixture OBS capture is ready."),
    allowedActions: [],
  },
  realtime: {
    service: "realtime",
    configured: true,
    health: readinessHealth("realtime", "ready", "Fixture realtime transport is ready."),
    allowedActions: [],
  },
  intelligence: {
    service: "intelligence",
    configured: true,
    health: readinessHealth("intelligence", "ready", "Fixture intelligence path is ready."),
    allowedActions: [],
  },
  session: {
    service: "session",
    configured: true,
    health: readinessHealth("session", "ready", "Fixture session can start."),
    allowedActions: ["start-session"],
  },
};

function readinessServices(
  patch: Partial<Record<StreamerSetupServiceId, StreamerSetupService>> = {},
): StreamerSetupService[] {
  const merged = { ...readyReadinessServices, ...patch };
  return readinessServiceOrder.map((service) => merged[service]);
}

function readinessFixture(input: {
  readonly status: StreamerReadinessView["status"];
  readonly ready: boolean;
  readonly liveInputsUsed?: boolean;
  readonly services?: ReturnType<typeof readinessServices>;
  readonly blockerCodes?: readonly string[];
  readonly recommendedAction?: StreamerSetupAction | null;
  readonly label: string;
}) {
  return streamerReadinessViewSchema.parse({
    evidenceClass: "fixture",
    liveInputsUsed: input.liveInputsUsed ?? false,
    ready: input.ready,
    status: input.status,
    services: input.services ?? readinessServices(),
    blockerCodes: input.blockerCodes ?? [],
    recommendedAction: input.recommendedAction ?? null,
    label: input.label,
  });
}

export const contractFixtureUiX01ReadinessCatalog = {
  "r4.setup.ready.v1": readinessFixture({
    status: "ready",
    ready: true,
    label: "Fixture setup is ready to start a stream session.",
    recommendedAction: "start-session",
  }),
  "r4.setup.permission-denied.v1": readinessFixture({
    status: "blocked",
    ready: false,
    services: readinessServices({
      "obs-capture": {
        service: "obs-capture",
        configured: false,
        health: readinessHealth(
          "obs-capture",
          "permission-denied",
          "Fixture browser cannot read the selected OBS Virtual Camera.",
        ),
        allowedActions: ["request-capture-permission", "select-capture-source"],
      },
      session: {
        ...readyReadinessServices.session,
        health: readinessHealth("session", "unavailable", "Capture permission is required before starting."),
        allowedActions: [],
      },
    }),
    blockerCodes: ["obs-capture-permission-denied"],
    recommendedAction: "request-capture-permission",
    label: "Fixture OBS capture permission is blocked.",
  }),
  "r4.setup.misconfigured.v1": readinessFixture({
    status: "blocked",
    ready: false,
    services: readinessServices({
      twitch: {
        service: "twitch",
        configured: false,
        health: readinessHealth("twitch", "misconfigured", "Fixture Twitch setup is incomplete."),
        allowedActions: ["connect-twitch", "install-extension"],
      },
      session: {
        ...readyReadinessServices.session,
        health: readinessHealth("session", "misconfigured", "Twitch setup is required before starting."),
        allowedActions: [],
      },
    }),
    blockerCodes: ["twitch-not-connected"],
    recommendedAction: "connect-twitch",
    label: "Fixture Twitch setup is incomplete.",
  }),
  "r4.setup.disconnected.v1": readinessFixture({
    status: "blocked",
    ready: false,
    services: readinessServices({
      realtime: {
        service: "realtime",
        configured: true,
        health: readinessHealth("realtime", "unavailable", "Fixture realtime connection is disconnected."),
        allowedActions: ["retry-service"],
      },
      session: {
        ...readyReadinessServices.session,
        health: readinessHealth("session", "unavailable", "Realtime must recover before starting."),
        allowedActions: [],
      },
    }),
    blockerCodes: ["realtime-disconnected"],
    recommendedAction: "retry-service",
    label: "Fixture realtime connection is disconnected.",
  }),
  "r4.setup.diagnostic.v1": readinessFixture({
    status: "diagnostic",
    ready: false,
    services: readinessServices({
      intelligence: {
        service: "intelligence",
        configured: true,
        health: readinessHealth(
          "intelligence",
          "degraded",
          "Fixture intelligence is using diagnostic examples only.",
        ),
        allowedActions: ["open-diagnostics"],
      },
    }),
    blockerCodes: ["diagnostic-fixture-only"],
    recommendedAction: "open-diagnostics",
    label: "Fixture setup is diagnostic only and cannot be claimed as live readiness.",
  }),
} satisfies Record<string, StreamerReadinessView>;

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
  liveDirector: contractFixtureLiveDirectorState,
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
  liveDirector: { publicContext: contractFixtureLiveDirectorState.publicContext },
});

export const contractFixtureOverlayView = overlayViewModelSchema.parse({
  envelope: { ...contractFixtureEnvelope, messageId: "fixture-overlay-view" },
  session: contractFixtureSession,
  readOnly: true,
  communityHype: 0,
  upNext: null,
  questCycle: contractFixtureQuestCycle,
  connection: contractFixtureConnection,
});
