import { describe, expect, it } from "vitest";

import {
  authoritativeSessionStateSchema,
  domainErrorSchema,
  systemVoteCloseCommandSchema,
  type AuthoritativeSessionState,
  type OrchestratorResult,
} from "../../src/core";
import { contractFixtureCandidateBatch } from "../../src/core/testing";
import {
  MemoryChatXptPersistence,
  SessionLifecycleService,
  type DueVoteCycleReader,
} from "../../src/realtime";
import {
  SYSTEM_VOTE_CLOSE_ACTOR_ID,
  VoteCloseScheduler,
  type AuthoritativeCommandExecutor,
} from "../../src/realtime/server";
import { FIXTURE_NOW, persistenceState } from "./persistence-fixtures";

const VOTING_ENDS_AT = FIXTURE_NOW + 31_000;

function votingState(revision = 7, sessionId = "fixture-session"): AuthoritativeSessionState {
  const base = persistenceState(sessionId);
  return authoritativeSessionStateSchema.parse({
    ...base,
    session: {
      ...base.session,
      status: "live",
      revision,
      startedAt: FIXTURE_NOW + 1_000,
    },
    questCycle: {
      ...base.questCycle,
      envelope: { ...base.questCycle.envelope, revision },
      status: "voting",
      options: contractFixtureCandidateBatch.candidates,
      availableStreamerActions: ["cancel", "skip", "emergency-pause"],
      voteTallies: contractFixtureCandidateBatch.candidates.map(({ candidateId }) => ({
        candidateId,
        votes: 0,
      })),
      startsAt: VOTING_ENDS_AT - 30_000,
      endsAt: VOTING_ENDS_AT,
    },
  });
}

class StaticDueVotes implements DueVoteCycleReader {
  constructor(private readonly states: readonly AuthoritativeSessionState[]) {}

  async dueVoteCycles(): Promise<readonly AuthoritativeSessionState[]> {
    return structuredClone(this.states);
  }
}

class RecordingExecutor implements AuthoritativeCommandExecutor {
  readonly commands: unknown[] = [];

  constructor(private readonly throws = false) {}

  async execute(input: unknown): Promise<OrchestratorResult> {
    this.commands.push(structuredClone(input));
    if (this.throws) throw new Error("fixture executor unavailable");
    return {
      ok: false,
      error: domainErrorSchema.parse({
        code: "unavailable-capability",
        message: "Fixture Role 3 close policy is not implemented",
        retryable: false,
      }),
    };
  }
}

class MutableClock {
  constructor(public value: number) {}

  now(): number {
    return this.value;
  }
}

