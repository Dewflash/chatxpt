import { describe, expect, it } from "vitest";

import {
  intelligenceSnapshotSchema,
  type AudienceSnapshot,
} from "../core";
import {
  contractFixtureAudienceSnapshot,
  contractFixtureCandidateBatch,
  contractFixtureEnvelope,
  contractFixtureGameplaySnapshot,
  contractFixtureProfile,
} from "../core/testing";
import {
  createAlgorithmicCandidateStrategy,
  createValidatingCandidateProvider,
  createValidatingIntelligenceProvider,
} from "./index";

async function fixtureIntelligence(audience: AudienceSnapshot = contractFixtureAudienceSnapshot) {
  return createValidatingIntelligenceProvider().analyse({
    envelope: contractFixtureEnvelope,
    gameplay: contractFixtureGameplaySnapshot,
    audience,
    profile: contractFixtureProfile,
  });
}

function audienceWithKnownSignal(options: {
  readonly signalId: string;
  readonly confidence: number;
  readonly observedAt: number;
}): AudienceSnapshot {
  return intelligenceSnapshotSchema.parse({
    envelope: {
      ...contractFixtureEnvelope,
      messageId: `algorithmic-intelligence-${options.signalId}`,
    },
    gameplay: contractFixtureGameplaySnapshot,
    audience: {
      ...contractFixtureAudienceSnapshot,
      signals: [
        {
          signalId: options.signalId,
          kind: "audience-energy",
          observation: {
            status: "known",
            value: 0.9,
            provenance: {
              source: "algorithm",
              method: "fixture-audience-pipeline",
              confidence: options.confidence,
              observedAt: options.observedAt,
              receivedAt: options.observedAt,
              evidenceClass: "fixture",
            },
          },
        },
      ],
    },
  }).audience;
}

