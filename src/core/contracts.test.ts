import { describe, expect, it } from "vitest";

import {
  CONTRACT_VERSION,
  acceptedVoteTallySnapshotSchema,
  audiencePointerAggregateSchema,
  candidateBatchSchema,
  commandEnvelopeSchema,
  contractEnvelopeSchema,
  directorCueSchema,
  gameplayCapabilitiesSchema,
  gameplaySnapshotSchema,
  intelligenceSnapshotSchema,
  liveDirectorInterventionRecordSchema,
  liveDirectorStateSchema,
  overlayViewModelSchema,
  questCompletionRuleSchema,
  questCycleStateSchema,
  sessionHistorySnapshotSchema,
  signalObservationSchema,
  streamSessionSchema,
  streamerReadinessViewSchema,
  streamerServiceCommandSchema,
  streamerSetupServiceSchema,
  streamerProfileSettingsCommandSchema,
  streamerLiveDirectorCueCommandSchema,
  streamerLiveDirectorIntentCommandSchema,
  streamerProfileSchema,
  streamerViewModelSchema,
  viewerViewModelSchema,
  voteSchema,
} from "./contracts";
import {
  contractFixtureCandidateBatch,
  contractFixtureAudiencePointerAggregate,
  contractFixtureEnvelope,
  contractFixtureGameplaySnapshot,
  contractFixtureLiveDirectorIntervention,
  contractFixtureLiveDirectorState,
  contractFixtureLiveDirectorStateCatalog,
  contractFixtureAudienceSnapshot,
  contractFixtureOverlayView,
  contractFixtureProfile,
  contractFixtureQuestCycle,
  contractFixtureSession,
  contractFixtureStreamerView,
  contractFixtureUiX01ReadinessCatalog,
  contractFixtureUiX04SessionHistory,
  contractFixtureUiX06QuestStateCatalog,
  contractFixtureUiX06RoleViewCatalog,
  contractFixtureViewerView,
  invalidCalibratedCapabilitiesWithoutAdapter,
  invalidLiveFixtureEnvelope,
  invalidShortCandidateBatch,
  invalidUnknownSignalWithValue,
} from "./testing";

describe("canonical contract envelope", () => {
  it("accepts the canonical fixture and exact contract version", () => {
    expect(contractEnvelopeSchema.parse(contractFixtureEnvelope).contractVersion).toBe(CONTRACT_VERSION);
  });

  it("rejects a fixture falsely labelled as live evidence", () => {
    expect(
      contractEnvelopeSchema.safeParse(invalidLiveFixtureEnvelope).success,
    ).toBe(false);
  });

  it("rejects receipt timestamps earlier than occurrence timestamps", () => {
    expect(
      contractEnvelopeSchema.safeParse({
        ...contractFixtureEnvelope,
        receivedAt: contractFixtureEnvelope.occurredAt - 1,
      }).success,
    ).toBe(false);
  });
});

describe("signal and capability truthfulness", () => {
  it("does not allow an unknown signal to carry a claimed value", () => {
    expect(
      signalObservationSchema.safeParse(invalidUnknownSignalWithValue).success,
    ).toBe(false);
  });

  it("rejects intelligence assembled from a different gameplay session", () => {
    expect(
      intelligenceSnapshotSchema.safeParse({
        envelope: contractFixtureEnvelope,
        gameplay: {
          ...contractFixtureGameplaySnapshot,
          envelope: {
            ...contractFixtureGameplaySnapshot.envelope,
            sessionId: "different-session",
          },
        },
        audience: contractFixtureAudienceSnapshot,
      }).success,
    ).toBe(false);
  });

  it("rejects intelligence that relabels fixture snapshots as live evidence", () => {
    expect(
      intelligenceSnapshotSchema.safeParse({
        envelope: {
          ...contractFixtureEnvelope,
          source: "algorithm",
          evidenceClass: "live",
        },
        gameplay: contractFixtureGameplaySnapshot,
        audience: contractFixtureAudienceSnapshot,
      }).success,
    ).toBe(false);
  });

  it("rejects fixture provenance inside a snapshot labelled as live", () => {
    expect(
      gameplayCapabilitiesSchema.safeParse(contractFixtureGameplaySnapshot.capabilities).success,
    ).toBe(true);
    expect(
      // The nested signal remains fixture-derived, so relabelling only the envelope cannot create live evidence.
      // This is deliberately constructed invalid data for the contract test.
      contractFixtureGameplaySnapshot.envelope.evidenceClass,
    ).toBe("fixture");

    const liveEnvelope = {
      ...contractFixtureGameplaySnapshot.envelope,
      source: "obs-virtual-camera" as const,
      evidenceClass: "live" as const,
    };
    const result = gameplaySnapshotSchema.safeParse({
      ...contractFixtureGameplaySnapshot,
      envelope: liveEnvelope,
    });
    expect(result.success).toBe(false);
  });

  it("requires calibrated HUD observations to identify their adapter", () => {
    expect(
      gameplayCapabilitiesSchema.safeParse(invalidCalibratedCapabilitiesWithoutAdapter).success,
    ).toBe(false);
  });
});

