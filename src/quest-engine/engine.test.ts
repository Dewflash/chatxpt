import { describe, expect, it } from "vitest";

import {
  acceptedVoteTallySnapshotSchema,
  audienceSnapshotSchema,
  candidateBatchSchema,
  gameplaySnapshotSchema,
  questCycleStateSchema,
  streamSessionSchema,
  streamerProfileSchema,
  systemQuestTickCommandSchema,
  systemQuestProgressCommandSchema,
  type GameplaySnapshot,
  type QuestCompletionRule,
  type QuestEngineInput,
  type QuestEngineResult,
  type QuestProgress,
} from "../core";
import {
  AUTOMATIC_PROGRESS_MINIMUM_CONFIDENCE,
  DEFAULT_VOTING_MILLISECONDS,
  DefaultQuestEngine,
  MAXIMUM_SIGNAL_AGE_MILLISECONDS,
  createDefaultQuestEngine,
} from ".";
import {
  ROLE_3_FIXTURE_TIME,
  role3CandidateCases,
  role3FixtureCandidateBatch,
  role3FixtureIdleState,
  role3IntelligenceCommand,
  role3StampFixtureState,
  role3StreamerCommand,
  role3VoteCloseCommand,
  role3VoteCommand,
} from "./testing";

function decision(result: QuestEngineResult) {
  if (!result.ok) throw new Error(`Expected decision, received ${result.error.code}`);
  return result.decision;
}

const progressProfile = streamerProfileSchema.parse({
  profileId: "role-3-progress-profile",
  streamerId: "role-3-progress-broadcaster",
  revision: 0,
  displayName: "Role 3 Progress Fixture",
  gameId: null,
  gameName: null,
  experience: {},
  restrictions: [],
  preferredQuestTypes: [],
  forbiddenQuestTypes: [],
  accessibilityNeeds: [],
});

const voteCloseProfile = streamerProfileSchema.parse({
  profileId: "role-3-fixture-profile",
  streamerId: "role-3-fixture-broadcaster",
  revision: 0,
  displayName: "Role 3 Fixture Streamer",
  gameId: null,
  gameName: null,
  experience: { intensity: 0.5, creativity: 0.5 },
  restrictions: [],
  preferredQuestTypes: [],
  forbiddenQuestTypes: [],
  accessibilityNeeds: [],
});

const progressSession = streamSessionSchema.parse({
  sessionId: role3FixtureIdleState.envelope.sessionId,
  broadcasterId: progressProfile.streamerId,
  platform: "twitch",
  status: "live",
  revision: 0,
  createdAt: ROLE_3_FIXTURE_TIME - 60_000,
  startedAt: ROLE_3_FIXTURE_TIME - 30_000,
  endedAt: null,
  capabilities: {
    twitchExtension: true,
    hostedViewerBoard: true,
    twitchChatVoting: true,
    twitchIdentity: true,
    anonymousParticipation: true,
    reactions: true,
  },
});

const voteCloseSession = streamSessionSchema.parse({
  sessionId: role3FixtureIdleState.envelope.sessionId,
  broadcasterId: "role-3-fixture-broadcaster",
  platform: "twitch",
  status: "live",
  revision: 0,
  createdAt: ROLE_3_FIXTURE_TIME - 60_000,
  startedAt: ROLE_3_FIXTURE_TIME - 30_000,
  endedAt: null,
  capabilities: {
    twitchExtension: true,
    hostedViewerBoard: true,
    twitchChatVoting: true,
    twitchIdentity: true,
    anonymousParticipation: true,
    reactions: true,
  },
});

function activeProgressState(
  progress: QuestProgress | null = null,
  completionRule: QuestCompletionRule | null = {
    mode: "signal",
    allowedSignalKinds: ["objective-progress"],
  },
) {
  return questCycleStateSchema.parse({
    ...role3FixtureIdleState,
    status: "active",
    options: role3FixtureCandidateBatch.candidates,
    activeCandidateId: role3FixtureCandidateBatch.candidates[0].candidateId,
    availableStreamerActions: ["cancel", "skip", "succeed", "fail", "emergency-pause"],
    startsAt: ROLE_3_FIXTURE_TIME,
    endsAt: ROLE_3_FIXTURE_TIME + 60_000,
    progress,
    completionRule,
  });
}

function progressCommand(overrides: Partial<ReturnType<typeof systemQuestProgressCommandSchema.parse>> = {}) {
  return systemQuestProgressCommandSchema.parse({
    contractVersion: "1.0.0",
    sessionId: role3FixtureIdleState.envelope.sessionId,
    questCycleId: role3FixtureIdleState.envelope.questCycleId,
    commandId: "role-3-progress-command",
    correlationId: "role-3-progress-correlation",
    expectedRevision: 0,
    issuedAt: ROLE_3_FIXTURE_TIME + 1_000,
    actor: { kind: "system", actorId: "role-3-progress-system" },
    type: "system.quest-progress",
    requestedValue: 0.5,
    evidenceSignalIds: ["role-3-progress-signal"],
    ...overrides,
  });
}

function tickCommand(
  overrides: Partial<ReturnType<typeof systemQuestTickCommandSchema.parse>> = {},
) {
  return systemQuestTickCommandSchema.parse({
    contractVersion: "1.0.0",
    sessionId: role3FixtureIdleState.envelope.sessionId,
    questCycleId: role3FixtureIdleState.envelope.questCycleId,
    commandId: "role-3-tick-command",
    correlationId: "role-3-tick-correlation",
    expectedRevision: 0,
    issuedAt: ROLE_3_FIXTURE_TIME,
    actor: { kind: "system", actorId: "role-3-tick-system" },
    type: "system.quest-tick",
    ...overrides,
  });
}

