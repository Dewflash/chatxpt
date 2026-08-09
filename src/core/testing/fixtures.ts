import {
  CONTRACT_VERSION,
  audienceSnapshotSchema,
  candidateBatchSchema,
  contractEnvelopeSchema,
  gameplaySnapshotSchema,
  overlayViewModelSchema,
  questCycleStateSchema,
  serviceHealthSchema,
  streamSessionSchema,
  streamerReadinessViewSchema,
  streamerViewModelSchema,
  streamerProfileSchema,
  viewerViewModelSchema,
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
