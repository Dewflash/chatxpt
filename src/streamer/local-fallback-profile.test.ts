import { describe, expect, it } from "vitest";

import { createDefaultStreamerProfile } from "../core";
import { editableDefaultsFromProfile } from "./streamer-commands";
import {
  LOCAL_FALLBACK_ACCOUNT_ID,
  LOCAL_FALLBACK_MAX_BYTES,
  LOCAL_FALLBACK_PROFILE_KEY,
  cacheCloudProfileForFallback,
  localProfileCloudStatus,
  readLocalFallbackProfile,
  updateLocalFallbackProfile,
  writeLocalFallbackProfile,
  type LocalFallbackStorage,
} from "./local-fallback-profile";

function storage(initial: Record<string, string> = {}): LocalFallbackStorage {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

describe("local fallback profile", () => {
  it("seeds one stable account and preserves edited presets across reloads", () => {
    const target = storage();
    const seeded = readLocalFallbackProfile(target, "Demo Streamer", 100);
    const draft = editableDefaultsFromProfile(seeded.envelope.profile);
    const edited = updateLocalFallbackProfile(seeded.envelope, {
      ...draft,
      selectedPresetId: "chill",
      restrictions: ["No jump scares"],
    }, 200);
    writeLocalFallbackProfile(target, edited);

    const restored = readLocalFallbackProfile(target, "Ignored Name", 300);
    expect(restored.envelope.localAccountId).toBe(LOCAL_FALLBACK_ACCOUNT_ID);
    expect(restored.envelope.profile.selectedPresetId).toBe("chill");
    expect(restored.envelope.profile.restrictions).toEqual(["No jump scares"]);
    expect(restored.envelope.pendingPatch?.restrictions).toEqual(["No jump scares"]);
    expect(restored.recovered).toBe(false);
  });

  it("recovers invalid and oversized data without exposing the invalid payload", () => {
    const invalid = storage({ [LOCAL_FALLBACK_PROFILE_KEY]: "not-json" });
    const invalidResult = readLocalFallbackProfile(invalid, "Demo", 100);
    expect(invalidResult.recovered).toBe(true);
    expect(invalidResult.diagnostic).toContain("invalid");
    expect(invalidResult.envelope.profile.streamPresets).toHaveLength(4);

    const oversized = storage({
      [LOCAL_FALLBACK_PROFILE_KEY]: "x".repeat(LOCAL_FALLBACK_MAX_BYTES + 1),
    });
    const oversizedResult = readLocalFallbackProfile(oversized, "Demo", 100);
    expect(oversizedResult.recovered).toBe(true);
    expect(oversizedResult.diagnostic).toContain("safety limit");

    const blocked: LocalFallbackStorage = {
      getItem: () => { throw new Error("blocked"); },
      setItem: () => { throw new Error("blocked"); },
      removeItem: () => undefined,
    };
    const blockedResult = readLocalFallbackProfile(blocked, "Demo", 100);
    expect(blockedResult.recovered).toBe(true);
    expect(blockedResult.diagnostic).toContain("blocked local profile access");
  });

  it("requires an explicit choice when the account revision moved", () => {
    const target = storage();
    const seeded = readLocalFallbackProfile(target, "Demo", 100).envelope;
    const cloud = createDefaultStreamerProfile({
      profileId: "profile-twitch-1",
      streamerId: "twitch-1",
      displayName: "Cloud Streamer",
      revision: 4,
    });
    const cached = cacheCloudProfileForFallback(seeded, cloud, 200);
    const edited = updateLocalFallbackProfile(cached, {
      ...editableDefaultsFromProfile(cached.profile),
      forbiddenQuestTypes: ["inventory-trash"],
    }, 300);

    expect(localProfileCloudStatus(edited, 4)).toBe("apply-ready");
    expect(localProfileCloudStatus(edited, 5)).toBe("conflict");
    expect(cached.profile.streamerId).toBe(LOCAL_FALLBACK_ACCOUNT_ID);
  });
});
