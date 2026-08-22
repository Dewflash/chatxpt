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

const minecraftProfile = {
  ...contractFixtureProfile,
  gameId: "minecraft",
  gameName: "Minecraft",
};

async function fixtureIntelligence(audience: AudienceSnapshot = contractFixtureAudienceSnapshot) {
  return createValidatingIntelligenceProvider().analyse({
    envelope: contractFixtureEnvelope,
    gameplay: contractFixtureGameplaySnapshot,
    audience,
    profile: minecraftProfile,
  });
}

function audienceWithKnownSignal(options: {
  readonly signalId: string;
  readonly confidence: number;
  readonly observedAt: number;
}): AudienceSnapshot {
  return audienceWithKnownSignals([{
    signalId: options.signalId,
    kind: "audience-energy",
    value: 0.9,
    confidence: options.confidence,
    observedAt: options.observedAt,
  }]);
}

function audienceWithKnownSignals(signals: readonly {
  readonly signalId: string;
  readonly kind: string;
  readonly value: string | number | boolean;
  readonly confidence?: number;
  readonly observedAt?: number;
}[]): AudienceSnapshot {
  return intelligenceSnapshotSchema.parse({
    envelope: {
      ...contractFixtureEnvelope,
      messageId: `algorithmic-intelligence-${signals.map(({ signalId }) => signalId).join("-")}`,
    },
    gameplay: contractFixtureGameplaySnapshot,
    audience: {
      ...contractFixtureAudienceSnapshot,
      signals: signals.map((signal) => ({
        signalId: signal.signalId,
        kind: signal.kind,
        observation: {
          status: "known" as const,
          value: signal.value,
          provenance: {
            source: "algorithm" as const,
            method: "fixture-audience-pipeline",
            confidence: signal.confidence ?? 0.9,
            observedAt: signal.observedAt ?? contractFixtureEnvelope.occurredAt,
            receivedAt: signal.observedAt ?? contractFixtureEnvelope.receivedAt,
            evidenceClass: "fixture" as const,
          },
        },
      })),
    },
  }).audience;
}

