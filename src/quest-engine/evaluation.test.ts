import { describe, expect, it } from "vitest";

import {
  CONTRACT_VERSION,
  intelligenceSnapshotSchema,
  liveDirectorStateSchema,
  streamerProfileSchema,
  streamerLiveDirectorCueCommandSchema,
  systemLiveDirectorCueCommandSchema,
  type DirectorCueAction,
  type LiveDirectorState,
  type QuestEngineResult,
} from "../core";
import { contractFixtureLiveDirectorState } from "../core/testing";
import {
  createDirectorCueHistorySummary,
  DefaultCandidateAssembler,
  DefaultDirectorCueConverter,
  DefaultDirectorCueLifecycle,
  DefaultQuestEngine,
  mergeDirectorCueHistory,
  type DirectorCueAuthority,
} from ".";
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

const directorNow = contractFixtureLiveDirectorState.liveContext!.compiledAt;
const directorAuthority = {
  sessionId: "fixture-session",
  questCycleId: "fixture-cycle",
  revision: 0,
} as const satisfies DirectorCueAuthority;
const directorBaseState = liveDirectorStateSchema.parse({
  ...contractFixtureLiveDirectorState,
  cue: null,
});
const directorSuitability = {
  disposition: "offer-cue" as const,
  score: 0.84,
  reasons: ["eligible"] as const,
  evidenceReferences: ["fixture-intent", "fixture-pointer", "fixture-activity"],
};

function directorSystemCommand() {
  return systemLiveDirectorCueCommandSchema.parse({
    contractVersion: CONTRACT_VERSION,
    sessionId: directorAuthority.sessionId,
    questCycleId: directorAuthority.questCycleId,
    commandId: "role-3-evaluation-cue-ready",
    correlationId: "role-3-evaluation-cue-correlation",
    expectedRevision: directorAuthority.revision,
    issuedAt: directorNow,
    actor: { kind: "system", actorId: "role-3-evaluation-system" },
    type: "system.live-director-cue-ready",
    cueId: "role-3-evaluation-cue",
    liveContextId: directorBaseState.liveContext!.contextId,
  });
}

function directorStreamerCommand(action: DirectorCueAction) {
  return streamerLiveDirectorCueCommandSchema.parse({
    contractVersion: CONTRACT_VERSION,
    sessionId: directorAuthority.sessionId,
    questCycleId: directorAuthority.questCycleId,
    commandId: `role-3-evaluation-cue-${action}`,
    correlationId: "role-3-evaluation-cue-correlation",
    expectedRevision: directorAuthority.revision,
    issuedAt: directorNow + 1_000,
    actor: { kind: "broadcaster", actorId: "role-3-evaluation-broadcaster" },
    type: "streamer.live-director-cue",
    cueId: "role-3-evaluation-cue",
    action,
  });
}

function offeredDirectorState(): LiveDirectorState {
  const offered = new DefaultDirectorCueLifecycle().offer({
    authority: directorAuthority,
    current: directorBaseState,
    command: directorSystemCommand(),
    suitability: directorSuitability,
    now: directorNow,
  });
  if (!offered.ok) throw new Error(offered.error.message);
  return liveDirectorStateSchema.parse({
    ...directorBaseState,
    cue: offered.decision.nextCue,
    updatedAt: directorNow,
  });
}

function resolveDirectorAction(action: DirectorCueAction) {
  return new DefaultDirectorCueLifecycle().applyAction({
    authority: directorAuthority,
    current: offeredDirectorState(),
    command: directorStreamerCommand(action),
    emergencyPaused: false,
    now: directorNow + 1_000,
  });
}

function convertedDirectorState(): LiveDirectorState {
  const converted = resolveDirectorAction("turn-into-vote");
  if (!converted.ok) throw new Error(converted.error.message);
  return liveDirectorStateSchema.parse({
    ...directorBaseState,
    cue: converted.decision.nextCue,
    updatedAt: directorNow + 1_000,
  });
}

function conversionInput(
  overrides: Partial<Parameters<DefaultDirectorCueConverter["convert"]>[0]> = {},
) {
  return {
    liveDirector: convertedDirectorState(),
    envelope: { ...role3FixtureCandidateBatch.envelope, source: "quest-engine" as const },
    candidates: null,
    intelligence: evaluationIntelligence,
    profile: evaluationProfile("Minecraft"),
    currentState: role3FixtureIdleState,
    recentQuests: [],
    now: directorNow + 1_000,
    seed: "role-3-evaluation-director-conversion",
    command: role3IntelligenceCommand(),
    emergencyPaused: false,
    sessionEnded: false,
    questImpossible: false,
    ...overrides,
  };
}

