import { z } from "zod";

import {
  CONTRACT_VERSION,
  audienceSnapshotSchema,
  commandEnvelopeSchema,
  contractEnvelopeSchema,
  gameplaySnapshotSchema,
  liveDirectorStateSchema,
  overlayViewModelSchema,
  streamerProfileSchema,
  streamerServiceCommandSchema,
  streamerViewModelSchema,
  viewerViewModelSchema,
  type CommandEnvelope,
  type ContractEnvelope,
  type GameplaySnapshot,
  type LiveDirectorState,
  type AudienceSnapshot,
  type OverlayViewModel,
  type QuestCandidate,
  type QuestCycleState,
  type RoleViewModels,
  type ServiceHealth,
  type StreamSession,
  type StreamerProfile,
  type StreamerServiceCommand,
  type StreamerViewModel,
  type ViewerViewModel,
} from "../contracts";

const GATEWAY_TIME = 1_786_010_000_000;
const GATEWAY_SESSION_ID = "ui-gateway-session";
const GATEWAY_CYCLE_ID = "ui-gateway-cycle";
const GATEWAY_REVISION = 4;

export const uiGatewaySurfaceSchema = z.enum(["streamer", "viewer", "overlay"]);
export type UiGatewaySurface = z.infer<typeof uiGatewaySurfaceSchema>;

export const uiGatewayCommandRouteSchema = z
  .object({
    method: z.literal("POST"),
    href: z.string().trim().min(1).max(160),
    command: z.union([commandEnvelopeSchema, streamerServiceCommandSchema]),
    allowed: z.boolean(),
    boundary: z.string().trim().min(1).max(240),
  })
  .strict();

export const uiGatewaySnapshotSchema = z
  .object({
    generatedAt: z.number().int().nonnegative(),
    evidenceClass: z.literal("fixture"),
    sessionId: z.string().trim().min(1),
    questCycleId: z.string().trim().min(1),
    revision: z.number().int().nonnegative(),
    routes: z.object({
      streamer: z.string().trim().min(1),
      viewer: z.string().trim().min(1),
      overlay: z.string().trim().min(1),
      fixtureJson: z.string().trim().min(1),
    }),
    views: z.object({
      streamer: streamerViewModelSchema,
      viewer: viewerViewModelSchema,
      overlay: overlayViewModelSchema,
    }),
    commands: z.object({
      streamer: z.array(uiGatewayCommandRouteSchema),
      viewer: z.array(uiGatewayCommandRouteSchema),
      overlay: z.array(uiGatewayCommandRouteSchema).length(0),
    }),
    boundaries: z.array(z.string().trim().min(1).max(240)),
  })
  .strict()
  .superRefine((snapshot, context) => {
    const viewModels = [snapshot.views.streamer, snapshot.views.viewer, snapshot.views.overlay];
    for (const [index, view] of viewModels.entries()) {
      if (
        view.envelope.sessionId !== snapshot.sessionId ||
        view.envelope.questCycleId !== snapshot.questCycleId ||
        view.envelope.revision !== snapshot.revision ||
        view.envelope.evidenceClass !== snapshot.evidenceClass
      ) {
        context.addIssue({
          code: "custom",
          message: "Gateway views must share the advertised fixture identity",
          path: ["views", index],
        });
      }
    }
  });

export type UiGatewayCommandRoute = z.infer<typeof uiGatewayCommandRouteSchema>;
export type UiGatewaySnapshot = z.infer<typeof uiGatewaySnapshotSchema>;
type UiGatewayRoutableCommand = CommandEnvelope | StreamerServiceCommand;

function envelope(messageId: string, source: ContractEnvelope["source"]): ContractEnvelope {
  return contractEnvelopeSchema.parse({
    contractVersion: CONTRACT_VERSION,
    sessionId: GATEWAY_SESSION_ID,
    questCycleId: GATEWAY_CYCLE_ID,
    messageId,
    correlationId: "ui-gateway-correlation",
    revision: GATEWAY_REVISION,
    occurredAt: GATEWAY_TIME,
    receivedAt: GATEWAY_TIME,
    source,
    evidenceClass: "fixture",
  });
}

