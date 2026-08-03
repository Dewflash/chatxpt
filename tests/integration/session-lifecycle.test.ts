import { describe, expect, it } from "vitest";

import {
  MemoryChatXptPersistence,
  PREPARING_SESSION_EXPIRY_MS,
  SESSION_RECONNECT_GRACE_MS,
  SessionLifecycleService,
  type LifecycleOperationIdFactory,
  type RoomCodeGenerator,
  type SessionLifecycleStore,
} from "../../src/realtime";
import { FIXTURE_NOW, persistenceState } from "./persistence-fixtures";

class SequenceRoomCodes implements RoomCodeGenerator {
  constructor(private readonly values: string[]) {}

  next(): string {
    const value = this.values.shift();
    if (value === undefined) throw new Error("Room-code sequence exhausted");
    return value;
  }
}

class SequenceOperationIds implements LifecycleOperationIdFactory {
  private index = 0;

  next(action: "start" | "end" | "expire"): string {
    this.index += 1;
    return `${action}-operation-${this.index}`;
  }
}

function service(store: SessionLifecycleStore, roomCodes: string[]) {
  return new SessionLifecycleService(
    store,
    new SequenceRoomCodes(roomCodes),
    new SequenceOperationIds(),
  );
}

describe("stream session lifecycle", () => {
  it("rejects a bootstrap timestamp that disagrees with canonical session state", async () => {
    const store = new MemoryChatXptPersistence();
    const lifecycle = service(store, ["ABCDEFGH"]);

    const result = await lifecycle.create(persistenceState(), FIXTURE_NOW + 1);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("validation");
    expect(await store.load("fixture-session")).toBeNull();
  });

  it("allocates eight-character codes, retries collisions, and permits only one active session per broadcaster", async () => {
    const store = new MemoryChatXptPersistence();
    const first = service(store, ["ABCDEFGH"]);
    const firstResult = await first.create(
      persistenceState("session-one", "broadcaster-one"),
      FIXTURE_NOW,
    );
    expect(firstResult).toMatchObject({ ok: true, value: { roomCode: "ABCDEFGH" } });

    const second = service(store, ["ABCDEFGH", "JKLMNPQR"]);
    const secondResult = await second.create(
      persistenceState("session-two", "broadcaster-two"),
      FIXTURE_NOW,
    );
    expect(secondResult).toMatchObject({ ok: true, value: { roomCode: "JKLMNPQR" } });

    const duplicateBroadcaster = service(store, ["STUVWXYZ"]);
    const denied = await duplicateBroadcaster.create(
      persistenceState("session-three", "broadcaster-one"),
      FIXTURE_NOW,
    );
    expect(denied.ok).toBe(false);
    if (denied.ok) return;
    expect(denied.error.code).toBe("duplicate");
  });

  it("expires an inactive preparing session at two hours without deleting its state", async () => {
    const store = new MemoryChatXptPersistence();
    const lifecycle = service(store, ["ABCDEFGH"]);
    await lifecycle.create(persistenceState(), FIXTURE_NOW);

    expect(await lifecycle.expireDue(FIXTURE_NOW + PREPARING_SESSION_EXPIRY_MS - 1)).toEqual([]);
    const expired = await lifecycle.expireDue(FIXTURE_NOW + PREPARING_SESSION_EXPIRY_MS);

    expect(expired).toHaveLength(1);
    expect(expired[0]?.ok).toBe(true);
    const retained = await store.load("fixture-session");
    expect(retained?.session.status).toBe("offline");
    expect(retained?.session.revision).toBe(1);
    expect(retained?.session.startedAt).toBeNull();
  });

  it("keeps a live session indefinitely while heartbeats continue and ends only after reconnect grace", async () => {
    const store = new MemoryChatXptPersistence();
    const lifecycle = service(store, ["ABCDEFGH"]);
    await lifecycle.create(persistenceState(), FIXTURE_NOW);
    const started = await lifecycle.start("fixture-session", 0, FIXTURE_NOW + 1_000, "start-live");
    expect(started.ok).toBe(true);

    const farFuture = FIXTURE_NOW + 7 * 24 * 60 * 60 * 1_000;
    const heartbeat = await lifecycle.heartbeat("fixture-session", farFuture);
    expect(heartbeat.ok).toBe(true);
    expect(await lifecycle.expireDue(farFuture + 1)).toEqual([]);

    const disconnected = await lifecycle.disconnect("fixture-session", farFuture + 2_000);
    expect(disconnected.ok).toBe(true);
    if (!disconnected.ok) return;
    const originalDeadline = disconnected.value.reconnectDeadlineAt;
    expect(originalDeadline).toBe(farFuture + 2_000 + SESSION_RECONNECT_GRACE_MS);

    const duplicateDisconnect = await lifecycle.disconnect("fixture-session", farFuture + 30_000);
    expect(duplicateDisconnect.ok).toBe(true);
    if (!duplicateDisconnect.ok) return;
    expect(duplicateDisconnect.value.reconnectDeadlineAt).toBe(originalDeadline);

    expect(await lifecycle.expireDue((originalDeadline as number) - 1)).toEqual([]);
    const ended = await lifecycle.expireDue(originalDeadline as number);
    expect(ended[0]?.ok).toBe(true);
    expect((await store.load("fixture-session"))?.session.status).toBe("ended");
  });

  it("clears reconnect grace when a broadcaster heartbeat returns", async () => {
    const store = new MemoryChatXptPersistence();
    const lifecycle = service(store, ["ABCDEFGH"]);
    await lifecycle.create(persistenceState(), FIXTURE_NOW);
    await lifecycle.start("fixture-session", 0, FIXTURE_NOW + 1_000, "start-live");
    await lifecycle.disconnect("fixture-session", FIXTURE_NOW + 2_000);

    const recovered = await lifecycle.heartbeat("fixture-session", FIXTURE_NOW + 3_000);
    expect(recovered.ok).toBe(true);
    if (!recovered.ok) return;
    expect(recovered.value.reconnectDeadlineAt).toBeNull();
    expect(await lifecycle.expireDue(FIXTURE_NOW + SESSION_RECONNECT_GRACE_MS + 3_000)).toEqual([]);
  });

  it("discards an out-of-order heartbeat without clearing a newer disconnect", async () => {
    const store = new MemoryChatXptPersistence();
    const lifecycle = service(store, ["ABCDEFGH"]);
    await lifecycle.create(persistenceState(), FIXTURE_NOW);
    await lifecycle.start("fixture-session", 0, FIXTURE_NOW + 1_000, "start-live");
    const disconnected = await lifecycle.disconnect("fixture-session", FIXTURE_NOW + 5_000);
    const staleHeartbeat = await lifecycle.heartbeat("fixture-session", FIXTURE_NOW + 4_000);

    expect(disconnected.ok).toBe(true);
    expect(staleHeartbeat.ok).toBe(true);
    if (!disconnected.ok || !staleHeartbeat.ok) return;
    expect(staleHeartbeat.value.reconnectDeadlineAt).toBe(disconnected.value.reconnectDeadlineAt);
  });

  it("prevents a stale expiry scan from ending a session that recovered before commit", async () => {
    const backing = new MemoryChatXptPersistence();
    const lifecycle = service(backing, ["ABCDEFGH"]);
    await lifecycle.create(persistenceState(), FIXTURE_NOW);
    await lifecycle.start("fixture-session", 0, FIXTURE_NOW + 1_000, "start-live");
    const disconnectAt = FIXTURE_NOW + 2_000;
    await lifecycle.disconnect("fixture-session", disconnectAt);
    const deadline = disconnectAt + SESSION_RECONNECT_GRACE_MS;
    const staleDue = await backing.due(deadline);
    await lifecycle.heartbeat("fixture-session", deadline);

    const raceStore: SessionLifecycleStore = {
      bootstrap: (input) => backing.bootstrap(input),
      load: (sessionId) => backing.load(sessionId),
      findOperation: (operationId) => backing.findOperation(operationId),
      commitLifecycle: (input) => backing.commitLifecycle(input),
      touch: (sessionId, action, occurredAt) => backing.touch(sessionId, action, occurredAt),
      due: async () => staleDue,
    };
    const racingLifecycle = service(raceStore, ["JKLMNPQR"]);
    const result = await racingLifecycle.expireDue(deadline);

    expect(result).toHaveLength(1);
    expect(result[0]?.ok).toBe(false);
    if (result[0]?.ok !== false) return;
    expect(result[0].error.code).toBe("unavailable-capability");
    expect((await backing.load("fixture-session"))?.session.status).toBe("live");
  });

  it("deduplicates lifecycle operations and rejects stale concurrent revisions", async () => {
    const store = new MemoryChatXptPersistence();
    const lifecycle = service(store, ["ABCDEFGH"]);
    await lifecycle.create(persistenceState(), FIXTURE_NOW);

    const first = await lifecycle.start("fixture-session", 0, FIXTURE_NOW + 1_000, "same-operation");
    const duplicate = await lifecycle.start("fixture-session", 0, FIXTURE_NOW + 1_000, "same-operation");
    const stale = await lifecycle.end("fixture-session", 0, FIXTURE_NOW + 2_000, "manual", "stale-end");

    expect(first.ok).toBe(true);
    expect(duplicate.ok).toBe(true);
    if (duplicate.ok) expect(duplicate.value).toEqual(first.ok ? first.value : null);
    expect(stale.ok).toBe(false);
    if (!stale.ok) expect(stale.error.code).toBe("stale-revision");
  });
});
