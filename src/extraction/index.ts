/** Role 2 public boundary for gameplay and audience extraction. */
export type {
  AudienceExtractionPipeline,
  GameplayExtractionPipeline,
} from "./ports";
export { createAudienceSignalPipeline } from "./audience-pipeline";
export type { AudienceSignalPipelineOptions } from "./audience-pipeline";
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
  measurePixelChange,
  streamVisualFrameMeasurements,
} from "./visual-measurements";
export type {
  FramePixelSampler,
  PixelChangeMeasurement,
  PixelSampleSize,
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
export { createMultiGameVisionEvidencePolicy } from "./vision-evidence-policy";
export type { MultiGameVisionEvidencePolicy } from "./vision-evidence-policy";
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
