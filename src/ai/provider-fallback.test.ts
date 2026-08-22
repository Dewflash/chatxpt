import { describe, expect, it, vi } from "vitest";

import {
  contractFixtureAudienceSnapshot,
  contractFixtureCandidateBatch,
  contractFixtureEnvelope,
  contractFixtureGameplaySnapshot,
  contractFixtureProfile,
} from "../core/testing";
import type { CandidateInput, QuestCandidate } from "../core";
import {
  createProviderFallbackGenerationStrategy,
  createValidatingCandidateProvider,
  createValidatingIntelligenceProvider,
  ProviderGenerationError,
  summariseProviderAttempts,
  type CandidateGenerationStrategy,
  type ProviderAttemptObservation,
  type ProviderFailureReason,
  type ProviderTimeoutScheduler,
} from "./index";

const PROVIDER_ID = "fixture-free-provider/pinned-model";

async function candidateInput(): Promise<CandidateInput> {
  const intelligence = await createValidatingIntelligenceProvider().analyse({
    envelope: contractFixtureEnvelope,
    gameplay: contractFixtureGameplaySnapshot,
    audience: contractFixtureAudienceSnapshot,
    profile: contractFixtureProfile,
  });
  return {
    envelope: contractFixtureCandidateBatch.envelope,
    intelligence,
    profile: contractFixtureProfile,
    recentQuestTitles: [],
    streamerGoal: null,
    activeChatXptQuest: null,
  };
}

function candidates(
  method: "ai-provider" | "algorithmic" | "deterministic-fallback",
  provider: string | null,
): QuestCandidate[] {
  return contractFixtureCandidateBatch.candidates.map((candidate, index) => ({
    ...candidate,
    candidateId: `${method}-candidate-${index + 1}`,
    rationale: "Unknown-safe candidate used only for provider and fallback fixture tests.",
    sourceSignalIds: [],
    confidence: method === "ai-provider" ? 0.75 : 0.5,
    generation: {
      method,
      provider,
      generatedAt: contractFixtureCandidateBatch.envelope.occurredAt,
    },
  }));
}

function createProvider(options: {
  providerStrategy: CandidateGenerationStrategy;
  algorithmicStrategy?: CandidateGenerationStrategy;
  observe?: (observation: ProviderAttemptObservation) => void;
  scheduler?: ProviderTimeoutScheduler;
  now?: () => number;
}) {
  return createValidatingCandidateProvider(
    createProviderFallbackGenerationStrategy({
      providerId: PROVIDER_ID,
      providerStrategy: options.providerStrategy,
      algorithmicStrategy: options.algorithmicStrategy ?? {
        generate: () => candidates("algorithmic", null),
      },
      timeoutMs: 2_000,
      observe: options.observe,
      scheduler: options.scheduler,
      now: options.now,
    }),
  );
}