function progressGameplay(
  patch: {
    readonly status?: "known" | "unknown";
    readonly kind?: string;
    readonly value?: string | number | boolean;
    readonly unknownReason?: "not-observed" | "conflicting";
    readonly confidence?: number;
    readonly observedAt?: number;
    readonly supportedSignals?: readonly string[];
    readonly gameId?: string | null;
  } = {},
): GameplaySnapshot {
  const status = patch.status ?? "known";
  const provenance = {
    source: "test-fixture" as const,
    method: "fixture-progress-signal",
    confidence: patch.confidence ?? AUTOMATIC_PROGRESS_MINIMUM_CONFIDENCE,
    observedAt: patch.observedAt ?? ROLE_3_FIXTURE_TIME,
    receivedAt: ROLE_3_FIXTURE_TIME,
    evidenceClass: "fixture" as const,
  };
  return gameplaySnapshotSchema.parse({
    envelope: {
      ...role3FixtureIdleState.envelope,
      messageId: "role-3-progress-gameplay",
    },
    capabilities: {
      tier: "calibrated-hud",
      gameId: patch.gameId === undefined ? "role-3-progress-game" : patch.gameId,
      adapterId: "role-3-progress-adapter",
      supportedSignals: patch.supportedSignals ?? ["objective-progress"],
    },
    signals: [
      {
        signalId: "role-3-progress-signal",
        kind: patch.kind ?? "objective-progress",
        observation:
          status === "known"
            ? { status, value: patch.value ?? 0.5, provenance }
            : { status, reason: patch.unknownReason ?? "not-observed", provenance },
      },
    ],
  });
}

const emptyProgressAudience = audienceSnapshotSchema.parse({
  envelope: {
    ...role3FixtureIdleState.envelope,
    messageId: "role-3-progress-audience",
  },
  sampleSize: 0,
  signals: [],
});

const sessionScopedGameplay = gameplaySnapshotSchema.parse({
  envelope: {
    ...role3FixtureIdleState.envelope,
    questCycleId: null,
    messageId: "role-3-session-gameplay",
  },
  capabilities: {
    tier: "universal-visual",
    gameId: null,
    adapterId: null,
    supportedSignals: [],
  },
  signals: [],
});

const sessionScopedAudience = audienceSnapshotSchema.parse({
  envelope: {
    ...role3FixtureIdleState.envelope,
    questCycleId: null,
    messageId: "role-3-session-audience",
  },
  sampleSize: 0,
  signals: [],
});

function votingFixture(options = role3FixtureCandidateBatch.candidates) {
  return questCycleStateSchema.parse({
    ...role3FixtureIdleState,
    status: "voting",
    options,
    availableStreamerActions: ["cancel", "skip", "emergency-pause"],
    voteTallies: options.map(({ candidateId }) => ({ candidateId, votes: 0 })),
    startsAt: ROLE_3_FIXTURE_TIME,
    endsAt: ROLE_3_FIXTURE_TIME + DEFAULT_VOTING_MILLISECONDS,
  });
}

