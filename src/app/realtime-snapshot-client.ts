"use client";

import type { RoleViewModels } from "@/core";
import {
  createSupabaseRealtimeClient,
  SupabaseSnapshotSubscriber,
  type SnapshotRole,
} from "@/realtime";

interface RealtimeConfigurationPayload {
  readonly ok: boolean;
  readonly enabled: boolean;
  readonly url?: string;
  readonly publishableKey?: string;
}

export interface ConnectRealtimeSnapshotInput<Role extends SnapshotRole> {
  readonly role: Role;
  readonly sessionId: string;
  readonly surfaceAuthorization?: string | null;
  readonly loadLatest: () => Promise<unknown | null>;
  readonly onSnapshot: (snapshot: RoleViewModels[Role]) => void;
}

/** Connects the private push path. Callers retain their normal HTTP read as recovery fallback. */
export async function connectRealtimeSnapshot<Role extends SnapshotRole>(
  input: ConnectRealtimeSnapshotInput<Role>,
): Promise<(() => Promise<void>) | null> {
  const configResponse = await fetch("/api/realtime/config", { cache: "no-store" });
  const config = (await configResponse.json()) as RealtimeConfigurationPayload;
  if (!configResponse.ok || !config.ok || !config.enabled || !config.url || !config.publishableKey) {
    return null;
  }
  const client = createSupabaseRealtimeClient({
    url: config.url,
    publishableKey: config.publishableKey,
  });
  const { data, error } = await client.auth.signInAnonymously();
  const accessToken = data.session?.access_token ?? null;
  if (error !== null || accessToken === null) return null;
  const accessHeaders: Record<string, string> = {
    authorization: `Bearer ${accessToken}`,
    "content-type": "application/json",
  };
  if (input.surfaceAuthorization) {
    accessHeaders["x-chatxpt-surface-authorization"] = input.surfaceAuthorization;
  }
  const access = await fetch("/api/realtime/access", {
    method: "POST",
    headers: accessHeaders,
    credentials: "include",
    cache: "no-store",
    body: JSON.stringify({ sessionId: input.sessionId, role: input.role }),
  });
  if (!access.ok) {
    await client.auth.signOut();
    return null;
  }
  const subscription = await new SupabaseSnapshotSubscriber(client).subscribe({
    sessionId: input.sessionId,
    role: input.role,
    accessToken,
    loadLatest: input.loadLatest,
    onSnapshot: input.onSnapshot,
  });
  return async () => {
    await subscription.unsubscribe();
    await client.auth.signOut();
  };
}
