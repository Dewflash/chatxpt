import { z } from "zod";

import {
  actorSchema,
  contractVersionSchema,
  identifierSchema,
  revisionSchema,
  timestampSchema,
} from "./common";
import { streamerQuestActionSchema } from "./quests";
import { participationSourceModeSchema } from "./participation";

const commandEnvelopeFields = {
  contractVersion: contractVersionSchema,
  sessionId: identifierSchema,
  questCycleId: identifierSchema.nullable(),
  commandId: identifierSchema,
  correlationId: identifierSchema,
  expectedRevision: revisionSchema,
  issuedAt: timestampSchema,
  actor: actorSchema,
};

export const streamerQuestCommandSchema = z
  .object({
    ...commandEnvelopeFields,
    type: z.literal("streamer.quest"),
    action: streamerQuestActionSchema,
    candidateId: identifierSchema.nullable(),
  })
  .strict();

export const viewerVoteCommandSchema = z
  .object({
    ...commandEnvelopeFields,
    questCycleId: identifierSchema,
    type: z.literal("viewer.vote"),
    candidateId: identifierSchema,
    voterKey: identifierSchema,
    sourceMode: participationSourceModeSchema,
  })
  .strict();

export const viewerReactionCommandSchema = z
  .object({
    ...commandEnvelopeFields,
    type: z.literal("viewer.react"),
    reaction: z.string().trim().min(1).max(40),
  })
  .strict();

export const systemIntelligenceCommandSchema = z
  .object({
    ...commandEnvelopeFields,
    type: z.literal("system.intelligence-ready"),
    candidateBatchId: identifierSchema,
  })
  .strict();

export const systemVoteCloseCommandSchema = z
  .object({
    ...commandEnvelopeFields,
    questCycleId: identifierSchema,
    type: z.literal("system.vote-close"),
  })
  .strict();

export const commandEnvelopeSchema = z
  .discriminatedUnion("type", [
    streamerQuestCommandSchema,
    viewerVoteCommandSchema,
    viewerReactionCommandSchema,
    systemIntelligenceCommandSchema,
    systemVoteCloseCommandSchema,
  ])
  .superRefine((command, context) => {
    const allowedActorKinds: Record<typeof command.type, Array<typeof command.actor.kind>> = {
      "streamer.quest": ["broadcaster", "moderator"],
      "viewer.vote": ["viewer", "anonymous"],
      "viewer.react": ["viewer", "anonymous"],
      "system.intelligence-ready": ["system"],
      "system.vote-close": ["system"],
    };

    if (!allowedActorKinds[command.type].includes(command.actor.kind)) {
      context.addIssue({
        code: "custom",
        message: `Actor kind ${command.actor.kind} cannot issue ${command.type}`,
        path: ["actor", "kind"],
      });
    }
  });

export type CommandEnvelope = z.infer<typeof commandEnvelopeSchema>;
export type StreamerQuestCommand = z.infer<typeof streamerQuestCommandSchema>;
export type ViewerVoteCommand = z.infer<typeof viewerVoteCommandSchema>;
export type ViewerReactionCommand = z.infer<typeof viewerReactionCommandSchema>;
export type SystemVoteCloseCommand = z.infer<typeof systemVoteCloseCommandSchema>;
