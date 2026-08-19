import { describe, expect, it } from "vitest";

import {
  audiencePointerAggregateSchema,
  streamerLiveDirectorIntentCommandSchema,
  systemLiveDirectorContextCommandSchema,
  type AudiencePointerAggregate,
} from "../contracts";
import {
  contractFixtureAudiencePointerAggregate,
  contractFixtureAudienceSnapshot,
  contractFixtureGameplaySnapshot,
  contractFixtureLiveDirectorState,
  contractFixtureProfile,
  contractFixtureQuestCycle,
  contractFixtureSession,
} from "../testing/fixtures";
import {
  LiveDirectorContextCompositionError,
  applyDeclaredStreamIntent,
  composeAudiencePointer,
  composeLiveDirectorContext,
} from "./live-director-context";
import type { AuthoritativeSessionState } from "./types";

const NOW = contractFixtureAudiencePointerAggregate.createdAt;

function state(): AuthoritativeSessionState {
  return {
    session: structuredClone(contractFixtureSession),
    profile: structuredClone(contractFixtureProfile),
    services: [],
    gameplay: structuredClone(contractFixtureGameplaySnapshot),
    audience: structuredClone(contractFixtureAudienceSnapshot),
    questCycle: structuredClone(contractFixtureQuestCycle),
    emergencyPaused: false,
    communityHype: 0,
  };
}

function intentCommand(
  commandId = "intent-command",
  action: "set" | "clear" = "set",
) {
  return streamerLiveDirectorIntentCommandSchema.parse({
    contractVersion: "1.0.0",
    sessionId: contractFixtureSession.sessionId,
    questCycleId: null,
    commandId,
    correlationId: `correlation-${commandId}`,
    expectedRevision: 0,
    issuedAt: NOW - 1,
    actor: { kind: "broadcaster", actorId: contractFixtureSession.broadcasterId },
    type: "streamer.live-director-intent",
    action,
    intent:
      action === "set"
        ? {
            goal: "Reach the next safe shelter",
            objective: "Explore carefully while involving chat in the route choice.",
            desiredAudienceInvolvement: "Vote on the next safe route.",
            requestedExpiresAt: NOW + 600_000,
          }
        : null,
  });
}

function contextCommand(pointerId: string | null = "fixture-pointer") {
  return systemLiveDirectorContextCommandSchema.parse({
    contractVersion: "1.0.0",
    sessionId: contractFixtureSession.sessionId,
    questCycleId: contractFixtureQuestCycle.envelope.questCycleId,
    commandId: "context-command",
    correlationId: "correlation-context-command",
    expectedRevision: 0,
    issuedAt: NOW,
    actor: { kind: "system", actorId: "fixture-orchestrator" },
    type: "system.live-director-context-ready",
    liveContextId: "composed-live-context",
    audiencePointerId: pointerId,
  });
}

function stateWithIntent(): AuthoritativeSessionState {
  const current = state();
  return {
    ...current,
    liveDirector: applyDeclaredStreamIntent(current, intentCommand(), NOW),
  };
}

function unresolvedAggregate(
  status: "unknown" | "conflicting" | "ambiguous" | "permission-denied",
): AudiencePointerAggregate {
  return audiencePointerAggregateSchema.parse({
    envelope: contractFixtureAudiencePointerAggregate.envelope,
    pointerId: "fixture-pointer",
    status,
    reason: `Fixture ${status} audience aggregate.`,
    observedAt: contractFixtureAudiencePointerAggregate.observedAt,
    evidenceSignalIds: ["fixture-audience-topic"],
  });
}