function command(
  commandId: string,
  actor: CommandEnvelope["actor"],
  body: Record<string, unknown>,
): CommandEnvelope {
  return commandEnvelopeSchema.parse({
    contractVersion: CONTRACT_VERSION,
    sessionId: GATEWAY_SESSION_ID,
    questCycleId: GATEWAY_CYCLE_ID,
    commandId,
    correlationId: "ui-gateway-correlation",
    expectedRevision: GATEWAY_REVISION,
    issuedAt: GATEWAY_TIME,
    actor,
    ...body,
  });
}

function serviceCommand(commandId: string, body: Record<string, unknown>): StreamerServiceCommand {
  return streamerServiceCommandSchema.parse({
    contractVersion: CONTRACT_VERSION,
    sessionId: GATEWAY_SESSION_ID,
    commandId,
    correlationId: "ui-gateway-correlation",
    expectedRevision: GATEWAY_REVISION,
    issuedAt: GATEWAY_TIME,
    actor: { kind: "broadcaster", actorId: "fixture-broadcaster" },
    ...body,
  });
}

function serviceHealth(service: string, status: ServiceHealth["status"], message: string): ServiceHealth {
  return {
    service,
    status,
    checkedAt: GATEWAY_TIME,
    message,
    retryable: status !== "ready",
  };
}

function generatedAt(method: QuestCandidate["generation"]["method"]): QuestCandidate["generation"] {
  return {
    method,
    provider: null,
    generatedAt: GATEWAY_TIME,
  };
}

function gatewayCandidates(): readonly [QuestCandidate, QuestCandidate, QuestCandidate] {
  return [
    {
      candidateId: "gateway-quest-1",
      title: "Hold Mid Together",
      instruction: "Stay grouped and hold the current lane for the next 45 seconds.",
      durationSeconds: 45,
      difficulty: "easy",
      rewardPoints: 100,
      rationale: "Fixture-only voting state for browser UI integration.",
      sourceSignalIds: ["gateway-activity"],
      confidence: 0.5,
      generation: generatedAt("deterministic-fallback"),
    },
    {
      candidateId: "gateway-quest-2",
      title: "Caster Mode Push",
      instruction: "Narrate the next team fight like a commentator while staying in play.",
      durationSeconds: 45,
      difficulty: "medium",
      rewardPoints: 150,
      rationale: "Fixture-only option that exercises distinct quest copy and reward display.",
      sourceSignalIds: ["gateway-audience-energy"],
      confidence: 0.5,
      generation: generatedAt("deterministic-fallback"),
    },
    {
      candidateId: "gateway-quest-3",
      title: "Team Check-In",
      instruction: "Call your plan before the next push and let chat judge the execution.",
      durationSeconds: 45,
      difficulty: "easy",
      rewardPoints: 120,
      rationale: "Fixture-only option for testing three-choice vote rendering.",
      sourceSignalIds: ["gateway-activity", "gateway-audience-energy"],
      confidence: 0.5,
      generation: generatedAt("deterministic-fallback"),
    },
  ];
}

function gatewayProfile(): StreamerProfile {
  return streamerProfileSchema.parse({
    profileId: "ui-gateway-profile",
    streamerId: "fixture-broadcaster",
    revision: GATEWAY_REVISION,
    displayName: "Fixture Streamer",
    gameId: "brawl-stars",
    gameName: "Brawl Stars",
    experience: {
      intensity: 0.6,
      creativity: 0.7,
    },
    restrictions: ["No wagering", "No unsafe real-world dares"],
    preferredQuestTypes: ["skill", "commentary", "teamwork"],
    forbiddenQuestTypes: ["humiliation", "team-sabotage"],
    accessibilityNeeds: ["high-contrast"],
  });
}