describe("algorithmic candidate strategy", () => {
  it("produces exactly three canonical algorithmic candidates without a provider", async () => {
    const provider = createValidatingCandidateProvider(createAlgorithmicCandidateStrategy());
    const batch = await provider.generate({
      envelope: contractFixtureCandidateBatch.envelope,
      intelligence: await fixtureIntelligence(),
      profile: minecraftProfile,
      recentQuestTitles: [],
      streamerGoal: null,
      activeChatXptQuest: null,
    });

    expect(batch.candidates).toHaveLength(3);
    expect(new Set(batch.candidates.map((candidate) => candidate.title)).size).toBe(3);
    expect(batch.candidates.every((candidate) => candidate.generation.method === "algorithmic")).toBe(true);
    expect(batch.candidates.every((candidate) => candidate.generation.provider === null)).toBe(true);
    expect(batch.candidates.every((candidate) => candidate.confidence >= 0.58)).toBe(true);
    expect(
      batch.candidates.every((candidate) => candidate.instruction.includes("Minecraft")),
    ).toBe(true);
    expect(JSON.stringify(batch)).not.toContain("game-neutral");
  });

  it("avoids recent quest titles when enough alternatives exist", async () => {
    const provider = createValidatingCandidateProvider(createAlgorithmicCandidateStrategy());
    const batch = await provider.generate({
      envelope: contractFixtureCandidateBatch.envelope,
      intelligence: await fixtureIntelligence(),
      profile: minecraftProfile,
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
      profile: minecraftProfile,
      recentQuestTitles: [],
      streamerGoal: null,
      activeChatXptQuest: null,
    });

    const citedIds = batch.candidates.flatMap((candidate) => candidate.sourceSignalIds);
    expect(citedIds).toContain("audience-energy-known");
    expect(
      citedIds.every((signalId) =>
        ["audience-energy-known", "audience-intent-known"].includes(signalId),
      ),
    ).toBe(true);
    expect(JSON.stringify(batch)).not.toContain("requesting quest please");
  });

  it("promotes templates supported by meaningful chat requests", async () => {
    const provider = createValidatingCandidateProvider(createAlgorithmicCandidateStrategy());
    const batch = await provider.generate({
      envelope: contractFixtureCandidateBatch.envelope,
      intelligence: await fixtureIntelligence(audienceWithKnownSignals([
        { signalId: "audience-intent-requesting", kind: "audience-intent", value: "requesting" },
        { signalId: "audience-repeated-requests-two", kind: "audience-repeated-requests", value: 2 },
      ])),
      profile: minecraftProfile,
      recentQuestTitles: [],
      streamerGoal: null,
      activeChatXptQuest: null,
    });

    expect(batch.candidates[0]).toMatchObject({
      title: "Plan Out Loud",
      sourceSignalIds: expect.arrayContaining([
        "audience-intent-requesting",
        "audience-repeated-requests-two",
      ]),
    });
  });

  it("promotes calm options when chat pressure is actually present", async () => {
    const provider = createValidatingCandidateProvider(createAlgorithmicCandidateStrategy());
    const batch = await provider.generate({
      envelope: contractFixtureCandidateBatch.envelope,
      intelligence: await fixtureIntelligence(audienceWithKnownSignals([
        { signalId: "audience-negative-pressure-two", kind: "audience-negative-pressure", value: 2 },
      ])),
      profile: minecraftProfile,
      recentQuestTitles: [],
      streamerGoal: null,
      activeChatXptQuest: null,
    });

    expect(batch.candidates.map(({ title }) => title)).toEqual(
      expect.arrayContaining(["Calm Focus", "Positive Commentary"]),
    );
    expect(batch.candidates
      .filter(({ title }) => title === "Calm Focus" || title === "Positive Commentary")
      .every(({ sourceSignalIds }) => sourceSignalIds.includes("audience-negative-pressure-two")))
      .toBe(true);
    expect(batch.candidates.find(({ title }) => title === "Positive Commentary")?.rationale)
      .toContain("chat pressure is negative");
  });

  it("does not claim negative chat when an unsupported fallback rotation selects positive commentary", async () => {
    const provider = createValidatingCandidateProvider(createAlgorithmicCandidateStrategy());
    const batch = await provider.generate({
      envelope: contractFixtureCandidateBatch.envelope,
      intelligence: await fixtureIntelligence(),
      profile: minecraftProfile,
      recentQuestTitles: [
        "Plan Out Loud",
        "Caster Mode",
        "Decision Spotlight",
        "Audience Coach",
        "Calm Focus",
        "Three-Step Preview",
        "One-Minute Mentor",
        "Dramatic Recap",
      ],
      streamerGoal: null,
      activeChatXptQuest: null,
    });

    expect(batch.candidates.find(({ title }) => title === "Positive Commentary")).toMatchObject({
      sourceSignalIds: [],
      rationale: expect.not.stringContaining("negative"),
    });
  });

  it("does not cite zero-valued audience pressure or requests", async () => {
    const provider = createValidatingCandidateProvider(createAlgorithmicCandidateStrategy());
    const batch = await provider.generate({
      envelope: contractFixtureCandidateBatch.envelope,
      intelligence: await fixtureIntelligence(audienceWithKnownSignals([
        { signalId: "audience-negative-pressure-zero", kind: "audience-negative-pressure", value: 0 },
        { signalId: "audience-repeated-requests-zero", kind: "audience-repeated-requests", value: 0 },
      ])),
      profile: minecraftProfile,
      recentQuestTitles: [],
      streamerGoal: null,
      activeChatXptQuest: null,
    });

    expect(batch.candidates.flatMap(({ sourceSignalIds }) => sourceSignalIds)).not.toEqual(
      expect.arrayContaining([
        "audience-negative-pressure-zero",
        "audience-repeated-requests-zero",
      ]),
    );
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
      profile: minecraftProfile,
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
      profile: minecraftProfile,
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
      profile: minecraftProfile,
      recentQuestTitles: ["Audience Coach"],
      streamerGoal: null,
      activeChatXptQuest: null,
    };

    expect(await strategy.generate(input)).toEqual(await strategy.generate(input));
  });

  it("rejects generation instead of emitting generic filler when no game is selected", async () => {
    const strategy = createAlgorithmicCandidateStrategy();
    const intelligence = await fixtureIntelligence();
    expect(() =>
      strategy.generate({
        envelope: contractFixtureCandidateBatch.envelope,
        intelligence,
        profile: contractFixtureProfile,
        recentQuestTitles: [],
        streamerGoal: null,
        activeChatXptQuest: null,
      }),
    ).toThrow("selected game");
  });
});
