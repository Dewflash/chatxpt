import { describe, expect, it } from "vitest";

import {
  contractFixtureAudienceSnapshot,
  contractFixtureCandidateBatch,
  contractFixtureEnvelope,
  contractFixtureGameplaySnapshot,
  contractFixtureProfile,
} from "../core/testing";
import {
  createValidatingCandidateProvider,
  createValidatingIntelligenceProvider,
  type CandidateGenerationStrategy,
} from "./index";

async function intelligence() {
  return createValidatingIntelligenceProvider().analyse({
    envelope: contractFixtureEnvelope,
    gameplay: contractFixtureGameplaySnapshot,
    audience: contractFixtureAudienceSnapshot,
    profile: contractFixtureProfile,
  });
}

describe("Role 2 provider boundaries", () => {
  it("combines separate gameplay and audience snapshots into canonical intelligence", async () => {
    await expect(intelligence()).resolves.toMatchObject({
      gameplay: contractFixtureGameplaySnapshot,
      audience: contractFixtureAudienceSnapshot,
    });
  });

  it("wraps a generation strategy and emits exactly three canonical candidates", async () => {
    const calls: unknown[] = [];
    const strategy: CandidateGenerationStrategy = {
      generate: (input) => {
        calls.push(input);
        return contractFixtureCandidateBatch.candidates;
      },
    };
    const provider = createValidatingCandidateProvider(strategy);

    await expect(
      provider.generate({
        envelope: contractFixtureCandidateBatch.envelope,
        intelligence: await intelligence(),
        profile: contractFixtureProfile,
        recentQuestTitles: [],
        streamerGoal: "  Reach the next safe shelter.  ",
        activeChatXptQuest: "  Active Quest: survive safely.  ",
      }),
    ).resolves.toEqual(contractFixtureCandidateBatch);
    expect(calls[0]).toMatchObject({
      streamerGoal: "Reach the next safe shelter.",
      activeChatXptQuest: "Active Quest: survive safely.",
    });
  });

  it("rejects a strategy that returns fewer than three candidates", async () => {
    const provider = createValidatingCandidateProvider({
      generate: () => contractFixtureCandidateBatch.candidates.slice(0, 2),
    });

    await expect(
      provider.generate({
        envelope: contractFixtureCandidateBatch.envelope,
        intelligence: await intelligence(),
        profile: contractFixtureProfile,
        recentQuestTitles: [],
        streamerGoal: null,
        activeChatXptQuest: null,
      }),
    ).rejects.toThrow();
  });

  it("rejects duplicate candidate titles before they reach Role 3", async () => {
    const duplicateTitle = contractFixtureCandidateBatch.candidates.map((candidate, index) =>
      index === 1 ? { ...candidate, title: contractFixtureCandidateBatch.candidates[0].title } : candidate,
    );
    const provider = createValidatingCandidateProvider({ generate: () => duplicateTitle });

    await expect(
      provider.generate({
        envelope: contractFixtureCandidateBatch.envelope,
        intelligence: await intelligence(),
        profile: contractFixtureProfile,
        recentQuestTitles: [],
        streamerGoal: null,
        activeChatXptQuest: null,
      }),
    ).rejects.toThrow();
  });

  it("rejects malformed active quest context before invoking a generation strategy", async () => {
    let called = false;
    const provider = createValidatingCandidateProvider({
      generate: () => {
        called = true;
        return contractFixtureCandidateBatch.candidates;
      },
    });

    await expect(
      provider.generate({
        envelope: contractFixtureCandidateBatch.envelope,
        intelligence: await intelligence(),
        profile: contractFixtureProfile,
        recentQuestTitles: [],
        streamerGoal: null,
        activeChatXptQuest: " ",
      }),
    ).rejects.toThrow("activeChatXptQuest");
    expect(called).toBe(false);
  });

  it("rejects malformed streamer goal context before invoking a generation strategy", async () => {
    let called = false;
    const provider = createValidatingCandidateProvider({
      generate: () => {
        called = true;
        return contractFixtureCandidateBatch.candidates;
      },
    });

    await expect(
      provider.generate({
        envelope: contractFixtureCandidateBatch.envelope,
        intelligence: await intelligence(),
        profile: contractFixtureProfile,
        recentQuestTitles: [],
        streamerGoal: " ",
        activeChatXptQuest: null,
      }),
    ).rejects.toThrow("streamerGoal");
    expect(called).toBe(false);
  });

  it("honours cancellation before invoking a provider strategy", async () => {
    const controller = new AbortController();
    controller.abort(new Error("cancelled for test"));
    let called = false;
    const provider = createValidatingCandidateProvider({
      generate: () => {
        called = true;
        return contractFixtureCandidateBatch.candidates;
      },
    });

    await expect(
      provider.generate(
        {
          envelope: contractFixtureCandidateBatch.envelope,
          intelligence: await intelligence(),
          profile: contractFixtureProfile,
          recentQuestTitles: [],
          streamerGoal: null,
          activeChatXptQuest: null,
        },
        controller.signal,
      ),
    ).rejects.toThrow("cancelled for test");
    expect(called).toBe(false);
  });
});
