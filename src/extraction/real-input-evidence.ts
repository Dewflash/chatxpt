import type { VisualFrameMeasurement } from "./visual-measurements";

export type GameplayEvidenceLabel = "quiet" | "action" | "transition";
export type ExtractionEvidenceClass = "live" | "diagnostic";

export interface GameplayEvidenceAnnotation {
  readonly label: GameplayEvidenceLabel;
  readonly startsAt: number;
  readonly endsAt: number;
  readonly note?: string;
}

export interface SelectiveOcrEvidenceObservation {
  readonly frameId: string;
  readonly regionId: string;
  readonly status: "recognized" | "unknown" | "error";
  readonly confidence: number | null;
  readonly processingMs: number;
  readonly parserResult: "matched" | "unmatched" | "not-run";
  readonly signalKind: string | null;
}

export interface UnknownEvidenceObservation {
  readonly signalKind: string;
  readonly reason:
    | "not-observed"
    | "low-confidence"
    | "unsupported"
    | "conflicting"
    | "permission-denied"
    | "dependency-unavailable";
  readonly frameId?: string;
}

export interface ExtractionEvidenceRunInput {
  readonly runId: string;
  readonly sampleId: string;
  readonly authorization: "team-owned" | "explicitly-authorized";
  readonly evidenceClass: ExtractionEvidenceClass;
  readonly measurements: readonly VisualFrameMeasurement[];
  readonly annotations: readonly GameplayEvidenceAnnotation[];
  readonly ocrObservations?: readonly SelectiveOcrEvidenceObservation[];
  readonly unknownObservations?: readonly UnknownEvidenceObservation[];
}

export interface NumericMetricSummary {
  readonly count: number;
  readonly min: number | null;
  readonly mean: number | null;
  readonly p50: number | null;
  readonly p95: number | null;
  readonly max: number | null;
}

export interface LabelMeasurementSummary {
  readonly label: GameplayEvidenceLabel;
  readonly annotatedFrameCount: number;
  readonly differentialFrameCount: number;
  readonly meanLumaDelta: NumericMetricSummary;
  readonly changedPixelRatio: NumericMetricSummary;
  readonly processingMs: NumericMetricSummary;
}

export interface ExtractionEvidenceRun {
  readonly runId: string;
  readonly sampleId: string;
  readonly authorization: "team-owned" | "explicitly-authorized";
  readonly evidenceClass: ExtractionEvidenceClass;
  readonly inputSource: "obs-virtual-camera";
  readonly rawFramesPersisted: false;
  readonly annotationSource: "separate-human-review";
  readonly frameCount: number;
  readonly differentialFrameCount: number;
  readonly unannotatedFrameCount: number;
  readonly capturedFrom: number;
  readonly capturedTo: number;
  readonly processingMs: NumericMetricSummary;
  readonly labels: Readonly<Record<GameplayEvidenceLabel, LabelMeasurementSummary>>;
  readonly annotations: readonly GameplayEvidenceAnnotation[];
  readonly measurements: readonly {
    frameId: string;
    capturedAt: number;
    meanLumaDelta: number | null;
    changedPixelRatio: number | null;
    processingMs: number;
  }[];
  readonly ocrObservations: readonly SelectiveOcrEvidenceObservation[];
  readonly unknownObservations: readonly UnknownEvidenceObservation[];
}

export interface SanitisedAudienceFixtureEvidence {
  readonly fixtureId: string;
  readonly evidenceClass: ExtractionEvidenceClass;
  readonly source: "twitch";
  readonly sourceEventCount: number;
  readonly privacyReviewed: boolean;
  readonly viewerIdentifiersRemoved: boolean;
  readonly messageTextSanitised: boolean;
  readonly rawInputPersisted: false;
}

export interface ExtractionEvidenceBundleAssessment {
  readonly structurallyComplete: boolean;
  readonly realEvidenceReady: boolean;
  readonly sampleCount: number;
  readonly labelsCovered: readonly GameplayEvidenceLabel[];
  readonly selectiveOcrCovered: boolean;
  readonly latencyCovered: boolean;
  readonly honestUnknownCovered: boolean;
  readonly sanitisedAudienceCovered: boolean;
  readonly missing: readonly string[];
}

