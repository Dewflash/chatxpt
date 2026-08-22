/** Role 2 public boundary for gameplay and audience extraction. */
export type {
  AudienceExtractionPipeline,
  GameplayExtractionPipeline,
} from "./ports";
export { AudienceAnalyticsAccumulator, createAudienceSignalPipeline } from "./audience-pipeline";
export type {
  AudienceAnalyticsTopic,
  AudienceAnalyticsTopicEvidence,
  AudienceAnalyticsUpdate,
  AudienceSignalPipelineOptions,
} from "./audience-pipeline";
export {
  assessExtractionEvidenceAsset,
  extractionAssetAcquisitionSchema,
  extractionAssetKindSchema,
  extractionAssetStorageSchema,
  extractionAssetUseSchema,
  extractionEvidenceAssessmentSchema,
  extractionEvidenceAssetSchema,
} from "./evidence-catalog";
export type {
  ExtractionAssetAcquisition,
  ExtractionAssetKind,
  ExtractionAssetStorage,
  ExtractionAssetUse,
  ExtractionEvidenceAssessment,
  ExtractionEvidenceAsset,
} from "./evidence-catalog";
export {
  createBrowserCanvasPixelSampler,
  cropSampledPixelFrameToContent,
  measurePixelChange,
  streamVisualFrameMeasurements,
} from "./visual-measurements";
export { MinecraftObservationTracker } from "./minecraft-observation-tracker";
export type { MinecraftObservationTrackerOptions } from "./minecraft-observation-tracker";
export type {
  FramePixelSampler,
  FramePixelSampleRequest,
  PixelChangeMeasurement,
  PixelSampleSize,
  PixelSampleRect,
  SampledPixelFrame,
  VisualFrameMeasurement,
  VisualMeasurementOptions,
} from "./visual-measurements";
export {
  confirmTemporalOcr,
  extractPixelRegion,
  preprocessOcrRegion,
  runSelectiveOcrExperiment,
} from "./selective-ocr";
export type {
  OcrPreprocessOptions,
  OcrReading,
  PixelRegion,
  SelectiveOcrAdapter,
  SelectiveOcrMeasurement,
  TemporalOcrConfirmation,
} from "./selective-ocr";
export {
  assessExtractionEvidenceBundle,
  createExtractionEvidenceRun,
  summariseNumericMetrics,
} from "./real-input-evidence";
export type {
  ExtractionEvidenceBundleAssessment,
  ExtractionEvidenceClass,
  ExtractionEvidenceRun,
  ExtractionEvidenceRunInput,
  GameplayEvidenceAnnotation,
  GameplayEvidenceLabel,
  LabelMeasurementSummary,
  NumericMetricSummary,
  SanitisedAudienceFixtureEvidence,
  SelectiveOcrEvidenceObservation,
  UnknownEvidenceObservation,
} from "./real-input-evidence";
export {
  classifyVisualActivity,
  decideOcrBurst,
  deriveVisualActivityPolicy,
} from "./visual-classification";
export type {
  OcrBurstDecision,
  VisualActivityClassification,
  VisualActivityPolicy,
} from "./visual-classification";
export {
  brawlStarsGameProfile,
  createDefaultGameProfileRegistry,
  gameCalibrationProfileSchema,
  gameProfileSelectionSchema,
  GameProfileRegistry,
  genericActionGameProfile,
  minecraftJavaGameProfile,
  normalizedVisualRegionSchema,
} from "./game-profiles";
export type {
  GameCalibrationProfile,
  GameProfileSelection,
  NormalizedVisualRegion,
  ResolvedGameProfile,
} from "./game-profiles";
export { estimateGlobalTranslation, measureSpatialMotion } from "./spatial-motion";
export type {
  SpatialMotionCell,
  SpatialMotionMeasurement,
  SpatialMotionOptions,
  TranslationEstimate,
} from "./spatial-motion";
export {
  defaultMotionInterpretationPolicy,
  interpretMotionWindow,
  toGameplayActivity,
} from "./motion-interpretation";
export type {
  GameplayActivity,
  MotionInterpretation,
  MotionInterpretationPolicy,
  ObservableMotionState,
  TimedSpatialMotion,
} from "./motion-interpretation";
export {
  cadenceNeedsBurst,
  decideAdaptiveSampling,
  defaultAdaptiveSamplingPolicy,
  initialAdaptiveSamplingState,
} from "./adaptive-sampling";
export type {
  AdaptiveSamplingDecision,
  AdaptiveSamplingPolicy,
  AdaptiveSamplingState,
  AnalysisCadenceMode,
} from "./adaptive-sampling";
export { fingerprintMinecraftHud, measureRegionVisualFeatures } from "./minecraft-hud";
export type {
  MinecraftHudFact,
  MinecraftHudFingerprint,
  MinecraftHudFingerprintStatus,
  RegionVisualFeatures,
} from "./minecraft-hud";
export {
  isKnownMinecraftFact,
  knownMinecraftFact,
  minecraftAwareContextSchema,
  minecraftFactSchema,
  minecraftFactStatusSchema,
  minecraftGameFactsSchema,
  minecraftIntentContextSchema,
  minecraftSupportedFacts,
  minecraftUnknownFacts,
  unknownMinecraftFact,
} from "./minecraft-state";
export {
  buildGenericGameStateContext,
  genericGameFactSchema,
  genericGameFactStatusSchema,
  genericGameStateContextSchema,
} from "./game-state-context";
export { detectMinecraftMenuState } from "./minecraft-menu";
export { measureMinecraftActionVisuals } from "./minecraft-action-visual";
export { MinecraftBasicStateTracker } from "./minecraft-basic-state";
export { measureMinecraftCameraMotion } from "./minecraft-camera-motion";
export { deriveMinecraftRuntimeFacts } from "./minecraft-runtime";
export { detectMinecraftSceneFacts } from "./minecraft-scene";
export type {
  GenericGameFact,
  GenericGameFactStatus,
  GenericGameStateContext,
} from "./game-state-context";
export type {
  MinecraftAwareContext,
  MinecraftFact,
  MinecraftFactInput,
  MinecraftFactStatus,
  MinecraftGameFacts,
  MinecraftIntentContext,
} from "./minecraft-state";
export type { MinecraftMenuState } from "./minecraft-menu";
export type { MinecraftActionVisualMeasurement } from "./minecraft-action-visual";
export type {
  MinecraftBasicStateFacts,
  MinecraftCombatState,
  MinecraftEnvironmentState,
  MinecraftHealthTrend,
  MinecraftLifeState,
  MinecraftMovementState,
  MinecraftScreenState,
} from "./minecraft-basic-state";
export type { MinecraftCameraMotionMeasurement } from "./minecraft-camera-motion";
export type { MinecraftRuntimeFacts } from "./minecraft-runtime";
export type { MinecraftSceneFacts } from "./minecraft-scene";
export {
  fingerprintBrawlHud,
  parseBrawlOutcomeText,
  parseBrawlTimerText,
} from "./brawl-hud";
export type {
  BrawlHudFingerprint,
  BrawlHudFingerprintStatus,
} from "./brawl-hud";
export { MultiGameVisionAnalyzer, streamMultiGameVisionAssessments } from "./multi-game-vision";
export type {
  GameVisionExplanation,
  MultiGameVisionAnalyzerOptions,
  MultiGameVisionAssessment,
  MultiGameVisionStreamOptions,
  MultiGameVisionStreamOutput,
} from "./multi-game-vision";
export { buildMultiGameGameplaySnapshot } from "./game-vision-snapshot";
export { analyseRecordingReplay } from "./recording-replay";
export type {
  RecordingAnnotation,
  RecordingAnnotationLabel,
  RecordingReplayAssessment,
  RecordingReplayFrame,
  RecordingReplayResult,
  RecordingReplaySummary,
} from "./recording-replay";
export { createBrowserTesseractOcr } from "./tesseract-ocr";
export type {
  BrowserTesseractOcrHandle,
  BrowserTesseractOcrOptions,
  TesseractWorkerPort,
} from "./tesseract-ocr";
export { createMultiGameGameplayExtractionPipeline } from "./multi-game-pipeline";
export type { MultiGameGameplayPipelineOptions } from "./multi-game-pipeline";
export {
  audienceEventSchema,
  audienceSnapshotSchema,
  gameplayCapabilitiesSchema,
  gameplaySnapshotSchema,
  signalObservationSchema,
  signalProvenanceSchema,
} from "../core";
export type {
  AudienceEvent,
  AudienceEventSource,
  AudienceSnapshot,
  EphemeralGameplayFrame,
  FrameSource,
  GameplayCapabilities,
  GameplaySnapshot,
  SignalObservation,
  SignalProvenance,
} from "../core";
