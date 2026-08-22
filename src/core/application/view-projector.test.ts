import { describe, expect, it } from "vitest";

import {
  contractFixtureAudienceSnapshot,
  contractFixtureEnvelope,
  contractFixtureGameplaySnapshot,
  contractFixtureLiveDirectorState,
  contractFixtureProfile,
  contractFixtureQuestCycle,
  contractFixtureSession,
} from "../testing";
import { CanonicalViewProjector } from "./view-projector";

function projectorInput() {
  return {
    envelope: contractFixtureEnvelope,
    session: contractFixtureSession,
    profile: contractFixtureProfile,
    services: [],
    gameplay: contractFixtureGameplaySnapshot,
    audience: contractFixtureAudienceSnapshot,
    questCycle: contractFixtureQuestCycle,
    emergencyPaused: false,
    participationMode: "hosted-board" as const,
    capabilities: contractFixtureSession.capabilities,
    viewerId: null,
    sessionPoints: 0,
    communityHype: 0,
    acceptedCandidateId: null,
    connection: {
      service: "fixture-realtime",
      status: "ready" as const,
      checkedAt: contractFixtureEnvelope.receivedAt,
      retryable: false,
    },
    liveDirector: contractFixtureLiveDirectorState,
  };
}

describe("CanonicalViewProjector overlay up next", () => {
  it("hides typed Current Objective without selected-game-compatible gameplay evidence", () => {
    const projected = new CanonicalViewProjector().project(projectorInput());

    expect(projected.overlay.upNext).toBeNull();
    expect(projected.overlay).not.toHaveProperty("liveDirector");
  });

  it("publishes only the typed objective when selected-game gameplay is fresh and known", () => {
    const intent = contractFixtureLiveDirectorState.declaredIntent;
    expect(intent.status).toBe("known");
    if (intent.status !== "known") {
      throw new Error("Fixture declared intent must be known for this projector case.");
    }
    const projected = new CanonicalViewProjector().project({
      ...projectorInput(),
      profile: {
        ...contractFixtureProfile,
        gameId: "brawl-stars",
        gameName: "Brawl Stars",
      },
      session: {
        ...contractFixtureSession,
        currentGame: {
          gameId: "minecraft-java",
          gameName: "Minecraft: Java Edition",
          source: "twitch" as const,
        },
      },
      gameplay: {
        ...contractFixtureGameplaySnapshot,
        capabilities: {
          tier: "universal-visual" as const,
          gameId: "minecraft-java",
          adapterId: null,
          supportedSignals: ["activity-intensity"],
        },
        signals: [
          {
            signalId: "fixture-activity",
            kind: "activity-intensity",
            observation: {
              status: "known" as const,
              value: 0.64,
              provenance: {
                source: "test-fixture" as const,
                method: "contract-fixture",
                confidence: 0.72,
                observedAt: contractFixtureEnvelope.occurredAt,
                receivedAt: contractFixtureEnvelope.receivedAt,
                evidenceClass: "fixture" as const,
              },
            },
          },
        ],
      },
    });

    expect(projected.overlay.upNext).toEqual({
      label: "Up next",
      title: "Reach the next safe shelter",
      detail: "Explore carefully while involving chat in the route choice.",
      expiresAt: intent.expiresAt,
    });
    expect(projected.overlay.upNext).not.toHaveProperty("desiredAudienceInvolvement");
  });

  it("treats universal Generic capture as compatible with explicit Generic stream context", () => {
    const intent = contractFixtureLiveDirectorState.declaredIntent;
    expect(intent.status).toBe("known");
    if (intent.status !== "known") return;
    const knownSignal = {
      signalId: "fixture-generic-activity",
      kind: "activity-intensity",
      observation: {
        status: "known" as const,
        value: 0.64,
        provenance: {
          source: "test-fixture" as const,
          method: "contract-fixture",
          confidence: 0.72,
          observedAt: contractFixtureEnvelope.occurredAt,
          receivedAt: contractFixtureEnvelope.receivedAt,
          evidenceClass: "fixture" as const,
        },
      },
    };

    const projected = new CanonicalViewProjector().project({
      ...projectorInput(),
      session: {
        ...contractFixtureSession,
        currentGame: {
          gameId: "generic",
          gameName: "Current Game",
          source: "streamer" as const,
        },
      },
      gameplay: {
        ...contractFixtureGameplaySnapshot,
        capabilities: {
          ...contractFixtureGameplaySnapshot.capabilities,
          gameId: null,
        },
        signals: [knownSignal],
      },
    });

    expect(projected.overlay.upNext).toMatchObject({
      label: "Up next",
      title: intent.goal,
    });
  });
});