const LABELS: readonly GameplayEvidenceLabel[] = ["quiet", "action", "transition"];
const EVIDENCE_CLASSES: readonly ExtractionEvidenceClass[] = ["live", "diagnostic"];
const AUTHORIZATION_CLASSES = ["team-owned", "explicitly-authorized"] as const;
const OCR_STATUSES = ["recognized", "unknown", "error"] as const;
const OCR_PARSER_RESULTS = ["matched", "unmatched", "not-run"] as const;
const UNKNOWN_REASONS = [
  "not-observed",
  "low-confidence",
  "unsupported",
  "conflicting",
  "permission-denied",
  "dependency-unavailable",
] as const;

function assertIdentifier(name: string, value: string): void {
  if (value.trim() === "" || value.length > 128) {
    throw new RangeError(`${name} must contain 1 to 128 characters`);
  }
}

function assertTimestamp(name: string, value: number): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative integer timestamp`);
  }
}

function assertNonNegativeFinite(name: string, value: number): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative finite number`);
  }
}

function assertOptionalUnitInterval(name: string, value: number | null): void {
  if (value !== null && (!Number.isFinite(value) || value < 0 || value > 1)) {
    throw new RangeError(`${name} must be null or between 0 and 1`);
  }
}

function percentile(sorted: readonly number[], percentileValue: number): number | null {
  if (sorted.length === 0) return null;
  const index = Math.max(0, Math.ceil(sorted.length * percentileValue) - 1);
  return sorted[Math.min(index, sorted.length - 1)];
}

export function summariseNumericMetrics(values: readonly number[]): NumericMetricSummary {
  for (const value of values) assertNonNegativeFinite("metric", value);
  if (values.length === 0) {
    return { count: 0, min: null, mean: null, p50: null, p95: null, max: null };
  }
  const sorted = [...values].sort((left, right) => left - right);
  const total = sorted.reduce((sum, value) => sum + value, 0);
  return {
    count: sorted.length,
    min: sorted[0],
    mean: total / sorted.length,
    p50: percentile(sorted, 0.5),
    p95: percentile(sorted, 0.95),
    max: sorted[sorted.length - 1],
  };
}

function validateAnnotations(
  annotations: readonly GameplayEvidenceAnnotation[],
): GameplayEvidenceAnnotation[] {
  const sorted = annotations
    .map((annotation) => {
      assertTimestamp("annotation startsAt", annotation.startsAt);
      assertTimestamp("annotation endsAt", annotation.endsAt);
      if (!LABELS.includes(annotation.label)) {
        throw new RangeError("annotation label must be quiet, action, or transition");
      }
      if (annotation.endsAt < annotation.startsAt) {
        throw new RangeError("annotation endsAt cannot precede startsAt");
      }
      if (annotation.note !== undefined && annotation.note.length > 240) {
        throw new RangeError("annotation note must not exceed 240 characters");
      }
      return { ...annotation };
    })
    .sort((left, right) => left.startsAt - right.startsAt);

  for (let index = 1; index < sorted.length; index += 1) {
    if (sorted[index].startsAt <= sorted[index - 1].endsAt) {
      throw new RangeError("gameplay evidence annotations must not overlap");
    }
  }
  return sorted;
}

function annotationFor(
  capturedAt: number,
  annotations: readonly GameplayEvidenceAnnotation[],
): GameplayEvidenceAnnotation | null {
  return (
    annotations.find(
      (annotation) => capturedAt >= annotation.startsAt && capturedAt <= annotation.endsAt,
    ) ?? null
  );
}

function validateOcrObservation(
  observation: SelectiveOcrEvidenceObservation,
  frameIds: ReadonlySet<string>,
): SelectiveOcrEvidenceObservation {
  assertIdentifier("OCR frameId", observation.frameId);
  assertIdentifier("OCR regionId", observation.regionId);
  if (!frameIds.has(observation.frameId)) {
    throw new RangeError(`OCR observation references unknown frame ${observation.frameId}`);
  }
  if (!OCR_STATUSES.includes(observation.status)) {
    throw new RangeError("OCR status is invalid");
  }
  if (!OCR_PARSER_RESULTS.includes(observation.parserResult)) {
    throw new RangeError("OCR parserResult is invalid");
  }
  assertOptionalUnitInterval("OCR confidence", observation.confidence);
  assertNonNegativeFinite("OCR processingMs", observation.processingMs);
  if (observation.status === "recognized" && observation.confidence === null) {
    throw new RangeError("recognized OCR observations require confidence");
  }
  if (observation.parserResult === "matched" && observation.signalKind === null) {
    throw new RangeError("matched OCR observations require signalKind");
  }
  if (observation.signalKind !== null) assertIdentifier("OCR signalKind", observation.signalKind);
  return { ...observation };
}

