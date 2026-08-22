import { z } from "zod";

import { identifierSchema, revisionSchema } from "./common";

const boundedExperienceValueSchema = z.number().min(0).max(1);

export const DEFAULT_STREAMER_VOTING_PREFERENCES = {
  voteVisibility: "live-tally",
  showCountdown: true,
  voteDurationSeconds: 30,
  voteChangesAllowed: false,
} as const;

export const DEFAULT_STREAMER_REWARD_PREFERENCES = {
  rewardDisplay: "session-points-and-hype",
  showRewardPreview: true,
  persistentEconomy: false,
  monetaryRewards: false,
} as const;

export const DEFAULT_STREAM_PRESETS = [
  {
    presetId: "competitive",
    name: "Competitive",
    description: "Focused, higher-intensity sidequests that respect the current match.",
    origin: "starter",
    experience: { intensity: 0.8, creativity: 0.5, playfulness: 0.35 },
    preferredQuestTypes: ["performance", "precision", "decision-making"],
    voting: DEFAULT_STREAMER_VOTING_PREFERENCES,
    rewards: DEFAULT_STREAMER_REWARD_PREFERENCES,
  },
  {
    presetId: "chill",
    name: "Chill",
    description: "Low-pressure prompts that leave plenty of room for relaxed play.",
    origin: "starter",
    experience: { intensity: 0.3, creativity: 0.65, playfulness: 0.6 },
    preferredQuestTypes: ["exploration", "creative", "chat-guided"],
    voting: DEFAULT_STREAMER_VOTING_PREFERENCES,
    rewards: DEFAULT_STREAMER_REWARD_PREFERENCES,
  },
  {
    presetId: "educational",
    name: "Educational",
    description: "Prompts that encourage explanation, planning, and teachable moments.",
    origin: "starter",
    experience: { intensity: 0.45, creativity: 0.5, playfulness: 0.3 },
    preferredQuestTypes: ["explanation", "planning", "demonstration"],
    voting: DEFAULT_STREAMER_VOTING_PREFERENCES,
    rewards: DEFAULT_STREAMER_REWARD_PREFERENCES,
  },
  {
    presetId: "community",
    name: "Community",
    description: "Viewer-led choices with playful, participation-first sidequests.",
    origin: "starter",
    experience: { intensity: 0.6, creativity: 0.75, playfulness: 0.8 },
    preferredQuestTypes: ["viewer-choice", "chat-guided", "creative"],
    voting: DEFAULT_STREAMER_VOTING_PREFERENCES,
    rewards: DEFAULT_STREAMER_REWARD_PREFERENCES,
  },
] as const;

export const streamerVotingPreferencesSchema = z
  .object({
    voteVisibility: z.enum(["live-tally", "hidden-until-close"]).default("live-tally"),
    showCountdown: z.boolean().default(true),
    voteDurationSeconds: z.literal(30).default(30),
    voteChangesAllowed: z.literal(false).default(false),
  })
  .strict();

export const streamerRewardPreferencesSchema = z
  .object({
    rewardDisplay: z.enum(["session-points", "community-hype", "session-points-and-hype"]).default(
      "session-points-and-hype",
    ),
    showRewardPreview: z.boolean().default(true),
    persistentEconomy: z.literal(false).default(false),
    monetaryRewards: z.literal(false).default(false),
  })
  .strict();

export const streamPresetSchema = z
  .object({
    presetId: identifierSchema,
    name: z.string().trim().min(1).max(48),
    description: z.string().trim().min(1).max(180),
    origin: z.enum(["starter", "custom"]),
    experience: z.record(z.string().trim().min(1).max(80), boundedExperienceValueSchema),
    preferredQuestTypes: z.array(z.string().trim().min(1).max(80)).max(32),
    voting: streamerVotingPreferencesSchema,
    rewards: streamerRewardPreferencesSchema,
  })
  .strict()
  .superRefine((preset, context) => {
    if (Object.keys(preset.experience).length === 0) {
      context.addIssue({
        code: "custom",
        message: "Stream presets require at least one experience setting",
        path: ["experience"],
      });
    }
  });

