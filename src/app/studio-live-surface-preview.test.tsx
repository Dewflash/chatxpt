import { describe, expect, it } from "vitest";

import { createFixtureUiGatewaySnapshot } from "@/core";

import { projectStudioLiveSurfaceViews } from "./studio-live-surface-preview";

describe("projectStudioLiveSurfaceViews", () => {
  it("uses the current authoritative revision for both public live surfaces", () => {
    const snapshot = createFixtureUiGatewaySnapshot();
    const projected = projectStudioLiveSurfaceViews(
      snapshot.views.streamer,
      snapshot.views.streamer.envelope.receivedAt,
    );

    expect(projected.viewer.envelope.revision).toBe(snapshot.revision);
    expect(projected.overlay.envelope.revision).toBe(snapshot.revision);
    expect(projected.viewer.questCycle.status).toBe(snapshot.views.streamer.questCycle.status);
    expect(projected.overlay.questCycle.status).toBe(snapshot.views.streamer.questCycle.status);
    expect(projected.viewer.questCycle.options).toEqual(snapshot.views.viewer.questCycle.options);
    expect(projected.overlay.questCycle.options).toEqual(snapshot.views.overlay.questCycle.options);
    expect(projected.viewer.publicContext).toEqual(projected.overlay.publicContext);
  });

  it("does not invent a personal viewer identity or expose open-vote tallies", () => {
    const snapshot = createFixtureUiGatewaySnapshot();
    const projected = projectStudioLiveSurfaceViews(
      snapshot.views.streamer,
      snapshot.views.streamer.envelope.receivedAt,
    );

    expect(projected.viewer.viewerId).toBeNull();
    expect(projected.viewer.acceptedCandidateId).toBeNull();
    expect(projected.viewer.sessionPoints).toBe(0);
    if (projected.viewer.questCycle.status === "voting") {
      expect(projected.viewer.questCycle.voteTallies).toEqual([]);
    }
  });
});