function validateUnknownObservation(
  observation: UnknownEvidenceObservation,
  frameIds: ReadonlySet<string>,
): UnknownEvidenceObservation {
  assertIdentifier("unknown signalKind", observation.signalKind);
  if (!UNKNOWN_REASONS.includes(observation.reason)) {
    throw new RangeError("unknown observation reason is invalid");
  }
  if (observation.frameId !== undefined) {
    assertIdentifier("unknown frameId", observation.frameId);
    if (!frameIds.has(observation.frameId)) {
      throw new RangeError(`unknown observation references unknown frame ${observation.frameId}`);
    }
  }
  return { ...observation };
}

export function createExtractionEvidenceRun(
  input: ExtractionEvidenceRunInput,
): ExtractionEvidenceRun {
  assertIdentifier("runId", input.runId);
  assertIdentifier("sampleId", input.sampleId);
  if (!EVIDENCE_CLASSES.includes(input.evidenceClass)) {
    throw new RangeError("evidenceClass must be live or diagnostic");
  }
  if (!AUTHORIZATION_CLASSES.includes(input.authorization)) {
    throw new RangeError("authorization must be team-owned or explicitly-authorized");
  }
  if (input.measurements.length === 0) {
    throw new RangeError("an extraction evidence run requires at least one measurement");
  }

  const annotations = validateAnnotations(input.annotations);
  const frameIds = new Set<string>();
  let previousCapturedAt = -1;
  const measurements = input.measurements.map((measurement) => {
    const { frame } = measurement;
    assertIdentifier("frameId", frame.frameId);
    if (frameIds.has(frame.frameId)) {
      throw new RangeError(`duplicate evidence frame ${frame.frameId}`);
    }
    frameIds.add(frame.frameId);
    if (frame.envelope.source !== "obs-virtual-camera") {
      throw new RangeError("evidence measurements must originate from OBS Virtual Camera");
    }
    if (frame.envelope.evidenceClass !== input.evidenceClass) {
      throw new RangeError("measurement evidence class must match the evidence run");
    }
    assertTimestamp("capturedAt", frame.capturedAt);
    if (frame.capturedAt < previousCapturedAt) {
      throw new RangeError("evidence measurements must be ordered by capturedAt");
    }
    previousCapturedAt = frame.capturedAt;
    assertNonNegativeFinite("processingMs", measurement.processingMs);
    assertOptionalUnitInterval("meanLumaDelta", measurement.meanLumaDelta);
    assertOptionalUnitInterval("changedPixelRatio", measurement.changedPixelRatio);
    if ((measurement.meanLumaDelta === null) !== (measurement.changedPixelRatio === null)) {
      throw new RangeError("visual difference metrics must both be present or both be null");
    }
    return {
      frameId: frame.frameId,
      capturedAt: frame.capturedAt,
      meanLumaDelta: measurement.meanLumaDelta,
      changedPixelRatio: measurement.changedPixelRatio,
      processingMs: measurement.processingMs,
    };
  });

  const labels = Object.fromEntries(
    LABELS.map((label) => {
      const labelled = measurements.filter(
        (measurement) => annotationFor(measurement.capturedAt, annotations)?.label === label,
      );
      const differential = labelled.filter(
        (measurement) => measurement.meanLumaDelta !== null,
      );
      return [
        label,
        {
          label,
          annotatedFrameCount: labelled.length,
          differentialFrameCount: differential.length,
          meanLumaDelta: summariseNumericMetrics(
            differential.map((measurement) => measurement.meanLumaDelta as number),
          ),
          changedPixelRatio: summariseNumericMetrics(
            differential.map((measurement) => measurement.changedPixelRatio as number),
          ),
          processingMs: summariseNumericMetrics(labelled.map(({ processingMs }) => processingMs)),
        } satisfies LabelMeasurementSummary,
      ];
    }),
  ) as Record<GameplayEvidenceLabel, LabelMeasurementSummary>;

  const ocrObservations = (input.ocrObservations ?? []).map((observation) =>
    validateOcrObservation(observation, frameIds),
  );
  const unknownObservations = (input.unknownObservations ?? []).map((observation) =>
    validateUnknownObservation(observation, frameIds),
  );

  return {
    runId: input.runId,
    sampleId: input.sampleId,
    authorization: input.authorization,
    evidenceClass: input.evidenceClass,
    inputSource: "obs-virtual-camera",
    rawFramesPersisted: false,
    annotationSource: "separate-human-review",
    frameCount: measurements.length,
    differentialFrameCount: measurements.filter(({ meanLumaDelta }) => meanLumaDelta !== null).length,
    unannotatedFrameCount: measurements.filter(
      ({ capturedAt }) => annotationFor(capturedAt, annotations) === null,
    ).length,
    capturedFrom: measurements[0].capturedAt,
    capturedTo: measurements[measurements.length - 1].capturedAt,
    processingMs: summariseNumericMetrics(measurements.map(({ processingMs }) => processingMs)),
    labels,
    annotations,
    measurements,
    ocrObservations,
    unknownObservations,
  };
}

