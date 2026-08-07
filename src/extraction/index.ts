/** Role 2 public boundary for gameplay and audience extraction. */
export type {
  AudienceExtractionPipeline,
  GameplayExtractionPipeline,
} from "./ports";
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
export { extractPixelRegion, runSelectiveOcrExperiment } from "./selective-ocr";
export type {
  OcrReading,
  PixelRegion,
  SelectiveOcrAdapter,
  SelectiveOcrMeasurement,
} from "./selective-ocr";
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
