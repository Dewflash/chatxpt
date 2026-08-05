import { describe, expect, it } from "vitest";

import {
  evaluateProviderQuestQuality,
  type ProviderQualityEvaluationInput,
} from "./provider-quality";

const passingCase: ProviderQualityEvaluationInput = {
  caseId: "supported-action-moment",
  gates: {
    exactlyThreeCandidates: true,
    schemaValid: true,
    deterministicValidationPassed: true,
    evidenceTraceable: true,
    credentialFreeFallbackPreserved: true,
  },
  scores: {
    feasibility: 4,
    clarity: 4,
    diversity: 4,
    novelty: 3,
    momentFit: 4,
    streamerFit: 4,
    audienceFit: 3,
    durationDifficultyFit: 4,
    refusalRecovery: 4,
  },
};

describe("evaluateProviderQuestQuality", () => {
  it("passes a high-quality batch that clears every hard gate", () => {
    const result = evaluateProviderQuestQuality(passingCase);

    expect(result.passed).toBe(true);
    expect(result.scoreRatio).toBeGreaterThanOrEqual(0.75);
    expect(result.failureReasons).toEqual([]);
  });

  it("rejects a batch with a hard-gate failure regardless of its quality scores", () => {
    const result = evaluateProviderQuestQuality({
      ...passingCase,
      gates: { ...passingCase.gates, deterministicValidationPassed: false },
    });

    expect(result.passed).toBe(false);
    expect(result.failureReasons).toContain(
      "hard-gate:deterministicValidationPassed",
    );
  });

  it("rejects a superficially strong batch that fails a critical criterion", () => {
    const result = evaluateProviderQuestQuality({
      ...passingCase,
      scores: { ...passingCase.scores, refusalRecovery: 1 },
    });

    expect(result.passed).toBe(false);
    expect(result.failureReasons).toContain("critical-score:refusalRecovery");
  });

  it("rejects a batch below the weighted quality threshold", () => {
    const result = evaluateProviderQuestQuality({
      ...passingCase,
      scores: {
        feasibility: 2,
        clarity: 2,
        diversity: 2,
        novelty: 2,
        momentFit: 2,
        streamerFit: 2,
        audienceFit: 2,
        durationDifficultyFit: 2,
        refusalRecovery: 2,
      },
    });

    expect(result.passed).toBe(false);
    expect(result.failureReasons).toEqual(["weighted-score:below-threshold"]);
  });

  it("returns identical evidence for identical trial input", () => {
    expect(evaluateProviderQuestQuality(passingCase)).toEqual(
      evaluateProviderQuestQuality(passingCase),
    );
  });
});