function validateAudienceFixture(
  fixture: SanitisedAudienceFixtureEvidence,
): SanitisedAudienceFixtureEvidence {
  assertIdentifier("audience fixtureId", fixture.fixtureId);
  if (!EVIDENCE_CLASSES.includes(fixture.evidenceClass)) {
    throw new RangeError("audience evidenceClass must be live or diagnostic");
  }
  if (fixture.source !== "twitch") {
    throw new RangeError("audience evidence must originate from Twitch");
  }
  if (!Number.isInteger(fixture.sourceEventCount) || fixture.sourceEventCount <= 0) {
    throw new RangeError("audience sourceEventCount must be a positive integer");
  }
  return { ...fixture };
}

export function assessExtractionEvidenceBundle(input: {
  readonly runs: readonly ExtractionEvidenceRun[];
  readonly audienceFixtures?: readonly SanitisedAudienceFixtureEvidence[];
}): ExtractionEvidenceBundleAssessment {
  const runIds = input.runs.map(({ runId }) => runId);
  if (new Set(runIds).size !== runIds.length) {
    throw new RangeError("evidence run IDs must be distinct");
  }
  const audienceFixtures = (input.audienceFixtures ?? []).map(validateAudienceFixture);
  const sampleCount = new Set(input.runs.map(({ sampleId }) => sampleId)).size;
  const labelsCovered = LABELS.filter((label) =>
    input.runs.some((run) => run.labels[label].annotatedFrameCount > 0),
  );
  const selectiveOcrCovered = input.runs.some((run) => run.ocrObservations.length > 0);
  const latencyCovered = input.runs.every((run) => run.processingMs.count === run.frameCount);
  const honestUnknownCovered = input.runs.some((run) => run.unknownObservations.length > 0);
  const sanitisedAudienceCovered = audienceFixtures.some(
    (fixture) =>
      fixture.privacyReviewed &&
      fixture.viewerIdentifiersRemoved &&
      fixture.messageTextSanitised &&
      fixture.rawInputPersisted === false,
  );

  const missing: string[] = [];
  if (sampleCount < 2) missing.push("two separately identified gameplay samples");
  for (const label of LABELS) {
    if (!labelsCovered.includes(label)) missing.push(`${label} annotation coverage`);
  }
  if (!selectiveOcrCovered) missing.push("one selective OCR observation");
  if (!latencyCovered) missing.push("processing latency observations");
  if (!honestUnknownCovered) missing.push("an explicit unknown observation");
  if (!sanitisedAudienceCovered) missing.push("a privacy-reviewed sanitised audience fixture");

  const structurallyComplete = missing.length === 0;
  const allInputsLive =
    input.runs.length > 0 &&
    input.runs.every((run) => run.evidenceClass === "live") &&
    audienceFixtures.length > 0 &&
    audienceFixtures.every((fixture) => fixture.evidenceClass === "live");
  if (structurallyComplete && !allInputsLive) {
    missing.push("all completed inputs must be live before this becomes real evidence");
  }

  return {
    structurallyComplete,
    realEvidenceReady: structurallyComplete && allInputsLive,
    sampleCount,
    labelsCovered,
    selectiveOcrCovered,
    latencyCovered,
    honestUnknownCovered,
    sanitisedAudienceCovered,
    missing,
  };
}
