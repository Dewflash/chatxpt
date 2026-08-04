import {
  candidateBatchSchema,
  commandEnvelopeSchema,
  domainErrorSchema,
  questCycleStateSchema,
  type CommandEnvelope,
  type DomainError,
  type QuestCandidate,
  type QuestCycleState,
  type QuestEngine,
  type QuestEngineDecision,
  type QuestEngineEventDraft,
  type QuestEngineInput,
  type QuestEngineResult,
  type StreamerQuestAction,
} from "../core";

export interface QuestTieBreakInput {
  readonly candidateIds: readonly string[];
  readonly seed: string;
}

export interface QuestTieBreaker {
  select(input: QuestTieBreakInput): string;
}

const actionsByStatus = {
  idle: [],
  evaluating: [],
  proposed: ["approve", "reject", "skip", "emergency-pause"],
  voting: ["start", "cancel", "skip", "emergency-pause"],
  active: ["cancel", "skip", "succeed", "fail", "emergency-pause"],
  succeeded: [],
  failed: [],
  cancelled: [],
  skipped: [],
  expired: [],
  cooldown: [],
} as const satisfies Record<QuestCycleState["status"], readonly StreamerQuestAction[]>;

function error(
  code: DomainError["code"],
  message: string,
  details?: DomainError["details"],
): QuestEngineResult {
  return {
    ok: false,
    error: domainErrorSchema.parse({ code, message, retryable: false, details }),
  };
}

