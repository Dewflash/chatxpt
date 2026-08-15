import {
  overlayViewModelSchema,
  streamerViewModelSchema,
  viewerViewModelSchema,
  type RoleViewModels,
  type ViewModelProjectionInput,
  type ViewModelProjector,
} from "../contracts";

function votingOpen(input: ViewModelProjectionInput): boolean {
  return (
    input.session.status === "live" &&
    input.questCycle.status === "voting" &&
    input.questCycle.options.length === 3 &&
    input.questCycle.endsAt !== null &&
    input.questCycle.endsAt > input.envelope.receivedAt
  );
}

/**
 * Canonical production projector. It derives only capability presentation;
 * lifecycle, vote acceptance, tallies, and rewards remain authoritative input.
 */
export class CanonicalViewProjector implements ViewModelProjector {
  project(input: ViewModelProjectionInput): RoleViewModels {
    const connected = input.connection.status === "ready";
    const canVote =
      votingOpen(input) &&
      connected &&
      input.participationMode !== "unavailable" &&
      input.acceptedCandidateId === null &&
      ((input.participationMode === "twitch-extension" && input.capabilities.twitchExtension) ||
        (input.participationMode === "hosted-board" && input.capabilities.hostedViewerBoard) ||
        (input.participationMode === "twitch-chat" && input.capabilities.twitchChatVoting));
    const canReact =
      input.session.status === "live" &&
      connected &&
      input.capabilities.reactions &&
      input.participationMode !== "unavailable";

    return {
      streamer: streamerViewModelSchema.parse({
        envelope: input.envelope,
        session: input.session,
        profile: input.profile,
        services: input.services,
        gameplay: input.gameplay,
        audience: input.audience,
        questCycle: input.questCycle,
        emergencyPaused: input.emergencyPaused,
      }),
      viewer: viewerViewModelSchema.parse({
        envelope: input.envelope,
        session: input.session,
        capabilities: input.capabilities,
        participationMode: input.participationMode,
        canVote,
        canReact,
        viewerId: input.viewerId,
        sessionPoints: input.sessionPoints,
        communityHype: input.communityHype,
        acceptedCandidateId: input.acceptedCandidateId,
        questCycle: input.questCycle,
        connection: input.connection,
      }),
      overlay: overlayViewModelSchema.parse({
        envelope: input.envelope,
        session: input.session,
        readOnly: true,
        communityHype: input.communityHype,
        questCycle: input.questCycle,
        connection: input.connection,
      }),
    };
  }
}
