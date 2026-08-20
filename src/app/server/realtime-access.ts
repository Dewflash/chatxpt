import "server-only";

import { z } from "zod";

import {
  createSupabaseServerClient,
  publicRealtimeEnvironment,
  resolveServerPersistenceEnvironment,
} from "@/realtime/server";
import type { SnapshotRole } from "@/realtime";

import { getChatXptServerRuntime } from "./runtime";

const bearerPattern = /^Bearer\s+([^\s]+)$/iu;
const ACCESS_TTL_MS = 30 * 60 * 1_000;

export const realtimeAccessRequestSchema = z.object({
  sessionId: z.string().trim().min(1).max(128),
  role: z.enum(["streamer", "viewer", "overlay"]),
}).strict();

export class RealtimeAccessError extends Error {
  constructor(
    readonly code: "unavailable" | "unauthenticated" | "forbidden" | "validation",
    message: string,
    readonly retryable = false,
  ) {
    super(message);
    this.name = "RealtimeAccessError";
  }
}

export function realtimePublicConfiguration() {
  const environment = resolveServerPersistenceEnvironment(process.env);
  return environment.mode === "supabase"
    ? { enabled: true as const, ...publicRealtimeEnvironment(environment) }
    : { enabled: false as const };
}

async function authenticatedPrincipal(authorizationHeader: string | null): Promise<string> {
  const token = bearerPattern.exec(authorizationHeader ?? "")?.[1] ?? null;
  if (token === null) {
    throw new RealtimeAccessError("unauthenticated", "A Supabase realtime session is required");
  }
  const environment = resolveServerPersistenceEnvironment(process.env);
  if (environment.mode !== "supabase") {
    throw new RealtimeAccessError(
      "unavailable",
      "Private realtime is unavailable in the local memory runtime",
      true,
    );
  }
  const { data, error } = await createSupabaseServerClient(environment).auth.getUser(token);
  if (error !== null || data.user === null) {
    throw new RealtimeAccessError("unauthenticated", "Realtime identity could not be verified");
  }
  return data.user.id;
}

export async function grantRealtimeSnapshotAccess(input: {
  readonly authorizationHeader: string | null;
  readonly sessionId: string;
  readonly role: SnapshotRole;
}): Promise<{ readonly expiresAt: number }> {
  const principalId = await authenticatedPrincipal(input.authorizationHeader);
  const expiresAt = Date.now() + ACCESS_TTL_MS;
  await getChatXptServerRuntime().persistence.accessGrants.grant({
    principalId,
    sessionId: input.sessionId,
    viewRole: input.role,
    expiresAt,
  });
  return { expiresAt };
}