describe("Live Director contract and privacy spine", () => {
  it("accepts only privacy-safe ephemeral audience-pointer aggregate inputs", () => {
    expect(
      audiencePointerAggregateSchema.safeParse(contractFixtureAudiencePointerAggregate).success,
    ).toBe(true);
    expect(
      audiencePointerAggregateSchema.safeParse({
        ...structuredClone(contractFixtureAudiencePointerAggregate),
        rawChat: ["private chat must never enter this seam"],
      }).success,
    ).toBe(false);
    expect(
      audiencePointerAggregateSchema.safeParse({
        ...structuredClone(contractFixtureAudiencePointerAggregate),
        envelope: {
          ...structuredClone(contractFixtureAudiencePointerAggregate.envelope),
          source: "twitch",
        },
      }).success,
    ).toBe(false);
  });

  it("publishes known, unknown, stale, conflicting, and privacy-denied fixtures", () => {
    expect(Object.keys(contractFixtureLiveDirectorStateCatalog)).toEqual([
      "live-director.known.v1",
      "live-director.unknown.v1",
      "live-director.stale.v1",
      "live-director.conflicting.v1",
      "live-director.privacy-denied.v1",
    ]);
    for (const state of Object.values(contractFixtureLiveDirectorStateCatalog)) {
      expect(liveDirectorStateSchema.safeParse(state).success).toBe(true);
      expect(state.privacy).toEqual({
        rawChatRetained: false,
        usernamesIncluded: false,
        viewerIdentifiersIncluded: false,
        providerPayloadIncluded: false,
      });
    }
  });

  it("keeps source classes separate and rejects mismatched cue/context authority", () => {
    expect(contractFixtureLiveDirectorState.liveContext?.facts.map((fact) => fact.sourceClass)).toEqual(
      expect.arrayContaining(["streamer-declared", "gameplay-observed", "audience-derived"]),
    );
    expect(
      liveDirectorStateSchema.safeParse({
        ...structuredClone(contractFixtureLiveDirectorState),
        cue: {
          ...structuredClone(contractFixtureLiveDirectorState.cue!),
          contextId: "different-context",
        },
      }).success,
    ).toBe(false);
    expect(
      liveDirectorStateSchema.safeParse({
        ...structuredClone(contractFixtureLiveDirectorState),
        rawChat: ["private fixture text"],
      }).success,
    ).toBe(false);
    expect(
      directorCueSchema.safeParse({
        ...structuredClone(contractFixtureLiveDirectorState.cue!),
        state: "expired",
        availableActions: [],
        updatedAt: contractFixtureLiveDirectorState.cue!.expiresAt - 1,
      }).success,
    ).toBe(false);
  });

  it("represents a privacy-safe, explicitly non-causal intervention record", () => {
    expect(
      liveDirectorInterventionRecordSchema.safeParse(contractFixtureLiveDirectorIntervention).success,
    ).toBe(true);
    expect(contractFixtureLiveDirectorIntervention.privacy).toEqual({
      rawChatIncluded: false,
      usernamesIncluded: false,
      viewerIdentifiersIncluded: false,
      privateVoteReceiptsIncluded: false,
      providerPayloadIncluded: false,
    });
    expect(contractFixtureLiveDirectorIntervention).not.toHaveProperty("viewerId");
    expect(contractFixtureLiveDirectorIntervention).not.toHaveProperty("rawChat");
  });
});

