import { describe, expect, it, vi } from "vitest";

import {
  contractFixtureAudienceSnapshot,
  contractFixtureCandidateBatch,
  contractFixtureEnvelope,
  contractFixtureGameplaySnapshot,
  contractFixtureProfile,
} from "../core/testing";
import { gameplaySnapshotSchema, streamerProfileSchema, type CandidateInput } from "../core";
import { createValidatingIntelligenceProvider } from "./providers";
import {
  candidateDraftJsonSchema,
  createOpenAICandidateStrategy,
  type StructuredCandidateTransport,
} from "./openai-candidate-strategy";
import { ProviderGenerationError } from "./provider-fallback";
import { createConfiguredCandidateProvider, parseOpenAIResponse } from "./server";

const minecraftProfile = {
  ...contractFixtureProfile,
  gameId: "minecraft",
  gameName: "Minecraft",
};

async function candidateInput(): Promise<CandidateInput> {
  const gameplay = {
    ...contractFixtureGameplaySnapshot,
    signals: contractFixtureGameplaySnapshot.signals.map((signal, index) =>
      index === 0
        ? {
            ...signal,
            observation: {
              status: "known" as const,
              value: 0.42,
              provenance: {
                ...signal.observation.provenance,
                confidence: 0.82,
              },
            },
          }
        : signal,
    ),
  };
  const intelligence = await createValidatingIntelligenceProvider().analyse({
    envelope: contractFixtureEnvelope,
    gameplay,
    audience: contractFixtureAudienceSnapshot,
    profile: minecraftProfile,
  });
  return {
    envelope: contractFixtureCandidateBatch.envelope,
    intelligence,
    profile: minecraftProfile,
    recentQuestTitles: ["Previous Fixture Quest"],
    streamerGoal: "Reach the next safe shelter",
    activeChatXptQuest: "Keep Moving: Reach the next checkpoint safely.",
  };
}

async function minecraftCandidateInput(): Promise<CandidateInput> {
  const base = await candidateInput();
  const now = base.envelope.occurredAt;
  const provenance = {
    source: "test-fixture" as const,
    method: "minecraft-hud-pixel-facts-v1",
    confidence: 0.9,
    observedAt: now,
    receivedAt: now,
    evidenceClass: "fixture" as const,
  };
  const gameplay = gameplaySnapshotSchema.parse({
    ...contractFixtureGameplaySnapshot,
    capabilities: {
      tier: "calibrated-hud",
      gameId: "minecraft",
      adapterId: "minecraft-java-vanilla-v1",
      supportedSignals: [
        "minecraft-hud-layout",
        "minecraft-health-hearts",
        "minecraft-hunger-shanks",
        "minecraft-hotbar-visible",
        "minecraft-recent-damage",
      ],
    },
    signals: [
      {
        signalId: "minecraft-hud-layout",
        kind: "minecraft-hud-layout",
        observation: { status: "known", value: "vanilla-like", provenance },
      },
      {
        signalId: "minecraft-health-hearts",
        kind: "minecraft-health-hearts",
        observation: { status: "known", value: 10, provenance },
      },
      {
        signalId: "minecraft-hunger-shanks",
        kind: "minecraft-hunger-shanks",
        observation: { status: "known", value: 8, provenance },
      },
      {
        signalId: "minecraft-menu-state",
        kind: "minecraft-menu-state",
        observation: {
          status: "unknown",
          reason: "not-observed",
          provenance: { ...provenance, confidence: 0 },
        },
      },
      {
        signalId: "minecraft-recent-damage",
        kind: "minecraft-recent-damage",
        observation: { status: "known", value: true, provenance: { ...provenance, method: "minecraft-runtime-facts-v1" } },
      },
    ],
  });
  return {
    ...base,
    activeChatXptQuest: "Recover Before Mining: Stay safe until health is stable.",
    profile: streamerProfileSchema.parse({
      ...contractFixtureProfile,
      gameId: "minecraft",
      gameName: "Minecraft Java Edition",
    }),
    intelligence: {
      ...base.intelligence,
      gameplay,
    },
  };
}

