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
  });

export type StreamerProfile = z.infer<typeof streamerProfileSchema>;
export type StreamerVotingPreferences = z.infer<typeof streamerVotingPreferencesSchema>;
export type StreamerRewardPreferences = z.infer<typeof streamerRewardPreferencesSchema>;
