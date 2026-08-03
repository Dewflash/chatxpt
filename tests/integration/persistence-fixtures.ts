import {
  authoritativeSessionStateSchema,
  type AuthoritativeSessionState,
} from "../../src/core";
import {
  contractFixtureAudienceSnapshot,
  contractFixtureGameplaySnapshot,
  contractFixtureProfile,
  contractFixtureQuestCycle,
  contractFixtureSession,
} from "../../src/core/testing";

export const FIXTURE_NOW = contractFixtureSession.createdAt;

export function persistenceState(
  sessionId = contractFixtureSession.sessionId,
  broadcasterId = contractFixtureSession.broadcasterId,
): AuthoritativeSessionState {
  const state = {
    session: {
      ...structuredClone(contractFixtureSession),
      sessionId,
      broadcasterId,
      createdAt: FIXTURE_NOW,
    },
    profile: {
      ...structuredClone(contractFixtureProfile),
      profileId: `profile-${broadcasterId}`,
      streamerId: broadcasterId,
    },
    services: [
      {
        service: "persistence",
        status: "ready" as const,
        checkedAt: FIXTURE_NOW,
        retryable: false,
      },
    ],
    gameplay: {
      ...structuredClone(contractFixtureGameplaySnapshot),
      envelope: {
        ...structuredClone(contractFixtureGameplaySnapshot.envelope),
        sessionId,
        messageId: `gameplay-${sessionId}`,
      },
    },
    audience: {
      ...structuredClone(contractFixtureAudienceSnapshot),
      envelope: {
        ...structuredClone(contractFixtureAudienceSnapshot.envelope),
        sessionId,
        messageId: `audience-${sessionId}`,
      },
    },
    questCycle: {
      ...structuredClone(contractFixtureQuestCycle),
      envelope: {
        ...structuredClone(contractFixtureQuestCycle.envelope),
        sessionId,
        messageId: `cycle-${sessionId}`,
      },
    },
    communityHype: 0,
  };
  return authoritativeSessionStateSchema.parse(state);
}