function gatewayGameplay(): GameplaySnapshot {
  return gameplaySnapshotSchema.parse({
    envelope: envelope("ui-gateway-gameplay", "test-fixture"),
    capabilities: {
      tier: "universal-visual",
      gameId: "brawl-stars",
      adapterId: "ui-gateway-fixture",
      supportedSignals: ["activity-intensity", "match-phase"],
    },
    signals: [
      {
        signalId: "gateway-activity",
        kind: "activity-intensity",
        observation: {
          status: "known",
          value: "medium",
          provenance: {
            source: "test-fixture",
            method: "ui-gateway-fixture",
            confidence: 0.5,
            observedAt: GATEWAY_TIME,
            receivedAt: GATEWAY_TIME,
            evidenceClass: "fixture",
          },
        },
      },
      {
        signalId: "gateway-match-phase",
        kind: "match-phase",
        observation: {
          status: "unknown",
          reason: "not-observed",
          provenance: {
            source: "test-fixture",
            method: "ui-gateway-fixture",
            confidence: 0,
            observedAt: GATEWAY_TIME,
            receivedAt: GATEWAY_TIME,
            evidenceClass: "fixture",
          },
        },
      },
    ],
  });
}

function gatewayAudience(): AudienceSnapshot {
  return audienceSnapshotSchema.parse({
    envelope: envelope("ui-gateway-audience", "test-fixture"),
    sampleSize: 23,
    signals: [
      {
        signalId: "gateway-audience-energy",
        kind: "audience-energy",
        observation: {
          status: "known",
          value: "hype",
          provenance: {
            source: "test-fixture",
            method: "ui-gateway-fixture",
            confidence: 0.5,
            observedAt: GATEWAY_TIME,
            receivedAt: GATEWAY_TIME,
            evidenceClass: "fixture",
          },
        },
      },
    ],
  });
}

function gatewayQuestCycle(): QuestCycleState {
  const options = [...gatewayCandidates()];
  return {
    envelope: envelope("ui-gateway-cycle-state", "orchestrator"),
    status: "voting",
    options,
    activeCandidateId: null,
    availableStreamerActions: ["cancel", "emergency-pause"],
    voteTallies: [
      { candidateId: options[0].candidateId, votes: 7 },
      { candidateId: options[1].candidateId, votes: 11 },
      { candidateId: options[2].candidateId, votes: 5 },
    ],
    startsAt: GATEWAY_TIME,
    endsAt: GATEWAY_TIME + 45_000,
    progress: null,
    completionRule: { mode: "manual", allowedSignalKinds: [] },
    result: null,
  };
}

function gatewaySession(): StreamSession {
  return {
    sessionId: GATEWAY_SESSION_ID,
    broadcasterId: "fixture-broadcaster",
    platform: "twitch",
    status: "live",
    revision: GATEWAY_REVISION,
    createdAt: GATEWAY_TIME - 600_000,
    startedAt: GATEWAY_TIME - 300_000,
    endedAt: null,
    capabilities: {
      twitchExtension: true,
      hostedViewerBoard: true,
      twitchChatVoting: true,
      twitchIdentity: false,
      anonymousParticipation: true,
      reactions: true,
    },
  };
}