function validOutput(signalId: string | null = null, gameName = "Minecraft"): string {
  return JSON.stringify({
    candidates: [
      {
        title: "Steady Reset",
        instruction: `In ${gameName}, take the next safe moment to reset and state the immediate plan.`,
        durationSeconds: 60,
        difficulty: "easy",
        rewardPoints: 100,
        rationale: "A lower-risk option that remains measurable with limited evidence.",
        sourceSignalIds: signalId === null ? [] : [signalId],
      },
      {
        title: "Deliberate Pressure",
        instruction: `In ${gameName}, commit to one controlled play and explain the decision before acting.`,
        durationSeconds: 75,
        difficulty: "medium",
        rewardPoints: 180,
        rationale: "A skill option grounded in observable pacing rather than invented game facts.",
        sourceSignalIds: [],
      },
      {
        title: "Chat Calls It",
        instruction: `In ${gameName}, let viewers choose the tone of the next clear decision.`,
        durationSeconds: 60,
        difficulty: "easy",
        rewardPoints: 120,
        rationale: "An audience option that does not prescribe unsafe or game-specific behaviour.",
        sourceSignalIds: [],
      },
    ],
  });
}

function knownSignalId(input: CandidateInput): string {
  const signal = [...input.intelligence.gameplay.signals, ...input.intelligence.audience.signals]
    .find(({ observation }) => observation.status === "known");
  if (signal === undefined) throw new Error("Fixture requires one known signal");
  return signal.signalId;
}

