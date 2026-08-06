import { z } from "zod";

import {
  CONTRACT_VERSION,
  ChatXptOrchestrator,
  candidateBatchSchema,
  commandEnvelopeSchema,
  contractEnvelopeSchema,
  domainErrorSchema,
  questCycleStateSchema,
  streamSessionSchema,
  streamerProfileSchema,
  streamerQuestCommandSchema,
  streamerServiceCommandSchema,
  systemIntelligenceCommandSchema,
  contractFixtureUiX01ReadinessCatalog,
  contractFixtureUiX04SessionHistory,
  contractFixtureUiX06QuestStateCatalog,
  contractFixtureUiX06RoleViewCatalog,
  contractFixtureUiX09GenerationCatalog,
  contractFixtureUiX09IntelligenceCatalog,
  type CommandEnvelope,
  type ContractEnvelope,
  type DomainError,
  type OrchestratorResult,
  type QuestCandidate,
  type RoleViewModels,
  type StreamerReadinessView,
  type StreamerServiceCommand,
  type TwitchChatFallbackAnnouncementKind,
  type TwitchChatFallbackDeliveryStatus,
  type TwitchChatVoteAcknowledgementStatus,
  type ViewModelProjectionInput,
  type ViewModelProjector,
} from "../../../../core";
import { DefaultQuestEngine } from "../../../../quest-engine";
import {
  buildTwitchChatFinalResultText,
  buildTwitchChatPollOpenText,
  buildTwitchChatVoteAcknowledgement,
  MemoryChatXptPersistence,
  recordTwitchChatAcknowledgementDelivery,
  recordTwitchChatFallbackDelivery,
  ServerCommandAuthorizer,
  SessionLifecycleService,
  type VerifiedCommandActor,
  type VerifiedCommandActorResolver,
} from "../../../../realtime";

const FIXTURE_TIME = 1_786_200_000_000;
const SESSION_ID = "ui-gateway-fixture-session";
const QUEST_CYCLE_ID = "ui-gateway-fixture-cycle";
const BROADCASTER_ID = "ui-gateway-fixture-broadcaster";
const SYSTEM_ACTOR_ID = "ui-gateway-fixture-system";
const VIEWER_PRINCIPAL_ID = "ui-gateway-fixture-viewer";
const STREAMER_PRINCIPAL_ID = "ui-gateway-fixture-streamer";
const OVERLAY_PRINCIPAL_ID = "ui-gateway-fixture-overlay";
const ROOM_CODE = "ABCDEFGH";
const GRANT_EXPIRES_AT = FIXTURE_TIME + 60 * 60 * 1_000;

export const DIAGNOSTIC_UI_GATEWAY_REALITY = {
  evidenceClass: "fixture",
  liveInputsUsed: false,
  label: "local diagnostic UI gateway",
  limitations: [
    "Uses in-memory fixture state only.",
    "Does not authenticate Twitch, Supabase, or production browser clients.",
    "Does not prove real gameplay, real chat, or deployed realtime behaviour.",
  ],
} as const;

export const diagnosticUiGatewayPrincipals = {
  streamer: STREAMER_PRINCIPAL_ID,
  viewer: VIEWER_PRINCIPAL_ID,
  overlay: OVERLAY_PRINCIPAL_ID,
} as const;

export const diagnosticUiGatewaySessionId = SESSION_ID;
export const diagnosticUiGatewayQuestCycleId = QUEST_CYCLE_ID;
export const diagnosticUiGatewayBroadcasterId = BROADCASTER_ID;
export const diagnosticUiGatewayRoomCode = ROOM_CODE;
export const diagnosticUiGatewayFixtureCatalog = {
  readiness: contractFixtureUiX01ReadinessCatalog,
  sessionHistory: contractFixtureUiX04SessionHistory,
  questStates: contractFixtureUiX06QuestStateCatalog,
  roleViews: contractFixtureUiX06RoleViewCatalog,
  intelligence: contractFixtureUiX09IntelligenceCatalog,
  generation: contractFixtureUiX09GenerationCatalog,
} as const;

type SnapshotRole = keyof RoleViewModels;

const snapshotReadInputSchema = z
  .object({
    sessionId: z.string().trim().min(1).max(128),
    role: z.enum(["streamer", "viewer", "overlay"]),
    principalId: z.string().trim().min(1).max(128),
  })
  .strict();

