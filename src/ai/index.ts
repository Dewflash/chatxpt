/** Role 2 public boundary for analysed intelligence and quest-candidate production. */
export {
  createValidatingCandidateProvider,
  createValidatingIntelligenceProvider,
} from "./providers";
export type { CandidateGenerationStrategy } from "./providers";
export {
  createProviderFallbackGenerationStrategy,
  ProviderGenerationError,
  providerAttemptStatuses,
  summariseProviderAttempts,
} from "./provider-fallback";
export type {
  AlgorithmicFallbackOutcome,
  ProviderAttemptObservation,
  ProviderAttemptStatus,
  ProviderEvaluationSummary,
  ProviderFailureReason,
  ProviderFallbackGenerationOptions,
  ProviderTimeoutScheduler,
} from "./provider-fallback";
export {
  candidateBatchSchema,
  candidateGenerationSchema,
  intelligenceSnapshotSchema,
  questCandidateSchema,
} from "../core";
export type {
  CandidateBatch,
  CandidateInput,
  CandidateProvider,
  IntelligenceInput,
  IntelligenceProvider,
  IntelligenceSnapshot,
  QuestCandidate,
} from "../core";