export const streamerProfileSchema = z
  .object({
    profileId: identifierSchema,
    streamerId: identifierSchema,
    revision: revisionSchema,
    displayName: z.string().trim().min(1).max(80),
    gameId: identifierSchema.nullable(),
    gameName: z.string().trim().min(1).max(120).nullable(),
    experience: z.record(z.string().trim().min(1).max(80), boundedExperienceValueSchema),
    restrictions: z.array(z.string().trim().min(1).max(160)).max(64),
    preferredQuestTypes: z.array(z.string().trim().min(1).max(80)).max(32),
    forbiddenQuestTypes: z.array(z.string().trim().min(1).max(80)).max(32),
    accessibilityNeeds: z.array(z.string().trim().min(1).max(160)).max(32),
    keywordWatchlist: z.array(z.string().trim().min(1).max(80)).max(32).default([]),
    streamPresets: z.array(streamPresetSchema).min(1).max(24).default(() =>
      DEFAULT_STREAM_PRESETS.map((preset) => ({
        ...preset,
        experience: { ...preset.experience },
        preferredQuestTypes: [...preset.preferredQuestTypes],
        voting: { ...preset.voting },
        rewards: { ...preset.rewards },
      })),
    ),
    selectedPresetId: identifierSchema.nullable().default("community"),
    voting: streamerVotingPreferencesSchema.default(DEFAULT_STREAMER_VOTING_PREFERENCES),
    rewards: streamerRewardPreferencesSchema.default(DEFAULT_STREAMER_REWARD_PREFERENCES),
  })
  .strict()
  .superRefine((profile, context) => {
    if ((profile.gameId === null) !== (profile.gameName === null)) {
      context.addIssue({
        code: "custom",
        message: "gameId and gameName must either both be present or both be null",
        path: ["gameId"],
      });
    }
    const presetIds = profile.streamPresets.map((preset) => preset.presetId);
    if (new Set(presetIds).size !== presetIds.length) {
      context.addIssue({
        code: "custom",
        message: "Stream preset IDs must be distinct",
        path: ["streamPresets"],
      });
    }
    if (
      profile.selectedPresetId !== null &&
      !profile.streamPresets.some((preset) => preset.presetId === profile.selectedPresetId)
    ) {
      context.addIssue({
        code: "custom",
        message: "Selected stream preset must reference a saved preset",
        path: ["selectedPresetId"],
      });
    }
  });

export const streamerSessionOverrideSchema = z
  .object({
    appliedAt: z.number().int().nonnegative(),
    presetId: identifierSchema.nullable().default(null),
    experiencePatch: z.record(z.string().trim().min(1).max(80), boundedExperienceValueSchema).default({}),
  })
  .strict()
  .superRefine((override, context) => {
    if (override.presetId === null && Object.keys(override.experiencePatch).length === 0) {
      context.addIssue({
        code: "custom",
        message: "Session overrides must include a preset or at least one setting",
        path: ["experiencePatch"],
      });
    }
  });

export type StreamerProfile = z.infer<typeof streamerProfileSchema>;
export type StreamerVotingPreferences = z.infer<typeof streamerVotingPreferencesSchema>;
export type StreamerRewardPreferences = z.infer<typeof streamerRewardPreferencesSchema>;
export type StreamPreset = z.infer<typeof streamPresetSchema>;
export type StreamerSessionOverride = z.infer<typeof streamerSessionOverrideSchema>;

export function resolveSelectedStreamPreset(
  profile: StreamerProfile,
  override: StreamerSessionOverride | null | undefined = null,
): StreamPreset | null {
  const presetId = override?.presetId ?? profile.selectedPresetId;
  return presetId === null
    ? null
    : profile.streamPresets.find((preset) => preset.presetId === presetId) ?? null;
}

/** Builds the bounded settings context consumed by intelligence and quest policy. */
export function resolveEffectiveStreamerProfile(
  profile: StreamerProfile,
  override: StreamerSessionOverride | null | undefined = null,
): StreamerProfile {
  const preset = resolveSelectedStreamPreset(profile, override);
  return streamerProfileSchema.parse({
    ...profile,
    selectedPresetId: preset?.presetId ?? profile.selectedPresetId,
    experience: {
      ...profile.experience,
      ...preset?.experience,
      ...override?.experiencePatch,
    },
    preferredQuestTypes:
      preset === null || preset.preferredQuestTypes.length === 0
        ? profile.preferredQuestTypes
        : preset.preferredQuestTypes,
    voting: preset?.voting ?? profile.voting,
    rewards: preset?.rewards ?? profile.rewards,
  });
}
