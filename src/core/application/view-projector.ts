import {
  overlayViewModelSchema,
  streamerViewModelSchema,
  viewerViewModelSchema,
  type OverlayUpNext,
  type PublicViewerContext,
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
  if (input.profile.gameId === null || input.gameplay.capabilities.gameId === null) return false;
  if (input.profile.gameId !== input.gameplay.capabilities.gameId) return false;
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

  if (questCycle.status === "selected") {
    const selected = optionById(questCycle.options, questCycle.activeCandidateId);
    if (selected === null) return null;
    return {
      label: "Vote winner",
      title: selected.title,
      detail:
        questCycle.endsAt === null
          ? "Waiting for streamer approval."
          : "Starting automatically after the winner reveal.",
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

const PUBLIC_SIGNAL_FRESHNESS_MILLISECONDS = 30_000;

function freshKnownSignalValue(
  snapshot: ViewModelProjectionInput["audience"] | ViewModelProjectionInput["gameplay"],
  kinds: readonly string[],
  now: number,
): string | number | boolean | null {
  for (const kind of kinds) {
    const signal = snapshot?.signals.find((candidate) => candidate.kind === kind);
    if (
      signal?.observation.status === "known" &&
      signal.observation.provenance.observedAt <= now &&
      now - signal.observation.provenance.observedAt <= PUBLIC_SIGNAL_FRESHNESS_MILLISECONDS
    ) {
      return signal.observation.value;
    }
  }
  return null;
}

function publicChatState(input: ViewModelProjectionInput): {
  readonly status: PublicViewerContext["chatStatus"];
  readonly energy: number | null;
} {
  const raw = freshKnownSignalValue(
    input.audience,
    ["audience-energy", "audience-mood"],
    input.envelope.receivedAt,
  );
  if (typeof raw === "number") {
    const energy = Math.max(0, Math.min(1, raw <= 1 ? raw : raw / 5));
    return {
      status: energy >= 0.67 ? "hype" : energy <= 0.33 ? "quiet" : "steady",
      energy,
    };
  }
  if (typeof raw === "string") {
    const normalized = raw.trim().toLocaleLowerCase();
    if (/hype|hyped|excited|high|energetic|celebrat/u.test(normalized)) {
      return { status: "hype", energy: 0.85 };
    }
    if (/quiet|calm|low|slow|idle|silent/u.test(normalized)) {
      return { status: "quiet", energy: 0.2 };
    }
    if (normalized.length > 0) return { status: "steady", energy: 0.5 };
  }
  return { status: "unknown", energy: null };
}

function publicGameplayStatus(input: ViewModelProjectionInput): string | null {
  const raw = freshKnownSignalValue(
    input.gameplay,
    [
      "minecraft-activity",
      "minecraft-menu-state",
      "minecraft-movement",
      "minecraft-combat",
      "game-vision-state",
      "activity-intensity",
      "visual-state",
    ],
    input.envelope.receivedAt,
  );
  return raw === null ? null : String(raw).trim().slice(0, 160) || null;
}

function projectPublicContext(input: ViewModelProjectionInput): PublicViewerContext {
  const now = input.envelope.receivedAt;
  const previous =
    input.liveDirector?.publicContext !== null &&
    input.liveDirector?.publicContext !== undefined &&
    input.liveDirector.publicContext.expiresAt > now
      ? input.liveDirector.publicContext
      : null;
  const observedChat = publicChatState(input);
  const chat = observedChat.status === "unknown" && previous !== null
    ? { status: previous.chatStatus, energy: previous.chatEnergy }
    : observedChat;
  const gameplayStatus = publicGameplayStatus(input) ?? previous?.gameplayStatus ?? null;
  const active = optionById(input.questCycle.options, input.questCycle.activeCandidateId);
  const intent = input.liveDirector?.declaredIntent;
  const sourceContextId =
    previous?.sourceContextId ??
    input.liveDirector?.liveContext?.contextId ??
    `public-source-${input.session.sessionId.slice(0, 110)}`;
  const explainer =
    chat.status !== "unknown" && gameplayStatus !== null
      ? `Chat is ${chat.status} while gameplay looks ${gameplayStatus}.`
      : chat.status !== "unknown"
        ? `Chat activity is ${chat.status}.`
        : gameplayStatus !== null
          ? `Gameplay currently looks ${gameplayStatus}.`
          : previous?.explainer ?? "Live context is still being observed.";
  return {
    contextId: `public-${input.envelope.revision}-${input.session.sessionId.slice(0, 96)}`,
    sourceContextId,
    goal: intent?.status === "known" ? intent.goal : previous?.goal ?? null,
    phase: input.questCycle.status,
    recentEvent: gameplayStatus ?? previous?.recentEvent ?? null,
    currentDecision:
      input.questCycle.status === "selected"
        ? input.questCycle.endsAt === null
          ? "Waiting for streamer approval"
          : "Winning quest selected"
        : previous?.currentDecision ?? null,
    activeSidequest: input.questCycle.status === "active" ? active?.title ?? null : null,
    result: input.questCycle.result === null ? null : resultTitle(input.questCycle.result.outcome),
    chatStatus: chat.status,
    chatEnergy: chat.energy,
    gameplayStatus,
    explainer,
    publishedAt: now,
    expiresAt: now + PUBLIC_SIGNAL_FRESHNESS_MILLISECONDS,
  };
}

/**
 * Canonical production projector. It derives only capability presentation;
 * lifecycle, vote acceptance, tallies, and rewards remain authoritative input.
 */
export class CanonicalViewProjector implements ViewModelProjector {
  project(input: ViewModelProjectionInput): RoleViewModels {
    const publicContext = projectPublicContext(input);
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
    const viewerLiveDirector = { liveDirector: { publicContext } };

    return {
      streamer: streamerViewModelSchema.parse({
        envelope: input.envelope,
        session: input.session,
        profile: input.profile,
        services: input.services,
        gameplay: input.gameplay,
        audience: input.audience,
        questCycle: input.questCycle,
        publicContext,
        communityHype: input.communityHype,
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
        publicContext,
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
        publicContext,
        connection: input.connection,
      }),
    };
  }
}
