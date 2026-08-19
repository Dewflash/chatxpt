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
import { directorCueActionSchema } from "./signals";

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

export const systemQuestTickCommandSchema = z
  .object({
    ...commandEnvelopeFields,
    questCycleId: identifierSchema,
    type: z.literal("system.quest-tick"),
  })
  .strict();

export const streamerQuestProgressCommandSchema = z
  .object({
    ...commandEnvelopeFields,
    questCycleId: identifierSchema,
    type: z.literal("streamer.quest-progress"),
    requestedValue: z.number().min(0).max(1),
  })
  .strict();

export const systemQuestProgressCommandSchema = z
  .object({
    ...commandEnvelopeFields,
    questCycleId: identifierSchema,
    type: z.literal("system.quest-progress"),
    requestedValue: z.number().min(0).max(1),
    evidenceSignalIds: z.array(identifierSchema).max(32),
  })
  .strict();

export const streamerEmergencyClearCommandSchema = z
  .object({
    ...commandEnvelopeFields,
    type: z.literal("streamer.emergency-clear"),
  })
  .strict();

const streamerVotingPreferencesPatchSchema = z
  .object({
    voteVisibility: z.enum(["live-tally", "hidden-until-close"]).optional(),
    showCountdown: z.boolean().optional(),
    voteDurationSeconds: z.literal(30).optional(),
    voteChangesAllowed: z.literal(false).optional(),
  })
  .strict();

const streamerRewardPreferencesPatchSchema = z
  .object({
    rewardDisplay: z.enum(["session-points", "community-hype", "session-points-and-hype"]).optional(),
    showRewardPreview: z.boolean().optional(),
    persistentEconomy: z.literal(false).optional(),
    monetaryRewards: z.literal(false).optional(),
  })
  .strict();

export const streamerProfileSettingsCommandSchema = z
  .object({
    ...commandEnvelopeFields,
    questCycleId: z.null(),
    type: z.literal("streamer.profile-settings"),
    experiencePatch: z.record(z.string().trim().min(1).max(80), z.number().min(0).max(1)).default({}),
    voting: streamerVotingPreferencesPatchSchema.optional(),
    rewards: streamerRewardPreferencesPatchSchema.optional(),
  })
  .strict()
  .superRefine((command, context) => {
    const experienceChangeCount = Object.keys(command.experiencePatch).length;
    const votingChangeCount = Object.keys(command.voting ?? {}).length;
    const rewardChangeCount = Object.keys(command.rewards ?? {}).length;

    if (experienceChangeCount === 0 && votingChangeCount === 0 && rewardChangeCount === 0) {
      context.addIssue({
        code: "custom",
        message: "Profile settings commands must include at least one setting change",
        path: ["experiencePatch"],
      });
    }
    if (experienceChangeCount > 16) {
      context.addIssue({
        code: "custom",
        message: "Profile settings commands may patch at most 16 experience settings",
        path: ["experiencePatch"],
      });
    }
  });

const declaredStreamIntentRequestSchema = z
  .object({
    goal: z.string().trim().min(3).max(120),
    objective: z.string().trim().min(3).max(240),
    desiredAudienceInvolvement: z.string().trim().min(1).max(160).nullable(),
    requestedExpiresAt: timestampSchema,
  })
  .strict();

export const streamerLiveDirectorIntentCommandSchema = z
  .object({
    ...commandEnvelopeFields,
    type: z.literal("streamer.live-director-intent"),
    action: z.enum(["set", "clear"]),
    intent: declaredStreamIntentRequestSchema.nullable(),
  })
  .strict()
  .superRefine((command, context) => {
    if ((command.action === "set") !== (command.intent !== null)) {
      context.addIssue({
        code: "custom",
        message: "Set intent commands require intent data; clear commands cannot carry it",
        path: ["intent"],
      });
    }
    if (
      command.action === "set" &&
      command.intent !== null &&
      command.intent.requestedExpiresAt <= command.issuedAt
    ) {
      context.addIssue({
        code: "custom",
        message: "Requested intent expiry must follow command issue time",
        path: ["intent", "requestedExpiresAt"],
      });
    }
  });

export const systemLiveDirectorContextCommandSchema = z
  .object({
    ...commandEnvelopeFields,
    type: z.literal("system.live-director-context-ready"),
    liveContextId: identifierSchema,
    audiencePointerId: identifierSchema.nullable(),
  })
  .strict();

export const systemLiveDirectorCueCommandSchema = z
  .object({
    ...commandEnvelopeFields,
    questCycleId: identifierSchema,
    type: z.literal("system.live-director-cue-ready"),
    cueId: identifierSchema,
    liveContextId: identifierSchema,
  })
  .strict();

export const streamerLiveDirectorCueCommandSchema = z
  .object({
    ...commandEnvelopeFields,
    questCycleId: identifierSchema,
    type: z.literal("streamer.live-director-cue"),
    cueId: identifierSchema,
    action: directorCueActionSchema,
  })
  .strict();

export const commandEnvelopeSchema = z
  .discriminatedUnion("type", [
    streamerQuestCommandSchema,
    viewerVoteCommandSchema,
    viewerReactionCommandSchema,
    systemIntelligenceCommandSchema,
    systemVoteCloseCommandSchema,
    systemQuestTickCommandSchema,
    streamerQuestProgressCommandSchema,
    systemQuestProgressCommandSchema,
    streamerEmergencyClearCommandSchema,
    streamerProfileSettingsCommandSchema,
    streamerLiveDirectorIntentCommandSchema,
    systemLiveDirectorContextCommandSchema,
    systemLiveDirectorCueCommandSchema,
    streamerLiveDirectorCueCommandSchema,
  ])
  .superRefine((command, context) => {
    const allowedActorKinds: Record<typeof command.type, Array<typeof command.actor.kind>> = {
      "streamer.quest": ["broadcaster", "moderator"],
      "viewer.vote": ["viewer", "anonymous"],
      "viewer.react": ["viewer", "anonymous"],
      "system.intelligence-ready": ["system"],
      "system.vote-close": ["system"],
      "system.quest-tick": ["system"],
      "streamer.quest-progress": ["broadcaster", "moderator"],
      "system.quest-progress": ["system"],
      "streamer.emergency-clear": ["broadcaster", "moderator"],
      "streamer.profile-settings": ["broadcaster"],
      "streamer.live-director-intent": ["broadcaster"],
      "system.live-director-context-ready": ["system"],
      "system.live-director-cue-ready": ["system"],
      "streamer.live-director-cue": ["broadcaster", "moderator"],
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
export type SystemQuestTickCommand = z.infer<typeof systemQuestTickCommandSchema>;
export type StreamerQuestProgressCommand = z.infer<typeof streamerQuestProgressCommandSchema>;
export type SystemQuestProgressCommand = z.infer<typeof systemQuestProgressCommandSchema>;
export type StreamerEmergencyClearCommand = z.infer<typeof streamerEmergencyClearCommandSchema>;
export type StreamerProfileSettingsCommand = z.infer<typeof streamerProfileSettingsCommandSchema>;
export type StreamerLiveDirectorIntentCommand = z.infer<
  typeof streamerLiveDirectorIntentCommandSchema
>;
export type SystemLiveDirectorContextCommand = z.infer<
  typeof systemLiveDirectorContextCommandSchema
>;
export type SystemLiveDirectorCueCommand = z.infer<typeof systemLiveDirectorCueCommandSchema>;
export type StreamerLiveDirectorCueCommand = z.infer<
  typeof streamerLiveDirectorCueCommandSchema
>;