describe("provider fallback candidate generation", () => {
  it("returns exactly three correctly labelled provider candidates without fallback", async () => {
    const observations: ProviderAttemptObservation[] = [];
    const algorithmicStrategy = { generate: vi.fn(() => candidates("algorithmic", null)) };
    const provider = createProvider({
      providerStrategy: { generate: () => candidates("ai-provider", PROVIDER_ID) },
      algorithmicStrategy,
      observe: (observation) => observations.push(observation),
      now: (() => {
        const times = [10, 24];
        return () => times.shift() ?? 24;
      })(),
    });

    const batch = await provider.generate(await candidateInput());

    expect(batch.candidates).toHaveLength(3);
    expect(batch.candidates.every(({ generation }) => generation.method === "ai-provider")).toBe(
      true,
    );
    expect(algorithmicStrategy.generate).not.toHaveBeenCalled();
    expect(observations).toEqual([
      {
        providerId: PROVIDER_ID,
        status: "succeeded",
        durationMs: 14,
        fallbackOutcome: "not-used",
      },
    ]);
  });

  const classifiedFailures: readonly [
    ProviderFailureReason,
    () => Error,
  ][] = [
    ["refusal", () => new ProviderGenerationError("refusal", "fixture refusal")],
    ["rate-limited", () => new ProviderGenerationError("rate-limited", "fixture limit")],
    ["unavailable", () => new ProviderGenerationError("unavailable", "fixture outage")],
    ["error", () => new Error("unclassified fixture error")],
  ];

  it.each(classifiedFailures)(
    "uses the credential-free algorithmic strategy after %s",
    async (expectedStatus, createError) => {
      const observations: ProviderAttemptObservation[] = [];
      const provider = createProvider({
        providerStrategy: {
          generate: () => {
            throw createError();
          },
        },
        observe: (observation) => observations.push(observation),
      });

      const batch = await provider.generate(await candidateInput());

      expect(batch.candidates).toHaveLength(3);
      expect(
        batch.candidates.every(
          ({ sourceSignalIds, generation }) =>
            generation.method === "algorithmic" &&
            generation.provider === null &&
            sourceSignalIds.length === 0,
        ),
      ).toBe(true);
      expect(observations).toHaveLength(1);
      expect(observations[0]).toMatchObject({
        providerId: PROVIDER_ID,
        status: expectedStatus,
        fallbackOutcome: "succeeded",
      });
    },
  );

  it.each([
    ["partial batch", () => candidates("ai-provider", PROVIDER_ID).slice(0, 2)],
    [
      "overfull batch",
      () => [
        ...candidates("ai-provider", PROVIDER_ID),
        {
          ...candidates("ai-provider", PROVIDER_ID)[0],
          candidateId: "ai-provider-candidate-4",
          title: "Fourth Fixture Option",
        },
      ],
    ],
    [
      "invalid candidate schema",
      () =>
        candidates("ai-provider", PROVIDER_ID).map((candidate, index) =>
          index === 0 ? { ...candidate, title: "x" } : candidate,
        ),
    ],
    [
      "duplicate title",
      () =>
        candidates("ai-provider", PROVIDER_ID).map((candidate, index, all) =>
          index === 1 ? { ...candidate, title: all[0].title } : candidate,
        ),
    ],
    ["incorrect method label", () => candidates("deterministic-fallback", null)],
  ])("classifies %s provider output as malformed", async (_label, providerCandidates) => {
    const observations: ProviderAttemptObservation[] = [];
    const provider = createProvider({
      providerStrategy: { generate: providerCandidates },
      observe: (observation) => observations.push(observation),
    });

    await expect(provider.generate(await candidateInput())).resolves.toMatchObject({
      candidates: [
        { generation: { method: "algorithmic", provider: null } },
        { generation: { method: "algorithmic", provider: null } },
        { generation: { method: "algorithmic", provider: null } },
      ],
    });
    expect(observations[0]).toMatchObject({
      status: "malformed",
      fallbackOutcome: "succeeded",
    });
  });

  it("times out a pending provider and records only privacy-safe metadata", async () => {
    let triggerTimeout: (() => void) | undefined;
    const scheduler: ProviderTimeoutScheduler = {
      schedule(callback) {
        triggerTimeout = callback;
        return "fixture-timeout";
      },
      cancel: vi.fn(),
    };
    const observations: ProviderAttemptObservation[] = [];
    const provider = createProvider({
      providerStrategy: { generate: () => new Promise<QuestCandidate[]>(() => undefined) },
      scheduler,
      observe: (observation) => observations.push(observation),
    });

    const pending = provider.generate(await candidateInput());
    await Promise.resolve();
    expect(triggerTimeout).toBeTypeOf("function");
    triggerTimeout?.();

    const batch = await pending;
    expect(batch.candidates).toHaveLength(3);
    expect(batch.candidates.every(({ generation }) => generation.method === "algorithmic")).toBe(
      true,
    );
    expect(observations).toEqual([
      {
        providerId: PROVIDER_ID,
        status: "timeout",
        durationMs: expect.any(Number),
        fallbackOutcome: "succeeded",
      },
    ]);
    expect(Object.keys(observations[0]).sort()).toEqual([
      "durationMs",
      "fallbackOutcome",
      "providerId",
      "status",
    ]);
    expect(scheduler.cancel).toHaveBeenCalledWith("fixture-timeout");
  });

  it("preserves caller cancellation without invoking algorithmic fallback", async () => {
    const controller = new AbortController();
    let markProviderStarted: (() => void) | undefined;
    const providerStarted = new Promise<void>((resolve) => {
      markProviderStarted = resolve;
    });
    const algorithmicStrategy = { generate: vi.fn(() => candidates("algorithmic", null)) };
    const observations: ProviderAttemptObservation[] = [];
    const provider = createProvider({
      providerStrategy: {
        generate: (_input, signal) =>
          new Promise<QuestCandidate[]>((_resolve, reject) => {
            markProviderStarted?.();
            signal?.addEventListener("abort", () => reject(signal.reason), { once: true });
          }),
      },
      algorithmicStrategy,
      observe: (observation) => observations.push(observation),
    });

    const pending = provider.generate(await candidateInput(), controller.signal);
    await providerStarted;
    controller.abort(new Error("caller cancelled fixture generation"));

    await expect(pending).rejects.toThrow("caller cancelled fixture generation");
    expect(algorithmicStrategy.generate).not.toHaveBeenCalled();
    expect(observations).toEqual([]);
  });

  it("rejects invalid algorithmic output and records failed recovery", async () => {
    const observations: ProviderAttemptObservation[] = [];
    const provider = createProvider({
      providerStrategy: {
        generate: () => {
          throw new ProviderGenerationError("unavailable", "fixture provider unavailable");
        },
      },
      algorithmicStrategy: {
        generate: () => candidates("algorithmic", null).slice(0, 2),
      },
      observe: (observation) => observations.push(observation),
    });

    await expect(provider.generate(await candidateInput())).rejects.toThrow(
      "Algorithmic fallback output did not match",
    );
    expect(observations[0]).toMatchObject({
      status: "unavailable",
      fallbackOutcome: "failed",
    });
  });

  it("does not let an observability callback break successful generation", async () => {
    const provider = createProvider({
      providerStrategy: { generate: () => candidates("ai-provider", PROVIDER_ID) },
      observe: () => {
        throw new Error("fixture metrics sink unavailable");
      },
    });

    await expect(provider.generate(await candidateInput())).resolves.toHaveProperty(
      "candidates.length",
      3,
    );
  });

  it("validates provider identity and timeout configuration before use", () => {
    const providerStrategy = { generate: () => candidates("ai-provider", PROVIDER_ID) };
    const algorithmicStrategy = { generate: () => candidates("algorithmic", null) };

    expect(() =>
      createProviderFallbackGenerationStrategy({
        providerId: " untrimmed ",
        providerStrategy,
        algorithmicStrategy,
        timeoutMs: 2_000,
      }),
    ).toThrow("providerId");
    expect(() =>
      createProviderFallbackGenerationStrategy({
        providerId: PROVIDER_ID,
        providerStrategy,
        algorithmicStrategy,
        timeoutMs: 0,
      }),
    ).toThrow("timeoutMs");
  });
});