describe("candidate and lifecycle boundaries", () => {
  it("requires exactly three distinct candidates", () => {
    expect(candidateBatchSchema.parse(contractFixtureCandidateBatch).candidates).toHaveLength(3);

    const duplicate = structuredClone(contractFixtureCandidateBatch);
    duplicate.candidates[1] = { ...duplicate.candidates[0] };
    expect(candidateBatchSchema.safeParse(duplicate).success).toBe(false);

    expect(candidateBatchSchema.safeParse(invalidShortCandidateBatch).success).toBe(false);
  });

  it("requires an active candidate for active lifecycle state", () => {
    expect(
      questCycleStateSchema.safeParse({
        ...contractFixtureQuestCycle,
        status: "active",
        activeCandidateId: null,
      }).success,
    ).toBe(false);
  });

  it("validates explicit completion predicates and their capability semantics", () => {
    const rule = {
      mode: "signal",
      allowedSignalKinds: ["objective-count", "match-active"],
      predicate: {
        signalKind: "objective-count",
        comparison: "at-least",
        target: 3,
        gameId: "fixture-game",
        corroboratingSignalKinds: ["match-active"],
      },
    };

    expect(questCompletionRuleSchema.safeParse(rule).success).toBe(true);
    expect(
      questCompletionRuleSchema.safeParse({
        ...rule,
        allowedSignalKinds: ["objective-count"],
      }).success,
    ).toBe(false);
    expect(
      questCompletionRuleSchema.safeParse({
        ...rule,
        predicate: { ...rule.predicate, comparison: "at-least", target: "three" },
      }).success,
    ).toBe(false);
    expect(
      questCompletionRuleSchema.safeParse({
        mode: "manual",
        allowedSignalKinds: [],
        predicate: rule.predicate,
      }).success,
    ).toBe(false);
  });

  it("publishes UI-X06 quest-state and role-view examples for UI consumers", () => {
    expect(Object.keys(contractFixtureUiX06QuestStateCatalog)).toEqual(
      expect.arrayContaining([
        "r5.quest.idle.v1",
        "r4.quest.proposed.v1",
        "r5.vote.zero-vote.v1",
        "r5.vote.tie.v1",
        "r5.quest.active-manual-progress.v1",
        "r5.quest.active-automatic-progress.v1",
        "r5.quest.succeeded-reward.v1",
        "r5.quest.failed.v1",
        "r5.quest.cancelled.v1",
        "r5.quest.skipped.v1",
        "r5.quest.expired.v1",
        "r4.quest.cooldown.v1",
      ]),
    );

    for (const [fixtureId, questState] of Object.entries(contractFixtureUiX06QuestStateCatalog)) {
      expect(questCycleStateSchema.safeParse(questState).success).toBe(true);
      expect(questState.envelope.evidenceClass).toBe("fixture");
      expect(
        contractFixtureUiX06RoleViewCatalog[
          fixtureId as keyof typeof contractFixtureUiX06RoleViewCatalog
        ],
      ).toBeDefined();
    }

    const zeroVote = contractFixtureUiX06QuestStateCatalog["r5.vote.zero-vote.v1"];
    expect(zeroVote.voteTallies.every((tally) => tally.votes === 0)).toBe(true);
    expect(
      contractFixtureUiX06RoleViewCatalog["r5.vote.zero-vote.v1"].viewer.acceptedCandidateId,
    ).toBeNull();

    const tie = contractFixtureUiX06QuestStateCatalog["r5.vote.tie.v1"];
    expect(tie.voteTallies.map((tally) => tally.votes)).toEqual([2, 2, 1]);
    expect(contractFixtureUiX06RoleViewCatalog["r5.vote.tie.v1"].viewer.acceptedCandidateId).not.toBeNull();

    expect(contractFixtureUiX06QuestStateCatalog["r5.quest.active-manual-progress.v1"].progress?.method).toBe(
      "manual",
    );
    expect(
      contractFixtureUiX06QuestStateCatalog["r5.quest.active-automatic-progress.v1"].progress?.method,
    ).toBe("automatic");
    expect(contractFixtureUiX06QuestStateCatalog["r5.quest.succeeded-reward.v1"].result).toMatchObject({
      outcome: "succeeded",
      rewardPointsAwarded: 100,
    });
  });
});