describe("authoritative vote-close scheduler", () => {
  it("emits a stable trusted command exactly when a voting cycle is due", async () => {
    const executor = new RecordingExecutor();
    const clock = new MutableClock(VOTING_ENDS_AT);
    const scheduler = new VoteCloseScheduler(
      new StaticDueVotes([votingState()]),
      executor,
      clock,
    );

    const first = await scheduler.closeDue();
    clock.value = VOTING_ENDS_AT + 5_000;
    const retry = await scheduler.closeDue();

    expect(first.ok).toBe(true);
    expect(retry.ok).toBe(true);
    expect(executor.commands).toHaveLength(2);
    const firstCommand = systemVoteCloseCommandSchema.parse(executor.commands[0]);
    const retryCommand = systemVoteCloseCommandSchema.parse(executor.commands[1]);
    expect(firstCommand).toEqual(retryCommand);
    expect(firstCommand).toMatchObject({
      expectedRevision: 7,
      issuedAt: VOTING_ENDS_AT,
      actor: { kind: "system", actorId: SYSTEM_VOTE_CLOSE_ACTOR_ID },
      type: "system.vote-close",
    });
    expect(firstCommand.commandId).toHaveLength("vote-close-".length + 64);
  });

  it("keeps the cycle identity stable while a stale revision is retried", async () => {
    let sweep = 0;
    const dueVotes: DueVoteCycleReader = {
      async dueVoteCycles() {
        sweep += 1;
        return [votingState(sweep === 1 ? 7 : 8)];
      },
    };
    const executor = new RecordingExecutor();
    const clock = new MutableClock(VOTING_ENDS_AT);
    const scheduler = new VoteCloseScheduler(dueVotes, executor, clock);

    await scheduler.closeDue();
    clock.value = VOTING_ENDS_AT + 1_000;
    await scheduler.closeDue();

    const first = systemVoteCloseCommandSchema.parse(executor.commands[0]);
    const retry = systemVoteCloseCommandSchema.parse(executor.commands[1]);
    expect(retry.commandId).toBe(first.commandId);
    expect(first.expectedRevision).toBe(7);
    expect(retry.expectedRevision).toBe(8);
  });

  it("uses one idempotency identity when concurrent sweepers see the same cycle", async () => {
    const executor = new RecordingExecutor();
    const scheduler = new VoteCloseScheduler(
      new StaticDueVotes([votingState()]),
      executor,
      new MutableClock(VOTING_ENDS_AT),
    );

    await Promise.all([scheduler.closeDue(), scheduler.closeDue()]);

    const commands = executor.commands.map((command) =>
      systemVoteCloseCommandSchema.parse(command),
    );
    expect(commands).toHaveLength(2);
    expect(commands[0]?.commandId).toBe(commands[1]?.commandId);
    expect(commands[0]).toEqual(commands[1]);
  });

  it("isolates execution failures so another due session is still attempted", async () => {
    const executor = new RecordingExecutor(true);
    const scheduler = new VoteCloseScheduler(
      new StaticDueVotes([votingState(7, "session-one"), votingState(3, "session-two")]),
      executor,
      new MutableClock(VOTING_ENDS_AT),
    );

    const result = await scheduler.closeDue();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.attempts).toHaveLength(2);
    expect(result.attempts.every((attempt) => !attempt.result.ok)).toBe(true);
    expect(executor.commands).toHaveLength(2);
  });

  it("rejects an invalid sweep time or a non-due state without issuing a command", async () => {
    const executor = new RecordingExecutor();
    const invalidState = {
      ...votingState(),
      questCycle: { ...votingState().questCycle, endsAt: VOTING_ENDS_AT + 1 },
    };
    const clock = new MutableClock(-1);
    const scheduler = new VoteCloseScheduler(new StaticDueVotes([invalidState]), executor, clock);

    expect(await scheduler.closeDue()).toMatchObject({
      ok: false,
      error: { code: "validation" },
    });
    clock.value = VOTING_ENDS_AT;
    const invalidDue = await scheduler.closeDue();
    expect(invalidDue).toMatchObject({
      ok: true,
      attempts: [{ result: { ok: false, error: { code: "validation" } } }],
    });
    expect(executor.commands).toHaveLength(0);
  });

  it("reports due-state lookup failure as retryable without issuing commands", async () => {
    const executor = new RecordingExecutor();
    const scheduler = new VoteCloseScheduler(
      {
        async dueVoteCycles() {
          throw new Error("fixture persistence unavailable");
        },
      },
      executor,
      new MutableClock(VOTING_ENDS_AT),
    );

    expect(await scheduler.closeDue()).toMatchObject({
      ok: false,
      error: { code: "dependency-unavailable", retryable: true },
    });
    expect(executor.commands).toHaveLength(0);
  });

  it("fails closed when the authoritative server clock is unavailable", async () => {
    const executor = new RecordingExecutor();
    const scheduler = new VoteCloseScheduler(
      new StaticDueVotes([votingState()]),
      executor,
      {
        now() {
          throw new Error("fixture clock unavailable");
        },
      },
    );

    expect(await scheduler.closeDue()).toMatchObject({
      ok: false,
      error: { code: "dependency-unavailable", retryable: true },
    });
    expect(executor.commands).toHaveLength(0);
  });

  it("finds only live voting cycles at or after their authoritative deadline in memory", async () => {
    const store = new MemoryChatXptPersistence();
    const base = votingState(0);
    const preparing = authoritativeSessionStateSchema.parse({
      ...base,
      session: { ...base.session, status: "preparing", startedAt: null },
    });
    const lifecycle = new SessionLifecycleService(store);
    expect(await lifecycle.create(preparing, FIXTURE_NOW)).toMatchObject({ ok: true });
    expect(await lifecycle.start("fixture-session", 0, FIXTURE_NOW + 1_000, "start-voting")).toMatchObject({
      ok: true,
    });

    expect(await store.dueVoteCycles(VOTING_ENDS_AT - 1)).toEqual([]);
    const due = await store.dueVoteCycles(VOTING_ENDS_AT);
    expect(due).toHaveLength(1);
    expect(due[0]).toMatchObject({
      session: { status: "live", revision: 1 },
      questCycle: { status: "voting", endsAt: VOTING_ENDS_AT },
    });

    const idleStore = new MemoryChatXptPersistence();
    const idleLifecycle = new SessionLifecycleService(idleStore);
    expect(await idleLifecycle.create(persistenceState("idle-session"), FIXTURE_NOW)).toMatchObject({
      ok: true,
    });
    expect(
      await idleLifecycle.start("idle-session", 0, FIXTURE_NOW + 1_000, "start-idle"),
    ).toMatchObject({ ok: true });
    expect(await idleStore.dueVoteCycles(VOTING_ENDS_AT)).toEqual([]);
  });
});