export type DiagnosticSnapshotReadInput = z.infer<typeof snapshotReadInputSchema>;

const viewerReceiptInputSchema = z
  .object({
    sessionId: z.string().trim().min(1).max(128),
    questCycleId: z.string().trim().min(1).max(128),
    principalId: z.string().trim().min(1).max(128),
    identityKind: z.enum(["authenticated", "anonymous-token"]),
  })
  .strict();

const hostedBoardAccessInputSchema = z
  .object({
    roomCode: z.string().trim().min(1).max(32),
    principalId: z.string().trim().min(1).max(128),
    baseUrl: z.url(),
    includeQrPayload: z.boolean().optional(),
  })
  .strict();

const sessionHistoryInputSchema = z
  .object({
    broadcasterId: z.string().trim().min(1).max(128),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  })
  .strict();

const chatFallbackInputSchema = z
  .object({
    kind: z.enum(["poll-open", "final-result"]).default("poll-open"),
    outcome: z.enum(["activated", "cancelled", "no-votes", "expired"]).optional(),
    winnerTitle: z.string().trim().min(1).max(80).nullable().optional(),
    deliveryStatus: z
      .enum(["not-attempted", "delivered", "rate-limited", "failed", "unavailable"])
      .default("not-attempted"),
    deliveredAt: z.number().int().nonnegative().nullable().default(null),
  })
  .strict();

const chatAcknowledgementInputSchema = z
  .object({
    processingStatus: z.enum(["counted", "duplicate", "rejected", "late"]),
    candidateId: z.string().trim().min(1).max(128).nullable(),
    deliveryStatus: z.enum(["delivered", "rate-limited", "failed", "unavailable"]),
    deliveredAt: z.number().int().nonnegative().nullable(),
  })
  .strict();

export type DiagnosticUiGatewayReadResult =
  | {
      readonly ok: true;
      readonly reality: typeof DIAGNOSTIC_UI_GATEWAY_REALITY;
      readonly sessionId: string;
      readonly role: SnapshotRole;
      readonly snapshot: RoleViewModels[SnapshotRole];
      readonly fixtureCatalog: typeof diagnosticUiGatewayFixtureCatalog;
    }
  | {
      readonly ok: false;
      readonly reality: typeof DIAGNOSTIC_UI_GATEWAY_REALITY;
      readonly error: DomainError;
    };

export type DiagnosticUiGatewayCommandResult =
  | {
      readonly ok: true;
      readonly reality: typeof DIAGNOSTIC_UI_GATEWAY_REALITY;
      readonly outcome: "committed" | "duplicate";
      readonly revision: number;
      readonly delivery: OrchestratorResult extends infer Result
        ? Result extends { ok: true; delivery: infer Delivery }
          ? Delivery
          : never
        : never;
      readonly receipt: {
        readonly commandId: string;
        readonly acceptedAt: number;
        readonly eventTypes: readonly string[];
      };
      readonly views: RoleViewModels | null;
      readonly serviceCommand?: {
        readonly status: "diagnostic-only";
        readonly readiness: StreamerReadinessView;
      };
    }
  | {
      readonly ok: false;
      readonly reality: typeof DIAGNOSTIC_UI_GATEWAY_REALITY;
      readonly error: DomainError;
    };

export type DiagnosticUiGatewayRouteResult =
  | {
      readonly ok: true;
      readonly reality: typeof DIAGNOSTIC_UI_GATEWAY_REALITY;
      readonly [key: string]: unknown;
    }
  | {
      readonly ok: false;
      readonly reality: typeof DIAGNOSTIC_UI_GATEWAY_REALITY;
      readonly error: DomainError;
    };

class FixedClock {
  now(): number {
    return FIXTURE_TIME + 3_000;
  }
}

class SequenceIds {
  private sequence = 0;

  nextId(kind: "quest-state" | "quest-event" | "view-model"): string {
    this.sequence += 1;
    return `ui-gateway-${kind}-${this.sequence}`;
  }
}

