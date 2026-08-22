import {
  overlayViewModelSchema,
  resolveCurrentStreamGame,
  streamerViewModelSchema,
  viewerViewModelSchema,
  type OverlayUpNext,
  type QuestCandidate,
  type QuestCycleState,
  type RoleViewModels,
  type ViewModelProjectionInput,
  type ViewModelProjector,
} from "../contracts";
import { GAMEPLAY_SNAPSHOT_STALE_AFTER_MS } from "./gameplay-health";

function votingOpen(input: ViewModelProjectionInput): boolean {
  return (
    input.session.status === "live" &&
    input.questCycle.status === "voting" &&
    input.questCycle.options.length === 3 &&
    input.questCycle.endsAt !== null &&
    input.questCycle.endsAt > input.envelope.receivedAt
  );
}

function optionById(
  options: readonly QuestCandidate[],
  candidateId: string | null,
): QuestCandidate | null {
  if (candidateId === null) return null;
  return options.find((candidate) => candidate.candidateId === candidateId) ?? null;
}

function resultTitle(outcome: NonNullable<QuestCycleState["result"]>["outcome"]): string {
  switch (outcome) {
    case "succeeded":
      return "Sidequest complete";
    case "failed":
      return "Sidequest failed";
    case "cancelled":
      return "Sidequest cancelled";
    case "skipped":
      return "Sidequest skipped";
    case "expired":
      return "Sidequest expired";
  }
}

function hasFreshCompatibleGameplay(input: ViewModelProjectionInput): boolean {
  if (input.gameplay === null) return false;
  const game = resolveCurrentStreamGame(input.profile, input.session.currentGame);
  if (game === null) return false;
  const gameplayGameId = input.gameplay.capabilities.gameId;
  const compatibleGame =
    game.gameId === gameplayGameId ||
    (game.gameId === "generic" && gameplayGameId === null);
  if (!compatibleGame) return false;
  if (input.envelope.receivedAt - input.gameplay.envelope.occurredAt > GAMEPLAY_SNAPSHOT_STALE_AFTER_MS) {
    return false;
  }
  return input.gameplay.signals.some((signal) => signal.observation.status === "known");
}

function declaredObjectiveUpNext(input: ViewModelProjectionInput): OverlayUpNext | null {
  const intent = input.liveDirector?.declaredIntent;
  if (intent?.status !== "known") return null;
  if (intent.expiresAt <= input.envelope.receivedAt) return null;
  if (!hasFreshCompatibleGameplay(input)) return null;
  return {
    label: "Up next",
    title: intent.goal,
    detail: intent.objective,
    expiresAt: intent.expiresAt,
  };
}

function questCycleUpNext(questCycle: QuestCycleState): OverlayUpNext | null {
  if (questCycle.status === "voting") {
    return {
      label: "Up next",
      title: "Winning quest goes live",
      detail: "The official winner appears here after the audience vote closes.",
      expiresAt: questCycle.endsAt,
    };
  }

  if (questCycle.status === "active") {
    const active = optionById(questCycle.options, questCycle.activeCandidateId);
    if (active === null) return null;
    return {
      label: "Quest payoff",
      title: active.title,
      detail: active.instruction,
      expiresAt: questCycle.endsAt,
    };
  }

  if (questCycle.status === "cooldown") {
    return {
      label: "Up next",
      title: "Next vote soon",
      detail: "ChatXPT is waiting for another safe sidequest moment.",
      expiresAt: questCycle.endsAt,
    };
  }

  if (questCycle.result !== null) {
    return {
      label: "Result",
      title: resultTitle(questCycle.result.outcome),
      detail: questCycle.result.reason,
      expiresAt: questCycle.endsAt,
    };
  }

  return null;
}

function overlayUpNext(input: ViewModelProjectionInput): OverlayUpNext | null {
  return questCycleUpNext(input.questCycle) ?? declaredObjectiveUpNext(input);
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
    const streamerLiveDirector =
      input.liveDirector === undefined ? {} : { liveDirector: input.liveDirector };
    const sessionOverride =
      input.sessionOverride === undefined ? {} : { sessionOverride: input.sessionOverride };
    const viewerLiveDirector =
      input.liveDirector === undefined
        ? {}
        : {
            liveDirector:
              input.liveDirector === null
                ? null
                : { publicContext: input.liveDirector.publicContext },
          };

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
        ...sessionOverride,
        ...streamerLiveDirector,
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
        ...viewerLiveDirector,
      }),
      overlay: overlayViewModelSchema.parse({
        envelope: input.envelope,
        session: input.session,
        readOnly: true,
        communityHype: input.communityHype,
        upNext: overlayUpNext(input),
        questCycle: input.questCycle,
        connection: input.connection,
      }),
    };
  }
}
