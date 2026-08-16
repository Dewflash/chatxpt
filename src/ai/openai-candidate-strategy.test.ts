import { describe, expect, it, vi } from "vitest";

import {
  contractFixtureAudienceSnapshot,
  contractFixtureCandidateBatch,
  contractFixtureEnvelope,
  contractFixtureGameplaySnapshot,
  contractFixtureProfile,
} from "../core/testing";
import type { CandidateInput } from "../core";
import { createValidatingIntelligenceProvider } from "./providers";
import {
  createOpenAICandidateStrategy,
  type StructuredCandidateTransport,
} from "./openai-candidate-strategy";
import { ProviderGenerationError } from "./provider-fallback";
import { createConfiguredCandidateProvider } from "./server";

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
    profile: contractFixtureProfile,
  });
  return {
    envelope: contractFixtureCandidateBatch.envelope,
    intelligence,
    profile: contractFixtureProfile,
    recentQuestTitles: ["Previous Fixture Quest"],
  };
}

function validOutput(signalId: string | null = null): string {
  return JSON.stringify({
    candidates: [
      {
        title: "Steady Reset",
        instruction: "Take the next safe moment to reset and state the immediate plan.",
        durationSeconds: 60,
        difficulty: "easy",
        rewardPoints: 100,
        rationale: "A lower-risk option that remains measurable with limited evidence.",
        sourceSignalIds: signalId === null ? [] : [signalId],
      },
      {
        title: "Deliberate Pressure",
        instruction: "Commit to one controlled play and explain the decision before acting.",
        durationSeconds: 75,
        difficulty: "medium",
        rewardPoints: 180,
        rationale: "A skill option grounded in observable pacing rather than invented game facts.",
        sourceSignalIds: [],
      },
      {
        title: "Chat Calls It",
        instruction: "Let viewers choose the tone of the next clear in-game decision.",
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
    const context = JSON.parse(requests[0].input) as Record<string, unknown>;
    expect(context).toHaveProperty("game");
    expect(context).toHaveProperty("gameplaySignals");
    expect(context).toHaveProperty("audience");
    expect(context).toHaveProperty("streamer");
    expect(JSON.stringify(context)).not.toContain(contractFixtureProfile.streamerId);
    expect(JSON.stringify(context)).not.toContain(contractFixtureProfile.displayName);
    expect(JSON.stringify(requests[0])).not.toMatch(/api[_-]?key/i);
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
