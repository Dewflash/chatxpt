import { z } from "zod";

import {
  createDefaultStreamerProfile,
  identifierSchema,
  streamPresetSchema,
  streamerProfileSchema,
  streamerRewardPreferencesSchema,
  streamerVotingPreferencesSchema,
  type StreamerProfile,
} from "../core";
import {
  applyEditableDefaultsToProfile,
  editableDefaultsFromProfile,
  type EditableProfileDefaults,
} from "./streamer-commands";

export const LOCAL_FALLBACK_ACCOUNT_ID = "chatxpt-established-demo" as const;
export const LOCAL_FALLBACK_PROFILE_KEY = "chatxpt.local-fallback-profile.v1";
export const LOCAL_FALLBACK_MAX_BYTES = 128 * 1024;

const editableProfileDefaultsSchema = z
  .object({
    gameId: identifierSchema.nullable(),
    gameName: z.string().trim().min(1).max(120).nullable(),
    experience: z.record(z.string().trim().min(1).max(80), z.number().min(0).max(1)),
    restrictions: z.array(z.string().trim().min(1).max(160)).max(64),
    preferredQuestTypes: z.array(z.string().trim().min(1).max(80)).max(32),
    forbiddenQuestTypes: z.array(z.string().trim().min(1).max(80)).max(32),
    accessibilityNeeds: z.array(z.string().trim().min(1).max(160)).max(32),
    keywordWatchlist: z.array(z.string().trim().min(1).max(80)).max(32),
    streamPresets: z.array(streamPresetSchema).min(1).max(24),
    selectedPresetId: identifierSchema.nullable(),
    voting: streamerVotingPreferencesSchema,
    rewards: streamerRewardPreferencesSchema,
  })
  .strict()
  .superRefine((settings, context) => {
    if ((settings.gameId === null) !== (settings.gameName === null)) {
      context.addIssue({
        code: "custom",
        message: "gameId and gameName must either both be present or both be null",
        path: ["gameId"],
      });
    }
    if (
      settings.selectedPresetId !== null &&
      !settings.streamPresets.some((preset) => preset.presetId === settings.selectedPresetId)
    ) {
      context.addIssue({
        code: "custom",
        message: "Selected stream preset must reference a saved preset",
        path: ["selectedPresetId"],
      });
    }
  });

export const localFallbackProfileEnvelopeSchema = z
  .object({
    version: z.literal(1),
    localAccountId: z.literal(LOCAL_FALLBACK_ACCOUNT_ID),
    profile: streamerProfileSchema,
    baseCloudRevision: z.number().int().nonnegative().nullable(),
    pendingPatch: editableProfileDefaultsSchema.nullable(),
    savedAt: z.number().int().nonnegative(),
  })
  .strict()
  .superRefine((envelope, context) => {
    if (
      envelope.profile.streamerId !== LOCAL_FALLBACK_ACCOUNT_ID ||
      envelope.profile.profileId !== `profile-${LOCAL_FALLBACK_ACCOUNT_ID}`
    ) {
      context.addIssue({
        code: "custom",
        message: "Local fallback profile identity is fixed",
        path: ["profile", "streamerId"],
      });
    }
  });

export type LocalFallbackProfileEnvelope = z.infer<typeof localFallbackProfileEnvelopeSchema>;

export interface LocalFallbackProfileRead {
  readonly envelope: LocalFallbackProfileEnvelope;
  readonly recovered: boolean;
  readonly diagnostic: string | null;
}

export interface LocalFallbackStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function seedLocalFallbackProfile(
  displayName = "Local Streamer",
  savedAt = Date.now(),
): LocalFallbackProfileEnvelope {
  return localFallbackProfileEnvelopeSchema.parse({
    version: 1,
    localAccountId: LOCAL_FALLBACK_ACCOUNT_ID,
    profile: createDefaultStreamerProfile({
      profileId: `profile-${LOCAL_FALLBACK_ACCOUNT_ID}`,
      streamerId: LOCAL_FALLBACK_ACCOUNT_ID,
      displayName,
    }),
    baseCloudRevision: null,
    pendingPatch: null,
    savedAt,
  });
}