function gatewayLiveDirector(): LiveDirectorState {
  return liveDirectorStateSchema.parse({
    declaredIntent: {
      status: "known",
      intentId: "gateway-live-intent",
      goal: "Reach the next safe shelter",
      objective: "Explore carefully while involving chat in the route choice.",
      desiredAudienceInvolvement: "Suggest and vote on the next safe route.",
      authorId: "fixture-broadcaster",
      updatedAt: GATEWAY_TIME - 20_000,
      expiresAt: GATEWAY_TIME + 600_000,
    },
    audiencePointer: {
      status: "known",
      pointerId: "gateway-audience-pointer",
      topic: "Try the quieter route",
      observedAt: GATEWAY_TIME - 5_000,
      windowStartedAt: GATEWAY_TIME - 30_000,
      windowEndedAt: GATEWAY_TIME - 5_000,
      createdAt: GATEWAY_TIME,
      expiresAt: GATEWAY_TIME + 30_000,
      confidence: 0.82,
      relevance: 0.88,
      intentAlignment: 0.9,
      uniqueParticipants: 3,
      qualifyingMessages: 5,
      sarcasmRisk: false,
      evidenceSignalIds: ["gateway-audience-energy"],
    },
    liveContext: {
      contextId: "gateway-live-context",
      declaredIntentId: "gateway-live-intent",
      audiencePointerId: "gateway-audience-pointer",
      compiledAt: GATEWAY_TIME,
      expiresAt: GATEWAY_TIME + 30_000,
      facts: [
        {
          factId: "gateway-context-streamer",
          sourceClass: "streamer-declared",
          kind: "current-objective",
          status: "known",
          value: "Explore carefully while involving chat in the route choice.",
          method: "declared-intent",
          confidence: 1,
          observedAt: GATEWAY_TIME - 20_000,
          expiresAt: GATEWAY_TIME + 600_000,
          evidenceClass: "fixture",
          evidenceSignalIds: ["gateway-live-intent"],
        },
        {
          factId: "gateway-context-gameplay",
          sourceClass: "gameplay-observed",
          kind: "activity-intensity",
          status: "unknown",
          value: null,
          method: "fixture-normalizer",
          confidence: 0,
          observedAt: GATEWAY_TIME,
          expiresAt: GATEWAY_TIME + 15_000,
          evidenceClass: "fixture",
          evidenceSignalIds: ["gateway-activity"],
        },
        {
          factId: "gateway-context-audience",
          sourceClass: "audience-derived",
          kind: "route-request",
          status: "known",
          value: "Try the quieter route",
          method: "fixture-aggregate",
          confidence: 0.82,
          observedAt: GATEWAY_TIME - 5_000,
          expiresAt: GATEWAY_TIME + 30_000,
          evidenceClass: "fixture",
          evidenceSignalIds: ["gateway-audience-energy"],
        },
      ],
    },
    cue: {
      cueId: "gateway-director-cue",
      contextId: "gateway-live-context",
      intentId: "gateway-live-intent",
      audiencePointerId: "gateway-audience-pointer",
      state: "proposed",
      reason: "Chat is asking for a route choice during a low-pressure moment.",
      evidenceReferences: [
        "gateway-live-intent",
        "gateway-activity",
        "gateway-audience-pointer",
      ],
      createdAt: GATEWAY_TIME,
      updatedAt: GATEWAY_TIME,
      expiresAt: GATEWAY_TIME + 30_000,
      availableActions: ["acknowledge", "turn-into-vote", "later", "dismiss"],
    },
    publicContext: null,
    privacy: {
      rawChatRetained: false,
      usernamesIncluded: false,
      viewerIdentifiersIncluded: false,
      providerPayloadIncluded: false,
    },
    updatedAt: GATEWAY_TIME,
  });
}

function gatewayViews(): RoleViewModels {
  const session = gatewaySession();
  const questCycle = gatewayQuestCycle();
  const services = [
    serviceHealth("twitch-extension", "ready", "Fixture Extension mount is available."),
    serviceHealth("hosted-board", "ready", "Fixture hosted board entry is available."),
    serviceHealth("obs-overlay", "degraded", "Fixture overlay is browser-safe; OBS capture is not verified here."),
    serviceHealth("realtime", "ready", "Fixture broadcast identity is consistent across surfaces."),
  ];
  const profile = gatewayProfile();
  const gameplay = gatewayGameplay();
  const audience = gatewayAudience();
  const liveDirector = gatewayLiveDirector();

  const streamer: StreamerViewModel = streamerViewModelSchema.parse({
    envelope: envelope("ui-gateway-streamer-view", "orchestrator"),
    session,
    profile,
    services,
    gameplay,
    audience,
    questCycle,
    emergencyPaused: false,
    liveDirector,
  });
  const viewer: ViewerViewModel = viewerViewModelSchema.parse({
    envelope: envelope("ui-gateway-viewer-view", "orchestrator"),
    session,
    capabilities: session.capabilities,
    participationMode: "hosted-board",
    canVote: true,
    canReact: true,
    viewerId: null,
    sessionPoints: 120,
    communityHype: 42,
    acceptedCandidateId: null,
    questCycle,
    connection: serviceHealth("viewer-realtime", "ready", "Fixture viewer can fetch the latest snapshot."),
    liveDirector: { publicContext: liveDirector.publicContext },
  });
  const overlay: OverlayViewModel = overlayViewModelSchema.parse({
    envelope: envelope("ui-gateway-overlay-view", "orchestrator"),
    session,
    readOnly: true,
    communityHype: 42,
    questCycle,
    connection: serviceHealth("overlay-realtime", "ready", "Fixture overlay is read-only."),
  });

  return { streamer, viewer, overlay };
}

