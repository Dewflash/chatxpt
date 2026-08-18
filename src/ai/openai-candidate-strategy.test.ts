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

function withKnownSignalProvenance(
  input: CandidateInput,
  update: { readonly confidence?: number; readonly observedAt?: number },
): CandidateInput {
  const signalId = knownSignalId(input);
  return {
    ...input,
    intelligence: {
      ...input.intelligence,
      gameplay: {
        ...input.intelligence.gameplay,
        signals: input.intelligence.gameplay.signals.map((signal) =>
          signal.signalId !== signalId || signal.observation.status !== "known"
            ? signal
            : {
                ...signal,
                observation: {
                  ...signal.observation,
                  provenance: {
                    ...signal.observation.provenance,
                    ...(update.confidence === undefined ? {} : { confidence: update.confidence }),
                    ...(update.observedAt === undefined ? {} : { observedAt: update.observedAt }),
                  },
                },
              },
        ),
      },
    },
  };
}

function outputWithCitations(signalIds: readonly string[]): string {
  const output = JSON.parse(validOutput()) as {
    candidates: Array<{ sourceSignalIds: string[] }>;
  };
  output.candidates[0].sourceSignalIds = [...signalIds];
  return JSON.stringify(output);
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
    expect(context).toHaveProperty("acceptedSignals");
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

  it.each([
    ["low-confidence", { confidence: 0.49 }],
    ["stale", { observedAt: contractFixtureCandidateBatch.envelope.occurredAt - 15_001 }],
    ["future-dated", { observedAt: contractFixtureCandidateBatch.envelope.occurredAt + 1 }],
  ] as const)("omits and rejects %s evidence", async (_label, update) => {
    const input = withKnownSignalProvenance(await candidateInput(), update);
    const signalId = knownSignalId(input);
    const requests: Parameters<StructuredCandidateTransport["generate"]>[0][] = [];
    const strategy = createOpenAICandidateStrategy({
      providerId: "openai/fixture-model",
      model: "fixture-model",
      transport: {
        async generate(request) {
          requests.push(request);
          return { outputText: validOutput(signalId) };
        },
      },
    });

    await expect(strategy.generate(input)).rejects.toMatchObject({ reason: "malformed" });
    expect(JSON.parse(requests[0].input)).toMatchObject({ acceptedSignals: [] });
  });

  it("deduplicates citations before deriving confidence", async () => {
    const input = await candidateInput();
    const signalId = knownSignalId(input);
    const generate = (sourceSignalIds: readonly string[]) => createOpenAICandidateStrategy({
      providerId: "openai/fixture-model",
      model: "fixture-model",
      transport: { generate: async () => ({ outputText: outputWithCitations(sourceSignalIds) }) },
    }).generate(input);

    const single = await generate([signalId]);
    const duplicated = await generate([signalId, signalId, signalId]);
    expect(duplicated[0].sourceSignalIds).toEqual([signalId]);
    expect(duplicated[0].confidence).toBe(single[0].confidence);
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
      environment: { CHATXPT_LLM_ENABLED: "true" },
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
    const requests: Parameters<StructuredCandidateTransport["generate"]>[0][] = [];
    const success = createConfiguredCandidateProvider({
      environment: { CHATXPT_LLM_ENABLED: "true" },
      transport: {
        generate: async (request) => {
          requests.push(request);
          return { outputText: validOutput(knownSignalId(input)) };
        },
      },
    });
    expect(success).toMatchObject({
      mode: "provider-with-fallback",
      reason: "configured",
      providerId: "openai/gpt-5.6-terra",
    });
    await expect(success.provider.generate(input)).resolves.toMatchObject({
      candidates: [
        { generation: { method: "ai-provider", provider: "openai/gpt-5.6-terra" } },
        { generation: { method: "ai-provider", provider: "openai/gpt-5.6-terra" } },
        { generation: { method: "ai-provider", provider: "openai/gpt-5.6-terra" } },
      ],
    });
    expect(requests[0].model).toBe("gpt-5.6-terra");

    const fallback = createConfiguredCandidateProvider({
      environment: { CHATXPT_LLM_ENABLED: "true" },
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
