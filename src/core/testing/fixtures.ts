import {
  CONTRACT_VERSION,
  audienceSnapshotSchema,
  candidateBatchSchema,
  contractEnvelopeSchema,
  gameplaySnapshotSchema,
  overlayViewModelSchema,
  questCycleStateSchema,
  streamSessionSchema,
  streamerViewModelSchema,
  streamerProfileSchema,
  viewerViewModelSchema,
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
