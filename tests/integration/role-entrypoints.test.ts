import { describe, expect, it } from "vitest";

import {
  contractFixtureAudienceSnapshot,
  contractFixtureCandidateBatch,
  contractFixtureGameplaySnapshot,
  contractFixtureOverlayView,
  contractFixtureQuestCycle,
  contractFixtureStreamerView,
  contractFixtureViewerView,
} from "../../src/core/testing";
import { candidateBatchSchema, intelligenceSnapshotSchema } from "../../src/ai";
import "../../src/design-system";
import { audienceSnapshotSchema, gameplaySnapshotSchema } from "../../src/extraction";
import { audienceEventSchema, gameplayFrameObservationSchema } from "../../src/integrations";
import { questCycleStateSchema } from "../../src/quest-engine";
import { overlayViewModelSchema, viewerViewModelSchema } from "../../src/realtime";
import {
  streamerProfileSettingsCommandSchema,
  streamerQuestCommandSchema,
  streamerViewModelSchema,
} from "../../src/streamer";
import {
  overlayViewModelSchema as viewerOverlaySchema,
  viewerReactionCommandSchema,
  viewerViewModelSchema as viewerSurfaceSchema,
  viewerVoteCommandSchema,
} from "../../src/viewer";

describe("role-owned public entrypoints", () => {
  it("lets Role 2 consume input contracts and produce canonical intelligence shapes", () => {
    expect(gameplaySnapshotSchema.safeParse(contractFixtureGameplaySnapshot).success).toBe(true);
    expect(audienceSnapshotSchema.safeParse(contractFixtureAudienceSnapshot).success).toBe(true);
    expect(
      intelligenceSnapshotSchema.safeParse({
        envelope: contractFixtureGameplaySnapshot.envelope,
        gameplay: contractFixtureGameplaySnapshot,
        audience: contractFixtureAudienceSnapshot,
      }).success,
    ).toBe(true);
    expect(candidateBatchSchema.safeParse(contractFixtureCandidateBatch).success).toBe(true);
  });

  it("lets Role 3 consume and produce canonical quest state without private imports", () => {
    expect(questCycleStateSchema.safeParse(contractFixtureQuestCycle).success).toBe(true);
  });

  it("lets Role 4 consume the canonical streamer view", () => {
    expect(streamerViewModelSchema.safeParse(contractFixtureStreamerView).success).toBe(true);
    expect(typeof streamerQuestCommandSchema.safeParse).toBe("function");
    expect(typeof streamerProfileSettingsCommandSchema.safeParse).toBe("function");
  });

  it("lets Role 5 consume the canonical viewer and overlay views", () => {
    expect(viewerSurfaceSchema.safeParse(contractFixtureViewerView).success).toBe(true);
    expect(viewerOverlaySchema.safeParse(contractFixtureOverlayView).success).toBe(true);
    expect(typeof viewerVoteCommandSchema.safeParse).toBe("function");
    expect(typeof viewerReactionCommandSchema.safeParse).toBe("function");
  });

  it("keeps Role 1 adapter and realtime schemas available through owned entrypoints", () => {
    expect(typeof audienceEventSchema.safeParse).toBe("function");
    expect(typeof gameplayFrameObservationSchema.safeParse).toBe("function");
    expect(viewerViewModelSchema.safeParse(contractFixtureViewerView).success).toBe(true);
    expect(overlayViewModelSchema.safeParse(contractFixtureOverlayView).success).toBe(true);
  });
});