function voteCloseInput(
  votes: readonly [number, number, number],
  overrides: Partial<QuestEngineInput> = {},
): QuestEngineInput {
  const currentState = overrides.currentState ?? votingFixture();
  const now = overrides.now ?? currentState.endsAt ?? ROLE_3_FIXTURE_TIME;
  return {
    currentState,
    command:
      overrides.command ??
      role3VoteCloseCommand({ expectedRevision: currentState.envelope.revision }),
    candidateBatch: null,
    acceptedVoteTally: acceptedVoteTallySnapshotSchema.parse({
      sessionId: currentState.envelope.sessionId,
      questCycleId: currentState.envelope.questCycleId,
      revision: currentState.envelope.revision,
      closedAt: now,
      acceptedVoteCount: votes.reduce((total, value) => total + value, 0),
      tallies: currentState.options.map(({ candidateId }, index) => ({
        candidateId,
        votes: votes[index],
      })),
    }),
    voteCloseValidationContext: {
      profile: voteCloseProfile,
      session: voteCloseSession,
      gameplay: null,
      audience: null,
      recentQuests: [],
    },
    now,
    ...overrides,
  };
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

  it("drives proposal and voting without exposing unresolved activation authority", () => {
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
    expect(voting.status).toBe("voting");
    expect(voting.endsAt).toBe(ROLE_3_FIXTURE_TIME + 1_000 + DEFAULT_VOTING_MILLISECONDS);
    expect(voting.availableStreamerActions).toEqual(["cancel", "skip", "emergency-pause"]);
    expect(voted.voteTallies[0]).toMatchObject({ candidateId: "role-3-candidate-1", votes: 1 });
    expect(
      engine.decide({
        currentState: role3StampFixtureState(voted, 3),
        command: role3StreamerCommand("start", { expectedRevision: 3 }),
        candidateBatch: null,
        now: ROLE_3_FIXTURE_TIME + 3_000,
      }),
    ).toMatchObject({
      ok: false,
      error: { code: "forbidden", details: { status: "voting" } },
    });
  });

  it("rejects votes at or after the authoritative voting deadline", () => {
    const voting = questCycleStateSchema.parse({
      ...role3FixtureIdleState,
      status: "voting",
      options: role3FixtureCandidateBatch.candidates,
      availableStreamerActions: ["cancel", "skip", "emergency-pause"],
      voteTallies: role3FixtureCandidateBatch.candidates.map(({ candidateId }) => ({
        candidateId,
        votes: 0,
      })),
      startsAt: ROLE_3_FIXTURE_TIME,
      endsAt: ROLE_3_FIXTURE_TIME + DEFAULT_VOTING_MILLISECONDS,
    });
    const result = new DefaultQuestEngine().decide({
      currentState: voting,
      command: role3VoteCommand(),
      candidateBatch: null,
      now: voting.endsAt ?? ROLE_3_FIXTURE_TIME,
    });

    expect(result).toMatchObject({ ok: false, error: { code: "expired" } });
  });

  it("activates the authoritative majority winner after the voting deadline", () => {
    const result = decision(new DefaultQuestEngine().decide(voteCloseInput([1, 4, 2])));

    expect(result.nextState).toMatchObject({
      status: "active",
      activeCandidateId: "role-3-candidate-2",
      voteTallies: [
        { candidateId: "role-3-candidate-1", votes: 1 },
        { candidateId: "role-3-candidate-2", votes: 4 },
        { candidateId: "role-3-candidate-3", votes: 2 },
      ],
      startsAt: ROLE_3_FIXTURE_TIME + DEFAULT_VOTING_MILLISECONDS,
      endsAt: ROLE_3_FIXTURE_TIME + DEFAULT_VOTING_MILLISECONDS + 45_000,
      progress: { value: 0, method: "unknown" },
    });
    expect(result.events).toEqual([
      {
        eventType: "quest-cycle.activated",
        attributes: {
          candidateId: "role-3-candidate-2",
          winningVotes: 4,
          acceptedVoteCount: 7,
          tiedCandidateCount: 1,
          tieBreakUsed: false,
        },
      },
    ]);
  });

  it("breaks a top-count tie deterministically from neutral cycle identifiers", () => {
    const engine = new DefaultQuestEngine();
    const first = decision(engine.decide(voteCloseInput([3, 3, 1])));
    const second = decision(engine.decide(voteCloseInput([3, 3, 1])));

    expect(first.nextState.activeCandidateId).toBe(second.nextState.activeCandidateId);
    expect(first.nextState.activeCandidateId).toBe("role-3-candidate-1");
    expect(first.events[0]).toMatchObject({
      eventType: "quest-cycle.activated",
      attributes: { tiedCandidateCount: 2, tieBreakUsed: true },
    });
  });

  it("returns typed no-activation when the authoritative tally has zero votes", () => {
    const result = decision(new DefaultQuestEngine().decide(voteCloseInput([0, 0, 0])));

    expect(result.nextState).toMatchObject({
      status: "cancelled",
      activeCandidateId: null,
      result: {
        outcome: "cancelled",
        rewardPointsAwarded: 0,
        reason: "Voting closed without an accepted vote; no quest was activated.",
      },
    });
    expect(result.events[0]).toMatchObject({
      eventType: "quest-cycle.vote-closed-no-activation",
      attributes: { reasonCode: "zero-votes", acceptedVoteCount: 0 },
    });
  });

  it("rejects early, missing, and mismatched authoritative close inputs", () => {
    const voting = votingFixture();
    const early = new DefaultQuestEngine().decide(
      voteCloseInput([1, 0, 0], { now: (voting.endsAt ?? 0) - 1 }),
    );
    const missing = new DefaultQuestEngine().decide({
      ...voteCloseInput([1, 0, 0]),
      acceptedVoteTally: null,
    });
    const mismatched = new DefaultQuestEngine().decide({
      ...voteCloseInput([1, 0, 0]),
      acceptedVoteTally: {
        ...voteCloseInput([1, 0, 0]).acceptedVoteTally!,
        sessionId: "another-session",
      },
    });
    const invalidAggregate = new DefaultQuestEngine().decide({
      ...voteCloseInput([1, 0, 0]),
      acceptedVoteTally: {
        ...voteCloseInput([1, 0, 0]).acceptedVoteTally!,
        acceptedVoteCount: 2,
      },
    });

    expect(early).toMatchObject({ ok: false, error: { code: "forbidden" } });
    expect(missing).toMatchObject({ ok: false, error: { code: "dependency-unavailable" } });
    expect(mismatched).toMatchObject({ ok: false, error: { code: "validation" } });
    expect(invalidAggregate).toMatchObject({ ok: false, error: { code: "validation" } });
  });

  it("rechecks concrete harmful instructions before activating the winner", () => {
    const options = role3FixtureCandidateBatch.candidates.map((candidate, index) =>
      index === 0
        ? {
            ...candidate,
            title: "Dangerous Drink",
            instruction: "Drink bleach before the next match begins.",
            rationale: "A concrete harmful fixture that must never reach active state.",
          }
        : candidate,
    );
    const result = decision(
      new DefaultQuestEngine().decide(
        voteCloseInput([5, 1, 0], { currentState: votingFixture(options) }),
      ),
    );

    expect(result.nextState.status).toBe("cancelled");
    expect(result.events[0]).toMatchObject({
      eventType: "quest-cycle.vote-closed-no-activation",
      attributes: { reasonCode: "winner-invalid", validationCodes: "unsafe" },
    });
  });

  it("rechecks the winner against intrinsic confidence and duration hard gates", () => {
    const options = role3FixtureCandidateBatch.candidates.map((candidate, index) =>
      index === 0
        ? {
            ...candidate,
            durationSeconds: 900,
            difficulty: "easy" as const,
            confidence: 0.1,
          }
        : candidate,
    );
    const result = decision(
      new DefaultQuestEngine().decide(
        voteCloseInput([5, 1, 0], { currentState: votingFixture(options) }),
      ),
    );

    expect(result.nextState.status).toBe("cancelled");
    expect(result.events[0]).toMatchObject({
      eventType: "quest-cycle.vote-closed-no-activation",
      attributes: {
        reasonCode: "winner-invalid",
        validationCodes: expect.stringContaining("low-confidence"),
      },
    });
    expect(result.events[0]?.attributes.validationCodes).toContain("duration-out-of-range");
    expect(result.events[0]?.attributes.validationCodes).toContain("difficulty-mismatch");
  });

  it("rechecks that the winner's cited evidence still exists at vote close", () => {
    const options = role3FixtureCandidateBatch.candidates.map((candidate, index) =>
      index === 0 ? { ...candidate, sourceSignalIds: ["missing-signal"] } : candidate,
    );
    const result = decision(
      new DefaultQuestEngine().decide(
        voteCloseInput([5, 1, 0], { currentState: votingFixture(options) }),
      ),
    );

    expect(result.nextState.status).toBe("cancelled");
    expect(result.events[0]).toMatchObject({
      attributes: {
        reasonCode: "winner-invalid",
        validationCodes: expect.stringContaining("unsupported-evidence"),
      },
    });
  });

  it("does not activate a winner made unsafe by the current streamer boundary", () => {
    const input = voteCloseInput([5, 1, 0]);
    const result = decision(
      new DefaultQuestEngine().decide({
        ...input,
        voteCloseValidationContext: {
          ...input.voteCloseValidationContext!,
          profile: streamerProfileSchema.parse({
            ...voteCloseProfile,
            forbiddenQuestTypes: ["current playable area"],
          }),
        },
      }),
    );

    expect(result.nextState.status).toBe("cancelled");
    expect(result.events[0]).toMatchObject({
      eventType: "quest-cycle.vote-closed-no-activation",
      attributes: {
        reasonCode: "winner-invalid",
        validationCodes: "streamer-restricted",
      },
    });
  });

  it("does not activate a fact-dependent winner after supporting gameplay becomes unknown", () => {
    const options = role3FixtureCandidateBatch.candidates.map((candidate, index) =>
      index === 0
        ? {
            ...candidate,
            title: "Elimination Callout",
            instruction: "Get one elimination during the next 30 seconds of play.",
            rationale: "A fixture that requires a current known kill signal before activation.",
          }
        : candidate,
    );
    const result = decision(
      new DefaultQuestEngine().decide(
        voteCloseInput([5, 1, 0], { currentState: votingFixture(options) }),
      ),
    );

    expect(result.nextState.status).toBe("cancelled");
    expect(result.events[0]).toMatchObject({
      eventType: "quest-cycle.vote-closed-no-activation",
      attributes: { reasonCode: "winner-invalid", validationCodes: "unknown-dependent" },
    });
  });

  it("does not activate a winner that fails the full close-time candidate gates", () => {
    const options = role3FixtureCandidateBatch.candidates.map((candidate, index) =>
      index === 0
        ? {
            ...candidate,
            title: "Impossible Marathon",
            instruction: "Complete a perfect objective chain for the next 900 seconds.",
            durationSeconds: 900,
            difficulty: "easy" as const,
            confidence: 0.1,
            sourceSignalIds: ["missing-signal"],
            rationale: "A low-confidence unsupported fixture that should fail full validation.",
          }
        : candidate,
    );
    const result = decision(
      new DefaultQuestEngine().decide(
        voteCloseInput([5, 1, 0], { currentState: votingFixture(options) }),
      ),
    );

    expect(result.nextState.status).toBe("cancelled");
    const validationCodes = String(result.events[0]?.attributes.validationCodes);
    expect(validationCodes).toContain("unsupported-evidence");
    expect(validationCodes).toContain("low-confidence");
    expect(validationCodes).toContain("duration-out-of-range");
    expect(validationCodes).toContain("difficulty-mismatch");
  });

  it("does not activate a recently repeated winner at vote close", () => {
    const input = voteCloseInput([5, 1, 0]);
    const result = decision(
      new DefaultQuestEngine().decide({
        ...input,
        voteCloseValidationContext: {
          ...input.voteCloseValidationContext!,
          recentQuests: [
            {
              title: "Hold Your Ground",
              occurredAt: input.now - 1_000,
            },
          ],
        },
      }),
    );

    expect(result.nextState.status).toBe("cancelled");
    expect(result.events[0]).toMatchObject({
      eventType: "quest-cycle.vote-closed-no-activation",
      attributes: {
        reasonCode: "winner-invalid",
        validationCodes: "recently-repeated",
      },
    });
  });

  it("accepts session-scoped close-time snapshots with null quest cycle IDs", () => {
    const input = voteCloseInput([2, 1, 0]);
    const gameplay = gameplaySnapshotSchema.parse({
      envelope: {
        ...role3FixtureIdleState.envelope,
        messageId: "role-3-session-gameplay",
        questCycleId: null,
      },
      capabilities: {
        tier: "universal-visual",
        gameId: null,
        adapterId: null,
        supportedSignals: ["activity-intensity"],
      },
      signals: [],
    });
    const audience = audienceSnapshotSchema.parse({
      envelope: {
        ...role3FixtureIdleState.envelope,
        messageId: "role-3-session-audience",
        questCycleId: null,
      },
      sampleSize: 2,
      signals: [],
    });

    const result = decision(
      new DefaultQuestEngine().decide({
        ...input,
        voteCloseValidationContext: {
          ...input.voteCloseValidationContext!,
          gameplay,
          audience,
        },
      }),
    );

    expect(result.nextState.status).toBe("active");
    expect(result.nextState.activeCandidateId).toBe("role-3-candidate-1");
  });

  it("does not activate after the session ends, while a missing audience remains non-blocking", () => {
    const endedInput = voteCloseInput([2, 1, 0]);
    const ended = decision(
      new DefaultQuestEngine().decide({
        ...endedInput,
        voteCloseValidationContext: {
          ...endedInput.voteCloseValidationContext!,
          session: streamSessionSchema.parse({
            ...voteCloseSession,
            status: "ended",
            endedAt: endedInput.now,
          }),
        },
      }),
    );
    const disconnectedAudience = decision(
      new DefaultQuestEngine().decide(voteCloseInput([2, 1, 0])),
    );

    expect(ended.nextState.status).toBe("cancelled");
    expect(ended.events[0]).toMatchObject({
      attributes: { reasonCode: "session-not-live", sessionStatus: "ended" },
    });
    expect(disconnectedAudience.nextState.status).toBe("active");
  });

  it("accepts canonical session-scoped gameplay and audience snapshots at vote close", () => {
    const gameplayInput = voteCloseInput([2, 1, 0]);
    const withGameplay = decision(
      new DefaultQuestEngine().decide({
        ...gameplayInput,
        voteCloseValidationContext: {
          ...gameplayInput.voteCloseValidationContext!,
          gameplay: sessionScopedGameplay,
        },
      }),
    );
    const audienceInput = voteCloseInput([2, 1, 0]);
    const withAudience = decision(
      new DefaultQuestEngine().decide({
        ...audienceInput,
        voteCloseValidationContext: {
          ...audienceInput.voteCloseValidationContext!,
          audience: sessionScopedAudience,
        },
      }),
    );

    expect(withGameplay.nextState.status).toBe("active");
    expect(withAudience.nextState.status).toBe("active");
  });

  it("still rejects a non-null snapshot cycle belonging to another quest", () => {
    const input = voteCloseInput([2, 1, 0]);
    const result = new DefaultQuestEngine().decide({
      ...input,
      voteCloseValidationContext: {
        ...input.voteCloseValidationContext!,
        gameplay: gameplaySnapshotSchema.parse({
          ...sessionScopedGameplay,
          envelope: {
            ...sessionScopedGameplay.envelope,
            questCycleId: "another-cycle",
          },
        }),
      },
    });

    expect(result).toMatchObject({ ok: false, error: { code: "validation" } });
  });

  it("applies terminal outcomes to an authoritative active-state fixture", () => {
    const active = questCycleStateSchema.parse({
      ...role3FixtureIdleState,
      status: "active",
      options: role3FixtureCandidateBatch.candidates,
      activeCandidateId: role3FixtureCandidateBatch.candidates[0].candidateId,
      availableStreamerActions: ["cancel", "skip", "succeed", "fail", "emergency-pause"],
      startsAt: ROLE_3_FIXTURE_TIME,
      endsAt: ROLE_3_FIXTURE_TIME + 30_000,
      progress: {
        value: 0,
        updatedAt: ROLE_3_FIXTURE_TIME,
        method: "unknown",
        evidenceSignalIds: [],
      },
    });
    const succeeded = decision(
      new DefaultQuestEngine().decide({
        currentState: role3StampFixtureState(active, 1),
        command: role3StreamerCommand("succeed", { expectedRevision: 1 }),
        candidateBatch: null,
        now: ROLE_3_FIXTURE_TIME + 4_000,
      }),
    ).nextState;

    expect(succeeded).toMatchObject({
      status: "succeeded",
      progress: { value: 1, method: "manual" },
      result: { outcome: "succeeded", rewardPointsAwarded: 100 },
    });
  });

  it("emits deterministic session reward, hype, history, and cooldown evidence", () => {
    const active = questCycleStateSchema.parse({
      ...role3FixtureIdleState,
      status: "active",
      options: role3FixtureCandidateBatch.candidates,
      activeCandidateId: role3FixtureCandidateBatch.candidates[1].candidateId,
      availableStreamerActions: ["cancel", "skip", "succeed", "fail", "emergency-pause"],
      startsAt: ROLE_3_FIXTURE_TIME,
      endsAt: ROLE_3_FIXTURE_TIME + 30_000,
      progress: null,
    });
    const result = decision(
      new DefaultQuestEngine().decide({
        currentState: active,
        command: role3StreamerCommand("succeed"),
        candidateBatch: null,
        now: ROLE_3_FIXTURE_TIME + 1_000,
      }),
    );

    expect(result.events).toEqual([
      {
        eventType: "quest-cycle.terminal",
        attributes: {
          outcome: "succeeded",
          rewardPointsAwarded: 200,
          hypeDelta: 10,
          historyCandidateId: "role-3-candidate-2",
          cooldownEndsAt: ROLE_3_FIXTURE_TIME + 121_000,
        },
      },
    ]);
  });

  it("accepts gameplay-backed automatic progress when audience state is unavailable", () => {
    const result = decision(
      new DefaultQuestEngine().decide({
        currentState: activeProgressState(),
        command: progressCommand(),
        candidateBatch: null,
        questProgressValidationContext: {
          profile: progressProfile,
          session: progressSession,
          gameplay: progressGameplay(),
          audience: null,
          completionRule: { mode: "signal", allowedSignalKinds: ["objective-progress"] },
        },
        now: ROLE_3_FIXTURE_TIME + 1_000,
      }),
    );

    expect(result.nextState.progress).toEqual({
      value: 0.5,
      updatedAt: ROLE_3_FIXTURE_TIME + 1_000,
      method: "automatic",
      evidenceSignalIds: ["role-3-progress-signal"],
    });
    expect(result.events).toEqual([
      {
        eventType: "quest-cycle.progress-updated",
        attributes: { method: "automatic", value: 0.5 },
      },
    ]);
  });

  it("keeps automatic value 1 non-terminal until manual completion", () => {
    const progressResult = decision(
      new DefaultQuestEngine().decide({
        currentState: activeProgressState(),
        command: progressCommand({ requestedValue: 1 }),
        candidateBatch: null,
        questProgressValidationContext: {
          profile: progressProfile,
          session: progressSession,
          gameplay: progressGameplay({ value: 1 }),
          audience: null,
          completionRule: { mode: "signal", allowedSignalKinds: ["objective-progress"] },
        },
        now: ROLE_3_FIXTURE_TIME + 1_000,
      }),
    );

    expect(progressResult.nextState).toMatchObject({
      status: "active",
      progress: {
        value: 1,
        method: "automatic",
        evidenceSignalIds: ["role-3-progress-signal"],
      },
      completionRule: { mode: "signal", allowedSignalKinds: ["objective-progress"] },
      result: null,
    });
    expect(progressResult.events).toEqual([
      {
        eventType: "quest-cycle.progress-updated",
        attributes: { method: "automatic", value: 1 },
      },
    ]);

    const completionResult = decision(
      new DefaultQuestEngine().decide({
        currentState: progressResult.nextState,
        command: role3StreamerCommand("succeed"),
        candidateBatch: null,
        now: ROLE_3_FIXTURE_TIME + 2_000,
      }),
    );

    expect(completionResult.nextState).toMatchObject({
      status: "succeeded",
      progress: { value: 1, method: "manual" },
      completionRule: null,
      result: {
        outcome: "succeeded",
        rewardPointsAwarded: 100,
        reason: "Streamer marked the active quest as succeeded.",
      },
    });
    expect(completionResult.events).toEqual([
      {
        eventType: "quest-cycle.terminal",
        attributes: {
          outcome: "succeeded",
          rewardPointsAwarded: 100,
          hypeDelta: 10,
          historyCandidateId: "role-3-candidate-1",
          cooldownEndsAt: ROLE_3_FIXTURE_TIME + 122_000,
        },
      },
    ]);
  });

  it.each([
    [
      "null active rule",
      null,
      { mode: "signal", allowedSignalKinds: ["objective-progress"] },
      "completion-rule-unavailable",
    ],
    [
      "manual active rule",
      { mode: "manual", allowedSignalKinds: [] },
      { mode: "signal", allowedSignalKinds: ["objective-progress"] },
      "completion-rule-unavailable",
    ],
    [
      "mismatched context rule",
      { mode: "signal", allowedSignalKinds: ["objective-progress"] },
      { mode: "signal", allowedSignalKinds: ["another-progress"] },
      "completion-rule-mismatch",
    ],
  ] as const)(
    "fails closed when automatic progress receives %s",
    (_label, activeRule, contextRule, reason) => {
      const activeCompletionRule: QuestCompletionRule | null =
        activeRule === null
          ? null
          : { mode: activeRule.mode, allowedSignalKinds: [...activeRule.allowedSignalKinds] };
      const suppliedCompletionRule: QuestCompletionRule = {
        mode: contextRule.mode,
        allowedSignalKinds: [...contextRule.allowedSignalKinds],
      };
      const result = new DefaultQuestEngine().decide({
        currentState: activeProgressState(null, activeCompletionRule),
        command: progressCommand({ requestedValue: 1 }),
        candidateBatch: null,
        questProgressValidationContext: {
          profile: progressProfile,
          session: progressSession,
          gameplay: progressGameplay({ value: 1 }),
          audience: null,
          completionRule: suppliedCompletionRule,
        },
        now: ROLE_3_FIXTURE_TIME + 1_000,
      });

      expect(result).toMatchObject({
        ok: false,
        error: { code: "validation", details: { reason } },
      });
    },
  );

  it.each([
    ["missing-evidence", { gameplay: null }],
    ["unknown-evidence", { gameplay: progressGameplay({ status: "unknown" }) }],
    [
      "contradictory-evidence",
      { gameplay: progressGameplay({ status: "unknown", unknownReason: "conflicting" }) },
    ],
    [
      "blocked-gameplay-context",
      {
        gameplay: progressGameplay({
          kind: "scene-transition",
          value: true,
          supportedSignals: ["scene-transition"],
        }),
      },
    ],
    ["unsupported-evidence", { gameplay: progressGameplay({ supportedSignals: [] }) }],
    [
      "disallowed-evidence",
      {
        gameplay: progressGameplay({
          kind: "disallowed-signal",
          supportedSignals: ["disallowed-signal"],
        }),
      },
    ],
    [
      "low-confidence-evidence",
      {
        gameplay: progressGameplay({
          confidence: AUTOMATIC_PROGRESS_MINIMUM_CONFIDENCE - 0.01,
        }),
      },
    ],
    [
      "stale-evidence",
      {
        gameplay: progressGameplay({
          observedAt: ROLE_3_FIXTURE_TIME - MAXIMUM_SIGNAL_AGE_MILLISECONDS - 1,
        }),
      },
    ],
  ] as const)("rejects automatic engine progress with %s", (reason, patch) => {
    const result = new DefaultQuestEngine().decide({
      currentState: activeProgressState(),
      command: progressCommand(),
      candidateBatch: null,
      questProgressValidationContext: {
        profile: progressProfile,
        session: progressSession,
        gameplay: patch.gameplay,
        audience: emptyProgressAudience,
        completionRule: { mode: "signal", allowedSignalKinds: ["objective-progress"] },
      },
      now: ROLE_3_FIXTURE_TIME + 1_000,
    });

    expect(result).toMatchObject({
      ok: false,
      error: { code: "validation", details: { reason } },
    });
  });

  it("keeps broad visual completion evidence on the manual fallback path", () => {
    const result = new DefaultQuestEngine().decide({
      currentState: activeProgressState(null, {
        mode: "signal",
        allowedSignalKinds: ["activity-intensity"],
      }),
      command: progressCommand({ requestedValue: 1 }),
      candidateBatch: null,
      questProgressValidationContext: {
        profile: progressProfile,
        session: progressSession,
        gameplay: progressGameplay({
          kind: "activity-intensity",
          value: 1,
          supportedSignals: ["activity-intensity"],
        }),
        audience: null,
        completionRule: { mode: "signal", allowedSignalKinds: ["activity-intensity"] },
      },
      now: ROLE_3_FIXTURE_TIME + 1_000,
    });

    expect(result).toMatchObject({
      ok: false,
      error: {
        code: "validation",
        details: { reason: "ambiguous-completion-evidence" },
      },
    });
  });

  it("rejects calibrated progress evidence from another saved game", () => {
    const expectedGameProfile = streamerProfileSchema.parse({
      ...progressProfile,
      gameId: "expected-game",
      gameName: "Expected Game",
    });
    const result = new DefaultQuestEngine().decide({
      currentState: activeProgressState(),
      command: progressCommand(),
      candidateBatch: null,
      questProgressValidationContext: {
        profile: expectedGameProfile,
        session: progressSession,
        gameplay: progressGameplay({ gameId: "another-game" }),
        audience: null,
        completionRule: { mode: "signal", allowedSignalKinds: ["objective-progress"] },
      },
      now: ROLE_3_FIXTURE_TIME + 1_000,
    });

    expect(result).toMatchObject({
      ok: false,
      error: { code: "validation", details: { reason: "cross-game-evidence" } },
    });
  });

  it("keeps automatic progress monotonic at the engine transition boundary", () => {
    const currentProgress = {
      value: 0.75,
      updatedAt: ROLE_3_FIXTURE_TIME,
      method: "automatic" as const,
      evidenceSignalIds: ["role-3-previous-progress-signal"],
    };
    const result = new DefaultQuestEngine().decide({
      currentState: activeProgressState(currentProgress),
      command: progressCommand({ requestedValue: 0.5 }),
      candidateBatch: null,
      questProgressValidationContext: {
        profile: progressProfile,
        session: progressSession,
        gameplay: progressGameplay(),
        audience: null,
        completionRule: { mode: "signal", allowedSignalKinds: ["objective-progress"] },
      },
      now: ROLE_3_FIXTURE_TIME + 1_000,
    });

    expect(result).toMatchObject({
      ok: false,
      error: { code: "validation", details: { reason: "progress-regression" } },
    });
  });

  it("does not bypass cooldown with an intelligence-ready command", () => {
    const cooldown = questCycleStateSchema.parse({
      ...role3FixtureIdleState,
      status: "cooldown",
      endsAt: ROLE_3_FIXTURE_TIME + 120_000,
    });
    const result = new DefaultQuestEngine().decide({
      currentState: cooldown,
      command: role3IntelligenceCommand(),
      candidateBatch: role3FixtureCandidateBatch,
      now: ROLE_3_FIXTURE_TIME,
    });

    expect(result).toMatchObject({
      ok: false,
      error: { code: "forbidden", details: { status: "cooldown" } },
    });
  });

  it("keeps early active ticks as deterministic no-ops", () => {
    const currentState = activeProgressState();
    const result = decision(
      new DefaultQuestEngine().decide({
        currentState,
        command: tickCommand(),
        candidateBatch: null,
        now: ROLE_3_FIXTURE_TIME + 59_999,
      }),
    );

    expect(result.nextState).toEqual(currentState);
    expect(result.events).toEqual([]);
  });

  it("expires an active quest at its authoritative deadline", () => {
    const result = decision(
      new DefaultQuestEngine().decide({
        currentState: activeProgressState({
          value: 0.5,
          updatedAt: ROLE_3_FIXTURE_TIME + 10_000,
          method: "manual",
          evidenceSignalIds: [],
        }),
        command: tickCommand(),
        candidateBatch: null,
        now: ROLE_3_FIXTURE_TIME + 60_000,
      }),
    );

    expect(result.nextState).toMatchObject({
      status: "expired",
      availableStreamerActions: [],
      endsAt: ROLE_3_FIXTURE_TIME + 60_000,
      progress: { value: 0.5, method: "manual" },
      completionRule: null,
      result: {
        outcome: "expired",
        occurredAt: ROLE_3_FIXTURE_TIME + 60_000,
        rewardPointsAwarded: 0,
        reason: "The active quest reached its authoritative deadline.",
      },
    });
    expect(result.events).toEqual([
      {
        eventType: "quest-cycle.terminal",
        attributes: {
          outcome: "expired",
          rewardPointsAwarded: 0,
          hypeDelta: 0,
          historyCandidateId: "role-3-candidate-1",
          cooldownEndsAt: ROLE_3_FIXTURE_TIME + 180_000,
        },
      },
    ]);
  });

  it("moves terminal state through cooldown and resets to idle at the absolute deadline", () => {
    const engine = new DefaultQuestEngine();
    const expired = decision(
      engine.decide({
        currentState: activeProgressState(),
        command: tickCommand(),
        candidateBatch: null,
        now: ROLE_3_FIXTURE_TIME + 60_000,
      }),
    ).nextState;
    const cooldown = decision(
      engine.decide({
        currentState: expired,
        command: tickCommand(),
        candidateBatch: null,
        now: ROLE_3_FIXTURE_TIME + 60_001,
      }),
    );

    expect(cooldown.nextState).toMatchObject({
      status: "cooldown",
      startsAt: ROLE_3_FIXTURE_TIME + 60_000,
      endsAt: ROLE_3_FIXTURE_TIME + 180_000,
      result: { outcome: "expired" },
    });
    expect(cooldown.events).toEqual([
      {
        eventType: "quest-cycle.cooldown-started",
        attributes: {
          cooldownEndsAt: ROLE_3_FIXTURE_TIME + 180_000,
          previousOutcome: "expired",
        },
      },
    ]);

    const earlyTick = decision(
      engine.decide({
        currentState: cooldown.nextState,
        command: tickCommand(),
        candidateBatch: null,
        now: ROLE_3_FIXTURE_TIME + 179_999,
      }),
    );
    expect(earlyTick.nextState).toEqual(cooldown.nextState);
    expect(earlyTick.events).toEqual([]);

    const idle = decision(
      engine.decide({
        currentState: cooldown.nextState,
        command: tickCommand(),
        candidateBatch: null,
        now: ROLE_3_FIXTURE_TIME + 180_000,
      }),
    );
    expect(idle.nextState).toMatchObject({
      status: "idle",
      options: [],
      activeCandidateId: null,
      availableStreamerActions: [],
      voteTallies: [],
      startsAt: null,
      endsAt: null,
      progress: null,
      completionRule: null,
      result: null,
    });
    expect(idle.events).toEqual([
      {
        eventType: "quest-cycle.cooldown-ended",
        attributes: { previousOutcome: "expired" },
      },
    ]);
  });

  it("anchors a delayed active expiry to its deadline and traverses every elapsed boundary", () => {
    const result = decision(
      new DefaultQuestEngine().decide({
        currentState: activeProgressState(),
        command: tickCommand(),
        candidateBatch: null,
        now: ROLE_3_FIXTURE_TIME + 180_000,
      }),
    );

    expect(result.nextState).toMatchObject({
      status: "idle",
      options: [],
      activeCandidateId: null,
      startsAt: null,
      endsAt: null,
      result: null,
    });
    expect(result.events).toEqual([
      {
        eventType: "quest-cycle.terminal",
        attributes: {
          outcome: "expired",
          rewardPointsAwarded: 0,
          hypeDelta: 0,
          historyCandidateId: "role-3-candidate-1",
          cooldownEndsAt: ROLE_3_FIXTURE_TIME + 180_000,
        },
      },
      {
        eventType: "quest-cycle.cooldown-started",
        attributes: {
          cooldownEndsAt: ROLE_3_FIXTURE_TIME + 180_000,
          previousOutcome: "expired",
        },
      },
      {
        eventType: "quest-cycle.cooldown-ended",
        attributes: { previousOutcome: "expired" },
      },
    ]);
  });

  it("skips an already elapsed cooldown when a terminal tick arrives late", () => {
    const terminalState = questCycleStateSchema.parse({
      ...activeProgressState(),
      status: "failed",
      availableStreamerActions: [],
      endsAt: ROLE_3_FIXTURE_TIME,
      completionRule: null,
      result: {
        outcome: "failed",
        occurredAt: ROLE_3_FIXTURE_TIME,
        reason: "Fixture terminal result.",
        rewardPointsAwarded: 0,
      },
    });
    const result = decision(
      new DefaultQuestEngine().decide({
        currentState: terminalState,
        command: tickCommand(),
        candidateBatch: null,
        now: ROLE_3_FIXTURE_TIME + 120_000,
      }),
    );

    expect(result.nextState.status).toBe("idle");
    expect(result.events).toEqual([
      {
        eventType: "quest-cycle.cooldown-started",
        attributes: {
          cooldownEndsAt: ROLE_3_FIXTURE_TIME + 120_000,
          previousOutcome: "failed",
        },
      },
      {
        eventType: "quest-cycle.cooldown-ended",
        attributes: { previousOutcome: "failed" },
      },
    ]);
  });

  it.each([
    [
      "active state without a deadline",
      questCycleStateSchema.parse({ ...activeProgressState(), endsAt: null }),
      "Active quest tick requires an authoritative deadline",
    ],
    [
      "terminal state without a result",
      questCycleStateSchema.parse({
        ...activeProgressState(),
        status: "failed",
        availableStreamerActions: [],
        completionRule: null,
        result: null,
      }),
      "Terminal quest tick requires a matching authoritative result",
    ],
    [
      "cooldown state without a terminal result",
      questCycleStateSchema.parse({
        ...role3FixtureIdleState,
        status: "cooldown",
        endsAt: null,
      }),
      "Cooldown tick requires an authoritative terminal result",
    ],
    [
      "cooldown state with a result timestamp that does not match its start",
      questCycleStateSchema.parse({
        ...role3FixtureIdleState,
        status: "cooldown",
        startsAt: ROLE_3_FIXTURE_TIME + 1,
        endsAt: ROLE_3_FIXTURE_TIME + 120_000,
        result: {
          outcome: "failed",
          occurredAt: ROLE_3_FIXTURE_TIME,
          reason: "Fixture terminal result.",
          rewardPointsAwarded: 0,
        },
      }),
      "Cooldown state does not match its authoritative terminal result",
    ],
    [
      "cooldown state with a deadline that does not match its result",
      questCycleStateSchema.parse({
        ...role3FixtureIdleState,
        status: "cooldown",
        startsAt: ROLE_3_FIXTURE_TIME,
        endsAt: ROLE_3_FIXTURE_TIME + 120_001,
        result: {
          outcome: "failed",
          occurredAt: ROLE_3_FIXTURE_TIME,
          reason: "Fixture terminal result.",
          rewardPointsAwarded: 0,
        },
      }),
      "Cooldown state does not match its authoritative terminal result",
    ],
  ] as const)("fails closed for %s", (_label, currentState, message) => {
    const result = new DefaultQuestEngine().decide({
      currentState,
      command: tickCommand(),
      candidateBatch: null,
      now: ROLE_3_FIXTURE_TIME + 60_000,
    });

    expect(result).toMatchObject({
      ok: false,
      error: { code: "validation", message },
    });
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