function gatewayCommands(views: RoleViewModels): UiGatewaySnapshot["commands"] {
  const firstCandidate = views.viewer.questCycle.options[0]?.candidateId ?? "gateway-quest-1";
  return {
    streamer: [
      {
        method: "POST",
        href: "/api/ui-gateway/commands",
        command: command(
          "ui-gateway-streamer-cancel",
          { kind: "broadcaster", actorId: "fixture-broadcaster" },
          { type: "streamer.quest", action: "cancel", candidateId: null },
        ),
        allowed: true,
        boundary: "Streamer commands must be authenticated and resolved by Role 1 before Role 3 changes lifecycle state.",
      },
      {
        method: "POST",
        href: "/api/ui-gateway/commands",
        command: command(
          "ui-gateway-emergency-pause",
          { kind: "broadcaster", actorId: "fixture-broadcaster" },
          { type: "streamer.quest", action: "emergency-pause", candidateId: null },
        ),
        allowed: true,
        boundary: "Emergency pause latches inside Role 1 authoritative state; UI only emits the command.",
      },
      {
        method: "POST",
        href: "/api/ui-gateway/commands",
        command: command(
          "ui-gateway-live-director-cue",
          { kind: "broadcaster", actorId: "fixture-broadcaster" },
          {
            type: "streamer.live-director-cue",
            cueId: "gateway-director-cue",
            action: "later",
          },
        ),
        allowed: true,
        boundary: "Director Cue actions are authenticated by Role 1 and transitioned by Role 3 before one authoritative commit.",
      },
      {
        method: "POST",
        href: "/api/ui-gateway/commands",
        command: serviceCommand("ui-gateway-connect-twitch", {
          type: "streamer.setup",
          service: "twitch",
          action: "connect-twitch",
        }),
        allowed: true,
        boundary: "Setup commands are broadcaster-only Role 1 commands; UI never stores Twitch credentials.",
      },
      {
        method: "POST",
        href: "/api/ui-gateway/commands",
        command: serviceCommand("ui-gateway-request-capture", {
          type: "streamer.setup",
          service: "obs-capture",
          action: "request-capture-permission",
        }),
        allowed: true,
        boundary: "OBS capture permission is requested by the browser/setup surface and reported as health, not fabricated live evidence.",
      },
      {
        method: "POST",
        href: "/api/ui-gateway/commands",
        command: serviceCommand("ui-gateway-start-session", {
          type: "streamer.session",
          action: "start",
        }),
        allowed: true,
        boundary: "Session start is a Role 1 lifecycle command; readiness must come from current integration health.",
      },
    ],
    viewer: [
      {
        method: "POST",
        href: "/api/ui-gateway/commands",
        command: command(
          "ui-gateway-viewer-vote",
          { kind: "anonymous", actorId: null },
          {
            type: "viewer.vote",
            candidateId: firstCandidate,
            voterKey: "fixture-anonymous-viewer",
            sourceMode: "hosted-board",
          },
        ),
        allowed: true,
        boundary: "Viewer vote commands are idempotent by commandId and voterKey; clients never calculate winners.",
      },
      {
        method: "POST",
        href: "/api/ui-gateway/commands",
        command: command(
          "ui-gateway-viewer-react",
          { kind: "anonymous", actorId: null },
          { type: "viewer.react", reaction: "hype" },
        ),
        allowed: true,
        boundary: "Reactions may update presentation, but reward and vote authority stay behind Role 1.",
      },
    ],
    overlay: [],
  };
}

