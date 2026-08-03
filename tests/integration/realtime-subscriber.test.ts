import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import { viewerViewModelSchema } from "../../src/core";
import { contractFixtureViewerView } from "../../src/core/testing";
import { SupabaseSnapshotSubscriber } from "../../src/realtime";

class FakeRealtimeChannel {
  private listener: ((message: { payload: unknown }) => void) | null = null;

  on(_type: string, _filter: unknown, listener: (message: { payload: unknown }) => void) {
    this.listener = listener;
    return this;
  }

  subscribe(callback: (status: "SUBSCRIBED", error?: Error) => void) {
    callback("SUBSCRIBED");
    return this;
  }

  emit(snapshot: unknown) {
    this.listener?.({ payload: { snapshot } });
  }
}

function viewerRevision(revision: number) {
  return viewerViewModelSchema.parse({
    ...structuredClone(contractFixtureViewerView),
    envelope: { ...structuredClone(contractFixtureViewerView.envelope), revision },
    session: { ...structuredClone(contractFixtureViewerView.session), revision },
    questCycle: {
      ...structuredClone(contractFixtureViewerView.questCycle),
      envelope: { ...structuredClone(contractFixtureViewerView.questCycle.envelope), revision },
    },
  });
}

describe("private Supabase snapshot subscriber", () => {
  it("removes a channel that fails authorization during join", async () => {
    const channel = {
      on() {
        return this;
      },
      subscribe(callback: (status: "CHANNEL_ERROR", error: Error) => void) {
        callback("CHANNEL_ERROR", new Error("forbidden"));
        return this;
      },
    } as unknown as RealtimeChannel;
    const removeChannel = vi.fn(async () => "ok");
    const client = {
      realtime: { setAuth: vi.fn(async () => undefined) },
      channel: () => channel,
      removeChannel,
    } as unknown as SupabaseClient;

    await expect(
      new SupabaseSnapshotSubscriber(client).subscribe({
        sessionId: "fixture-session",
        role: "viewer",
        accessToken: "invalid-token",
        loadLatest: async () => viewerRevision(0),
        onSnapshot: () => undefined,
      }),
    ).rejects.toThrow("forbidden");
    expect(removeChannel).toHaveBeenCalledWith(channel);
  });

  it("joins first, loads the reconnect snapshot, and discards duplicate or older revisions", async () => {
    const channel = new FakeRealtimeChannel();
    const setAuth = vi.fn(async () => undefined);
    const removeChannel = vi.fn(async () => "ok");
    const channelFactory = vi.fn(() => channel);
    const client = {
      realtime: { setAuth },
      channel: channelFactory,
      removeChannel,
    } as unknown as SupabaseClient;
    const observed: number[] = [];
    const subscriber = new SupabaseSnapshotSubscriber(client);

    const subscription = await subscriber.subscribe({
      sessionId: "fixture-session",
      role: "viewer",
      accessToken: "fixture-access-token",
      loadLatest: async () => viewerRevision(1),
      onSnapshot: (snapshot) => observed.push(snapshot.envelope.revision),
    });
    channel.emit(viewerRevision(1));
    channel.emit(viewerRevision(0));
    channel.emit(viewerRevision(2));

    expect(setAuth).toHaveBeenCalledWith("fixture-access-token");
    expect(channelFactory).toHaveBeenCalledWith("chatxpt:fixture-session:viewer", {
      config: { private: true },
    });
    expect(observed).toEqual([1, 2]);

    await subscription.refreshAccessToken("refreshed-token");
    expect(setAuth).toHaveBeenLastCalledWith("refreshed-token");
    await subscription.unsubscribe();
    expect(removeChannel).toHaveBeenCalledWith(channel as unknown as RealtimeChannel);
  });

  it("reports and discards malformed broadcast payloads", async () => {
    const channel = new FakeRealtimeChannel();
    const client = {
      realtime: { setAuth: vi.fn(async () => undefined) },
      channel: () => channel,
      removeChannel: vi.fn(async () => "ok"),
    } as unknown as SupabaseClient;
    const snapshots: unknown[] = [];
    const health: string[] = [];
    const subscriber = new SupabaseSnapshotSubscriber(client);

    await subscriber.subscribe({
      sessionId: "fixture-session",
      role: "viewer",
      accessToken: "fixture-access-token",
      loadLatest: async () => viewerRevision(0),
      onSnapshot: (snapshot) => snapshots.push(snapshot),
      onHealth: (status) => health.push(status.status),
    });
    channel.emit({ privateViewerId: "must-not-pass" });

    expect(snapshots).toHaveLength(1);
    expect(health).toContain("degraded");
  });
});
