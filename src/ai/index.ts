/** Role 2 public boundary for analysed intelligence and quest-candidate production. */
export { createAlgorithmicCandidateStrategy } from "./algorithmic-candidates";
export {
  createValidatingCandidateProvider,
  createValidatingIntelligenceProvider,
} from "./providers";
export type { CandidateGenerationStrategy } from "./providers";
export {
  candidateDraftJsonSchema,
  createOpenAICandidateStrategy,
} from "./openai-candidate-strategy";
export type {
  OpenAICandidateStrategyOptions,
  StructuredCandidateTransport,
  StructuredCandidateTransportRequest,
  StructuredCandidateTransportResponse,
} from "./openai-candidate-strategy";
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
export { createConfiguredCandidateProvider } from "./server";
export type {
  ConfiguredCandidateProvider,
  ConfiguredCandidateProviderOptions,
} from "./server";
