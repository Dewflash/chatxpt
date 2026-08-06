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
  systemIntelligenceCommandSchema,
  type CommandEnvelope,
  type ContractEnvelope,
  type DomainError,
  type OrchestratorResult,
  type RoleViewModels,
  type ViewModelProjectionInput,
  type ViewModelProjector,
} from "../../../../core";
import { DefaultQuestEngine } from "../../../../quest-engine";
import {
  MemoryChatXptPersistence,
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

type SnapshotRole = keyof RoleViewModels;

const snapshotReadInputSchema = z
  .object({
    sessionId: z.string().trim().min(1).max(128),
    role: z.enum(["streamer", "viewer", "overlay"]),
    principalId: z.string().trim().min(1).max(128),
  })
  .strict();

export type DiagnosticSnapshotReadInput = z.infer<typeof snapshotReadInputSchema>;

export type DiagnosticUiGatewayReadResult =
  | {
      readonly ok: true;
      readonly reality: typeof DIAGNOSTIC_UI_GATEWAY_REALITY;
      readonly sessionId: string;
      readonly role: SnapshotRole;
      readonly snapshot: RoleViewModels[SnapshotRole];
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
    };
  }

  async executeCommand(input: unknown): Promise<DiagnosticUiGatewayCommandResult> {
    const parsed = commandEnvelopeSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        reality: DIAGNOSTIC_UI_GATEWAY_REALITY,
        error: error("validation", "Command does not match the canonical schema"),
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

  private ensureReady(): Promise<void> {
    this.ready ??= this.bootstrap();
    return this.ready;
  }

  private async bootstrap(): Promise<void> {
    const lifecycle = new SessionLifecycleService(
      this.persistence,
      { next: () => "ABCDEFGH" },
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
