import type {
  OverlayViewModel,
  ViewerReactionCommand,
  ViewerViewModel,
  ViewerVoteCommand,
} from "../core";

export type ViewerCommand = ViewerVoteCommand | ViewerReactionCommand;

/**
 * Role 1 wraps its authorised dispatcher with this sink. Role 5 emits a
 * canonical command and waits for newer props; it never applies the result.
 */
export type ViewerCommandSink = (command: ViewerCommand) => void;

export type ViewerSurfacePhase =
  | "loading"
  | "offline"
  | "ended"
  | "unavailable"
  | "waiting"
  | "voting"
  | "active"
  | "result";

export type OverlaySurfacePhase =
  | "loading"
  | "inactive"
  | "voting"
  | "active"
  | "result";

export interface ViewerQuestOptionPresentation {
  readonly candidateId: string;
  readonly title: string;
  readonly instruction: string;
  readonly durationSeconds: number;
  readonly difficulty: "easy" | "medium" | "hard";
  readonly rewardPoints: number;
  /** Null means the authoritative snapshot did not supply a tally. */
  readonly votes: number | null;
  readonly acceptedByViewer: boolean;
  readonly active: boolean;
}

export interface QuestProgressPresentation {
  readonly value: number;
  readonly method: "automatic" | "manual" | "unknown";
  readonly updatedAt: number;
}

export interface QuestResultPresentation {
  readonly outcome: "succeeded" | "failed" | "cancelled" | "skipped" | "expired";
  readonly reason: string;
  readonly rewardPointsAwarded: number;
  readonly occurredAt: number;
}

export interface ViewerPresentation {
  readonly phase: ViewerSurfacePhase;
  readonly evidenceClass: ViewerViewModel["envelope"]["evidenceClass"] | null;
  readonly revision: number | null;
  readonly participationMode: ViewerViewModel["participationMode"] | null;
  readonly connection: ViewerViewModel["connection"] | null;
  readonly options: readonly ViewerQuestOptionPresentation[];
  readonly acceptedCandidateId: string | null;
  readonly activeCandidateId: string | null;
  readonly canVote: boolean;
  readonly canReact: boolean;
  readonly startsAt: number | null;
  readonly endsAt: number | null;
  readonly progress: QuestProgressPresentation | null;
  readonly result: QuestResultPresentation | null;
  readonly sessionPoints: number;
  /** The canonical contract has no accepted scale, so this is never a percentage. */
  readonly communityHype: number;
}

export interface OverlayPresentation {
  readonly readOnly: true;
  readonly phase: OverlaySurfacePhase;
  readonly evidenceClass: OverlayViewModel["envelope"]["evidenceClass"] | null;
  readonly revision: number | null;
  readonly connection: OverlayViewModel["connection"] | null;
  readonly activeQuest: ViewerQuestOptionPresentation | null;
  readonly startsAt: number | null;
  readonly endsAt: number | null;
  readonly progress: QuestProgressPresentation | null;
  readonly result: QuestResultPresentation | null;
  readonly communityHype: number;
}

const terminalQuestStatuses = new Set([
  "succeeded",
  "failed",
  "cancelled",
  "skipped",
  "expired",
]);

function viewerPhase(view: ViewerViewModel): ViewerSurfacePhase {
  if (view.session.status === "offline") return "offline";
  if (view.session.status === "ended") return "ended";
  if (view.participationMode === "unavailable") return "unavailable";
  if (view.questCycle.status === "voting") return "voting";
  if (view.questCycle.status === "active") return "active";
  if (terminalQuestStatuses.has(view.questCycle.status)) return "result";
  return "waiting";
}

function overlayPhase(view: OverlayViewModel): OverlaySurfacePhase {
  if (view.questCycle.status === "voting") return "voting";
  if (view.questCycle.status === "active") return "active";
  if (terminalQuestStatuses.has(view.questCycle.status)) return "result";
  return "inactive";
}