class DiagnosticActorResolver implements VerifiedCommandActorResolver {
  resolve(command: CommandEnvelope): VerifiedCommandActor | null {
    if (command.actor.kind === "broadcaster" && command.actor.actorId === BROADCASTER_ID) {
      return {
        kind: "broadcaster",
        actorId: BROADCASTER_ID,
        expiresAt: null,
        moderatorForBroadcasterIds: [],
        voterKey: null,
        participationModes: [],
      };
    }
    if (command.actor.kind === "anonymous" && command.type === "viewer.vote") {
      return {
        kind: "anonymous",
        actorId: null,
        expiresAt: null,
        moderatorForBroadcasterIds: [],
        voterKey: command.voterKey,
        participationModes: [command.sourceMode],
      };
    }
    if (command.actor.kind === "viewer" && command.type === "viewer.vote") {
      return {
        kind: "viewer",
        actorId: command.actor.actorId,
        expiresAt: null,
        moderatorForBroadcasterIds: [],
        voterKey: command.voterKey,
        participationModes: [command.sourceMode],
      };
    }
    if (command.actor.kind === "system") {
      return {
        kind: "system",
        actorId: command.actor.actorId,
        expiresAt: null,
        moderatorForBroadcasterIds: [],
        voterKey: null,
        participationModes: [],
      };
    }
    return null;
  }
}

class DiagnosticViewProjector implements ViewModelProjector {
  project(input: ViewModelProjectionInput): RoleViewModels {
    const connection = {
      service: "diagnostic-ui-gateway",
      status: "ready" as const,
      checkedAt: input.envelope.occurredAt,
      message: "Fixture-only local UI gateway.",
      retryable: false,
    };
    return {
      streamer: {
        envelope: input.envelope,
        session: input.session,
        profile: input.profile,
        services: [...input.services],
        gameplay: input.gameplay,
        audience: input.audience,
        questCycle: input.questCycle,
        emergencyPaused: input.emergencyPaused,
      },
      viewer: {
        envelope: input.envelope,
        session: input.session,
        capabilities: input.capabilities,
        participationMode: input.participationMode,
        canVote: input.questCycle.status === "voting",
        canReact: input.capabilities.reactions,
        viewerId: input.viewerId,
        sessionPoints: input.sessionPoints,
        communityHype: input.communityHype,
        acceptedCandidateId: input.acceptedCandidateId,
        questCycle: input.questCycle,
        connection,
      },
      overlay: {
        envelope: input.envelope,
        session: input.session,
        readOnly: true,
        communityHype: input.communityHype,
        questCycle: input.questCycle,
        connection,
      },
    };
  }
}

function error(code: DomainError["code"], message: string, retryable = false): DomainError {
  return domainErrorSchema.parse({ code, message, retryable });
}

export function diagnosticUiGatewayStatusFor(error: DomainError): number {
  switch (error.code) {
    case "validation":
      return 400;
    case "unauthenticated":
      return 401;
    case "forbidden":
      return 403;
    case "duplicate":
    case "stale-revision":
      return 409;
    case "expired":
      return 410;
    case "dependency-unavailable":
    case "unavailable-capability":
      return 503;
    case "rate-limited":
      return 429;
    case "internal":
      return 500;
  }
}

function envelope(messageId: string, revision: number): ContractEnvelope {
  return contractEnvelopeSchema.parse({
    contractVersion: CONTRACT_VERSION,
    sessionId: SESSION_ID,
    questCycleId: QUEST_CYCLE_ID,
    messageId,
    correlationId: "ui-gateway-fixture-correlation",
    revision,
    occurredAt: FIXTURE_TIME,
    receivedAt: FIXTURE_TIME,
    source: "test-fixture",
    evidenceClass: "fixture",
  });
}

function candidate(candidateId: string, title: string, instruction: string) {
  return {
    candidateId,
    title,
    instruction,
    durationSeconds: 30,
    difficulty: "easy" as const,
    rewardPoints: 100,
    rationale: "Fixture-only gateway candidate for local browser command testing.",
    sourceSignalIds: [],
    confidence: 0,
    generation: {
      method: "deterministic-fallback" as const,
      provider: null,
      generatedAt: FIXTURE_TIME,
    },
  };
}

