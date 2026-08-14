import "server-only";

import {
  createConfiguredPersistenceRuntime,
  resolveServerPersistenceEnvironment,
  type ConfiguredPersistenceRuntime,
} from "@/realtime/server";

export interface ChatXptServerRuntime {
  readonly persistence: ConfiguredPersistenceRuntime;
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
  globalRuntime[runtimeKey] = { persistence };
  return globalRuntime[runtimeKey];
}