function progressPresentation(
  progress: ViewerViewModel["questCycle"]["progress"],
): QuestProgressPresentation | null {
  if (progress === null) return null;
  return {
    value: progress.value,
    method: progress.method,
    updatedAt: progress.updatedAt,
  };
}

function resultPresentation(
  result: ViewerViewModel["questCycle"]["result"],
): QuestResultPresentation | null {
  if (result === null) return null;
  return {
    outcome: result.outcome,
    reason: result.reason,
    rewardPointsAwarded: result.rewardPointsAwarded,
    occurredAt: result.occurredAt,
  };
}

function optionPresentations(
  questCycle: ViewerViewModel["questCycle"],
  acceptedCandidateId: string | null,
  revealTallies: boolean,
): ViewerQuestOptionPresentation[] {
  const tallies = new Map(
    questCycle.voteTallies.map((tally) => [tally.candidateId, tally.votes] as const),
  );

  return questCycle.options.map((candidate) => ({
    candidateId: candidate.candidateId,
    title: candidate.title,
    instruction: candidate.instruction,
    durationSeconds: candidate.durationSeconds,
    difficulty: candidate.difficulty,
    rewardPoints: candidate.rewardPoints,
    votes: revealTallies ? (tallies.get(candidate.candidateId) ?? null) : null,
    acceptedByViewer: candidate.candidateId === acceptedCandidateId,
    active: candidate.candidateId === questCycle.activeCandidateId,
  }));
}

export function presentViewer(view: ViewerViewModel | null): ViewerPresentation {
  if (view === null) {
    return {
      phase: "loading",
      evidenceClass: null,
      revision: null,
      participationMode: null,
      connection: null,
      options: [],
      acceptedCandidateId: null,
      activeCandidateId: null,
      canVote: false,
      canReact: false,
      startsAt: null,
      endsAt: null,
      progress: null,
      result: null,
      sessionPoints: 0,
      communityHype: 0,
    };
  }

  const phase = viewerPhase(view);
  const connectionReady = view.connection.status === "ready";
  const revealTallies =
    view.acceptedCandidateId !== null || phase === "active" || phase === "result";

  return {
    phase,
    evidenceClass: view.envelope.evidenceClass,
    revision: view.envelope.revision,
    participationMode: view.participationMode,
    connection: view.connection,
    options: optionPresentations(view.questCycle, view.acceptedCandidateId, revealTallies),
    acceptedCandidateId: view.acceptedCandidateId,
    activeCandidateId: view.questCycle.activeCandidateId,
    canVote: phase === "voting" && view.canVote && connectionReady,
    canReact: view.canReact && connectionReady,
    startsAt: view.questCycle.startsAt,
    endsAt: view.questCycle.endsAt,
    progress: progressPresentation(view.questCycle.progress),
    result: resultPresentation(view.questCycle.result),
    sessionPoints: view.sessionPoints,
    communityHype: view.communityHype,
  };
}

export function presentOverlay(view: OverlayViewModel | null): OverlayPresentation {
  if (view === null) {
    return {
      readOnly: true,
      phase: "loading",
      evidenceClass: null,
      revision: null,
      connection: null,
      activeQuest: null,
      startsAt: null,
      endsAt: null,
      progress: null,
      result: null,
      communityHype: 0,
    };
  }

  const options = optionPresentations(view.questCycle, null, true);

  return {
    readOnly: true,
    phase: overlayPhase(view),
    evidenceClass: view.envelope.evidenceClass,
    revision: view.envelope.revision,
    connection: view.connection,
    activeQuest:
      options.find((candidate) => candidate.candidateId === view.questCycle.activeCandidateId) ??
      null,
    startsAt: view.questCycle.startsAt,
    endsAt: view.questCycle.endsAt,
    progress: progressPresentation(view.questCycle.progress),
    result: resultPresentation(view.questCycle.result),
    communityHype: view.communityHype,
  };
}
