/** Role 2 public boundary for gameplay and audience extraction. */
export type {
  AudienceExtractionPipeline,
  GameplayExtractionPipeline,
} from "./ports";
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
