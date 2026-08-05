import { describe, expect, it } from "vitest";

import {
  intelligenceSnapshotSchema,
  streamerProfileSchema,
  type QuestEngineResult,
} from "../core";
import { DefaultCandidateAssembler, DefaultQuestEngine } from ".";
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

const evaluationIntelligence = intelligenceSnapshotSchema.parse({
  envelope: {
    ...role3FixtureIdleState.envelope,
    messageId: "role-3-evaluation-intelligence",
  },
  gameplay: {
    envelope: {
      ...role3FixtureIdleState.envelope,
      messageId: "role-3-evaluation-gameplay",
    },
    capabilities: {
      tier: "universal-visual",
      gameId: null,
      adapterId: null,
      supportedSignals: [],
    },
    signals: [],
  },
  audience: {
    envelope: {
      ...role3FixtureIdleState.envelope,
      messageId: "role-3-evaluation-audience",
    },
    sampleSize: 0,
    signals: [],
  },
});

function evaluationProfile(gameName: string | null) {
  return streamerProfileSchema.parse({
    profileId: `role-3-evaluation-${gameName ?? "unknown"}`,
    streamerId: "role-3-evaluation-streamer",
    revision: 0,
    displayName: "Role 3 Evaluation Fixture",
    gameId: gameName === null ? null : gameName.toLocaleLowerCase().replace(/\s+/g, "-"),
    gameName,
    experience: { intensity: 0.5 },
    restrictions: [],
    preferredQuestTypes: [],
    forbiddenQuestTypes: [],
    accessibilityNeeds: [],
  });
}

function assemble(candidates: readonly unknown[], gameName: string | null, seed: string) {
  return new DefaultCandidateAssembler().assemble({
    envelope: {
      ...role3FixtureCandidateBatch.envelope,
      messageId: `role-3-evaluation-${seed}`,
      source: "quest-engine",
    },
    candidates,
    intelligence: evaluationIntelligence,
    profile: evaluationProfile(gameName),
    currentState: role3FixtureIdleState,
    recentQuests: [],
    now: ROLE_3_FIXTURE_TIME,
    seed,
  });
}

describe("Role 3 engine evaluation fixtures", () => {
  it("continues with exactly three deterministic fallbacks when the provider is unavailable", () => {
    const first = assemble([], null, "provider-unavailable");
    const replay = assemble([], null, "provider-unavailable");

    expect(first).toEqual(replay);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.batch.candidates).toHaveLength(3);
    expect(
      first.batch.candidates.every(
        ({ generation, sourceSignalIds }) =>
          generation.method === "deterministic-fallback" && sourceSignalIds.length === 0,
      ),
    ).toBe(true);
  });

  it("replaces malformed and unsafe provider values without weakening validation", () => {
    const result = assemble(
      [
        { candidateId: "missing-required-fields" },
        role3CandidateCases.unsafe.candidates[0],
        null,
      ],
      "Action RPG",
      "malformed-provider-output",
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.batch.candidates).toHaveLength(3);
    expect(result.batch.candidates.every(({ generation }) => generation.method === "deterministic-fallback")).toBe(true);
    expect(result.audit).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: "provided",
          accepted: false,
          issues: expect.arrayContaining([expect.objectContaining({ code: "malformed" })]),
        }),
        expect.objectContaining({
          source: "provided",
          accepted: false,
          issues: expect.arrayContaining([expect.objectContaining({ code: "unsafe" })]),
        }),
      ]),
    );
  });

  it.each(["Tactical Shooter", "Racing", "Strategy", "Platformer", null])(
    "keeps fallback output game-neutral for %s",
    (gameName) => {
      const result = assemble([], gameName, `genre-${gameName ?? "unknown"}`);

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.batch.candidates).toHaveLength(3);
      expect(new Set(result.batch.candidates.map(({ title }) => title)).size).toBe(3);
      expect(
        result.batch.candidates.every(
          ({ generation, sourceSignalIds }) =>
            generation.method === "deterministic-fallback" && sourceSignalIds.length === 0,
        ),
      ).toBe(true);
    },
  );

  it("is replay-stable from a reconstructed voting snapshot and rejects a stale reconnect command", () => {
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
    const reconstructed = role3StampFixtureState(voting, 7);
    const vote = role3VoteCommand({ expectedRevision: 7, commandId: "reconnect-vote" });
    const input = {
      currentState: reconstructed,
      command: vote,
      candidateBatch: null,
      now: ROLE_3_FIXTURE_TIME + 2_000,
    } as const;

    expect(engine.decide(input)).toEqual(engine.decide(input));
    expect(
      engine.decide({
        ...input,
        command: role3VoteCommand({ expectedRevision: 6, commandId: "stale-reconnect-vote" }),
      }),
    ).toMatchObject({ ok: false, error: { code: "stale-revision" } });
  });

  it("keeps ordinary cancellation and emergency cancellation distinguishable", () => {
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
    const currentState = role3StampFixtureState(voting, 2);
    const ordinary = decision(
      engine.decide({
        currentState,
        command: role3StreamerCommand("cancel", { expectedRevision: 2 }),
        candidateBatch: null,
        now: ROLE_3_FIXTURE_TIME + 2_000,
      }),
    );
    const emergency = decision(
      engine.decide({
        currentState,
        command: role3StreamerCommand("emergency-pause", { expectedRevision: 2 }),
        candidateBatch: null,
        now: ROLE_3_FIXTURE_TIME + 2_000,
      }),
    );

    expect(ordinary.nextState).toMatchObject({
      status: "cancelled",
      result: { reason: "Streamer cancelled the quest cycle." },
    });
    expect(ordinary.events[0]).toMatchObject({ eventType: "quest-cycle.terminal" });
    expect(emergency.nextState).toMatchObject({
      status: "cancelled",
      result: { reason: "Emergency pause cancelled the current quest cycle." },
    });
    expect(emergency.events[0]).toMatchObject({ eventType: "quest-cycle.emergency-cancelled" });
  });
});
