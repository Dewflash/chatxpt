import {
  CONTRACT_VERSION,
  overlayViewModelSchema,
  viewerViewModelSchema,
  type ContractEnvelope,
  type OverlayViewModel,
  type QuestCandidate,
  type QuestCycleState,
  type StreamSession,
  type ViewerViewModel,
} from "../core";

const BASE_TIME = 1_786_200_000_000;
const SESSION_ID = "role-5-demo-session";
const CYCLE_ID = "role-5-demo-cycle";

function envelope(messageId: string, revision = 12): ContractEnvelope {
  return {
    contractVersion: CONTRACT_VERSION,
    sessionId: SESSION_ID,
    questCycleId: CYCLE_ID,
    messageId,
    correlationId: "role-5-demo-correlation",
    revision,
    occurredAt: BASE_TIME,
    receivedAt: BASE_TIME,
    source: "test-fixture",
    evidenceClass: "fixture",
  };
}

const candidates: readonly QuestCandidate[] = [
  {
    candidateId: "guardian-protocol",
    title: "Guardian Protocol",
    instruction: "Reach the teammate under pressure and hold cover until the revive finishes.",
    durationSeconds: 75,
    difficulty: "hard",
    rewardPoints: 600,
    rationale: "A team-saving moment is visible and chat is asking for a rescue.",
    sourceSignalIds: ["fixture-squad-pressure"],
    confidence: 0.78,
    generation: {
      method: "deterministic-fallback",
      provider: null,
      generatedAt: BASE_TIME,
    },
  },
  {
    candidateId: "caster-mode",
    title: "Caster Mode",
    instruction: "Narrate the next fight like a sports commentator until combat ends.",
    durationSeconds: 90,
    difficulty: "easy",
    rewardPoints: 280,
    rationale: "The viewer mood is playful and the streamer allows performance quests.",
    sourceSignalIds: ["fixture-chat-energy"],
    confidence: 0.72,
    generation: {
      method: "deterministic-fallback",
      provider: null,
      generatedAt: BASE_TIME,
    },
  },
  {
    candidateId: "Chat-battle-cry".toLocaleLowerCase(),
    title: "Chat Battle Cry",
    instruction: "Pick one short phrase from chat and say it before the next committed push.",
    durationSeconds: 60,
    difficulty: "easy",
    rewardPoints: 280,
    rationale: "Chat gets a direct role without forcing unsafe or sabotaging play.",
    sourceSignalIds: ["fixture-chat-request"],
    confidence: 0.7,
    generation: {
      method: "deterministic-fallback",
      provider: null,
      generatedAt: BASE_TIME,
    },
  },
];

const session: StreamSession = {
  sessionId: SESSION_ID,
  broadcasterId: "fixture-broadcaster",
  platform: "twitch",
  status: "live",
  revision: 12,
  createdAt: BASE_TIME - 300_000,
  startedAt: BASE_TIME - 120_000,
  endedAt: null,
  capabilities: {
    twitchExtension: true,
    hostedViewerBoard: true,
    twitchChatVoting: true,
    twitchIdentity: true,
    anonymousParticipation: true,
    reactions: true,
  },
};

function votingCycle(acceptedCandidateId: string | null = null): QuestCycleState {
  return {
    envelope: envelope("role-5-demo-cycle-state"),
    status: "voting",
    options: [...candidates],
    activeCandidateId: null,
    availableStreamerActions: ["cancel", "skip", "emergency-pause"],
    voteTallies: [
      { candidateId: "guardian-protocol", votes: acceptedCandidateId === "guardian-protocol" ? 18 : 17 },
      { candidateId: "caster-mode", votes: acceptedCandidateId === "caster-mode" ? 12 : 11 },
      { candidateId: "chat-battle-cry", votes: acceptedCandidateId === "chat-battle-cry" ? 9 : 8 },
    ],
    startsAt: BASE_TIME - 10_000,
    endsAt: BASE_TIME + 20_000,
    progress: null,
    completionRule: null,
    result: null,
  };
}