describe("Role 3 engine evaluation fixtures", () => {
  it("continues with exactly three deterministic fallbacks when the provider is unavailable", () => {
    const first = assemble([], "Minecraft", "provider-unavailable");
    const replay = assemble([], "Minecraft", "provider-unavailable");

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

  it.each(["Tactical Shooter", "Racing", "Strategy", "Platformer", "Minecraft"])(
    "keeps fallback output game-aware for %s",
    (gameName) => {
      const result = assemble([], gameName, `genre-${gameName}`);

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.batch.candidates).toHaveLength(3);
      expect(new Set(result.batch.candidates.map(({ title }) => title)).size).toBe(3);
      expect(
        result.batch.candidates.every(({ instruction }) => instruction.includes(gameName)),
      ).toBe(true);
      expect(
        result.batch.candidates.every(
          ({ generation, sourceSignalIds }) =>
            generation.method === "deterministic-fallback" && sourceSignalIds.length === 0,
        ),
      ).toBe(true);
    },
  );

  it("returns typed invalid context instead of generic filler when no game is selected", () => {
    expect(assemble([], null, "missing-game")).toMatchObject({
      ok: false,
      code: "invalid-context",
      reason: expect.stringContaining("selected game"),
    });
  });

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

  it.each([
    ["acknowledge", "acknowledged"],
    ["turn-into-vote", "converted"],
    ["later", "postponed"],
    ["dismiss", "dismissed"],
  ] as const)("keeps the %s cue action server-authorised and deterministic", (action, state) => {
    const first = resolveDirectorAction(action);
    const replay = resolveDirectorAction(action);

    expect(first).toEqual(replay);
    expect(first).toMatchObject({ ok: true, decision: { nextCue: { state } } });
    if (!first.ok) return;
    expect(first.decision.events).toHaveLength(1);
    expect(first.decision.events[0]?.attributes).toMatchObject({
      cueId: "role-3-evaluation-cue",
    });
  });

  it("converts provider absence into exactly three private, approval-ready fallbacks", () => {
    const converter = new DefaultDirectorCueConverter();
    const first = converter.convert(conversionInput());
    const replay = converter.convert(conversionInput());

    expect(first).toEqual(replay);
    expect(first).toMatchObject({
      ok: true,
      readyForStreamerApproval: true,
      decision: {
        nextState: {
          status: "proposed",
          availableStreamerActions: expect.arrayContaining(["approve", "reject"]),
        },
      },
    });
    if (!first.ok) return;
    expect(first.decision.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          eventType: "live-director.cue-conversion-ready",
          attributes: expect.objectContaining({
            candidateCount: 3,
            fallbackCount: 3,
            streamerApprovalRequired: true,
            candidatePublication: false,
          }),
        }),
      ]),
    );
    expect(first.batch.candidates).toHaveLength(3);
    expect(
      first.batch.candidates.every(
        ({ generation }) => generation.method === "deterministic-fallback",
      ),
    ).toBe(true);
  });

  it.each([
    ["emergency pause", { emergencyPaused: true }],
    ["session end", { sessionEnded: true }],
    ["impossible opportunity", { questImpossible: true }],
  ] as const)("publishes nothing when %s invalidates conversion", (_name, patch) => {
    expect(new DefaultDirectorCueConverter().convert(conversionInput(patch))).toMatchObject({
      ok: false,
      disposition: "no-publication",
      code: "invalid-context",
    });
  });

  it("records one privacy-safe resolved cue across reconnect replay", () => {
    const dismissed = resolveDirectorAction("dismiss");
    if (!dismissed.ok) throw new Error(dismissed.error.message);
    const summary = createDirectorCueHistorySummary({
      cue: dismissed.decision.nextCue,
      topic: "Choose the next safe route",
    });
    if (summary === null) throw new Error("Expected a resolved cue summary");

    const first = mergeDirectorCueHistory([], summary, directorNow + 1_000);
    expect(first).not.toBeNull();
    expect(mergeDirectorCueHistory(first!, summary, directorNow + 1_000)).toEqual(first);
    expect(first).toEqual([
      {
        cueId: "role-3-evaluation-cue",
        intentId: "fixture-intent",
        topic: "Choose the next safe route",
        offeredAt: directorNow,
        resolvedAt: directorNow + 1_000,
        disposition: "dismissed",
      },
    ]);
  });
});
