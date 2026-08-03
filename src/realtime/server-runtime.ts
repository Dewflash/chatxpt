import "server-only";

import type { ServiceHealth } from "../core";
import { createMemoryPersistenceRuntime } from "./memory";
import {
  createSupabasePersistenceRuntime,
  type SupabaseChatXptDataApi,
} from "./supabase";
import type { ServerPersistenceEnvironment } from "./environment";
import type { ChatXptPersistenceRuntime } from "./types";

export class PersistenceConfigurationError extends Error {
  constructor(readonly health: ServiceHealth) {
    super(health.message ?? "Persistence environment is misconfigured");
    this.name = "PersistenceConfigurationError";
  }
}

export type ConfiguredPersistenceRuntime =
  | (ChatXptPersistenceRuntime & { readonly mode: "memory" })
  | (ChatXptPersistenceRuntime & {
      readonly mode: "supabase";
      readonly api: SupabaseChatXptDataApi;
      probe(checkedAt?: number): Promise<ServiceHealth>;
    });

export function createConfiguredPersistenceRuntime(
  environment: ServerPersistenceEnvironment,
): ConfiguredPersistenceRuntime {
  if (environment.mode === "misconfigured") {
    throw new PersistenceConfigurationError(environment.health);
  }
  return environment.mode === "memory"
    ? createMemoryPersistenceRuntime()
    : createSupabasePersistenceRuntime(environment);
}