function idleCycle(): QuestCycleState {
  return {
    envelope: envelope("role-5-demo-idle-cycle", 11),
    status: "idle",
    options: [],
    activeCandidateId: null,
    availableStreamerActions: [],
    voteTallies: [],
    startsAt: null,
    endsAt: null,
    progress: null,
    completionRule: null,
    result: null,
  };
}

function activeCycle(): QuestCycleState {
  return {
    ...votingCycle("guardian-protocol"),
    envelope: envelope("role-5-demo-active-cycle", 13),
    status: "active",
    activeCandidateId: "guardian-protocol",
    startsAt: BASE_TIME - 16_000,
    endsAt: BASE_TIME + 59_000,
    completionRule: {
      mode: "signal",
      allowedSignalKinds: ["fixture-squad-pressure"],
    },
    progress: {
      value: 0.42,
      updatedAt: BASE_TIME - 2_000,
      method: "automatic",
      evidenceSignalIds: ["fixture-squad-pressure"],
    },
  };
}

function resultCycle(): QuestCycleState {
  return {
    ...activeCycle(),
    envelope: envelope("role-5-demo-result-cycle", 14),
    status: "succeeded",
    endsAt: BASE_TIME,
    completionRule: {
      mode: "manual",
      allowedSignalKinds: [],
    },
    progress: {
      value: 1,
      updatedAt: BASE_TIME,
      method: "manual",
      evidenceSignalIds: [],
    },
    result: {
      outcome: "succeeded",
      occurredAt: BASE_TIME,
      reason: "Streamer completed the revive and held cover.",
      rewardPointsAwarded: 600,
    },
  };
}

export function createViewerDemoView(input: {
  readonly mode?: ViewerViewModel["participationMode"];
  readonly acceptedCandidateId?: string | null;
  readonly connection?: ViewerViewModel["connection"]["status"];
} = {}): ViewerViewModel {
  const connectionStatus = input.connection ?? "ready";
  return viewerViewModelSchema.parse({
    envelope: envelope("role-5-demo-viewer-view"),
    session,
    capabilities: session.capabilities,
    participationMode: input.mode ?? "twitch-extension",
    canVote: connectionStatus === "ready",
    canReact: connectionStatus === "ready",
    viewerId: "fixture-viewer",
    sessionPoints: input.acceptedCandidateId === "guardian-protocol" ? 600 : 120,
    communityHype: input.acceptedCandidateId === null ? 74 : 82,
    acceptedCandidateId: input.acceptedCandidateId ?? null,
    questCycle: votingCycle(input.acceptedCandidateId ?? null),
    connection: {
      service: "fixture-realtime",
      status: connectionStatus,
      checkedAt: BASE_TIME,
      message: connectionStatus === "ready" ? "Fixture snapshot connected" : "Fixture reconnect state",
      retryable: connectionStatus !== "ready",
    },
  });
}

export function createOverlayDemoView(
  state: "inactive" | "voting" | "active" | "result" | "reconnecting" = "active",
): OverlayViewModel {
  const cycle =
    state === "inactive"
      ? idleCycle()
      : state === "voting"
        ? votingCycle()
        : state === "result"
          ? resultCycle()
          : activeCycle();
  return overlayViewModelSchema.parse({
    envelope: envelope(`role-5-demo-overlay-${state}`, cycle.envelope.revision),
    session: { ...session, revision: cycle.envelope.revision },
    readOnly: true,
    communityHype: state === "result" ? 88 : 82,
    questCycle: cycle,
    connection: {
      service: "fixture-realtime",
      status: state === "reconnecting" ? "degraded" : "ready",
      checkedAt: BASE_TIME,
      message: state === "reconnecting" ? "Keeping latest safe snapshot while reconnecting" : "Fixture overlay connected",
      retryable: state === "reconnecting",
    },
  });
}

export function acceptFixtureVote(view: ViewerViewModel, candidateId: string): ViewerViewModel {
  return createViewerDemoView({
    mode: view.participationMode,
    acceptedCandidateId: candidateId,
    connection: view.connection.status,
  });
}