function initialState() {
  const session = streamSessionSchema.parse({
    sessionId: SESSION_ID,
    broadcasterId: BROADCASTER_ID,
    platform: "twitch",
    status: "preparing",
    revision: 0,
    createdAt: FIXTURE_TIME,
    startedAt: null,
    endedAt: null,
    capabilities: {
      twitchExtension: false,
      hostedViewerBoard: true,
      twitchChatVoting: true,
      twitchIdentity: false,
      anonymousParticipation: true,
      reactions: false,
    },
  });
  const profile = streamerProfileSchema.parse({
    profileId: "ui-gateway-fixture-profile",
    streamerId: BROADCASTER_ID,
    revision: 0,
    displayName: "UI Gateway Fixture Streamer",
    gameId: null,
    gameName: null,
    experience: {
      intensity: 0.5,
      creativity: 0.5,
    },
    restrictions: ["Fixture route only; do not present as live evidence."],
    preferredQuestTypes: ["commentary", "positioning"],
    forbiddenQuestTypes: ["unsafe", "wagering"],
      accessibilityNeeds: [],
  });
  const questCycle = questCycleStateSchema.parse({
    envelope: envelope("ui-gateway-cycle", 0),
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
  });
  const connection = {
    service: "diagnostic-ui-gateway",
    status: "ready" as const,
    checkedAt: FIXTURE_TIME,
    message: "Fixture-only local UI gateway.",
    retryable: false,
  };
  return {
    session,
    profile,
    services: [connection],
    gameplay: null,
    audience: null,
    questCycle,
    emergencyPaused: false,
    communityHype: 0,
  };
}

function fixtureCandidateBatch(revision: number) {
  return candidateBatchSchema.parse({
    envelope: envelope("ui-gateway-candidates", revision),
    candidates: [
      candidate("ui-gateway-candidate-1", "Hold Your Ground", "Stay in the current safe playable area for 30 seconds."),
      candidate("ui-gateway-candidate-2", "Caster Mode", "Narrate the next 30 seconds like a sports commentator."),
      candidate("ui-gateway-candidate-3", "Plan Out Loud", "Explain your next move before the next major action."),
    ],
  });
}

function readinessForCommand(command: StreamerServiceCommand): StreamerReadinessView {
  if (command.type === "streamer.session") {
    return command.action === "start"
      ? contractFixtureUiX01ReadinessCatalog["r4.setup.ready.v1"]
      : contractFixtureUiX01ReadinessCatalog["r4.setup.diagnostic.v1"];
  }
  if (command.action === "request-capture-permission" || command.action === "select-capture-source") {
    return contractFixtureUiX01ReadinessCatalog["r4.setup.permission-denied.v1"];
  }
  if (command.action === "connect-twitch" || command.action === "install-extension") {
    return contractFixtureUiX01ReadinessCatalog["r4.setup.misconfigured.v1"];
  }
  if (command.action === "retry-service") {
    return contractFixtureUiX01ReadinessCatalog["r4.setup.disconnected.v1"];
  }
  if (command.action === "start-session") {
    return contractFixtureUiX01ReadinessCatalog["r4.setup.ready.v1"];
  }
  return contractFixtureUiX01ReadinessCatalog["r4.setup.diagnostic.v1"];
}

export class DiagnosticUiGateway {
  private readonly persistence = new MemoryChatXptPersistence();
  private readonly clock = new FixedClock();
  private readonly orchestrator = new ChatXptOrchestrator({
    authorizer: new ServerCommandAuthorizer(new DiagnosticActorResolver(), () => this.clock.now()),
    candidateBatches: this.persistence,
    acceptedVotes: this.persistence,
    repository: this.persistence,
    engine: new DefaultQuestEngine(),
    projectionContext: {
      resolve: (_state, command) => ({
        participationMode:
          command.type === "viewer.vote" ? command.sourceMode : "hosted-board",
        viewerId:
          command.actor.kind === "viewer"
            ? command.actor.actorId
            : command.actor.kind === "anonymous" && command.type === "viewer.vote"
              ? command.voterKey
              : null,
        sessionPoints: 0,
        acceptedCandidateId: command.type === "viewer.vote" ? command.candidateId : null,
        connection: {
          service: "diagnostic-ui-gateway",
          status: "ready",
          checkedAt: this.clock.now(),
          message: "Fixture-only local UI gateway.",
          retryable: false,
        },
      }),
    },
    projector: new DiagnosticViewProjector(),
    publisher: this.persistence,
    clock: this.clock,
    ids: new SequenceIds(),
  });
  private ready: Promise<void> | null = null;

