import {
  canonicalJsonStringify,
  overlayViewModelSchema,
  publicQuestCycleStateSchema,
  streamerViewModelSchema,
  viewerViewModelSchema,
  type RoleViewModels,
} from "../core";

/** Removes viewer-specific identity, reward, and vote-choice fields before shared broadcast. */
export function sanitizeRoleViewsForBroadcast(views: RoleViewModels): RoleViewModels {
  const streamer = streamerViewModelSchema.parse(views.streamer);
  const viewer = viewerViewModelSchema.parse(views.viewer);
  const overlay = overlayViewModelSchema.parse(views.overlay);
  const publicStreamerQuestCycle = publicQuestCycleStateSchema.parse(streamer.questCycle);
  if (
    canonicalJsonStringify(streamer.session) !== canonicalJsonStringify(viewer.session) ||
    canonicalJsonStringify(streamer.session) !== canonicalJsonStringify(overlay.session) ||
    canonicalJsonStringify(publicStreamerQuestCycle) !== canonicalJsonStringify(viewer.questCycle) ||
    canonicalJsonStringify(publicStreamerQuestCycle) !== canonicalJsonStringify(overlay.questCycle)
  ) {
    throw new Error("Role snapshots disagree on authoritative session state");
  }
  return {
    streamer,
    viewer: viewerViewModelSchema.parse({
      ...viewer,
      viewerId: null,
      sessionPoints: 0,
      acceptedCandidateId: null,
    }),
    overlay,
  };
}
