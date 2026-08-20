import "server-only";

import { createHash, randomUUID } from "node:crypto";

import {
  CanonicalViewProjector,
  ChatXptOrchestrator,
  CONTRACT_VERSION,
  Role1InterventionCoordinator,
  domainErrorSchema,
  intelligenceSnapshotSchema,
  systemLiveDirectorContextCommandSchema,
  type CandidateProvider,
  type AuthoritativeSessionState,
  type DirectorCueLifecycle,
  type DirectorCueProposalCoordinator,
  type MessageIdFactory,
  type OrchestratorResult,
  type ProjectionContextResolver,
  type QuestEngine,
  type ServerClock,
  type ViewModelProjector,
} from "@/core";
import { createConfiguredCandidateProvider } from "@/ai/server";
import {
  createDefaultQuestEngine,
  DefaultCandidateAssembler,
  DefaultDirectorCueLifecycle,
  DefaultInterventionPolicy,
  DefaultLiveDirectorProposalCoordinator,
} from "@/quest-engine";
import {
  ServerCommandAuthorizer,
  bindPersistenceRuntime,
  type VerifiedCommandActor,
  type VerifiedCommandActorResolver,
} from "@/realtime";
import {
  createConfiguredPersistenceRuntime,
  resolveServerPersistenceEnvironment,
  type ConfiguredPersistenceRuntime,
} from "@/realtime/server";

class RuntimeMessageIds implements MessageIdFactory {
  nextId(kind: "quest-state" | "quest-event" | "view-model"): string {
    return `${kind}-${randomUUID()}`;
  }
}

class RequestActorResolver implements VerifiedCommandActorResolver {
  constructor(private readonly actor: VerifiedCommandActor) {}

  resolve(): VerifiedCommandActor {
    return this.actor;
  }
}

function stableRuntimeCommandId(prefix: string, parts: readonly unknown[]): string {
  const digest = createHash("sha256")
    .update(parts.map((part) => String(part)).join("|"))
    .digest("hex")
    .slice(0, 32);
  return `${prefix}-${digest}`;
}

export interface ChatXptServerRuntimeDependencies {
  readonly persistence: ConfiguredPersistenceRuntime;
  readonly engine?: QuestEngine;
  readonly candidateProvider?: CandidateProvider;
  readonly directorCues?: DirectorCueLifecycle;
  readonly directorCueProposals?: DirectorCueProposalCoordinator;
  readonly projector?: ViewModelProjector;
  readonly clock?: ServerClock;
  readonly ids?: MessageIdFactory;
}

type EligibleCycleProposalResult =
  | OrchestratorResult
  | { readonly ok: true; readonly outcome: "not-eligible" };

/** Shared production composition root for persistence and the sole command orchestrator. */
export class ChatXptServerRuntime {
  readonly persistence: ConfiguredPersistenceRuntime;
  private readonly engine: QuestEngine;
  private readonly candidateProvider: CandidateProvider;
  private readonly directorCues: DirectorCueLifecycle;
  private readonly directorCueProposals: DirectorCueProposalCoordinator;
  private readonly projector: ViewModelProjector;
  private readonly clock: ServerClock;
  private readonly ids: MessageIdFactory;
  private readonly eligibleProposalRequests = new Map<string, Promise<EligibleCycleProposalResult>>();

  constructor(dependencies: ChatXptServerRuntimeDependencies) {
    this.persistence = dependencies.persistence;
    this.engine = dependencies.engine ?? createDefaultQuestEngine();
    this.candidateProvider =
      dependencies.candidateProvider ?? createConfiguredCandidateProvider().provider;
    this.directorCues = dependencies.directorCues ?? new DefaultDirectorCueLifecycle();
    this.directorCueProposals =
      dependencies.directorCueProposals ??
      new DefaultLiveDirectorProposalCoordinator(this.candidateProvider);
    this.projector = dependencies.projector ?? new CanonicalViewProjector();
    this.clock = dependencies.clock ?? { now: Date.now };
    this.ids = dependencies.ids ?? new RuntimeMessageIds();
  }

  execute(
    command: unknown,
    actor: VerifiedCommandActor,
    projectionContext: ProjectionContextResolver,
  ) {
    const authorizer = new ServerCommandAuthorizer(
      new RequestActorResolver(actor),
      () => this.clock.now(),
    );
    return new ChatXptOrchestrator(
      bindPersistenceRuntime(
        {
          authorizer,
          engine: this.engine,
          directorCues: this.directorCues,
          directorCueProposals: this.directorCueProposals,
          projectionContext,
          projector: this.projector,
          clock: this.clock,
          ids: this.ids,
        },
        this.persistence,
      ),
    ).execute(command);
  }

  async requestLiveDirectorContextRefresh(
    state: AuthoritativeSessionState,
    projectionContext: ProjectionContextResolver,
  ): Promise<OrchestratorResult> {
    const gameplayId = state.gameplay?.envelope.messageId ?? "no-gameplay";
    const questCycleId = state.questCycle.envelope.questCycleId;
    const commandId = stableRuntimeCommandId("live-director-refresh", [
      state.session.sessionId,
      state.session.revision,
      questCycleId ?? "none",
      gameplayId,
    ]);
    const existing = await this.persistence.sessions.findReceipt(commandId);
    if (existing !== null) {
      return {
        ok: true,
        outcome: "duplicate",
        receipt: existing,
        views: null,
        delivery: "not-republished",
      };
    }
    const now = this.clock.now();
    const command = systemLiveDirectorContextCommandSchema.parse({
      contractVersion: CONTRACT_VERSION,
      sessionId: state.session.sessionId,
      questCycleId,
      commandId,
      correlationId: `live-director-context-refresh-${randomUUID()}`,
      expectedRevision: state.session.revision,
      issuedAt: now,
      actor: { kind: "system", actorId: "role1-live-director-refresh" },
      type: "system.live-director-context-ready",
      liveContextId: `live-context-${randomUUID()}`,
      audiencePointerId: null,
    });
    return this.execute(
      command,
      {
        kind: "system",
        actorId: "role1-live-director-refresh",
        expiresAt: null,
        moderatorForBroadcasterIds: [],
        voterKey: null,
        participationModes: [],
      },
      projectionContext,
    );
  }

