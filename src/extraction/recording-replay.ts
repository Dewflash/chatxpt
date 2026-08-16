import type { GameProfileSelection } from "./game-profiles";
import {
  MultiGameVisionAnalyzer,
  type MultiGameVisionAssessment,
} from "./multi-game-vision";
import type { SampledPixelFrame } from "./visual-measurements";

export type RecordingAnnotationLabel = "quiet" | "action" | "transition" | "outcome" | "unknown";

export interface RecordingAnnotation {
  readonly label: RecordingAnnotationLabel;
  readonly startsAtMs: number;
  readonly endsAtMs: number;
}

export interface RecordingReplayFrame {
  readonly relativeTimeMs: number;
  readonly pixels: SampledPixelFrame;
  readonly discontinuityBefore?: boolean;
}

export interface RecordingReplayAssessment {
  readonly relativeTimeMs: number;
  readonly annotation: RecordingAnnotationLabel | null;
  readonly assessment: MultiGameVisionAssessment;
  readonly processingDurationMs: number;
}

export interface RecordingReplaySummary {
  readonly frameCount: number;
  readonly p50ProcessingMs: number;
  readonly p95ProcessingMs: number;
  readonly interpretationCounts: Readonly<Record<string, number>>;
  readonly cadenceCounts: Readonly<Record<string, number>>;
  readonly supportTierCounts: Readonly<Record<string, number>>;
  readonly annotationInterpretationCounts: Readonly<
    Record<string, Readonly<Record<string, number>>>
  >;
}

export interface RecordingReplayResult {
  readonly assessments: readonly RecordingReplayAssessment[];
  readonly summary: RecordingReplaySummary;
}

function annotationAt(
  annotations: readonly RecordingAnnotation[],
  relativeTimeMs: number,
): RecordingAnnotationLabel | null {
  return annotations.find(
    ({ startsAtMs, endsAtMs }) => relativeTimeMs >= startsAtMs && relativeTimeMs <= endsAtMs,
  )?.label ?? null;
}

function increment(record: Record<string, number>, key: string): void {
  record[key] = (record[key] ?? 0) + 1;
}

function percentile(sorted: readonly number[], ratio: number): number {
  if (sorted.length === 0) return 0;
  return sorted[Math.max(0, Math.ceil(sorted.length * ratio) - 1)];
}

function validateAnnotations(annotations: readonly RecordingAnnotation[]): void {
  for (const annotation of annotations) {
    if (
      !Number.isInteger(annotation.startsAtMs) ||
      !Number.isInteger(annotation.endsAtMs) ||
      annotation.startsAtMs < 0 ||
      annotation.endsAtMs < annotation.startsAtMs
    ) {
      throw new RangeError("recording annotations require a valid non-negative millisecond range");
    }
  }
}

/**
 * Replays already-decoded, bounded frames through the production analyzer.
 * Decoding remains an injected local concern, so recordings and pixels never
 * become repository fixtures or evidence merely by using this helper.
 */
export function analyseRecordingReplay(input: {
  readonly frames: Iterable<RecordingReplayFrame>;
  readonly selection: GameProfileSelection;
  readonly annotations?: readonly RecordingAnnotation[];
  readonly analyzer?: MultiGameVisionAnalyzer;
  readonly now?: () => number;
}): RecordingReplayResult {
  const annotations = input.annotations ?? [];
  validateAnnotations(annotations);
  const analyzer = input.analyzer ?? new MultiGameVisionAnalyzer();
  const clock = input.now ?? (() => performance.now());
  const assessments: RecordingReplayAssessment[] = [];
  let previousRelativeTimeMs: number | null = null;

  for (const frame of input.frames) {
    if (!Number.isInteger(frame.relativeTimeMs) || frame.relativeTimeMs < 0) {
      throw new RangeError("recording frame time must be a non-negative integer");
    }
    if (previousRelativeTimeMs !== null && frame.relativeTimeMs <= previousRelativeTimeMs) {
      throw new RangeError("recording frame times must be strictly increasing");
    }
    if (frame.discontinuityBefore === true) analyzer.reset();
    const startedAt = clock();
    const assessment = analyzer.analyse({
      frame: frame.pixels,
      observedAt: frame.relativeTimeMs,
      selection: input.selection,
    });
    const endedAt = clock();
    assessments.push({
      relativeTimeMs: frame.relativeTimeMs,
      annotation: annotationAt(annotations, frame.relativeTimeMs),
      assessment,
      processingDurationMs: Math.max(0, endedAt - startedAt),
    });
    previousRelativeTimeMs = frame.relativeTimeMs;
  }

  const interpretationCounts: Record<string, number> = {};
  const cadenceCounts: Record<string, number> = {};
  const supportTierCounts: Record<string, number> = {};
  const annotationInterpretationCounts: Record<string, Record<string, number>> = {};
  for (const item of assessments) {
    increment(interpretationCounts, item.assessment.interpretation.state);
    increment(cadenceCounts, item.assessment.sampling.mode);
    increment(supportTierCounts, item.assessment.supportTier);
    if (item.annotation !== null) {
      const annotationCounts = annotationInterpretationCounts[item.annotation] ?? {};
      increment(annotationCounts, item.assessment.interpretation.state);
      annotationInterpretationCounts[item.annotation] = annotationCounts;
    }
  }
  const latencies = assessments
    .map(({ processingDurationMs }) => processingDurationMs)
    .sort((left, right) => left - right);
  return {
    assessments,
    summary: {
      frameCount: assessments.length,
      p50ProcessingMs: percentile(latencies, 0.5),
      p95ProcessingMs: percentile(latencies, 0.95),
      interpretationCounts,
      cadenceCounts,
      supportTierCounts,
      annotationInterpretationCounts,
    },
  };
}