describe("algorithmic candidate strategy", () => {
  it("produces exactly three canonical algorithmic candidates without a provider", async () => {
    const provider = createValidatingCandidateProvider(createAlgorithmicCandidateStrategy());
    const batch = await provider.generate({
      envelope: contractFixtureCandidateBatch.envelope,
      intelligence: await fixtureIntelligence(),
      profile: contractFixtureProfile,
      recentQuestTitles: [],
      streamerGoal: null,
      activeChatXptQuest: null,
    });

    expect(batch.candidates).toHaveLength(3);
    expect(new Set(batch.candidates.map((candidate) => candidate.title)).size).toBe(3);
    expect(batch.candidates.every((candidate) => candidate.generation.method === "algorithmic")).toBe(true);
    expect(batch.candidates.every((candidate) => candidate.generation.provider === null)).toBe(true);
    expect(batch.candidates.every((candidate) => candidate.confidence >= 0.58)).toBe(true);
  });

  it("avoids recent quest titles when enough alternatives exist", async () => {
    const provider = createValidatingCandidateProvider(createAlgorithmicCandidateStrategy());
    const batch = await provider.generate({
      envelope: contractFixtureCandidateBatch.envelope,
      intelligence: await fixtureIntelligence(),
      profile: contractFixtureProfile,
      recentQuestTitles: ["Plan Out Loud", "Caster Mode", "Calm Focus"],
      streamerGoal: null,
      activeChatXptQuest: null,
    });

    expect(batch.candidates.map((candidate) => candidate.title)).not.toEqual(
      expect.arrayContaining(["Plan Out Loud", "Caster Mode", "Calm Focus"]),
    );
  });

  it("uses Minecraft-aware templates when Minecraft is the selected game", async () => {
    const provider = createValidatingCandidateProvider(createAlgorithmicCandidateStrategy());
    const batch = await provider.generate({
      envelope: contractFixtureCandidateBatch.envelope,
      intelligence: await fixtureIntelligence(),
      profile: {
        ...contractFixtureProfile,
        gameId: "minecraft",
        gameName: "Minecraft",
      },
      recentQuestTitles: [],
      streamerGoal: null,
      activeChatXptQuest: null,
    });

    expect(batch.candidates).toHaveLength(3);
    expect(batch.candidates.every((candidate) => candidate.instruction.includes("Minecraft")))
      .toBe(true);
    expect(JSON.stringify(batch)).not.toMatch(/\b(?:health|hunger|hotbar|sleep|biome|monster|damage cause)\b/iu);
  });

  it("never fills a Minecraft batch with generic templates when Minecraft titles are recent", async () => {
    const provider = createValidatingCandidateProvider(createAlgorithmicCandidateStrategy());
    const batch = await provider.generate({
      envelope: contractFixtureCandidateBatch.envelope,
      intelligence: await fixtureIntelligence(),
      profile: {
        ...contractFixtureProfile,
        gameId: "minecraft",
        gameName: "Minecraft",
      },
      recentQuestTitles: [
        "Next Goal Check",
        "Chat Chooses the Vibe",
        "Explain the Choice",
        "Teach the Moment",
      ],
      streamerGoal: null,
      activeChatXptQuest: null,
    });

    expect(batch.candidates).toHaveLength(3);
    expect(batch.candidates.every((candidate) => candidate.instruction.includes("Minecraft")))
      .toBe(true);
    expect(batch.candidates.map(({ title }) => title)).not.toEqual(
      expect.arrayContaining(["Plan Out Loud", "Caster Mode", "Calm Focus"]),
    );
  });

  it("cites only known canonical signal IDs and never raw chat text", async () => {
    const audience = intelligenceSnapshotSchema.parse({
      envelope: {
        ...contractFixtureEnvelope,
        messageId: "algorithmic-intelligence",
      },
      gameplay: contractFixtureGameplaySnapshot,
      audience: {
        ...contractFixtureAudienceSnapshot,
        signals: [
          {
            signalId: "audience-energy-known",
            kind: "audience-energy",
            observation: {
              status: "known",
              value: 0.9,
              provenance: {
                source: "algorithm",
                method: "fixture-audience-pipeline",
                confidence: 0.9,
                observedAt: contractFixtureEnvelope.occurredAt,
                receivedAt: contractFixtureEnvelope.receivedAt,
                evidenceClass: "fixture",
              },
            },
          },
          {
            signalId: "audience-intent-known",
            kind: "audience-intent",
            observation: {
              status: "known",
              value: "requesting",
              provenance: {
                source: "algorithm",
                method: "fixture-audience-pipeline",
                confidence: 0.9,
                observedAt: contractFixtureEnvelope.occurredAt,
                receivedAt: contractFixtureEnvelope.receivedAt,
                evidenceClass: "fixture",
              },
            },
          },
        ],
      },
    }).audience;
    const provider = createValidatingCandidateProvider(createAlgorithmicCandidateStrategy());
    const batch = await provider.generate({
      envelope: contractFixtureCandidateBatch.envelope,
      intelligence: await fixtureIntelligence(audience),
      profile: contractFixtureProfile,
      recentQuestTitles: [],
      streamerGoal: null,
      activeChatXptQuest: null,
    });

    const citedIds = batch.candidates.flatMap((candidate) => candidate.sourceSignalIds);
    expect(citedIds).toEqual(
      expect.arrayContaining(["audience-energy-known", "audience-intent-known"]),
    );
    expect(JSON.stringify(batch)).not.toContain("requesting quest please");
  });

  it("omits known low-confidence signal IDs that Role 3 would reject", async () => {
    const provider = createValidatingCandidateProvider(createAlgorithmicCandidateStrategy());
    const batch = await provider.generate({
      envelope: contractFixtureCandidateBatch.envelope,
      intelligence: await fixtureIntelligence(
        audienceWithKnownSignal({
          signalId: "audience-energy-low-confidence",
          confidence: 0.1,
          observedAt: contractFixtureEnvelope.occurredAt,
        }),
      ),
      profile: contractFixtureProfile,
      recentQuestTitles: [],
      streamerGoal: null,
      activeChatXptQuest: null,
    });

    expect(batch.candidates.flatMap((candidate) => candidate.sourceSignalIds)).not.toContain(
      "audience-energy-low-confidence",
    );
  });

  it("omits known stale signal IDs that Role 3 would reject", async () => {
    const provider = createValidatingCandidateProvider(createAlgorithmicCandidateStrategy());
    const batch = await provider.generate({
      envelope: contractFixtureCandidateBatch.envelope,
      intelligence: await fixtureIntelligence(
        audienceWithKnownSignal({
          signalId: "audience-energy-stale",
          confidence: 0.9,
          observedAt: contractFixtureEnvelope.occurredAt - 30_001,
        }),
      ),
      profile: contractFixtureProfile,
      recentQuestTitles: [],
      streamerGoal: null,
      activeChatXptQuest: null,
    });

    expect(batch.candidates.flatMap((candidate) => candidate.sourceSignalIds)).not.toContain(
      "audience-energy-stale",
    );
  });

  it("is deterministic for the same session, cycle, revision, and recent titles", async () => {
    const strategy = createAlgorithmicCandidateStrategy();
    const input = {
      envelope: contractFixtureCandidateBatch.envelope,
      intelligence: await fixtureIntelligence(),
      profile: contractFixtureProfile,
      recentQuestTitles: ["Audience Coach"],
      streamerGoal: null,
      activeChatXptQuest: null,
    };

    expect(await strategy.generate(input)).toEqual(await strategy.generate(input));
  });
});
