import { z } from "zod";

import { actorSchema, contractEnvelopeSchema, identifierSchema, timestampSchema } from "./common";

export const voteSchema = z
  .object({
    envelope: contractEnvelopeSchema,
    voter: actorSchema,
    voterKey: identifierSchema,
    candidateId: identifierSchema,
    acceptedAt: timestampSchema,
    sourceMode: z.enum(["twitch-extension", "hosted-board", "twitch-chat"]),
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

export type Vote = z.infer<typeof voteSchema>;
