import type {
  AudienceEventSource,
  AudienceSnapshot,
  FrameSource,
  GameplaySnapshot,
} from "../core";

/** Adapts Role 1's ephemeral frame source into canonical Role 2 gameplay snapshots. */
export interface GameplayExtractionPipeline {
  snapshots(source: FrameSource, signal?: AbortSignal): AsyncIterable<GameplaySnapshot>;
}

/** Adapts Role 1's normalised audience events into canonical Role 2 audience snapshots. */
export interface AudienceExtractionPipeline {
  snapshots(source: AudienceEventSource, signal?: AbortSignal): AsyncIterable<AudienceSnapshot>;
}
