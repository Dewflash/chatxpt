import { describe, expect, it } from "vitest";

import {
  CONTRACT_VERSION,
  type EphemeralGameplayFrame,
  type FrameSource,
  type GameplayFrameObservation,
} from "../core";
import { createMultiGameGameplayExtractionPipeline } from "./multi-game-pipeline";
import type { SampledPixelFrame } from "./visual-measurements";

function observation(status: GameplayFrameObservation["status"], sequence: number): GameplayFrameObservation {
  const capturedAt = 1_000 + sequence * 100;
  return {
    envelope: {
      contractVersion: CONTRACT_VERSION,
      sessionId: "pipeline-session",
      questCycleId: null,
      messageId: `pipeline-frame-${sequence}`,
      correlationId: "pipeline-correlation",
      revision: 0,
      occurredAt: capturedAt,
      receivedAt: capturedAt,
      source: status === "ready" ? "obs-virtual-camera" : "test-fixture",
      evidenceClass: status === "ready" ? "diagnostic" : "fixture",
    },
    frameId: `pipeline-frame-${sequence}`,
    capturedAt,
    width: 1280,
    height: 576,
    status,
  };
}

function pixels(): SampledPixelFrame {
  return { width: 160, height: 90, rgba: new Uint8ClampedArray(160 * 90 * 4).fill(25) };
}

function source(released: number[]): FrameSource {
  return {
    async *frames(): AsyncIterable<EphemeralGameplayFrame> {
      for (const [sequence, status] of (["ready", "permission-denied"] as const).entries()) {
        yield {
          observation: observation(status, sequence),
          image: pixels() as unknown as CanvasImageSource,
          release: () => released.push(sequence),
        };
      }
    },
  };
}

describe("multi-game gameplay extraction pipeline", () => {
  it("emits canonical ready and capture-denied snapshots while releasing every frame", async () => {
    const released: number[] = [];
    const pipeline = createMultiGameGameplayExtractionPipeline({
      sampler: { sample: async (image) => image as unknown as SampledPixelFrame },
      selection: { requestedGameId: "brawl-stars", source: "streamer-config", confidence: 1 },
    });
    const snapshots = [];
    for await (const snapshot of pipeline.snapshots(source(released))) snapshots.push(snapshot);

    expect(snapshots).toHaveLength(2);
    expect(snapshots[0]).toMatchObject({
      capabilities: { gameId: "brawl-stars", tier: "universal-visual" },
    });
    expect(snapshots[1].signals.every(({ observation }) =>
      observation.status === "unknown" && observation.reason === "permission-denied",
    )).toBe(true);
    expect(released).toEqual([0, 1]);
  });
});
