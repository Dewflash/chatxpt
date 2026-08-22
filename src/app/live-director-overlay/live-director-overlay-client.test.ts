import { describe, expect, it, vi } from "vitest";

import { resolveLiveDirectorClientAuth } from "./live-director-overlay-client";

describe("Live Director client authorization", () => {
  it("reads the permanent browser and OBS Dock grant from the URL fragment", async () => {
    await expect(resolveLiveDirectorClientAuth(
      "https://chatxpt.example/live-director-overlay?broadcasterId=fixture#directorAccessToken=fixture-director-token-0001",
    )).resolves.toEqual({
      broadcasterId: "fixture",
      accessToken: "fixture-director-token-0001",
    });
  });

  it("uses the isolated desktop bridge when the native navigation URL has no grant", async () => {
    const getDirectorAuth = vi.fn().mockResolvedValue({
      broadcasterId: "fixture",
      accessToken: "fixture-director-token-0001",
    });

    await expect(resolveLiveDirectorClientAuth(
      "https://chatxpt.example/live-director-overlay?broadcasterId=fixture",
      { getDirectorAuth },
    )).resolves.toEqual({
      broadcasterId: "fixture",
      accessToken: "fixture-director-token-0001",
    });
    expect(getDirectorAuth).toHaveBeenCalledOnce();
  });

  it("rejects incomplete links without inventing authority", async () => {
    await expect(resolveLiveDirectorClientAuth(
      "https://chatxpt.example/live-director-overlay?broadcasterId=fixture",
    )).resolves.toBeNull();
  });
});
