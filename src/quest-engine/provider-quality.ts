/**
 * Evaluation-only Role 3 rubric for comparing candidate batches from AI providers.
 *
 * This module does not select or call a provider and is not part of the runtime
 * quest lifecycle. Role 2 supplies measured provider results; Role 3 applies
 * these quest-quality gates and scores before the joint recommendation.
 */

export const PROVIDER_QUALITY_SCORE_MAXIMUM = 4 as const;
export const PROVIDER_QUALITY_PASS_RATIO = 0.75;
export const PROVIDER_QUALITY_CRITICAL_MINIMUM = 2 as const;

export const PROVIDER_QUALITY_CRITERIA = [
  { id: "feasibility", weight: 3 },
  { id: "clarity", weight: 2 },
  { id: "diversity", weight: 2 },
  { id: "novelty", weight: 1 },
  { id: "momentFit", weight: 2 },
  { id: "streamerFit", weight: 2 },
  { id: "audienceFit", weight: 2 },
  { id: "durationDifficultyFit", weight: 2 },
  { id: "refusalRecovery", weight: 2 },
] as const;

export type ProviderQualityCriterion =
  (typeof PROVIDER_QUALITY_CRITERIA)[number]["id"];
export type ProviderQualityScore = 0 | 1 | 2 | 3 | 4;

export interface ProviderQualityHardGates {
  readonly exactlyThreeCandidates: boolean;
  readonly schemaValid: boolean;
  readonly deterministicValidationPassed: boolean;
  readonly evidenceTraceable: boolean;
  readonly credentialFreeFallbackPreserved: boolean;
}

export interface ProviderQualityEvaluationInput {
  readonly caseId: string;
  readonly gates: ProviderQualityHardGates;
  readonly scores: Readonly<Record<ProviderQualityCriterion, ProviderQualityScore>>;
}

export type ProviderQualityFailureReason =
  | `hard-gate:${keyof ProviderQualityHardGates}`
  | `critical-score:${"feasibility" | "clarity" | "refusalRecovery"}`
  | "weighted-score:below-threshold";

export interface ProviderQualityEvaluation {
  readonly caseId: string;
  readonly passed: boolean;
  readonly weightedScore: number;
  readonly maximumWeightedScore: number;
  readonly scoreRatio: number;
  readonly failureReasons: readonly ProviderQualityFailureReason[];
}

const CRITICAL_CRITERIA = ["feasibility", "clarity", "refusalRecovery"] as const;
const HARD_GATE_ORDER: readonly (keyof ProviderQualityHardGates)[] = [
  "exactlyThreeCandidates",
  "schemaValid",
  "deterministicValidationPassed",
  "evidenceTraceable",
  "credentialFreeFallbackPreserved",
];

/** Applies the recorded Role 3 gates and weighted rubric to one repeatable trial case. */
export function evaluateProviderQuestQuality(
  input: ProviderQualityEvaluationInput,
): ProviderQualityEvaluation {
  const maximumWeightedScore = PROVIDER_QUALITY_CRITERIA.reduce(
    (total, criterion) => total + criterion.weight * PROVIDER_QUALITY_SCORE_MAXIMUM,
    0,
  );
  const weightedScore = PROVIDER_QUALITY_CRITERIA.reduce(
    (total, criterion) => total + input.scores[criterion.id] * criterion.weight,
    0,
  );
  const scoreRatio = weightedScore / maximumWeightedScore;
  const failureReasons: ProviderQualityFailureReason[] = [];

  for (const gate of HARD_GATE_ORDER) {
    if (!input.gates[gate]) {
      failureReasons.push(`hard-gate:${gate}`);
    }
  }

  for (const criterion of CRITICAL_CRITERIA) {
    if (input.scores[criterion] < PROVIDER_QUALITY_CRITICAL_MINIMUM) {
      failureReasons.push(`critical-score:${criterion}`);
    }
  }

  if (scoreRatio < PROVIDER_QUALITY_PASS_RATIO) {
    failureReasons.push("weighted-score:below-threshold");
  }

  return {
    caseId: input.caseId,
    passed: failureReasons.length === 0,
    weightedScore,
    maximumWeightedScore,
    scoreRatio,
    failureReasons,
  };
}
