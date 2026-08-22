import { z } from "zod";

import {
  contractEnvelopeSchema,
  identifierSchema,
  serviceHealthSchema,
  timestampSchema,
} from "./common";
import { streamerProfileSchema, streamerSessionOverrideSchema } from "./profile";
import { publicQuestCycleStateSchema, questCycleStateSchema } from "./quests";
import { participationCapabilitiesSchema, streamSessionSchema } from "./session";
import {
  audienceSnapshotSchema,
  gameplaySnapshotSchema,
  liveDirectorStateSchema,
  publicViewerContextSchema,
} from "./signals";

export const participationModeSchema = z.enum([
  "twitch-extension",
  "hosted-board",
  "twitch-chat",
  "unavailable",
]);

export const streamerLiveDirectorProjectionSchema = liveDirectorStateSchema;

export const streamerProfileConnectionSchema = z
  .object({
    accountStatus: z.enum(["twitch-verified", "diagnostic", "local-fallback"]),
    profileOrigin: z.enum(["supabase", "memory", "device-seed"]),
    persistenceStatus: z.enum(["synced", "temporary", "device-only", "unavailable"]),
    checkedAt: timestampSchema,
    lastPersistedAt: timestampSchema.nullable(),
    message: z.string().trim().min(1).max(240),
  })
  .strict();

export const viewerLiveDirectorProjectionSchema = z
  .object({
    publicContext: publicViewerContextSchema.nullable(),
  })
  .strict();

export const streamerViewModelSchema = z
  .object({
    envelope: contractEnvelopeSchema,
    session: streamSessionSchema,
    profile: streamerProfileSchema,
    services: z.array(serviceHealthSchema),
    gameplay: gameplaySnapshotSchema.nullable(),
    audience: audienceSnapshotSchema.nullable(),
    questCycle: questCycleStateSchema,
    publicContext: publicViewerContextSchema.nullable().default(null),
    communityHype: z.number().int().nonnegative().default(0),
    emergencyPaused: z.boolean(),
    profileConnection: streamerProfileConnectionSchema.optional(),
    sessionOverride: streamerSessionOverrideSchema.nullable().optional(),
    liveDirector: streamerLiveDirectorProjectionSchema.nullable().optional(),
  })
  .strict()
  .superRefine((view, context) => {
    if (view.envelope.sessionId !== view.session.sessionId) {
      context.addIssue({ code: "custom", message: "Session IDs must match", path: ["session", "sessionId"] });
    }
    if (view.envelope.revision !== view.session.revision) {
      context.addIssue({ code: "custom", message: "Session revision must match view revision", path: ["session", "revision"] });
    }
    if (view.questCycle.envelope.sessionId !== view.session.sessionId) {
      context.addIssue({
        code: "custom",
        message: "Quest cycle must belong to the view session",
        path: ["questCycle", "envelope", "sessionId"],
      });
    }
    if (view.questCycle.envelope.revision !== view.envelope.revision) {
      context.addIssue({
        code: "custom",
        message: "Quest-cycle revision must match view revision",
        path: ["questCycle", "envelope", "revision"],
      });
    }
    if (view.questCycle.envelope.questCycleId !== view.envelope.questCycleId) {
      context.addIssue({
        code: "custom",
        message: "Quest-cycle IDs must match",
        path: ["questCycle", "envelope", "questCycleId"],
      });
    }
    if (view.profile.streamerId !== view.session.broadcasterId) {
      context.addIssue({
        code: "custom",
        message: "Profile streamer must own the view session",
        path: ["profile", "streamerId"],
      });
    }
    for (const [path, snapshot] of [
      ["gameplay", view.gameplay],
      ["audience", view.audience],
    ] as const) {
      if (snapshot !== null && snapshot.envelope.sessionId !== view.session.sessionId) {
        context.addIssue({
          code: "custom",
          message: "Intelligence snapshot must belong to the view session",
          path: [path, "envelope", "sessionId"],
        });
      }
    }
  });