describe("identity and command permissions", () => {
  it("accepts an anonymous viewer vote and rejects a viewer streamer command", () => {
    const base = {
      contractVersion: CONTRACT_VERSION,
      sessionId: "fixture-session",
      questCycleId: "fixture-cycle",
      commandId: "fixture-command",
      correlationId: "fixture-correlation",
      expectedRevision: 0,
      issuedAt: 1,
    };

    expect(
      commandEnvelopeSchema.safeParse({
        ...base,
        type: "viewer.vote",
        actor: { kind: "anonymous", actorId: null },
        candidateId: "fixture-candidate-1",
        voterKey: "fixture-voter-key",
        sourceMode: "hosted-board",
      }).success,
    ).toBe(true);

    expect(
      commandEnvelopeSchema.safeParse({
        ...base,
        type: "streamer.quest",
        actor: { kind: "viewer", actorId: "fixture-viewer" },
        action: "skip",
        candidateId: null,
      }).success,
    ).toBe(false);
  });

  it("accepts only neutral system vote-close commands and tally snapshots", () => {
    const closeCommand = {
      contractVersion: CONTRACT_VERSION,
      sessionId: "fixture-session",
      questCycleId: "fixture-cycle",
      commandId: "fixture-vote-close",
      correlationId: "fixture-vote-close-correlation",
      expectedRevision: 4,
      issuedAt: 10,
      actor: { kind: "system", actorId: "fixture-orchestrator" },
      type: "system.vote-close",
    };
    expect(commandEnvelopeSchema.safeParse(closeCommand).success).toBe(true);
    expect(
      commandEnvelopeSchema.safeParse({
        ...closeCommand,
        actor: { kind: "broadcaster", actorId: "fixture-broadcaster" },
      }).success,
    ).toBe(false);

    const tally = {
      sessionId: "fixture-session",
      questCycleId: "fixture-cycle",
      revision: 4,
      closedAt: 10,
      acceptedVoteCount: 3,
      tallies: [
        { candidateId: "fixture-candidate-1", votes: 2 },
        { candidateId: "fixture-candidate-2", votes: 1 },
        { candidateId: "fixture-candidate-3", votes: 0 },
      ],
    };
    expect(acceptedVoteTallySnapshotSchema.safeParse(tally).success).toBe(true);
    expect(
      acceptedVoteTallySnapshotSchema.safeParse({
        ...tally,
        winnerCandidateId: "fixture-candidate-1",
      }).success,
    ).toBe(false);
    expect(
      acceptedVoteTallySnapshotSchema.safeParse({ ...tally, acceptedVoteCount: 4 }).success,
    ).toBe(false);
  });

  it("accepts neutral timer/progress commands without lifecycle or reward authority", () => {
    const base = {
      contractVersion: CONTRACT_VERSION,
      sessionId: "fixture-session",
      questCycleId: "fixture-cycle",
      commandId: "fixture-command",
      correlationId: "fixture-correlation",
      expectedRevision: 4,
      issuedAt: 10,
    };

    expect(
      commandEnvelopeSchema.safeParse({
        ...base,
        type: "system.quest-tick",
        actor: { kind: "system", actorId: "fixture-orchestrator" },
      }).success,
    ).toBe(true);
    expect(
      commandEnvelopeSchema.safeParse({
        ...base,
        type: "system.quest-progress",
        actor: { kind: "system", actorId: "fixture-orchestrator" },
        requestedValue: 0.5,
        evidenceSignalIds: ["fixture-signal"],
        outcome: "succeeded",
      }).success,
    ).toBe(false);
    expect(
      commandEnvelopeSchema.safeParse({
        ...base,
        type: "streamer.quest-progress",
        actor: { kind: "moderator", actorId: "fixture-moderator" },
        requestedValue: 0.5,
      }).success,
    ).toBe(true);
    expect(
      commandEnvelopeSchema.safeParse({
        ...base,
        questCycleId: null,
        type: "streamer.emergency-clear",
        actor: { kind: "broadcaster", actorId: "fixture-broadcaster" },
      }).success,
    ).toBe(true);
  });

  it("accepts broadcaster profile settings commands and rejects moderator or no-op profile edits", () => {
    const base = {
      contractVersion: CONTRACT_VERSION,
      sessionId: "fixture-session",
      questCycleId: null,
      commandId: "fixture-profile-settings",
      correlationId: "fixture-profile-settings-correlation",
      expectedRevision: 4,
      issuedAt: 10,
      type: "streamer.profile-settings",
      experiencePatch: { intensity: 0.8 },
      voting: { voteVisibility: "hidden-until-close" },
      rewards: { rewardDisplay: "session-points" },
    };

    expect(
      commandEnvelopeSchema.safeParse({
        ...base,
        actor: { kind: "broadcaster", actorId: "fixture-broadcaster" },
      }).success,
    ).toBe(true);
    expect(
      commandEnvelopeSchema.safeParse({
        ...base,
        actor: { kind: "moderator", actorId: "fixture-moderator" },
      }).success,
    ).toBe(false);
    expect(
      streamerProfileSettingsCommandSchema.safeParse({
        ...base,
        actor: { kind: "broadcaster", actorId: "fixture-broadcaster" },
        experiencePatch: {},
        voting: {},
        rewards: {},
      }).success,
    ).toBe(false);
    expect(
      streamerProfileSettingsCommandSchema.safeParse({
        ...base,
        actor: { kind: "broadcaster", actorId: "fixture-broadcaster" },
        experiencePatch: {},
        voting: undefined,
        rewards: undefined,
      }).success,
    ).toBe(false);
  });

  it("authorises Live Director intent and cue command classes without client lifecycle authority", () => {
    const base = {
      contractVersion: CONTRACT_VERSION,
      sessionId: "fixture-session",
      questCycleId: "fixture-cycle",
      commandId: "fixture-live-director-command",
      correlationId: "fixture-live-director-correlation",
      expectedRevision: 4,
      issuedAt: 10,
    };
    const intent = {
      ...base,
      questCycleId: null,
      type: "streamer.live-director-intent",
      action: "set",
      intent: {
        goal: "Reach the next shelter",
        objective: "Explore carefully while chat chooses the route.",
        desiredAudienceInvolvement: "Vote on the route.",
        requestedExpiresAt: 1_000,
      },
    };
    expect(
      commandEnvelopeSchema.safeParse({
        ...intent,
        actor: { kind: "broadcaster", actorId: "fixture-broadcaster" },
      }).success,
    ).toBe(true);
    expect(
      commandEnvelopeSchema.safeParse({
        ...intent,
        actor: { kind: "moderator", actorId: "fixture-moderator" },
      }).success,
    ).toBe(false);
    expect(
      streamerLiveDirectorIntentCommandSchema.safeParse({
        ...intent,
        action: "clear",
        actor: { kind: "broadcaster", actorId: "fixture-broadcaster" },
      }).success,
    ).toBe(false);

    const cueAction = {
      ...base,
      type: "streamer.live-director-cue",
      actor: { kind: "moderator", actorId: "fixture-moderator" },
      cueId: "fixture-director-cue",
      action: "later",
    };
    expect(commandEnvelopeSchema.safeParse(cueAction).success).toBe(true);
    expect(
      commandEnvelopeSchema.safeParse({
        ...cueAction,
        actor: { kind: "viewer", actorId: "fixture-viewer" },
      }).success,
    ).toBe(false);
    expect(
      streamerLiveDirectorCueCommandSchema.safeParse({
        ...cueAction,
        outcome: "voting",
      }).success,
    ).toBe(false);

    expect(
      commandEnvelopeSchema.safeParse({
        ...base,
        type: "system.live-director-context-ready",
        actor: { kind: "system", actorId: "fixture-orchestrator" },
        liveContextId: "fixture-live-context",
        audiencePointerId: "fixture-pointer",
      }).success,
    ).toBe(true);
    expect(
      commandEnvelopeSchema.safeParse({
        ...base,
        type: "system.live-director-cue-ready",
        actor: { kind: "broadcaster", actorId: "fixture-broadcaster" },
        cueId: "fixture-director-cue",
        liveContextId: "fixture-live-context",
      }).success,
    ).toBe(false);
  });

  it("accepts broadcaster-only setup/session commands and rejects invalid service action pairs", () => {
    const base = {
      contractVersion: CONTRACT_VERSION,
      sessionId: "fixture-session",
      commandId: "fixture-setup-command",
      correlationId: "fixture-setup-correlation",
      expectedRevision: 4,
      issuedAt: 10,
      actor: { kind: "broadcaster", actorId: "fixture-broadcaster" },
    };

    expect(
      streamerServiceCommandSchema.safeParse({
        ...base,
        type: "streamer.setup",
        service: "obs-capture",
        action: "request-capture-permission",
      }).success,
    ).toBe(true);
    expect(
      streamerServiceCommandSchema.safeParse({
        ...base,
        type: "streamer.session",
        action: "start",
      }).success,
    ).toBe(true);
    expect(
      streamerServiceCommandSchema.safeParse({
        ...base,
        actor: { kind: "moderator", actorId: "fixture-moderator" },
        type: "streamer.setup",
        service: "twitch",
        action: "connect-twitch",
      }).success,
    ).toBe(false);
    expect(
      streamerServiceCommandSchema.safeParse({
        ...base,
        type: "streamer.setup",
        service: "obs-capture",
        action: "connect-twitch",
      }).success,
    ).toBe(false);
    expect(
      streamerSetupServiceSchema.safeParse({
        service: "realtime",
        configured: false,
        health: {
          service: "realtime",
          status: "unavailable",
          checkedAt: 10,
          retryable: true,
        },
        allowedActions: ["connect-twitch"],
      }).success,
    ).toBe(false);
  });

  it("accepts an anonymous fixture vote and rejects a broadcaster vote", () => {
    const vote = {
      envelope: contractFixtureEnvelope,
      voter: { kind: "anonymous", actorId: null },
      voterKey: "fixture-anonymous-key",
      candidateId: "fixture-candidate-1",
      acceptedAt: contractFixtureEnvelope.occurredAt,
      sourceMode: "hosted-board",
    };

    expect(voteSchema.safeParse(vote).success).toBe(true);
    expect(
      voteSchema.safeParse({
        ...vote,
        voter: { kind: "broadcaster", actorId: "fixture-broadcaster" },
      }).success,
    ).toBe(false);
  });
});