export function createFixtureUiGatewaySnapshot(): UiGatewaySnapshot {
  const views = gatewayViews();
  return uiGatewaySnapshotSchema.parse({
    generatedAt: GATEWAY_TIME,
    evidenceClass: "fixture",
    sessionId: GATEWAY_SESSION_ID,
    questCycleId: GATEWAY_CYCLE_ID,
    revision: GATEWAY_REVISION,
    routes: {
      streamer: "/diagnostics/ui-harness?surface=streamer",
      viewer: "/diagnostics/ui-harness?surface=viewer",
      overlay: "/diagnostics/ui-harness?surface=overlay",
      fixtureJson: "/api/ui-gateway/fixture",
    },
    views,
    commands: gatewayCommands(views),
    boundaries: [
      "This gateway is browser-safe and fixture-only; it cannot prove live Twitch, OBS, AI, or Supabase behavior.",
      "Role 1 owns command authentication, idempotency, revision checks, persistence, and broadcast.",
      "Role 4 and Role 5 render these view models and emit these commands without owning lifecycle or vote authority.",
      "All surfaces show the same sessionId, questCycleId, revision, and fixture evidence class.",
    ],
  });
}

export type UiGatewayCommandValidationResult =
  | {
      readonly ok: true;
      readonly accepted: false;
      readonly status: "validated-fixture-only";
      readonly command: UiGatewayRoutableCommand;
      readonly boundary: string;
    }
  | {
      readonly ok: false;
      readonly status: "invalid" | "unknown-session" | "stale-revision" | "unsupported-command";
      readonly httpStatus: 400 | 404 | 409;
      readonly error: string;
    };

export function validateFixtureUiGatewayCommand(input: unknown): UiGatewayCommandValidationResult {
  const parsed = z.union([commandEnvelopeSchema, streamerServiceCommandSchema]).safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      status: "invalid",
      httpStatus: 400,
      error: "Command does not match the canonical envelope schema.",
    };
  }

  const snapshot = createFixtureUiGatewaySnapshot();
  const commandToValidate = parsed.data;
  if (commandToValidate.sessionId !== snapshot.sessionId) {
    return {
      ok: false,
      status: "unknown-session",
      httpStatus: 404,
      error: "Diagnostic gateway can only validate its fixture session.",
    };
  }
  if (
    ("questCycleId" in commandToValidate && commandToValidate.questCycleId !== snapshot.questCycleId) ||
    commandToValidate.expectedRevision !== snapshot.revision
  ) {
    return {
      ok: false,
      status: "stale-revision",
      httpStatus: 409,
      error: "Command does not target the current fixture quest cycle revision.",
    };
  }

  const supported = [...snapshot.commands.streamer, ...snapshot.commands.viewer].find(
    (route) => commandRouteMatches(route.command, commandToValidate),
  );
  if (supported === undefined) {
    return {
      ok: false,
      status: "unsupported-command",
      httpStatus: 400,
      error: "Diagnostic gateway has no fixture handler for this command type.",
    };
  }

  return {
    ok: true,
    accepted: false,
    status: "validated-fixture-only",
    command: commandToValidate,
    boundary:
      "The diagnostic gateway validates browser-safe command shape only; real acceptance still requires Role 1 authorization, persistence, and broadcast.",
  };
}

function commandRouteMatches(routeCommand: UiGatewayRoutableCommand, commandToValidate: UiGatewayRoutableCommand): boolean {
  if (routeCommand.type !== commandToValidate.type) return false;
  if (routeCommand.type === "streamer.setup" && commandToValidate.type === "streamer.setup") {
    return routeCommand.service === commandToValidate.service && routeCommand.action === commandToValidate.action;
  }
  if (routeCommand.type === "streamer.session" && commandToValidate.type === "streamer.session") {
    return routeCommand.action === commandToValidate.action;
  }
  return true;
}