export function writeLocalFallbackProfile(
  storage: LocalFallbackStorage,
  envelope: LocalFallbackProfileEnvelope,
): void {
  const parsed = localFallbackProfileEnvelopeSchema.parse(envelope);
  const encoded = JSON.stringify(parsed);
  if (new TextEncoder().encode(encoded).byteLength > LOCAL_FALLBACK_MAX_BYTES) {
    throw new Error("Local fallback profile is too large to save safely");
  }
  storage.setItem(LOCAL_FALLBACK_PROFILE_KEY, encoded);
}

export function readLocalFallbackProfile(
  storage: LocalFallbackStorage,
  displayName = "Local Streamer",
  savedAt = Date.now(),
): LocalFallbackProfileRead {
  let source: string | null;
  try {
    source = storage.getItem(LOCAL_FALLBACK_PROFILE_KEY);
  } catch {
    return {
      envelope: seedLocalFallbackProfile(displayName, savedAt),
      recovered: true,
      diagnostic: "This browser blocked local profile access. Starter presets are available for this page only.",
    };
  }
  if (source === null) {
    const envelope = seedLocalFallbackProfile(displayName, savedAt);
    try {
      writeLocalFallbackProfile(storage, envelope);
      return { envelope, recovered: false, diagnostic: null };
    } catch {
      return {
        envelope,
        recovered: true,
        diagnostic: "This browser could not save the local profile. Starter presets are available for this page only.",
      };
    }
  }
  if (new TextEncoder().encode(source).byteLength > LOCAL_FALLBACK_MAX_BYTES) {
    const envelope = seedLocalFallbackProfile(displayName, savedAt);
    try {
      writeLocalFallbackProfile(storage, envelope);
    } catch {
      // The diagnostic still explains that the unsafe value was not accepted.
    }
    return {
      envelope,
      recovered: true,
      diagnostic: "The saved local profile exceeded the safety limit and was replaced with starter presets.",
    };
  }
  try {
    return {
      envelope: localFallbackProfileEnvelopeSchema.parse(JSON.parse(source)),
      recovered: false,
      diagnostic: null,
    };
  } catch {
    const envelope = seedLocalFallbackProfile(displayName, savedAt);
    try {
      writeLocalFallbackProfile(storage, envelope);
    } catch {
      // The diagnostic still explains that the invalid value was not accepted.
    }
    return {
      envelope,
      recovered: true,
      diagnostic: "The saved local profile was invalid and was replaced with starter presets.",
    };
  }
}

export function updateLocalFallbackProfile(
  envelope: LocalFallbackProfileEnvelope,
  defaults: EditableProfileDefaults,
  savedAt = Date.now(),
): LocalFallbackProfileEnvelope {
  const profile = applyEditableDefaultsToProfile(
    envelope.profile,
    defaults,
    envelope.profile.revision + 1,
  );
  return acceptLocalFallbackProfile(envelope, profile, savedAt);
}

export function acceptLocalFallbackProfile(
  envelope: LocalFallbackProfileEnvelope,
  profile: StreamerProfile,
  savedAt = Date.now(),
): LocalFallbackProfileEnvelope {
  const parsedProfile = streamerProfileSchema.parse(profile);
  if (
    parsedProfile.streamerId !== envelope.profile.streamerId ||
    parsedProfile.profileId !== envelope.profile.profileId ||
    parsedProfile.revision <= envelope.profile.revision
  ) {
    throw new Error("Local fallback profile updates must preserve identity and advance revision");
  }
  return localFallbackProfileEnvelopeSchema.parse({
    ...envelope,
    profile: parsedProfile,
    pendingPatch: editableDefaultsFromProfile(parsedProfile),
    savedAt,
  });
}

export function cacheCloudProfileForFallback(
  envelope: LocalFallbackProfileEnvelope,
  cloudProfile: StreamerProfile,
  savedAt = Date.now(),
): LocalFallbackProfileEnvelope {
  const profile = applyEditableDefaultsToProfile(
    envelope.profile,
    editableDefaultsFromProfile(cloudProfile),
    envelope.profile.revision + 1,
  );
  return localFallbackProfileEnvelopeSchema.parse({
    ...envelope,
    profile,
    baseCloudRevision: cloudProfile.revision,
    pendingPatch: null,
    savedAt,
  });
}

export function localProfileCloudStatus(
  envelope: LocalFallbackProfileEnvelope,
  cloudRevision: number,
): "clean" | "apply-ready" | "conflict" {
  if (envelope.pendingPatch === null) return "clean";
  return envelope.baseCloudRevision === cloudRevision ? "apply-ready" : "conflict";
}