describe("OpenAI-compatible candidate strategy", () => {
  it("uses only provider-supported array constraints in the strict response schema", () => {
    const sourceSignalIds =
      candidateDraftJsonSchema.properties.candidates.items.properties.sourceSignalIds;

    expect(sourceSignalIds).toMatchObject({ type: "array", maxItems: 8 });
    expect(sourceSignalIds).not.toHaveProperty("uniqueItems");
  });

  it("sends normalized context only and assigns canonical provider metadata itself", async () => {
    const input = await candidateInput();
    const signalId = knownSignalId(input);
    const requests: Parameters<StructuredCandidateTransport["generate"]>[0][] = [];
    const transport: StructuredCandidateTransport = {
      async generate(request) {
        requests.push(request);
        return { outputText: validOutput(signalId) };
      },
    };
    const candidates = await createOpenAICandidateStrategy({
      providerId: "openai/fixture-model",
      model: "fixture-model",
      transport,
    }).generate(input);

    expect(candidates).toHaveLength(3);
    expect(candidates.every(({ generation }) =>
      generation.method === "ai-provider" && generation.provider === "openai/fixture-model",
    )).toBe(true);
    expect(candidates[0].sourceSignalIds).toEqual([signalId]);
    const context = JSON.parse(requests[0].input) as {
      streamer: { goal: string | null };
      activeChatXptQuest: string | null;
    } & Record<string, unknown>;
    expect(context).toHaveProperty("game");
    expect(context).toHaveProperty("gameState");
    expect(context).toHaveProperty("gameplaySignals");
    expect(context).toHaveProperty("audience");
    expect(context).toHaveProperty("streamer");
    expect(context.streamer.goal).toBe(input.streamerGoal);
    expect(context.activeChatXptQuest).toBe(input.activeChatXptQuest);
    expect(JSON.stringify(context)).not.toContain(minecraftProfile.streamerId);
    expect(JSON.stringify(context)).not.toContain(minecraftProfile.displayName);
    expect(JSON.stringify(requests[0])).not.toMatch(/api[_-]?key/i);
    expect(requests[0].instructions).toContain("Every option must explicitly name the selected game");
  });

  it("rejects provider output that does not name the selected game", async () => {
    const strategy = createOpenAICandidateStrategy({
      providerId: "openai/fixture-model",
      model: "fixture-model",
      transport: {
        async generate() {
          return {
            outputText: validOutput().replaceAll("Minecraft", "the selected title"),
          };
        },
      },
    });

    await expect(strategy.generate(await candidateInput())).rejects.toMatchObject({
      reason: "malformed",
      message: expect.stringContaining("selected game"),
    });
  });

  it("rejects hallucinated signal citations as malformed", async () => {
    const strategy = createOpenAICandidateStrategy({
      providerId: "openai/fixture-model",
      model: "fixture-model",
      transport: {
        async generate() {
          return { outputText: validOutput("invented-health-signal") };
        },
      },
    });
    await expect(strategy.generate(await candidateInput())).rejects.toMatchObject({
      reason: "malformed",
    });
  });

  it("rejects duplicate signal citations instead of inflating candidate confidence", async () => {
    const input = await candidateInput();
    const signalId = knownSignalId(input);
    const output = JSON.parse(validOutput(signalId)) as {
      candidates: Array<{ sourceSignalIds: string[] }>;
    };
    output.candidates[0].sourceSignalIds = [signalId, signalId];
    const strategy = createOpenAICandidateStrategy({
      providerId: "openai/fixture-model",
      model: "fixture-model",
      transport: { generate: async () => ({ outputText: JSON.stringify(output) }) },
    });

    await expect(strategy.generate(input)).rejects.toMatchObject({ reason: "malformed" });
  });

  it.each([
    {
      label: "stale",
      confidence: 0.9,
      observedAtOffset: -3_001,
      expectedSignalStatus: "stale",
      expectedFactStatus: "stale",
    },
    {
      label: "low-confidence",
      confidence: 0.74,
      observedAtOffset: 0,
      expectedSignalStatus: "unknown",
      expectedFactStatus: "unknown",
    },
    {
      label: "future-timestamped",
      confidence: 0.9,
      observedAtOffset: 1,
      expectedSignalStatus: "unknown",
      expectedFactStatus: "conflicting",
    },
  ])("rejects $label provider citations and downgrades their model context", async ({
    confidence,
    observedAtOffset,
    expectedSignalStatus,
    expectedFactStatus,
  }) => {
    const base = await minecraftCandidateInput();
    const now = base.envelope.occurredAt;
    const gameplay = gameplaySnapshotSchema.parse({
      ...base.intelligence.gameplay,
      signals: base.intelligence.gameplay.signals.map((signal) =>
        signal.signalId === "minecraft-health-hearts" && signal.observation.status === "known"
          ? {
              ...signal,
              observation: {
                ...signal.observation,
                provenance: {
                  ...signal.observation.provenance,
                  confidence,
                  observedAt: now + observedAtOffset,
                  receivedAt: now + observedAtOffset,
                },
              },
            }
          : signal),
    });
    const input: CandidateInput = {
      ...base,
      intelligence: { ...base.intelligence, gameplay },
    };
    const requests: Parameters<StructuredCandidateTransport["generate"]>[0][] = [];
    const strategy = createOpenAICandidateStrategy({
      providerId: "openai/fixture-model",
      model: "fixture-model",
      transport: {
        async generate(request) {
          requests.push(request);
          return { outputText: validOutput("minecraft-health-hearts") };
        },
      },
    });

    await expect(strategy.generate(input)).rejects.toMatchObject({ reason: "malformed" });
    const context = JSON.parse(requests[0].input) as {
      gameplaySignals: Array<{ signalId: string; status: string; value?: unknown }>;
      gameState: { facts: { playerHealth: { status: string; value: unknown } } };
      minecraft: { gameFacts: { healthHearts: { status: string; value: unknown } } };
    };
    expect(context.gameplaySignals.find(({ signalId }) => signalId === "minecraft-health-hearts"))
      .toMatchObject({ status: expectedSignalStatus });
    expect(context.gameplaySignals.find(({ signalId }) => signalId === "minecraft-health-hearts"))
      .not.toHaveProperty("value");
    expect(context.gameState.facts.playerHealth).toMatchObject({ status: expectedSignalStatus, value: null });
    expect(context.minecraft.gameFacts.healthHearts).toMatchObject({ status: expectedFactStatus, value: null });
  });

  it("sends a typed Minecraft fact block with known and unknown facts separated", async () => {
    const input = await minecraftCandidateInput();
    const requests: Parameters<StructuredCandidateTransport["generate"]>[0][] = [];
    const transport: StructuredCandidateTransport = {
      async generate(request) {
        requests.push(request);
        return { outputText: validOutput("minecraft-health-hearts") };
      },
    };

    await createOpenAICandidateStrategy({
      providerId: "openai/fixture-model",
      model: "fixture-model",
      transport,
    }).generate(input);

    const context = JSON.parse(requests[0].input) as {
      gameState: {
        schemaVersion: string;
        facts: Record<string, { status: string; value: unknown; sourceSignalIds: string[] }>;
        gameSpecificContext: string | null;
        supportedGenericFacts: string[];
        unknownGenericFacts: string[];
      };
      minecraft: {
        gameFacts: Record<string, { status: string; value: unknown; sourceSignalIds: string[] }>;
        streamerIntent: { streamerGoal: string | null };
        activeChatXptQuest: string | null;
        supportedFacts: string[];
        unknownFacts: string[];
      };
    };
    expect(requests[0].instructions).toContain("minecraft.gameFacts");
    expect(requests[0].instructions).toContain("gameState.facts");
    expect(requests[0].instructions).toContain(
      "For Minecraft, choose safe Minecraft-aware quests about goals, choices, route planning, explanation, or chat-guided style",
    );
    expect(requests[0].instructions).toContain(
      "Weak and strong models receive the same typed context",
    );
    expect(requests[0].instructions).not.toContain(
      "If evidence is unknown, stale, unsupported, or low-confidence, use a broadly measurable game-neutral quest.",
    );
    expect(context.gameState).toMatchObject({
      schemaVersion: "generic-game-state-v1",
      gameSpecificContext: "minecraft",
    });
    expect(context.gameState.facts.playerHealth).toMatchObject({
      status: "known",
      value: 10,
      sourceSignalIds: ["minecraft-health-hearts"],
    });
    expect(context.gameState.facts.playerResource).toMatchObject({
      status: "known",
      value: 8,
      sourceSignalIds: ["minecraft-hunger-shanks"],
    });
    expect(context.gameState.facts.recentDamage).toMatchObject({
      status: "known",
      value: true,
      sourceSignalIds: ["minecraft-recent-damage"],
    });
    expect(context.gameState.supportedGenericFacts).toEqual(
      expect.arrayContaining(["hudLayout", "playerHealth", "playerResource", "recentDamage"]),
    );
    expect(context.gameState.unknownGenericFacts).toEqual(
      expect.arrayContaining(["environment", "objectiveState", "matchTimer"]),
    );
    expect(context.minecraft.streamerIntent).toEqual({ streamerGoal: input.streamerGoal });
    expect(context.minecraft.activeChatXptQuest).toBe("Recover Before Mining: Stay safe until health is stable.");
    expect(context.minecraft.gameFacts.healthHearts).toMatchObject({
      status: "known",
      value: 10,
      sourceSignalIds: ["minecraft-health-hearts"],
    });
    expect(context.minecraft.gameFacts.menuState).toMatchObject({
      status: "unknown",
      value: null,
    });
    expect(context.minecraft.gameFacts.recentDamage).toMatchObject({
      status: "known",
      value: true,
      sourceSignalIds: ["minecraft-recent-damage"],
    });
    expect(context.minecraft.gameFacts.likelyDamageCause).toMatchObject({
      status: "unknown",
      value: null,
    });
    expect(context.minecraft.supportedFacts).toEqual(
      expect.arrayContaining(["edition", "hudLayout", "healthHearts", "hungerShanks", "recentDamage"]),
    );
    expect(context.minecraft.unknownFacts).toEqual(
      expect.arrayContaining(["mode", "menuState", "likelyDamageCause", "visibleHostile"]),
    );
  });

  it("sends generic game-state context for non-Minecraft calibrated games without a Minecraft block", async () => {
    const base = await candidateInput();
    const now = base.envelope.occurredAt;
    const provenance = {
      source: "test-fixture" as const,
      method: "brawl-hud-fixture-v1",
      confidence: 0.88,
      observedAt: now,
      receivedAt: now,
      evidenceClass: "fixture" as const,
    };
    const input: CandidateInput = {
      ...base,
      profile: streamerProfileSchema.parse({
        ...contractFixtureProfile,
        gameId: "brawl-stars",
        gameName: "Brawl Stars",
      }),
      intelligence: {
        ...base.intelligence,
        gameplay: gameplaySnapshotSchema.parse({
          ...contractFixtureGameplaySnapshot,
          capabilities: {
            tier: "calibrated-hud",
            gameId: "brawl-stars",
            adapterId: "brawl-stars-standard-v1",
            supportedSignals: ["brawl-hud-layout", "match-active", "match-timer", "match-score"],
          },
          signals: [
            {
              signalId: "brawl-hud-layout",
              kind: "brawl-hud-layout",
              observation: { status: "known", value: "standard", provenance },
            },
            {
              signalId: "match-active",
              kind: "match-active",
              observation: { status: "known", value: true, provenance },
            },
            {
              signalId: "match-timer",
              kind: "match-timer",
              observation: { status: "known", value: 72, provenance },
            },
            {
              signalId: "match-score",
              kind: "match-score",
              observation: { status: "known", value: "2-1", provenance },
            },
          ],
        }),
      },
    };
    const requests: Parameters<StructuredCandidateTransport["generate"]>[0][] = [];
    await createOpenAICandidateStrategy({
      providerId: "openai/fixture-model",
      model: "fixture-model",
      transport: {
        async generate(request) {
          requests.push(request);
          return { outputText: validOutput("match-timer", "Brawl Stars") };
        },
      },
    }).generate(input);

    const context = JSON.parse(requests[0].input) as {
      gameState: {
        gameSpecificContext: string | null;
        facts: Record<string, { status: string; value: unknown; sourceSignalIds: string[] }>;
        supportedGenericFacts: string[];
        unknownGenericFacts: string[];
      };
      streamer: { goal: string | null };
      activeChatXptQuest: string | null;
      minecraft?: unknown;
    };
    expect(context.minecraft).toBeUndefined();
    expect(context.streamer.goal).toBe(input.streamerGoal);
    expect(context.activeChatXptQuest).toBe(input.activeChatXptQuest);
    expect(context.gameState.gameSpecificContext).toBe("brawl-stars");
    expect(context.gameState.facts.objectiveState).toMatchObject({
      status: "known",
      value: true,
      sourceSignalIds: ["match-active"],
    });
    expect(context.gameState.facts.matchTimer).toMatchObject({
      status: "known",
      value: 72,
      sourceSignalIds: ["match-timer"],
    });
    expect(context.gameState.facts.scoreState).toMatchObject({
      status: "known",
      value: "2-1",
      sourceSignalIds: ["match-score"],
    });
    expect(context.gameState.supportedGenericFacts).toEqual(
      expect.arrayContaining(["hudLayout", "objectiveState", "matchTimer", "scoreState"]),
    );
    expect(context.gameState.unknownGenericFacts).toContain("playerHealth");
    expect(requests[0].instructions).toContain(
      "In rationale, describe that constraint generically as not relying on unsupported state.",
    );
  });

  it("classifies refusal, rate limiting, and malformed JSON without leaking payloads", async () => {
    const input = await candidateInput();
    const refusal = createOpenAICandidateStrategy({
      providerId: "openai/fixture-model",
      model: "fixture-model",
      transport: { generate: async () => ({ outputText: null, refused: true }) },
    });
    await expect(refusal.generate(input)).rejects.toMatchObject({ reason: "refusal" });

    const limited = createOpenAICandidateStrategy({
      providerId: "openai/fixture-model",
      model: "fixture-model",
      transport: {
        async generate() {
          throw Object.assign(new Error("fixture limit"), { status: 429 });
        },
      },
    });
    await expect(limited.generate(input)).rejects.toMatchObject({ reason: "rate-limited" });

    const malformed = createOpenAICandidateStrategy({
      providerId: "openai/fixture-model",
      model: "fixture-model",
      transport: { generate: async () => ({ outputText: "not-json" }) },
    });
    await expect(malformed.generate(input)).rejects.toBeInstanceOf(ProviderGenerationError);
  });
});

