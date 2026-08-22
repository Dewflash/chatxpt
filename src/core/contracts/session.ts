import { z } from "zod";

import { contractEnvelopeSchema, identifierSchema, revisionSchema, timestampSchema } from "./common";

export const participationCapabilitiesSchema = z
  .object({
    twitchExtension: z.boolean(),
    hostedViewerBoard: z.boolean(),
    twitchChatVoting: z.boolean(),
    twitchIdentity: z.boolean(),
    anonymousParticipation: z.boolean(),
    reactions: z.boolean(),
  })
  .strict();

export const streamSessionStatusSchema = z.enum(["offline", "preparing", "live", "ended"]);

export const streamGameSourceSchema = z.enum(["profile", "twitch", "streamer"]);

export const streamSessionGameSchema = z
  .object({
    gameId: identifierSchema,
    gameName: z.string().trim().min(1).max(120),
    source: streamGameSourceSchema,
  })
  .strict();

export const streamSessionSchema = z
  .object({
    sessionId: identifierSchema,
    broadcasterId: identifierSchema,
    platform: z.literal("twitch"),
    status: streamSessionStatusSchema,
    revision: revisionSchema,
    createdAt: timestampSchema,
    startedAt: timestampSchema.nullable(),
    endedAt: timestampSchema.nullable(),
    currentGame: streamSessionGameSchema.nullable().optional(),
    capabilities: participationCapabilitiesSchema,
  })
  .strict()
  .superRefine((session, context) => {
    if (session.endedAt !== null && session.startedAt === null) {
      context.addIssue({
        code: "custom",
        message: "An ended session requires startedAt",
        path: ["startedAt"],
      });
    }
    if (session.endedAt !== null && session.startedAt !== null && session.endedAt < session.startedAt) {
      context.addIssue({ code: "custom", message: "endedAt cannot precede startedAt", path: ["endedAt"] });
    }
  });

export const platformEventSchema = z
  .object({
    envelope: contractEnvelopeSchema,
    platform: z.literal("twitch"),
    eventType: z.string().trim().min(1).max(120),
    subjectId: identifierSchema.nullable(),
    attributes: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])),
  })
  .strict();

export type ParticipationCapabilities = z.infer<typeof participationCapabilitiesSchema>;
export type StreamGameSource = z.infer<typeof streamGameSourceSchema>;
export type StreamSessionGame = z.infer<typeof streamSessionGameSchema>;
export type StreamSession = z.infer<typeof streamSessionSchema>;
export type PlatformEvent = z.infer<typeof platformEventSchema>;
