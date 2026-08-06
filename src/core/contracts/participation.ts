import { z } from "zod";

import {
  actorSchema,
  contractEnvelopeSchema,
  identifierSchema,
  revisionSchema,
  timestampSchema,
} from "./common";
import { voteTallySchema } from "./quests";

export const participationSourceModeSchema = z.enum([
  "twitch-extension",
  "hosted-board",
  "twitch-chat",
]);

export const voteSchema = z
  .object({
    envelope: contractEnvelopeSchema,
    voter: actorSchema,
    voterKey: identifierSchema,
    candidateId: identifierSchema,
    acceptedAt: timestampSchema,
    sourceMode: participationSourceModeSchema,
  })
  .strict()
  .superRefine((vote, context) => {
    if (vote.voter.kind !== "viewer" && vote.voter.kind !== "anonymous") {
      context.addIssue({
        code: "custom",
        message: "Only viewers and anonymous participants can cast votes",
        path: ["voter", "kind"],
      });
    }
  });

export const acceptedVoteTallySnapshotSchema = z
  .object({
    sessionId: identifierSchema,
    questCycleId: identifierSchema,
    revision: revisionSchema,
    closedAt: timestampSchema,
    acceptedVoteCount: z.number().int().nonnegative(),
    tallies: z.array(voteTallySchema).length(3),
  })
  .strict()
  .superRefine((snapshot, context) => {
    const candidateIds = snapshot.tallies.map((tally) => tally.candidateId);
    if (new Set(candidateIds).size !== candidateIds.length) {
      context.addIssue({
        code: "custom",
        message: "Accepted vote tallies must use three distinct candidate IDs",
        path: ["tallies"],
      });
    }
    const total = snapshot.tallies.reduce((sum, tally) => sum + tally.votes, 0);
    if (total !== snapshot.acceptedVoteCount) {
      context.addIssue({
        code: "custom",
        message: "Accepted vote count must equal the sum of candidate tallies",
        path: ["acceptedVoteCount"],
      });
    }
  });

export type Vote = z.infer<typeof voteSchema>;
export type ParticipationSourceMode = z.infer<typeof participationSourceModeSchema>;
export type AcceptedVoteTallySnapshot = z.infer<typeof acceptedVoteTallySnapshotSchema>;