describe("streamer profile boundary", () => {
  it("accepts the neutral profile fixture and rejects partial game identity", () => {
    expect(streamerProfileSchema.parse(contractFixtureProfile).gameId).toBeNull();
    expect(streamerProfileSchema.parse(contractFixtureProfile).voting).toMatchObject({
      voteDurationSeconds: 30,
      voteChangesAllowed: false,
    });
    expect(streamerProfileSchema.parse(contractFixtureProfile).rewards).toMatchObject({
      persistentEconomy: false,
      monetaryRewards: false,
    });
    expect(
      streamerProfileSchema.safeParse({
        ...contractFixtureProfile,
        gameId: "fixture-game",
        gameName: null,
      }).success,
    ).toBe(false);
  });

  it("rejects profile preferences that change accepted vote or reward mechanics", () => {
    expect(
      streamerProfileSchema.safeParse({
        ...contractFixtureProfile,
        voting: {
          ...contractFixtureProfile.voting,
          voteDurationSeconds: 45,
        },
      }).success,
    ).toBe(false);
    expect(
      streamerProfileSchema.safeParse({
        ...contractFixtureProfile,
        rewards: {
          ...contractFixtureProfile.rewards,
          persistentEconomy: true,
        },
      }).success,
    ).toBe(false);
  });
});

