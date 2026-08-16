import {
  gameplaySnapshotSchema,
  type FrameSource,
  type GameplayFrameObservation,
  type GameplaySnapshot,
  type SignalObservation,
} from "../core";
import {
  createDefaultGameProfileRegistry,
  type GameProfileSelection,
} from "./game-profiles";
import { buildMultiGameGameplaySnapshot } from "./game-vision-snapshot";
import {
  MultiGameVisionAnalyzer,
  streamMultiGameVisionAssessments,
} from "./multi-game-vision";
import type { GameplayExtractionPipeline } from "./ports";
import type { FramePixelSampler } from "./visual-measurements";

export interface MultiGameGameplayPipelineOptions {
  readonly sampler: FramePixelSampler;
  readonly sampleWidth?: number;
  readonly sampleHeight?: number;
  readonly selection: GameProfileSelection | ((frame: GameplayFrameObservation) => GameProfileSelection);
  readonly analyzer?: MultiGameVisionAnalyzer;
}

function selected(
  selection: MultiGameGameplayPipelineOptions["selection"],
  frame: GameplayFrameObservation,
): GameProfileSelection {
  return typeof selection === "function" ? selection(frame) : selection;
}

function unavailableObservation(frame: GameplayFrameObservation): SignalObservation {
  const provenance = {
    source: frame.envelope.source,
    method: "multi-game-vision-capture-status",
    confidence: 0,
    observedAt: frame.capturedAt,
    receivedAt: frame.envelope.receivedAt,
    evidenceClass: frame.envelope.evidenceClass,
  } as const;
  if (frame.status === "permission-denied") {
    return { status: "unknown", reason: "permission-denied", provenance };
  }
  if (frame.status === "stale") {
    return { status: "stale", reason: "Gameplay capture is stale.", provenance };
  }
  return { status: "unavailable", reason: `Gameplay capture is ${frame.status}.`, provenance };
}

function unavailableSnapshot(
  frame: GameplayFrameObservation,
  selection: GameProfileSelection,
): GameplaySnapshot {
  const resolved = createDefaultGameProfileRegistry().resolve(selection);
  return gameplaySnapshotSchema.parse({
    envelope: {
      ...frame.envelope,
      messageId: `gameplay-snapshot-${frame.frameId}`,
      occurredAt: frame.capturedAt,
    },
    capabilities: {
      tier: "universal-visual",
      gameId: resolved.profile.gameId,
      adapterId: null,
      supportedSignals: resolved.profile.universalSignals,
    },
    signals: resolved.profile.universalSignals.map((kind) => ({
      signalId: `game-${kind}`,
      kind,
      observation: unavailableObservation(frame),
    })),
  });
}

/** Production Role 2 pipeline over Role 1's canonical ephemeral FrameSource. */
export function createMultiGameGameplayExtractionPipeline(
  options: MultiGameGameplayPipelineOptions,
): GameplayExtractionPipeline {
  const sampleWidth = options.sampleWidth ?? 160;
  const sampleHeight = options.sampleHeight ?? 90;
  return {
    async *snapshots(source: FrameSource, signal?: AbortSignal) {
      for await (const output of streamMultiGameVisionAssessments(source, {
        sampler: options.sampler,
        sampleWidth,
        sampleHeight,
        selection: options.selection,
        analyzer: options.analyzer,
      }, signal)) {
        if (output.status === "ready") {
          yield buildMultiGameGameplaySnapshot(output);
        } else {
          yield unavailableSnapshot(output.frame, selected(options.selection, output.frame));
        }
      }
    },
  };
}