describe("provider attempt summaries", () => {
  it("reports pinned-provider rates and nearest-rank p50/p95 latency", () => {
    const summary = summariseProviderAttempts([
      {
        providerId: PROVIDER_ID,
        status: "succeeded",
        durationMs: 10,
        fallbackOutcome: "not-used",
      },
      {
        providerId: PROVIDER_ID,
        status: "malformed",
        durationMs: 20,
        fallbackOutcome: "succeeded",
      },
      {
        providerId: PROVIDER_ID,
        status: "timeout",
        durationMs: 30,
        fallbackOutcome: "succeeded",
      },
      {
        providerId: PROVIDER_ID,
        status: "rate-limited",
        durationMs: 40,
        fallbackOutcome: "failed",
      },
    ]);

    expect(summary).toMatchObject({
      providerId: PROVIDER_ID,
      attemptCount: 4,
      providerSuccessRate: 0.25,
      fallbackRate: 0.75,
      fallbackSuccessRate: 2 / 3,
      malformedRate: 0.25,
      timeoutRate: 0.25,
      rateLimitedRate: 0.25,
      p50LatencyMs: 20,
      p95LatencyMs: 40,
      statusCounts: {
        succeeded: 1,
        timeout: 1,
        refusal: 0,
        "rate-limited": 1,
        unavailable: 0,
        malformed: 1,
        error: 0,
      },
    });
  });

  it("rejects empty, mixed-provider, and inconsistent observations", () => {
    expect(() => summariseProviderAttempts([])).toThrow("At least one");
    expect(() =>
      summariseProviderAttempts([
        {
          providerId: PROVIDER_ID,
          status: "succeeded",
          durationMs: 10,
          fallbackOutcome: "not-used",
        },
        {
          providerId: "different-provider/model",
          status: "timeout",
          durationMs: 20,
          fallbackOutcome: "succeeded",
        },
      ]),
    ).toThrow("one pinned providerId");
    expect(() =>
      summariseProviderAttempts([
        {
          providerId: PROVIDER_ID,
          status: "timeout",
          durationMs: 20,
          fallbackOutcome: "not-used",
        },
      ]),
    ).toThrow("must record");
  });
});