  async readSnapshot(input: unknown): Promise<DiagnosticUiGatewayReadResult> {
    const parsed = snapshotReadInputSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        reality: DIAGNOSTIC_UI_GATEWAY_REALITY,
        error: error("validation", "Snapshot read request is invalid"),
      };
    }
    await this.ensureReady();
    const allowed = await this.persistence.canRead(
      parsed.data.principalId,
      parsed.data.sessionId,
      parsed.data.role,
      this.clock.now(),
    );
    if (!allowed) {
      return {
        ok: false,
        reality: DIAGNOSTIC_UI_GATEWAY_REALITY,
        error: error("unauthenticated", "Diagnostic principal cannot read that role snapshot"),
      };
    }
    const snapshot = await this.persistence.readSnapshot(parsed.data.sessionId, parsed.data.role);
    if (snapshot === null) {
      return {
        ok: false,
        reality: DIAGNOSTIC_UI_GATEWAY_REALITY,
        error: error("dependency-unavailable", "Diagnostic snapshot is unavailable", true),
      };
    }
    return {
      ok: true,
      reality: DIAGNOSTIC_UI_GATEWAY_REALITY,
      sessionId: parsed.data.sessionId,
      role: parsed.data.role,
      snapshot,
      fixtureCatalog: diagnosticUiGatewayFixtureCatalog,
    };
  }

  async executeCommand(input: unknown): Promise<DiagnosticUiGatewayCommandResult> {
    const parsedServiceCommand = streamerServiceCommandSchema.safeParse(input);
    if (parsedServiceCommand.success) {
      return this.executeStreamerServiceCommand(parsedServiceCommand.data);
    }

    const parsed = commandEnvelopeSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        reality: DIAGNOSTIC_UI_GATEWAY_REALITY,
        error: error("validation", "Command does not match a supported canonical schema"),
      };
    }
    await this.ensureReady();
    const result = await this.orchestrator.execute(parsed.data);
    if (!result.ok) {
      return {
        ok: false,
        reality: DIAGNOSTIC_UI_GATEWAY_REALITY,
        error: result.error,
      };
    }
    return {
      ok: true,
      reality: DIAGNOSTIC_UI_GATEWAY_REALITY,
      outcome: result.outcome,
      revision: result.receipt.state.session.revision,
      delivery: result.delivery,
      receipt: {
        commandId: result.receipt.command.commandId,
        acceptedAt: result.receipt.acceptedAt,
        eventTypes: result.receipt.events.map(({ event }) => event.eventType),
      },
      views: result.views,
    };
  }

  private async executeStreamerServiceCommand(
    command: StreamerServiceCommand,
  ): Promise<DiagnosticUiGatewayCommandResult> {
    await this.ensureReady();
    const state = await this.persistence.load(command.sessionId);
    if (state === null) {
      return {
        ok: false,
        reality: DIAGNOSTIC_UI_GATEWAY_REALITY,
        error: error("dependency-unavailable", "Diagnostic session is unavailable", true),
      };
    }
    if (command.actor.actorId !== BROADCASTER_ID || command.expectedRevision !== state.session.revision) {
      return {
        ok: false,
        reality: DIAGNOSTIC_UI_GATEWAY_REALITY,
        error: command.actor.actorId !== BROADCASTER_ID
          ? error("forbidden", "Only the fixture broadcaster may run setup/session commands")
          : error("stale-revision", "A concurrent command changed the diagnostic session"),
      };
    }

    const readiness = readinessForCommand(command);
    return {
      ok: true,
      reality: DIAGNOSTIC_UI_GATEWAY_REALITY,
      outcome: "committed",
      revision: state.session.revision,
      delivery: "not-republished",
      receipt: {
        commandId: command.commandId,
        acceptedAt: this.clock.now(),
        eventTypes: [`${command.type}.diagnostic-acknowledged`],
      },
      views: null,
      serviceCommand: {
        status: "diagnostic-only",
        readiness,
      },
    };
  }

  async readViewerReceipt(input: unknown): Promise<DiagnosticUiGatewayRouteResult> {
    const parsed = viewerReceiptInputSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        reality: DIAGNOSTIC_UI_GATEWAY_REALITY,
        error: error("validation", "Private viewer receipt request is invalid"),
      };
    }
    await this.ensureReady();
    const result = await this.persistence.readViewerParticipationReceipt({
      ...parsed.data,
      at: this.clock.now(),
    });
    if (result.status === "available" || result.status === "not-found") {
      return {
        ok: true,
        reality: DIAGNOSTIC_UI_GATEWAY_REALITY,
        receiptStatus: result.status,
        receipt: result.receipt,
      };
    }
    return {
      ok: false,
      reality: DIAGNOSTIC_UI_GATEWAY_REALITY,
      error: result.error,
    };
  }

  async resolveHostedBoardAccess(input: unknown): Promise<DiagnosticUiGatewayRouteResult> {
    const parsed = hostedBoardAccessInputSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        reality: DIAGNOSTIC_UI_GATEWAY_REALITY,
        error: error("validation", "Hosted Quest Board access request is invalid"),
      };
    }
    await this.ensureReady();
    const result = await this.persistence.resolveHostedBoardAccess({
      ...parsed.data,
      at: this.clock.now(),
      grantExpiresAt: GRANT_EXPIRES_AT,
    });
    if (result.status === "available") {
      return {
        ok: true,
        reality: DIAGNOSTIC_UI_GATEWAY_REALITY,
        accessStatus: result.status,
        access: result.access,
      };
    }
    return {
      ok: false,
      reality: DIAGNOSTIC_UI_GATEWAY_REALITY,
      error: result.error,
    };
  }

  async readSessionHistory(input: unknown): Promise<DiagnosticUiGatewayRouteResult> {
    const parsed = sessionHistoryInputSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        reality: DIAGNOSTIC_UI_GATEWAY_REALITY,
        error: error("validation", "Session history request is invalid"),
      };
    }
    await this.ensureReady();
    if (parsed.data.broadcasterId !== BROADCASTER_ID) {
      return {
        ok: false,
        reality: DIAGNOSTIC_UI_GATEWAY_REALITY,
        error: error("forbidden", "Diagnostic history is scoped to the fixture broadcaster"),
      };
    }
    const history = await this.persistence.readSessionHistory({
      ...parsed.data,
      at: this.clock.now(),
    });
    return {
      ok: true,
      reality: DIAGNOSTIC_UI_GATEWAY_REALITY,
      history,
      fixtureHistory: contractFixtureUiX04SessionHistory,
    };
  }

  async readChatFallback(input: unknown): Promise<DiagnosticUiGatewayRouteResult> {
    const parsed = chatFallbackInputSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        reality: DIAGNOSTIC_UI_GATEWAY_REALITY,
        error: error("validation", "Twitch-chat fallback request is invalid"),
      };
    }
    await this.ensureReady();
    const state = await this.persistence.load(SESSION_ID);
    if (state === null) {
      return {
        ok: false,
        reality: DIAGNOSTIC_UI_GATEWAY_REALITY,
        error: error("dependency-unavailable", "Diagnostic session is unavailable", true),
      };
    }
    if (state.questCycle.options.length !== 3) {
      return {
        ok: false,
        reality: DIAGNOSTIC_UI_GATEWAY_REALITY,
        error: error("unavailable-capability", "Twitch-chat fallback requires three visible vote options", true),
      };
    }
    const options = state.questCycle.options as unknown as readonly [
      QuestCandidate,
      QuestCandidate,
      QuestCandidate,
    ];
    const messageText =
      parsed.data.kind === "poll-open"
        ? buildTwitchChatPollOpenText(options)
        : buildTwitchChatFinalResultText({
            outcome: parsed.data.outcome ?? "cancelled",
            winnerTitle: parsed.data.winnerTitle ?? null,
          });
    const delivery = recordTwitchChatFallbackDelivery({
      kind: parsed.data.kind as TwitchChatFallbackAnnouncementKind,
      status: parsed.data.deliveryStatus as TwitchChatFallbackDeliveryStatus,
      messageText,
      deliveredAt: parsed.data.deliveredAt,
      retryable: ["failed", "rate-limited", "unavailable"].includes(parsed.data.deliveryStatus),
    });
    return {
      ok: true,
      reality: DIAGNOSTIC_UI_GATEWAY_REALITY,
      delivery,
    };
  }

  async buildChatAcknowledgement(input: unknown): Promise<DiagnosticUiGatewayRouteResult> {
    const parsed = chatAcknowledgementInputSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        reality: DIAGNOSTIC_UI_GATEWAY_REALITY,
        error: error("validation", "Twitch-chat acknowledgement request is invalid"),
      };
    }
    const delivery = recordTwitchChatAcknowledgementDelivery({
      status: parsed.data.deliveryStatus,
      messageText: "ChatXPT acknowledgement delivery probe.",
      deliveredAt: parsed.data.deliveredAt,
      retryable: ["failed", "rate-limited", "unavailable"].includes(parsed.data.deliveryStatus),
    });
    return {
      ok: true,
      reality: DIAGNOSTIC_UI_GATEWAY_REALITY,
      acknowledgement: buildTwitchChatVoteAcknowledgement({
        delivery,
        processingStatus: parsed.data.processingStatus as Extract<
          TwitchChatVoteAcknowledgementStatus,
          "counted" | "duplicate" | "rejected" | "late"
        >,
        candidateId: parsed.data.candidateId,
      }),
    };
  }

  private ensureReady(): Promise<void> {
    this.ready ??= this.bootstrap();
    return this.ready;
  }

  private async bootstrap(): Promise<void> {
    const lifecycle = new SessionLifecycleService(
      this.persistence,
      { next: () => ROOM_CODE },
      { next: (action) => `ui-gateway-${action}` },
    );
    const created = await lifecycle.create(initialState(), FIXTURE_TIME);
    if (!created.ok) throw new Error(`Diagnostic UI gateway create failed: ${created.error.message}`);

    const started = await lifecycle.start(SESSION_ID, 0, FIXTURE_TIME + 1_000, "ui-gateway-start");
    if (!started.ok) throw new Error(`Diagnostic UI gateway start failed: ${started.error.message}`);

    const liveState = await this.persistence.load(SESSION_ID);
    if (liveState === null) throw new Error("Diagnostic UI gateway live state is unavailable");

    const batch = fixtureCandidateBatch(liveState.session.revision);
    await this.persistence.store(batch);
    const proposed = await this.orchestrator.execute(
      systemIntelligenceCommandSchema.parse({
        contractVersion: CONTRACT_VERSION,
        sessionId: SESSION_ID,
        questCycleId: QUEST_CYCLE_ID,
        commandId: "ui-gateway-intelligence-ready",
        correlationId: "ui-gateway-correlation-intelligence",
        expectedRevision: liveState.session.revision,
        issuedAt: FIXTURE_TIME + 2_000,
        actor: { kind: "system", actorId: SYSTEM_ACTOR_ID },
        type: "system.intelligence-ready",
        candidateBatchId: batch.envelope.messageId,
      }),
    );
    if (!proposed.ok) throw new Error(`Diagnostic UI gateway proposal failed: ${proposed.error.message}`);

    const voting = await this.orchestrator.execute(
      streamerQuestCommandSchema.parse({
        contractVersion: CONTRACT_VERSION,
        sessionId: SESSION_ID,
        questCycleId: QUEST_CYCLE_ID,
        commandId: "ui-gateway-approve",
        correlationId: "ui-gateway-correlation-approve",
        expectedRevision: proposed.receipt.state.session.revision,
        issuedAt: FIXTURE_TIME + 3_000,
        actor: { kind: "broadcaster", actorId: BROADCASTER_ID },
        type: "streamer.quest",
        action: "approve",
        candidateId: null,
      }),
    );
    if (!voting.ok) throw new Error(`Diagnostic UI gateway vote start failed: ${voting.error.message}`);

    await Promise.all([
      this.persistence.grant({
        principalId: STREAMER_PRINCIPAL_ID,
        sessionId: SESSION_ID,
        viewRole: "streamer",
        expiresAt: GRANT_EXPIRES_AT,
      }),
      this.persistence.grant({
        principalId: VIEWER_PRINCIPAL_ID,
        sessionId: SESSION_ID,
        viewRole: "viewer",
        expiresAt: GRANT_EXPIRES_AT,
      }),
      this.persistence.grant({
        principalId: OVERLAY_PRINCIPAL_ID,
        sessionId: SESSION_ID,
        viewRole: "overlay",
        expiresAt: GRANT_EXPIRES_AT,
      }),
    ]);
  }
}

let singleton: DiagnosticUiGateway | null = null;

export function getDiagnosticUiGateway(): DiagnosticUiGateway {
  singleton ??= new DiagnosticUiGateway();
  return singleton;
}

export function resetDiagnosticUiGateway(): void {
  singleton = null;
}