describe("Live Director context composition", () => {
  it("applies broadcaster intent without inferring it and invalidates older derived context", () => {
    const current = {
      ...state(),
      liveDirector: structuredClone(contractFixtureLiveDirectorState),
    };
    const updated = applyDeclaredStreamIntent(current, intentCommand("new-intent"), NOW);

    expect(updated.declaredIntent).toMatchObject({
      status: "known",
      intentId: "new-intent",
      authorId: contractFixtureSession.broadcasterId,
      updatedAt: NOW,
    });
    expect(updated.liveContext).toBeNull();
    expect(updated.audiencePointer).toBeNull();
    expect(updated.cue).toBeNull();
    expect(updated.publicContext).toBeNull();

    const cleared = applyDeclaredStreamIntent(
      { ...current, liveDirector: updated },
      intentCommand("clear-intent", "clear"),
      NOW + 1,
    );
    expect(cleared.declaredIntent).toEqual({
      status: "unknown",
      reason: "cleared",
      observedAt: NOW + 1,
    });
  });

  it("rejects an intent that expires before server acceptance", () => {
    const command = streamerLiveDirectorIntentCommandSchema.parse({
      ...intentCommand("expired-intent"),
      issuedAt: NOW - 2_000,
      intent: {
        ...intentCommand("expired-intent").intent!,
        requestedExpiresAt: NOW - 1_000,
      },
    });
    expect(() => applyDeclaredStreamIntent(state(), command, NOW)).toThrow(
      LiveDirectorContextCompositionError,
    );
  });

  it("deduplicates repeated participant content and retains only aggregate counts", () => {
    const pointer = composeAudiencePointer(contractFixtureAudiencePointerAggregate, NOW);

    expect(pointer).toMatchObject({
      status: "known",
      uniqueParticipants: 3,
      qualifyingMessages: 5,
    });
    const persisted = JSON.stringify(pointer);
    expect(persisted).not.toContain("participantKey");
    expect(persisted).not.toContain("messageFingerprint");
    expect(persisted).not.toContain("ephemeral-participant");
  });

  it("keeps a single participant as sparse evidence without calling it consensus", () => {
    const aggregate = audiencePointerAggregateSchema.parse({
      ...structuredClone(contractFixtureAudiencePointerAggregate),
      evidence: [contractFixtureAudiencePointerAggregate.evidence[0]],
    });
    const pointer = composeAudiencePointer(aggregate, NOW);

    expect(pointer).toMatchObject({
      status: "known",
      uniqueParticipants: 1,
      qualifyingMessages: 1,
    });
    expect(JSON.stringify(pointer).toLocaleLowerCase()).not.toContain("consensus");
  });

  it("removes deleted or cleared chat evidence instead of retaining its references", () => {
    const aggregate = audiencePointerAggregateSchema.parse({
      ...structuredClone(contractFixtureAudiencePointerAggregate),
      evidence: contractFixtureAudiencePointerAggregate.evidence.map((evidence) => ({
        ...evidence,
        deleted: true,
      })),
    });
    const pointer = composeAudiencePointer(aggregate, NOW);

    expect(pointer).toEqual({
      status: "unknown",
      reason: "Qualifying audience evidence was deleted or cleared.",
      observedAt: contractFixtureAudiencePointerAggregate.observedAt,
      evidenceSignalIds: [],
    });
  });

  it.each(["conflicting", "ambiguous", "permission-denied"] as const)(
    "preserves an honest %s audience state without inventing a topic",
    (status) => {
      const composed = composeLiveDirectorContext({
        state: stateWithIntent(),
        command: contextCommand(),
        aggregate: unresolvedAggregate(status),
        acceptedAt: NOW,
      });

      expect(composed.audiencePointer?.status).toBe(status);
      expect(composed.liveContext?.audiencePointerId).toBeNull();
      expect(
        composed.liveContext?.facts.find((fact) => fact.sourceClass === "audience-derived"),
      ).toMatchObject({ value: null });
    },
  );

  it("composes separate streamer, gameplay, and audience facts for Role 3", () => {
    const composed = composeLiveDirectorContext({
      state: stateWithIntent(),
      command: contextCommand(),
      aggregate: contractFixtureAudiencePointerAggregate,
      acceptedAt: NOW,
    });

    expect(composed.liveContext?.facts.map((fact) => fact.sourceClass)).toEqual(
      expect.arrayContaining(["streamer-declared", "gameplay-observed", "audience-derived"]),
    );
    expect(composed.liveContext?.declaredIntentId).toBe("intent-command");
    expect(composed.liveContext?.audiencePointerId).toBe("fixture-pointer");
    expect(composed.privacy).toEqual({
      rawChatRetained: false,
      usernamesIncluded: false,
      viewerIdentifiersIncluded: false,
      providerPayloadIncluded: false,
    });
  });

  it("uses unknown streamer and audience facts when neither source was supplied", () => {
    const composed = composeLiveDirectorContext({
      state: state(),
      command: contextCommand(null),
      aggregate: null,
      acceptedAt: NOW,
    });
    const streamerFact = composed.liveContext?.facts.find(
      (fact) => fact.sourceClass === "streamer-declared",
    );
    const audienceFactValue = composed.liveContext?.facts.find(
      (fact) => fact.sourceClass === "audience-derived",
    );

    expect(composed.declaredIntent).toMatchObject({ status: "unknown", reason: "not-set" });
    expect(streamerFact).toMatchObject({ status: "unknown", value: null });
    expect(audienceFactValue).toMatchObject({ status: "unknown", value: null });
  });

  it("does not present a future-dated gameplay observation as known", () => {
    const current = stateWithIntent();
    const composed = composeLiveDirectorContext({
      state: {
        ...current,
        gameplay: {
          ...structuredClone(contractFixtureGameplaySnapshot),
          signals: [
            {
              signalId: "future-activity",
              kind: "activity-intensity",
              observation: {
                status: "known",
                value: 0.2,
                provenance: {
                  source: "test-fixture",
                  method: "future-clock-fixture",
                  confidence: 0.9,
                  observedAt: NOW + 100,
                  receivedAt: NOW + 100,
                  evidenceClass: "fixture",
                },
              },
            },
          ],
        },
      },
      command: contextCommand(),
      aggregate: contractFixtureAudiencePointerAggregate,
      acceptedAt: NOW,
    });

    expect(
      composed.liveContext?.facts.find((fact) => fact.factId.includes("future-activity")),
    ).toMatchObject({ status: "unknown", value: null, confidence: 0 });
  });

  it("marks expired pointer input stale while preserving its original evidence window", () => {
    const acceptedAt = contractFixtureAudiencePointerAggregate.expiresAt;
    const composed = composeLiveDirectorContext({
      state: stateWithIntent(),
      command: contextCommand(),
      aggregate: contractFixtureAudiencePointerAggregate,
      acceptedAt,
    });

    expect(composed.audiencePointer).toMatchObject({
      status: "stale",
      staleAt: acceptedAt,
      windowStartedAt: contractFixtureAudiencePointerAggregate.windowStartedAt,
      windowEndedAt: contractFixtureAudiencePointerAggregate.windowEndedAt,
    });
  });

  it("marks expired declared intent stale instead of fabricating a replacement goal", () => {
    const current = state();
    const shortIntent = streamerLiveDirectorIntentCommandSchema.parse({
      ...intentCommand("short-intent"),
      intent: {
        ...intentCommand("short-intent").intent!,
        requestedExpiresAt: NOW + 1_000,
      },
    });
    const withIntent = {
      ...current,
      liveDirector: applyDeclaredStreamIntent(current, shortIntent, NOW),
    };
    const composed = composeLiveDirectorContext({
      state: withIntent,
      command: contextCommand(),
      aggregate: contractFixtureAudiencePointerAggregate,
      acceptedAt: NOW + 1_000,
    });

    expect(composed.declaredIntent).toMatchObject({
      status: "stale",
      intentId: "short-intent",
      staleAt: NOW + 1_000,
    });
    expect(
      composed.liveContext?.facts.find((fact) => fact.sourceClass === "streamer-declared"),
    ).toMatchObject({
      status: "stale",
      value: "Explore carefully while involving chat in the route choice.",
    });
  });
});
