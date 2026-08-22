import { describe, expect, it } from "vitest";

import { contractFixtureStreamerView } from "@/core/testing";

import { captureGameFromView } from "./StudioGameplayCaptureClient";

describe("captureGameFromView", () => {
  it("uses the authoritative current-stream game ahead of the saved default", () => {
    expect(captureGameFromView({
      ...contractFixtureStreamerView,
      profile: {
        ...contractFixtureStreamerView.profile,
        gameId: "minecraft",
        gameName: "Minecraft",
      },
      session: {
        ...contractFixtureStreamerView.session,
        currentGame: {
          gameId: "generic",
          gameName: "Current Game",
          source: "streamer",
        },
      },
    })).toBe("generic");
  });

  it("falls back to the saved calibrated default when no live override exists", () => {
    expect(captureGameFromView({
      ...contractFixtureStreamerView,
      profile: {
        ...contractFixtureStreamerView.profile,
        gameId: "brawl-stars",
        gameName: "Brawl Stars",
      },
      session: {
        ...contractFixtureStreamerView.session,
        currentGame: null,
      },
    })).toBe("brawl-stars");
  });
});