describe("streamer setup readiness boundary", () => {
  it("publishes UI-X01 setup readiness examples for Studio consumers", () => {
    expect(Object.keys(contractFixtureUiX01ReadinessCatalog)).toEqual(
      expect.arrayContaining([
        "r4.setup.ready.v1",
        "r4.setup.permission-denied.v1",
        "r4.setup.misconfigured.v1",
        "r4.setup.disconnected.v1",
        "r4.setup.diagnostic.v1",
      ]),
    );

    for (const readiness of Object.values(contractFixtureUiX01ReadinessCatalog)) {
      expect(streamerReadinessViewSchema.safeParse(readiness).success).toBe(true);
      expect(readiness.evidenceClass).toBe("fixture");
      expect(readiness.liveInputsUsed).toBe(false);
      expect(readiness.services.map(({ service }) => service).sort()).toEqual([
        "intelligence",
        "obs-capture",
        "realtime",
        "session",
        "twitch",
      ]);
    }

    expect(contractFixtureUiX01ReadinessCatalog["r4.setup.ready.v1"].ready).toBe(true);
    expect(
      contractFixtureUiX01ReadinessCatalog["r4.setup.permission-denied.v1"].services.find(
        (service) => service.service === "obs-capture",
      )?.health.status,
    ).toBe("permission-denied");
    expect(
      contractFixtureUiX01ReadinessCatalog["r4.setup.misconfigured.v1"].recommendedAction,
    ).toBe("connect-twitch");
  });
});