function stableHash(value: string): number {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

class StableQuestTieBreaker implements QuestTieBreaker {
  select({ candidateIds, seed }: QuestTieBreakInput): string {
    const candidates = [...candidateIds].sort();
    if (candidates.length === 0) {
      throw new Error("Cannot select from an empty candidate set");
    }
    return candidates.reduce((selected, candidate) =>
      stableHash(`${seed}:${candidate}`) < stableHash(`${seed}:${selected}`) ? candidate : selected,
    );
  }
}

function event(eventType: string, attributes: QuestEngineEventDraft["attributes"] = {}) {
  return { eventType, attributes } satisfies QuestEngineEventDraft;
}

function accept(
  currentState: QuestCycleState,
  patch: Omit<Partial<QuestCycleState>, "envelope">,
  emitted: readonly QuestEngineEventDraft[],
): QuestEngineResult {
  const nextState = questCycleStateSchema.safeParse({
    ...currentState,
    ...patch,
  });
  if (!nextState.success) {
    return error("internal", "Quest transition produced invalid canonical state");
  }
  return {
    ok: true,
    decision: {
      nextState: nextState.data,
      events: emitted,
    } satisfies QuestEngineDecision,
  };
}

function illegalCommand(state: QuestCycleState, command: CommandEnvelope): QuestEngineResult {
  const action = command.type === "streamer.quest" ? command.action : command.type;
  return error("forbidden", `${action} is not available while the quest cycle is ${state.status}`, {
    commandType: command.type,
    status: state.status,
  });
}

function validateBoundary(input: QuestEngineInput): QuestEngineResult | null {
  const state = questCycleStateSchema.safeParse(input.currentState);
  if (!state.success) return error("validation", "Current quest-cycle state is invalid");

  const command = commandEnvelopeSchema.safeParse(input.command);
  if (!command.success) return error("validation", "Quest command is invalid");

  if (!Number.isSafeInteger(input.now) || input.now < 0) {
    return error("validation", "Authoritative quest-engine time is invalid");
  }
  if (command.data.sessionId !== state.data.envelope.sessionId) {
    return error("validation", "Quest command belongs to another session");
  }
  if (command.data.questCycleId !== state.data.envelope.questCycleId) {
    return error("validation", "Quest command belongs to another quest cycle");
  }
  if (command.data.expectedRevision !== state.data.envelope.revision) {
    return error("stale-revision", "Quest command expected a stale cycle revision", {
      currentRevision: state.data.envelope.revision,
      expectedRevision: command.data.expectedRevision,
    });
  }
  if (command.data.type !== "system.intelligence-ready" && input.candidateBatch !== null) {
    return error("validation", "Only an intelligence-ready command may include candidates");
  }
  return null;
}

function validateCandidateBatch(input: QuestEngineInput): QuestEngineResult | null {
  if (input.command.type !== "system.intelligence-ready") return null;
  if (input.candidateBatch === null) {
    return error("dependency-unavailable", "Intelligence-ready command has no candidate batch");
  }
  const batch = candidateBatchSchema.safeParse(input.candidateBatch);
  if (!batch.success) return error("validation", "Candidate batch is invalid");

  const envelope = batch.data.envelope;
  if (
    envelope.messageId !== input.command.candidateBatchId ||
    envelope.sessionId !== input.command.sessionId ||
    envelope.questCycleId !== input.command.questCycleId ||
    envelope.revision !== input.command.expectedRevision ||
    envelope.evidenceClass !== input.currentState.envelope.evidenceClass
  ) {
    return error("validation", "Candidate batch does not belong to the commanded cycle");
  }
  return null;
}

function transitionIntelligenceReady(input: QuestEngineInput): QuestEngineResult {
  if (input.command.type !== "system.intelligence-ready" || input.candidateBatch === null) {
    return error("internal", "Intelligence transition received inconsistent input");
  }
  if (!["idle", "evaluating", "cooldown"].includes(input.currentState.status)) {
    return illegalCommand(input.currentState, input.command);
  }

  return accept(
    input.currentState,
    {
      status: "proposed",
      options: [...input.candidateBatch.candidates],
      activeCandidateId: null,
      availableStreamerActions: [...actionsByStatus.proposed],
      voteTallies: [],
      startsAt: null,
      endsAt: null,
      progress: null,
      result: null,
    },
    [event("quest-cycle.proposed", { candidateCount: input.candidateBatch.candidates.length })],
  );
}

function terminalTransition(
  input: QuestEngineInput,
  outcome: "succeeded" | "failed" | "cancelled" | "skipped",
  reasonOverride?: string,
  eventType = "quest-cycle.terminal",
): QuestEngineResult {
  const activeCandidate = input.currentState.options.find(
    (candidate) => candidate.candidateId === input.currentState.activeCandidateId,
  );
  const rewardPointsAwarded = outcome === "succeeded" ? (activeCandidate?.rewardPoints ?? 0) : 0;
  const reasonByOutcome = {
    succeeded: "Streamer marked the active quest as succeeded.",
    failed: "Streamer marked the active quest as failed.",
    cancelled: "Streamer cancelled the quest cycle.",
    skipped: "Streamer skipped the quest cycle.",
  } as const;

  return accept(
    input.currentState,
    {
      status: outcome,
      availableStreamerActions: [...actionsByStatus[outcome]],
      endsAt: input.now,
      progress:
        outcome === "succeeded"
          ? {
              value: 1,
              updatedAt: input.now,
              method: "manual",
              evidenceSignalIds: [],
            }
          : input.currentState.progress,
      result: {
        outcome,
        occurredAt: input.now,
        reason: reasonOverride ?? reasonByOutcome[outcome],
        rewardPointsAwarded,
      },
    },
    [
      event(eventType, {
        outcome,
        rewardPointsAwarded,
      }),
    ],
  );
}

function tiedWinner(state: QuestCycleState, tieBreaker: QuestTieBreaker): string {
  const votes = new Map(state.voteTallies.map((tally) => [tally.candidateId, tally.votes]));
  const highestVote = Math.max(0, ...state.options.map((candidate) => votes.get(candidate.candidateId) ?? 0));
  const tiedIds = state.options
    .filter((candidate) => (votes.get(candidate.candidateId) ?? 0) === highestVote)
    .map((candidate) => candidate.candidateId);
  return tieBreaker.select({
    candidateIds: tiedIds,
    seed: `${state.envelope.sessionId}:${state.envelope.questCycleId ?? "none"}:${state.envelope.revision}`,
  });
}

function activeEndTime(now: number, candidate: QuestCandidate): number | null {
  const endsAt = now + candidate.durationSeconds * 1_000;
  return Number.isSafeInteger(endsAt) ? endsAt : null;
}

function transitionStreamerCommand(
  input: QuestEngineInput,
  tieBreaker: QuestTieBreaker,
): QuestEngineResult {
  if (input.command.type !== "streamer.quest") {
    return error("internal", "Streamer transition received another command type");
  }
  const { action } = input.command;
  const availableActions: readonly StreamerQuestAction[] = actionsByStatus[input.currentState.status];
  if (!availableActions.includes(action)) {
    return illegalCommand(input.currentState, input.command);
  }

  if (action === "approve" && input.currentState.status === "proposed") {
    return accept(
      input.currentState,
      {
        status: "voting",
        availableStreamerActions: [...actionsByStatus.voting],
        voteTallies: input.currentState.options.map((candidate) => ({
          candidateId: candidate.candidateId,
          votes: 0,
        })),
        startsAt: input.now,
      },
      [event("quest-cycle.voting-started")],
    );
  }

  if (action === "reject" && input.currentState.status === "proposed") {
    return terminalTransition(input, "cancelled", "Streamer rejected the proposed quest batch.");
  }
  if (action === "skip") return terminalTransition(input, "skipped");
  if (action === "cancel") return terminalTransition(input, "cancelled");
  if (action === "emergency-pause") {
    return terminalTransition(
      input,
      "cancelled",
      "Emergency pause cancelled the current quest cycle.",
      "quest-cycle.emergency-cancelled",
    );
  }
  if (action === "succeed" && input.currentState.status === "active") {
    return terminalTransition(input, "succeeded");
  }
  if (action === "fail" && input.currentState.status === "active") {
    return terminalTransition(input, "failed");
  }

  if (action === "start" && input.currentState.status === "voting") {
    const candidateId = input.command.candidateId ?? tiedWinner(input.currentState, tieBreaker);
    const candidate = input.currentState.options.find((option) => option.candidateId === candidateId);
    if (candidate === undefined) {
      return error("validation", "Start command selected a candidate outside this cycle");
    }
    const endsAt = activeEndTime(input.now, candidate);
    if (endsAt === null) return error("validation", "Active quest end time exceeds supported range");

    return accept(
      input.currentState,
      {
        status: "active",
        activeCandidateId: candidate.candidateId,
        availableStreamerActions: [...actionsByStatus.active],
        startsAt: input.now,
        endsAt,
        progress: {
          value: 0,
          updatedAt: input.now,
          method: "unknown",
          evidenceSignalIds: [],
        },
      },
      [event("quest-cycle.activated", { candidateId: candidate.candidateId, endsAt })],
    );
  }

  return illegalCommand(input.currentState, input.command);
}

function transitionVote(input: QuestEngineInput): QuestEngineResult {
  if (input.command.type !== "viewer.vote") {
    return error("internal", "Vote transition received another command type");
  }
  if (input.currentState.status !== "voting") return illegalCommand(input.currentState, input.command);
  const selectedCandidateId = input.command.candidateId;
  if (!input.currentState.options.some(({ candidateId }) => candidateId === selectedCandidateId)) {
    return error("validation", "Vote selected a candidate outside this cycle");
  }

  const voteTallies = input.currentState.options.map((candidate) => {
    const current = input.currentState.voteTallies.find(
      (tally) => tally.candidateId === candidate.candidateId,
    );
    return {
      candidateId: candidate.candidateId,
      votes: (current?.votes ?? 0) + (candidate.candidateId === selectedCandidateId ? 1 : 0),
    };
  });
  return accept(input.currentState, { voteTallies }, [
    event("quest-cycle.vote-recorded", { candidateId: selectedCandidateId }),
  ]);
}

export class DefaultQuestEngine implements QuestEngine {
  constructor(private readonly tieBreaker: QuestTieBreaker = new StableQuestTieBreaker()) {}

  decide(input: QuestEngineInput): QuestEngineResult {
    const boundaryError = validateBoundary(input);
    if (boundaryError !== null) return boundaryError;
    const batchError = validateCandidateBatch(input);
    if (batchError !== null) return batchError;

    switch (input.command.type) {
      case "system.intelligence-ready":
        return transitionIntelligenceReady(input);
      case "streamer.quest":
        return transitionStreamerCommand(input, this.tieBreaker);
      case "viewer.vote":
        return transitionVote(input);
      case "viewer.react":
        return error("unavailable-capability", "Viewer reactions do not change Phase 1 quest state");
    }
  }
}

export function createDefaultQuestEngine(tieBreaker?: QuestTieBreaker): QuestEngine {
  return new DefaultQuestEngine(tieBreaker);
}