describe("OpenAI Responses API parsing", () => {
  it("detects a nested refusal without retaining refusal text", () => {
    expect(
      parseOpenAIResponse({
        output_text: "",
        output: [
          {
            type: "message",
            content: [{ type: "refusal" }],
          },
        ],
      }),
    ).toEqual({ outputText: null, refused: true });
  });

  it("passes structured output through when the response contains no refusal", () => {
    expect(
      parseOpenAIResponse({
        output_text: "{\"candidates\":[]}",
        output: [
          {
            type: "message",
            content: [{ type: "output_text" }],
          },
        ],
      }),
    ).toEqual({ outputText: "{\"candidates\":[]}" });
  });
});

describe("environment-driven candidate provider composition", () => {
  it("keeps the credential-free algorithmic path when LLM use is disabled", async () => {
    const transport = { generate: vi.fn(async () => ({ outputText: validOutput() })) };
    const configured = createConfiguredCandidateProvider({
      environment: { CHATXPT_LLM_ENABLED: "false" },
      transport,
    });
    expect(configured).toMatchObject({ mode: "algorithmic", reason: "disabled", providerId: null });
    const batch = await configured.provider.generate(await candidateInput());
    expect(batch.candidates.every(({ generation }) => generation.method === "algorithmic")).toBe(true);
    expect(transport.generate).not.toHaveBeenCalled();
  });

  it("reports missing credentials without attempting a provider call", async () => {
    const configured = createConfiguredCandidateProvider({
      environment: { CHATXPT_LLM_ENABLED: "true", OPENAI_MODEL: "fixture-model" },
    });
    expect(configured).toMatchObject({ mode: "algorithmic", reason: "missing-credential" });
    await expect(configured.provider.generate(await candidateInput())).resolves.toMatchObject({
      candidates: [
        { generation: { method: "algorithmic", provider: null } },
        { generation: { method: "algorithmic", provider: null } },
        { generation: { method: "algorithmic", provider: null } },
      ],
    });
  });

  it("uses the configured provider and falls back algorithmically after provider failure", async () => {
    const input = await candidateInput();
    const success = createConfiguredCandidateProvider({
      environment: {
        CHATXPT_LLM_ENABLED: "true",
        CHATXPT_LLM_PROVIDER_ID: "openai",
        OPENAI_MODEL: "fixture-model",
      },
      transport: { generate: async () => ({ outputText: validOutput(knownSignalId(input)) }) },
    });
    expect(success).toMatchObject({
      mode: "provider-with-fallback",
      reason: "configured",
      providerId: "openai/fixture-model",
    });
    await expect(success.provider.generate(input)).resolves.toMatchObject({
      candidates: [
        { generation: { method: "ai-provider", provider: "openai/fixture-model" } },
        { generation: { method: "ai-provider", provider: "openai/fixture-model" } },
        { generation: { method: "ai-provider", provider: "openai/fixture-model" } },
      ],
    });

    const fallback = createConfiguredCandidateProvider({
      environment: {
        CHATXPT_LLM_ENABLED: "true",
        OPENAI_MODEL: "fixture-model",
      },
      transport: {
        async generate() {
          throw new ProviderGenerationError("unavailable", "fixture outage");
        },
      },
    });
    await expect(fallback.provider.generate(input)).resolves.toMatchObject({
      candidates: [
        { generation: { method: "algorithmic", provider: null } },
        { generation: { method: "algorithmic", provider: null } },
        { generation: { method: "algorithmic", provider: null } },
      ],
    });
  });
});
