import { describe, expect, it } from "vitest";

import { candidateBatchSchema, questCycleStateSchema, type QuestEngineResult } from "../core";
import { DefaultQuestEngine, createDefaultQuestEngine, type QuestTieBreaker } from ".";
import {
  ROLE_3_FIXTURE_TIME,
  role3CandidateCases,
  role3FixtureCandidateBatch,
  role3FixtureIdleState,
  role3IntelligenceCommand,
  role3StampFixtureState,
  role3StreamerCommand,
  role3VoteCommand,
} from "./testing";

function decision(result: QuestEngineResult) {
  if (!result.ok) throw new Error(`Expected decision, received ${result.error.code}`);
  return result.decision;
}

describe("DefaultQuestEngine", () => {
  it("is constructible through the Role 3 public entrypoint", () => {
    expect(createDefaultQuestEngine()).toBeInstanceOf(DefaultQuestEngine);
  });

  it("consumes an exactly-three candidate batch and proposes canonical state", () => {
    const result = new DefaultQuestEngine().decide({
      currentState: role3FixtureIdleState,
      command: role3IntelligenceCommand(),
      candidateBatch: role3FixtureCandidateBatch,
      now: ROLE_3_FIXTURE_TIME,
    });

    const proposed = decision(result);
    expect(proposed.nextState.status).toBe("proposed");
    expect(proposed.nextState.options).toHaveLength(3);
    expect(proposed.nextState.availableStreamerActions).toEqual([
      "approve",
      "reject",
      "skip",
      "emergency-pause",
    ]);
    expect(proposed.events).toEqual([
      { eventType: "quest-cycle.proposed", attributes: { candidateCount: 3 } },
    ]);
    expect(questCycleStateSchema.safeParse(proposed.nextState).success).toBe(true);
  });

  it("rejects stale revisions before applying a transition", () => {
    const result = new DefaultQuestEngine().decide({
      currentState: role3StampFixtureState(role3FixtureIdleState, 2),
      command: role3IntelligenceCommand({ expectedRevision: 1 }),
      candidateBatch: role3FixtureCandidateBatch,
      now: ROLE_3_FIXTURE_TIME,
    });

    expect(result).toMatchObject({ ok: false, error: { code: "stale-revision" } });
  });

  it("rejects malformed, duplicated, and missing provider candidate batches", () => {
    expect(candidateBatchSchema.safeParse(role3CandidateCases.malformed).success).toBe(false);
    expect(candidateBatchSchema.safeParse(role3CandidateCases.duplicated).success).toBe(false);

    const result = new DefaultQuestEngine().decide({
      currentState: role3FixtureIdleState,
      command: role3IntelligenceCommand(),
      candidateBatch: role3CandidateCases.providerFailed,
      now: ROLE_3_FIXTURE_TIME,
    });
    expect(result).toMatchObject({ ok: false, error: { code: "dependency-unavailable" } });
  });

  it("keeps policy-edge fixtures explicit without presenting them as live evidence", () => {
    for (const fixture of [
      role3CandidateCases.lowConfidence,
      role3CandidateCases.unknownHeavyFallback,
      role3CandidateCases.unsafe,
      role3CandidateCases.impossible,
    ]) {
      expect(candidateBatchSchema.safeParse(fixture).success).toBe(true);
      expect(fixture.envelope.evidenceClass).toBe("fixture");
    }
  });

  it("drives the manual proposal, voting, active, and succeeded skeleton", () => {
    const engine = new DefaultQuestEngine();
    const proposed = decision(
      engine.decide({
        currentState: role3FixtureIdleState,
        command: role3IntelligenceCommand(),
        candidateBatch: role3FixtureCandidateBatch,
        now: ROLE_3_FIXTURE_TIME,
      }),
    ).nextState;
    const voting = decision(
      engine.decide({
        currentState: role3StampFixtureState(proposed, 1),
        command: role3StreamerCommand("approve", { expectedRevision: 1 }),
        candidateBatch: null,
        now: ROLE_3_FIXTURE_TIME + 1_000,
      }),
    ).nextState;
    const voted = decision(
      engine.decide({
        currentState: role3StampFixtureState(voting, 2),
        command: role3VoteCommand({ expectedRevision: 2 }),
        candidateBatch: null,
        now: ROLE_3_FIXTURE_TIME + 2_000,
      }),
    ).nextState;
    const active = decision(
      engine.decide({
        currentState: role3StampFixtureState(voted, 3),
        command: role3StreamerCommand("start", { expectedRevision: 3 }),
        candidateBatch: null,
        now: ROLE_3_FIXTURE_TIME + 3_000,
      }),
    ).nextState;
    const succeeded = decision(
      engine.decide({
        currentState: role3StampFixtureState(active, 4),
        command: role3StreamerCommand("succeed", { expectedRevision: 4 }),
        candidateBatch: null,
        now: ROLE_3_FIXTURE_TIME + 4_000,
      }),
    ).nextState;

    expect(voting.status).toBe("voting");
    expect(voted.voteTallies[0]).toMatchObject({ candidateId: "role-3-candidate-1", votes: 1 });
    expect(active).toMatchObject({ status: "active", activeCandidateId: "role-3-candidate-1" });
    expect(active.endsAt).toBe(ROLE_3_FIXTURE_TIME + 33_000);
    expect(succeeded).toMatchObject({
      status: "succeeded",
      progress: { value: 1, method: "manual" },
      result: { outcome: "succeeded", rewardPointsAwarded: 100 },
    });
  });

  it("uses an injected deterministic selector when voting is tied", () => {
    const selectSecond: QuestTieBreaker = {
      select: ({ candidateIds }) => candidateIds[1],
    };
    const engine = new DefaultQuestEngine(selectSecond);
    const proposed = decision(
      engine.decide({
        currentState: role3FixtureIdleState,
        command: role3IntelligenceCommand(),
        candidateBatch: role3FixtureCandidateBatch,
        now: ROLE_3_FIXTURE_TIME,
      }),
    ).nextState;
    const voting = decision(
      engine.decide({
        currentState: role3StampFixtureState(proposed, 1),
        command: role3StreamerCommand("approve", { expectedRevision: 1 }),
        candidateBatch: null,
        now: ROLE_3_FIXTURE_TIME,
      }),
    ).nextState;
    const input = {
      currentState: role3StampFixtureState(voting, 2),
      command: role3StreamerCommand("start", { expectedRevision: 2 }),
      candidateBatch: null,
      now: ROLE_3_FIXTURE_TIME + 5_000,
    } as const;

    const first = decision(engine.decide(input));
    const replay = decision(engine.decide(input));
    expect(first).toEqual(replay);
    expect(first.nextState.activeCandidateId).toBe("role-3-candidate-2");
  });

  it("returns typed forbidden results for unavailable lifecycle actions", () => {
    const result = new DefaultQuestEngine().decide({
      currentState: role3FixtureIdleState,
      command: role3StreamerCommand("pause"),
      candidateBatch: null,
      now: ROLE_3_FIXTURE_TIME,
    });

    expect(result).toMatchObject({
      ok: false,
      error: { code: "forbidden", retryable: false, details: { status: "idle" } },
    });
  });

  it("cancels the current cycle with an explicit emergency event", () => {
    const engine = new DefaultQuestEngine();
    const proposed = decision(
      engine.decide({
        currentState: role3FixtureIdleState,
        command: role3IntelligenceCommand(),
        candidateBatch: role3FixtureCandidateBatch,
        now: ROLE_3_FIXTURE_TIME,
      }),
    ).nextState;
    const result = decision(
      engine.decide({
        currentState: role3StampFixtureState(proposed, 1),
        command: role3StreamerCommand("emergency-pause", { expectedRevision: 1 }),
        candidateBatch: null,
        now: ROLE_3_FIXTURE_TIME + 1_000,
      }),
    );

    expect(result.nextState).toMatchObject({
      status: "cancelled",
      result: {
        outcome: "cancelled",
        reason: "Emergency pause cancelled the current quest cycle.",
      },
    });
    expect(result.events[0]).toMatchObject({ eventType: "quest-cycle.emergency-cancelled" });
  });
});