  async requestEligibleCycleProposal(
    state: AuthoritativeSessionState,
    projectionContext: ProjectionContextResolver,
  ): Promise<EligibleCycleProposalResult> {
    if (state.session.status !== "live" || state.gameplay === null) {
      return { ok: true, outcome: "not-eligible" };
    }
    const questCycleId = state.questCycle.envelope.questCycleId;
    const commandId = `eligible-cycle-proposal-${state.session.sessionId}-${state.session.revision}-${questCycleId ?? "none"}`;
    const inFlight = this.eligibleProposalRequests.get(commandId);
    if (inFlight !== undefined) return inFlight;
    const request = this.executeEligibleCycleProposal(state, projectionContext);
    this.eligibleProposalRequests.set(commandId, request);
    try {
      return await request;
    } finally {
      if (this.eligibleProposalRequests.get(commandId) === request) {
        this.eligibleProposalRequests.delete(commandId);
      }
    }
  }

  private async executeEligibleCycleProposal(
    state: AuthoritativeSessionState,
    projectionContext: ProjectionContextResolver,
  ): Promise<EligibleCycleProposalResult> {
    if (state.session.status !== "live" || state.gameplay === null) {
      return { ok: true, outcome: "not-eligible" };
    }
    const questCycleId = state.questCycle.envelope.questCycleId;
    const commandId = `eligible-cycle-proposal-${state.session.sessionId}-${state.session.revision}-${questCycleId ?? "none"}`;
    const existing = await this.persistence.sessions.findReceipt(commandId);
    if (existing !== null) {
      return {
        ok: true,
        outcome: "duplicate",
        receipt: existing,
        views: null,
        delivery: "not-republished",
      };
    }
    const now = this.clock.now();
    const envelope = {
      contractVersion: CONTRACT_VERSION,
      sessionId: state.session.sessionId,
      questCycleId,
      messageId: `eligible-cycle-intelligence-${randomUUID()}`,
      correlationId: `eligible-cycle-proposal-${randomUUID()}`,
      revision: state.session.revision,
      occurredAt: now,
      receivedAt: now,
      source: "orchestrator" as const,
      evidenceClass: state.questCycle.envelope.evidenceClass,
    };
    const audience =
      state.audience !== null &&
      state.audience.envelope.sessionId === envelope.sessionId &&
      state.audience.envelope.questCycleId === envelope.questCycleId &&
      state.audience.envelope.revision === envelope.revision &&
      state.audience.envelope.evidenceClass === envelope.evidenceClass
        ? state.audience
        : {
            envelope,
            sampleSize: 0,
            signals: [],
          };
    const intelligence = intelligenceSnapshotSchema.safeParse({
      envelope,
      gameplay: state.gameplay,
      audience,
    });
    if (!intelligence.success) {
      return {
        ok: false,
        error: domainErrorSchema.parse({
          code: "validation",
          message: "Eligible-cycle intelligence context is not canonical",
          retryable: false,
        }),
      };
    }
    const actor = {
      kind: "system" as const,
      actorId: "role1-intervention-coordinator",
      expiresAt: null,
      moderatorForBroadcasterIds: [],
      voterKey: null,
      participationModes: [],
    };
    const coordinator = new Role1InterventionCoordinator(
      new DefaultInterventionPolicy(),
      this.candidateProvider,
      new DefaultCandidateAssembler(),
      this.persistence.candidates,
      {
        execute: (command) => this.execute(command, actor, projectionContext),
      },
      () => this.clock.now(),
    );
    const result = await coordinator.run({
      state,
      intelligence: intelligence.data,
      recentQuests: state.recentQuests ?? [],
      candidateInputEnvelope: envelope,
      commandId,
      correlationId: envelope.correlationId,
      systemActorId: actor.actorId,
      issuedAt: now,
    });
    if (result.ok && result.outcome === "denied") {
      return { ok: true, outcome: "not-eligible" };
    }
    if (!result.ok) {
      return { ok: false, error: result.error };
    }
    return result.orchestrator;
  }
}

const runtimeKey = Symbol.for("chatxpt.serverRuntime.v1");
const globalRuntime = globalThis as typeof globalThis & {
  [runtimeKey]?: ChatXptServerRuntime;
};

/** One process-local composition root shared by every Role 1 server surface. */
export function getChatXptServerRuntime(): ChatXptServerRuntime {
  if (globalRuntime[runtimeKey] !== undefined) return globalRuntime[runtimeKey];
  const persistence = createConfiguredPersistenceRuntime(
    resolveServerPersistenceEnvironment(process.env),
  );
  globalRuntime[runtimeKey] = new ChatXptServerRuntime({ persistence });
  return globalRuntime[runtimeKey];
}
