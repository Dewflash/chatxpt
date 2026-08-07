import {
  canonicalJsonStringify,
  overlayViewModelSchema,
  streamerViewModelSchema,
  viewerViewModelSchema,
  type RoleViewModels,
} from "../core";

/** Removes viewer-specific identity, reward, and vote-choice fields before shared broadcast. */
export function sanitizeRoleViewsForBroadcast(views: RoleViewModels): RoleViewModels {
  const streamer = streamerViewModelSchema.parse(views.streamer);
  const viewer = viewerViewModelSchema.parse(views.viewer);
  const overlay = overlayViewModelSchema.parse(views.overlay);
  if (
    canonicalJsonStringify(streamer.session) !== canonicalJsonStringify(viewer.session) ||
    canonicalJsonStringify(streamer.session) !== canonicalJsonStringify(overlay.session) ||
    canonicalJsonStringify(streamer.questCycle) !== canonicalJsonStringify(viewer.questCycle) ||
    canonicalJsonStringify(streamer.questCycle) !== canonicalJsonStringify(overlay.questCycle)
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
      privateRecovery: viewer.privateRecovery === undefined
        ? undefined
        : {
            status: "unavailable",
            viewerId: null,
            acceptedCandidateId: null,
            acceptedAt: null,
            sourceMode: null,
            sessionPoints: 0,
            restoredAt: viewer.privateRecovery.restoredAt,
          },
      chatVote: viewer.chatVote === undefined
        ? undefined
        : {
            status: viewer.chatVote.status === "unavailable" ? "unavailable" : "not-delivered",
            commandId: null,
            candidateId: null,
            receivedAt: null,
            message: viewer.chatVote.status === "unavailable"
              ? viewer.chatVote.message
              : "Chat vote acknowledgement is private to the viewer.",
            retryable: viewer.chatVote.retryable,
          },
    }),
    overlay,
  };
}
