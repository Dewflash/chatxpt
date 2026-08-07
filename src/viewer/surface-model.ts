import {
  CONTRACT_VERSION,
  type OverlayViewModel,
  type QuestCandidate,
  type QuestCycleState,
  type ServiceHealth,
  type ViewerViewModel,
  type ViewerVoteCommand,
} from "../core";

export type ViewerSurfaceMode = "extension" | "hosted-board";

export type ViewerVoteDispatchResult =
  | {
      readonly ok: true;
      readonly view: ViewerViewModel;
      readonly message: string;
    }
  | {
      readonly ok: false;
      readonly message: string;
    };

export type ViewerVoteDispatcher = (command: ViewerVoteCommand) => Promise<ViewerVoteDispatchResult>;

export type HostedQuestBoardAccessState =
  | {
      readonly status: "ready";
      readonly roomCode: string;
      readonly view: ViewerViewModel;
    }
  | {
      readonly status: "loading" | "invalid" | "expired" | "forbidden" | "unavailable";
      readonly roomCode?: string;
      readonly message: string;
      readonly retryable: boolean;
    };

export type ChatVoteAcknowledgement = {
  readonly status: "counted" | "duplicate" | "rejected" | "late" | "unavailable";
  readonly message: string;
  readonly optionNumber?: 1 | 2 | 3;
};

export function visibleQuestOptions(cycle: QuestCycleState): readonly QuestCandidate[] {
  if (cycle.status !== "proposed" && cycle.status !== "voting" && cycle.status !== "active") {
    return [];
  }
  return cycle.options;
}

export function activeQuest(cycle: QuestCycleState): QuestCandidate | null {
  if (cycle.activeCandidateId === null) return null;
  return cycle.options.find((option) => option.candidateId === cycle.activeCandidateId) ?? null;
}

export function voteCountFor(cycle: QuestCycleState, candidateId: string): number {
  return cycle.voteTallies.find((tally) => tally.candidateId === candidateId)?.votes ?? 0;
}

export function voteShareFor(cycle: QuestCycleState, candidateId: string): number {
  const total = cycle.voteTallies.reduce((sum, tally) => sum + tally.votes, 0);
  if (total === 0) return 0;
  return Math.round((voteCountFor(cycle, candidateId) / total) * 100);
}

export function remainingSeconds(now: number, endsAt: number | null): number | null {
  if (endsAt === null) return null;
  return Math.max(0, Math.ceil((endsAt - now) / 1000));
}

export function serviceStatusLabel(health: ServiceHealth): string {
  switch (health.status) {
    case "ready":
      return "Configured";
    case "degraded":
      return "Degraded";
    case "misconfigured":
      return "Not configured";
    case "permission-denied":
    case "unavailable":
      return "Not ready";
  }
}

export function overlayPlacementClass(view: OverlayViewModel): "edge" | "result" | "quiet" {
  if (view.questCycle.result !== null) return "result";
  if (view.questCycle.status === "idle" || view.questCycle.status === "cooldown") return "quiet";
  return "edge";
}

export function buildViewerVoteCommand(input: {
  readonly view: ViewerViewModel;
  readonly candidateId: string;
  readonly voterKey: string;
  readonly issuedAt: number;
}): ViewerVoteCommand {
  const sourceMode =
    input.view.participationMode === "unavailable" ? "hosted-board" : input.view.participationMode;

  return {
    contractVersion: CONTRACT_VERSION,
    sessionId: input.view.session.sessionId,
    questCycleId: input.view.questCycle.envelope.questCycleId ?? "fixture-cycle",
    commandId: `viewer-vote-${input.candidateId}-${input.issuedAt}`,
    correlationId: `viewer-correlation-${input.issuedAt}`,
    expectedRevision: input.view.envelope.revision,
    issuedAt: input.issuedAt,
    actor: input.view.viewerId === null
      ? { kind: "anonymous", actorId: null }
      : { kind: "viewer", actorId: input.view.viewerId },
    type: "viewer.vote",
    candidateId: input.candidateId,
    voterKey: input.voterKey,
    sourceMode,
  };
}
