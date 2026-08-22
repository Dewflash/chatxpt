import { describe, expect, it } from "vitest";

import {
  createDefaultStreamerProfile,
  resolveEffectiveStreamerProfile,
  streamerProfileSchema,
  streamerSessionOverrideSchema,
} from "./profile";

const profile = streamerProfileSchema.parse({
  profileId: "profile-1",
  streamerId: "streamer-1",
  revision: 1,
  displayName: "Streamer",
  gameId: "minecraft",
  gameName: "Minecraft",
  experience: { intensity: 0.5, creativity: 0.5 },
  restrictions: ["No griefing"],
  preferredQuestTypes: ["exploration"],
  forbiddenQuestTypes: ["team-sabotage"],
  accessibilityNeeds: [],
});

describe("stream preset profile contract", () => {
  it("seeds the four editable starter presets and a privacy-safe watchlist", () => {
    expect(profile.streamPresets.map((preset) => preset.name)).toEqual([
      "Competitive",
      "Chill",
      "Educational",
      "Community",
    ]);
    expect(profile.selectedPresetId).toBe("community");
    expect(profile.keywordWatchlist).toEqual([]);
  });

  it("resolves the selected session preset and live patch without mutating saved defaults", () => {
    const override = streamerSessionOverrideSchema.parse({
      appliedAt: 1_786_020_000_000,
      presetId: "chill",
      experiencePatch: { intensity: 0.4 },
    });
    const effective = resolveEffectiveStreamerProfile(profile, override);

    expect(effective.selectedPresetId).toBe("chill");
    expect(effective.experience).toMatchObject({ intensity: 0.4, creativity: 0.65 });
    expect(effective.preferredQuestTypes).toContain("exploration");
    expect(profile.selectedPresetId).toBe("community");
    expect(profile.experience.intensity).toBe(0.5);
  });

  it("uses one canonical starter profile and keeps current-stream game separate", () => {
    const defaults = createDefaultStreamerProfile({
      profileId: "profile-new",
      streamerId: "streamer-new",
      displayName: "New Streamer",
      gameId: "minecraft",
      gameName: "Minecraft",
    });
    const effective = resolveEffectiveStreamerProfile(defaults, null, {
      gameId: "fortnite",
      gameName: "Fortnite",
      source: "twitch",
    });

    expect(defaults.streamPresets).toHaveLength(4);
    expect(defaults.selectedPresetId).toBe("community");
    expect(effective.gameName).toBe("Fortnite");
    expect(defaults.gameName).toBe("Minecraft");
  });
});
