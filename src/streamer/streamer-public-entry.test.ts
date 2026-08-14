import { describe, expect, it } from "vitest";

import {
  StudioManagementSurface,
  TwitchConfigSurface,
  TwitchLiveConfigSurface,
  buildProfileSettingsCommand,
  buildQuestCommand,
  buildSetupCommand,
} from ".";

describe("Role 4 public entry", () => {
  it("exports the complete Studio and compact Twitch surfaces with canonical command builders", () => {
    expect(typeof StudioManagementSurface).toBe("function");
    expect(typeof TwitchConfigSurface).toBe("function");
    expect(typeof TwitchLiveConfigSurface).toBe("function");
    expect(typeof buildProfileSettingsCommand).toBe("function");
    expect(typeof buildQuestCommand).toBe("function");
    expect(typeof buildSetupCommand).toBe("function");
  });
});
