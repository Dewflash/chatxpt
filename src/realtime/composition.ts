import type { OrchestratorDependencies } from "../core";
import type { ChatXptPersistenceRuntime } from "./types";

export type OrchestratorLogicDependencies = Omit<
  OrchestratorDependencies,
  | "repository"
  | "candidateBatches"
  | "audiencePointers"
  | "acceptedVotes"
  | "gameplaySnapshots"
  | "publisher"
>;

/** Binds the sole Role 1 orchestrator to one coherent persistence runtime. */
export function bindPersistenceRuntime(
  dependencies: OrchestratorLogicDependencies,
  persistence: ChatXptPersistenceRuntime,
): OrchestratorDependencies {
  return {
    ...dependencies,
    repository: persistence.sessions,
    candidateBatches: persistence.candidates,
    audiencePointers: persistence.audiencePointers,
    acceptedVotes: persistence.acceptedVotes,
    gameplaySnapshots: persistence.gameplaySnapshots,
    publisher: persistence.snapshots,
  };
}
