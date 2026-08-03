import { createClient, type RealtimeChannel, type SupabaseClient } from "@supabase/supabase-js";

import {
  overlayViewModelSchema,
  serviceHealthSchema,
  streamerViewModelSchema,
  viewerViewModelSchema,
  type RoleViewModels,
  type ServiceHealth,
} from "../core";
import type { SnapshotRole } from "./types";

export interface RealtimePublicConfiguration {
  readonly url: string;
  readonly publishableKey: string;
}

export interface SnapshotSubscription<Role extends SnapshotRole> {
  refreshAccessToken(token: string): Promise<void>;
  unsubscribe(): Promise<void>;
  readonly channel: RealtimeChannel;
  readonly role: Role;
  readonly sessionId: string;
}

export interface SubscribeToSnapshotsInput<Role extends SnapshotRole> {
  readonly sessionId: string;
  readonly role: Role;
  readonly accessToken: string;
  /** Fetches the authorised server snapshot after the channel joins. */
  readonly loadLatest: () => Promise<unknown | null>;
  readonly onSnapshot: (snapshot: RoleViewModels[Role]) => void;
  readonly onHealth?: (health: ServiceHealth) => void;
}

function snapshotForRole<Role extends SnapshotRole>(
  role: Role,
  input: unknown,
): RoleViewModels[Role] | null {
  const schema = {
    streamer: streamerViewModelSchema,
    viewer: viewerViewModelSchema,
    overlay: overlayViewModelSchema,
  }[role];
  const parsed = schema.safeParse(input);
  return parsed.success ? (parsed.data as RoleViewModels[Role]) : null;
}

function health(
  status: ServiceHealth["status"],
  message: string,
  retryable: boolean,
): ServiceHealth {
  return serviceHealthSchema.parse({
    service: "realtime",
    status,
    checkedAt: Date.now(),
    message,
    retryable,
  });
}

function waitForJoin(channel: RealtimeChannel, onHealth?: (value: ServiceHealth) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      const error = new Error("Realtime channel join timed out");
      onHealth?.(health("unavailable", error.message, true));
      reject(error);
    }, 10_000);

    channel.subscribe((status, error) => {
      if (settled) return;
      if (status === "SUBSCRIBED") {
        settled = true;
        clearTimeout(timer);
        onHealth?.(health("ready", "Private snapshot channel is connected", false));
        resolve();
        return;
      }
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        settled = true;
        clearTimeout(timer);
        const message = error?.message ?? `Realtime channel ${status.toLowerCase()}`;
        onHealth?.(health(status === "CHANNEL_ERROR" ? "permission-denied" : "unavailable", message, true));
        reject(new Error(message));
      }
    });
  });
}

export function createSupabaseRealtimeClient(
  configuration: RealtimePublicConfiguration,
): SupabaseClient {
  return createClient(configuration.url, configuration.publishableKey, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
    global: { headers: { "X-Client-Info": "chatxpt-realtime/0.1.0" } },
  });
}

export class SupabaseSnapshotSubscriber {
  constructor(private readonly client: SupabaseClient) {}

  async subscribe<Role extends SnapshotRole>(
    input: SubscribeToSnapshotsInput<Role>,
  ): Promise<SnapshotSubscription<Role>> {
    let latestRevision = -1;
    const accept = (candidate: unknown) => {
      const snapshot = snapshotForRole(input.role, candidate);
      if (snapshot === null) {
        input.onHealth?.(health("degraded", "Invalid role snapshot was discarded", true));
        return;
      }
      if (
        snapshot.envelope.sessionId !== input.sessionId ||
        snapshot.envelope.revision <= latestRevision
      ) {
        return;
      }
      latestRevision = snapshot.envelope.revision;
      input.onSnapshot(snapshot);
    };

    await this.client.realtime.setAuth(input.accessToken);
    const channel = this.client
      .channel(`chatxpt:${input.sessionId}:${input.role}`, { config: { private: true } })
      .on("broadcast", { event: "snapshot" }, (message) => {
        const payload = message.payload as unknown;
        const snapshot =
          typeof payload === "object" && payload !== null && "snapshot" in payload
            ? (payload as { snapshot: unknown }).snapshot
            : null;
        accept(snapshot);
      });

    try {
      await waitForJoin(channel, input.onHealth);
    } catch (caught) {
      await this.client.removeChannel(channel);
      throw caught;
    }
    try {
      accept(await input.loadLatest());
    } catch (caught) {
      await this.client.removeChannel(channel);
      const message = caught instanceof Error ? caught.message : "Reconnect snapshot could not be loaded";
      input.onHealth?.(health("unavailable", message, true));
      throw caught;
    }

    return {
      channel,
      role: input.role,
      sessionId: input.sessionId,
      refreshAccessToken: (token) => this.client.realtime.setAuth(token),
      unsubscribe: async () => {
        await this.client.removeChannel(channel);
      },
    };
  }
}