export const viewerViewModelSchema = z
  .object({
    envelope: contractEnvelopeSchema,
    session: streamSessionSchema,
    capabilities: participationCapabilitiesSchema,
    participationMode: participationModeSchema,
    canVote: z.boolean(),
    canReact: z.boolean(),
    viewerId: identifierSchema.nullable(),
    sessionPoints: z.number().int().nonnegative(),
    communityHype: z.number().int().nonnegative(),
    acceptedCandidateId: identifierSchema.nullable(),
    questCycle: publicQuestCycleStateSchema,
    publicContext: publicViewerContextSchema.nullable().default(null),
    connection: serviceHealthSchema,
    liveDirector: viewerLiveDirectorProjectionSchema.nullable().optional(),
  })
  .strict()
  .superRefine((view, context) => {
    if (view.envelope.sessionId !== view.session.sessionId) {
      context.addIssue({ code: "custom", message: "Session IDs must match", path: ["session", "sessionId"] });
    }
    if (view.envelope.revision !== view.session.revision) {
      context.addIssue({ code: "custom", message: "Session revision must match view revision", path: ["session", "revision"] });
    }
    for (const capability of Object.keys(view.capabilities) as Array<keyof typeof view.capabilities>) {
      if (view.capabilities[capability] !== view.session.capabilities[capability]) {
        context.addIssue({
          code: "custom",
          message: "Viewer capabilities must match the authoritative session capabilities",
          path: ["capabilities", capability],
        });
      }
    }
    if (view.questCycle.envelope.sessionId !== view.session.sessionId) {
      context.addIssue({
        code: "custom",
        message: "Quest cycle must belong to the view session",
        path: ["questCycle", "envelope", "sessionId"],
      });
    }
    if (view.questCycle.envelope.revision !== view.envelope.revision) {
      context.addIssue({
        code: "custom",
        message: "Quest-cycle revision must match view revision",
        path: ["questCycle", "envelope", "revision"],
      });
    }
    if (view.questCycle.envelope.questCycleId !== view.envelope.questCycleId) {
      context.addIssue({
        code: "custom",
        message: "Quest-cycle IDs must match",
        path: ["questCycle", "envelope", "questCycleId"],
      });
    }
    if (
      view.acceptedCandidateId !== null &&
      !view.questCycle.options.some((candidate) => candidate.candidateId === view.acceptedCandidateId)
    ) {
      context.addIssue({
        code: "custom",
        message: "acceptedCandidateId must reference a visible cycle option",
        path: ["acceptedCandidateId"],
      });
    }
  });

export const overlayUpNextSchema = z
  .object({
    label: z.string().trim().min(1).max(40),
    title: z.string().trim().min(1).max(90),
    detail: z.string().trim().min(1).max(180),
    expiresAt: timestampSchema.nullable(),
  })
  .strict();

export const overlayViewModelSchema = z
  .object({
    envelope: contractEnvelopeSchema,
    session: streamSessionSchema,
    readOnly: z.literal(true),
    communityHype: z.number().int().nonnegative(),
    upNext: overlayUpNextSchema.nullable(),
    questCycle: publicQuestCycleStateSchema,
    publicContext: publicViewerContextSchema.nullable().default(null),
    connection: serviceHealthSchema,
  })
  .strict()
  .superRefine((view, context) => {
    if (view.envelope.sessionId !== view.session.sessionId) {
      context.addIssue({ code: "custom", message: "Session IDs must match", path: ["session", "sessionId"] });
    }
    if (view.envelope.revision !== view.session.revision) {
      context.addIssue({ code: "custom", message: "Session revision must match view revision", path: ["session", "revision"] });
    }
    if (view.questCycle.envelope.sessionId !== view.session.sessionId) {
      context.addIssue({
        code: "custom",
        message: "Quest cycle must belong to the view session",
        path: ["questCycle", "envelope", "sessionId"],
      });
    }
    if (view.questCycle.envelope.revision !== view.envelope.revision) {
      context.addIssue({
        code: "custom",
        message: "Quest-cycle revision must match view revision",
        path: ["questCycle", "envelope", "revision"],
      });
    }
    if (view.questCycle.envelope.questCycleId !== view.envelope.questCycleId) {
      context.addIssue({
        code: "custom",
        message: "Quest-cycle IDs must match",
        path: ["questCycle", "envelope", "questCycleId"],
      });
    }
  });

export type StreamerViewModel = z.infer<typeof streamerViewModelSchema>;
export type StreamerProfileConnection = z.infer<typeof streamerProfileConnectionSchema>;
export type ViewerViewModel = z.infer<typeof viewerViewModelSchema>;
export type OverlayUpNext = z.infer<typeof overlayUpNextSchema>;
export type OverlayViewModel = z.infer<typeof overlayViewModelSchema>;
export type StreamerLiveDirectorProjection = z.infer<
  typeof streamerLiveDirectorProjectionSchema
>;
export type ViewerLiveDirectorProjection = z.infer<typeof viewerLiveDirectorProjectionSchema>;
