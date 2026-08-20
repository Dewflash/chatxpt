import "server-only";

import { randomUUID } from "node:crypto";

import {
  CanonicalViewProjector,
  ChatXptOrchestrator,
  type MessageIdFactory,
  type DirectorCueLifecycle,
  type DirectorCueProposalCoordinator,
  type ProjectionContextResolver,
  type QuestEngine,
  type ServerClock,
  type ViewModelProjector,
} from "@/core";
import { createConfiguredCandidateProvider } from "@/ai/server";
import {
  createDefaultQuestEngine,
  DefaultDirectorCueLifecycle,
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

export interface ChatXptServerRuntimeDependencies {
  readonly persistence: ConfiguredPersistenceRuntime;
  readonly engine?: QuestEngine;
  readonly directorCues?: DirectorCueLifecycle;
  readonly directorCueProposals?: DirectorCueProposalCoordinator;
  readonly projector?: ViewModelProjector;
  readonly clock?: ServerClock;
  readonly ids?: MessageIdFactory;
}

/** Shared production composition root for persistence and the sole command orchestrator. */
export class ChatXptServerRuntime {
  readonly persistence: ConfiguredPersistenceRuntime;
  private readonly engine: QuestEngine;
  private readonly directorCues: DirectorCueLifecycle;
  private readonly directorCueProposals: DirectorCueProposalCoordinator;
  private readonly projector: ViewModelProjector;
  private readonly clock: ServerClock;
  private readonly ids: MessageIdFactory;

  constructor(dependencies: ChatXptServerRuntimeDependencies) {
    this.persistence = dependencies.persistence;
    this.engine = dependencies.engine ?? createDefaultQuestEngine();
    this.directorCues = dependencies.directorCues ?? new DefaultDirectorCueLifecycle();
    this.directorCueProposals =
      dependencies.directorCueProposals ??
      new DefaultLiveDirectorProposalCoordinator(createConfiguredCandidateProvider().provider);
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