describe("session history boundary", () => {
  it("publishes a privacy-safe session history fixture", () => {
    expect(sessionHistorySnapshotSchema.safeParse(contractFixtureUiX04SessionHistory).success).toBe(true);
    expect(contractFixtureUiX04SessionHistory.evidenceClass).toBe("fixture");
    expect(contractFixtureUiX04SessionHistory.summary).toMatchObject({
      totalQuestCycles: 2,
      succeeded: 1,
      skipped: 1,
      totalAcceptedVotes: 3,
    });
    expect(contractFixtureUiX04SessionHistory.privacy).toMatchObject({
      rawChatHistoryRetained: false,
      viewerIdentifiersIncluded: false,
      privateVoteReceiptsIncluded: false,
    });
    expect(contractFixtureUiX04SessionHistory.entries[0]).not.toHaveProperty("viewerId");
    expect(contractFixtureUiX04SessionHistory.entries[0]).not.toHaveProperty("rawChat");
  });
});

describe("stream session boundary", () => {
  it("accepts the preparing session fixture and rejects an ended session that never started", () => {
    expect(streamSessionSchema.parse(contractFixtureSession).status).toBe("preparing");
    expect(
      streamSessionSchema.safeParse({
        ...contractFixtureSession,
        status: "ended",
        startedAt: null,
        endedAt: contractFixtureEnvelope.occurredAt,
      }).success,
    ).toBe(false);
  });
});

describe("role view-model boundaries", () => {
  it("accepts canonical streamer, viewer, and read-only overlay fixtures", () => {
    expect(streamerViewModelSchema.safeParse(contractFixtureStreamerView).success).toBe(true);
    expect(viewerViewModelSchema.safeParse(contractFixtureViewerView).success).toBe(true);
    expect(overlayViewModelSchema.safeParse(contractFixtureOverlayView).success).toBe(true);
  });

  it("rejects a view whose session revision differs from its envelope revision", () => {
    expect(
      viewerViewModelSchema.safeParse({
        ...contractFixtureViewerView,
        session: { ...contractFixtureViewerView.session, revision: 1 },
      }).success,
    ).toBe(false);
  });

  it("rejects viewer capabilities that disagree with the authoritative session", () => {
    expect(
      viewerViewModelSchema.safeParse({
        ...contractFixtureViewerView,
        capabilities: {
          ...contractFixtureViewerView.capabilities,
          twitchExtension: true,
        },
      }).success,
    ).toBe(false);
  });

  it("structurally excludes private Live Director state from viewer and OBS projections", () => {
    expect(contractFixtureStreamerView.liveDirector?.cue?.reason).toContain("Chat is asking");
    expect(contractFixtureViewerView.liveDirector).toEqual({
      publicContext: contractFixtureLiveDirectorState.publicContext,
    });
    expect(contractFixtureViewerView.liveDirector).not.toHaveProperty("cue");
    expect(contractFixtureViewerView.liveDirector).not.toHaveProperty("audiencePointer");
    expect(contractFixtureOverlayView).not.toHaveProperty("liveDirector");

    expect(
      viewerViewModelSchema.safeParse({
        ...structuredClone(contractFixtureViewerView),
        liveDirector: {
          publicContext: contractFixtureLiveDirectorState.publicContext,
          cue: contractFixtureLiveDirectorState.cue,
        },
      }).success,
    ).toBe(false);
    expect(
      overlayViewModelSchema.safeParse({
        ...structuredClone(contractFixtureOverlayView),
        liveDirector: contractFixtureLiveDirectorState,
      }).success,
    ).toBe(false);
  });
});
