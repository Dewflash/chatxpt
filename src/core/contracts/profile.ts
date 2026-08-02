import { z } from "zod";

import { identifierSchema, revisionSchema } from "./common";

const boundedExperienceValueSchema = z.number().min(0).max(1);

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
