import {
  acceptedVoteTallySnapshotSchema,
  audienceSnapshotSchema,
  candidateBatchSchema,
  commandEnvelopeSchema,
  domainErrorSchema,
  gameplaySnapshotSchema,
  intelligenceSnapshotSchema,
  questCycleStateSchema,
  streamerProfileSchema,
  streamSessionSchema,
  type CommandEnvelope,
  type DomainError,
  type QuestCycleState,
  type QuestEngine,
  type QuestEngineDecision,
  type QuestEngineEventDraft,
  type QuestEngineInput,
  type QuestEngineResult,
  type QuestProgress,
  type StreamerQuestAction,
} from "../core";
import { decideAutomaticProgress, decideManualProgress, decideQuestOutcome } from "./outcomes";
import { defaultCooldownEndsAt } from "./intervention";
import { validateCandidateAtVoteClose } from "./validation";

export const DEFAULT_VOTING_MILLISECONDS = 30_000;
export const DEFAULT_WINNER_DISPLAY_MILLISECONDS = 10_000;
export const DEFAULT_RESULT_DISPLAY_MILLISECONDS = 10_000;

const actionsByStatus = {
  idle: [],
  evaluating: [],
  proposed: ["approve", "reject", "skip", "emergency-pause"],
  voting: ["cancel", "skip", "emergency-pause"],
  selected: ["cancel", "skip", "emergency-pause"],
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
  if (
    command.data.type !== "system.vote-close" &&
    (input.acceptedVoteTally != null || input.voteCloseValidationContext != null)
  ) {
    return error("validation", "Only a vote-close command may include final tally context");
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

function completionRulesMatch(
  activeRule: QuestCycleState["completionRule"],
  suppliedRule: QuestCycleState["completionRule"],
): boolean {
  if (activeRule === null || suppliedRule === null) return false;
  return JSON.stringify(activeRule) === JSON.stringify(suppliedRule);
}

function transitionQuestProgress(input: QuestEngineInput): QuestEngineResult {
  if (input.command.type !== "streamer.quest-progress" && input.command.type !== "system.quest-progress") {
    return error("internal", "Progress transition received another command type");
  }
  if (input.currentState.status !== "active") return illegalCommand(input.currentState, input.command);

  const progressDecision =
    input.command.type === "streamer.quest-progress"
      ? decideManualProgress(input.currentState.progress, input.command.requestedValue, input.now)
      : (() => {
          const context = input.questProgressValidationContext;
          if (
            context === null ||
            context === undefined ||
            context.gameplay === null
          ) {
            return {
              accepted: false as const,
              reason: "missing-evidence" as const,
            };
          }
          const activeCompletionRule = input.currentState.completionRule;
          if (activeCompletionRule === null || activeCompletionRule.mode !== "signal") {
            return {
              accepted: false as const,
              reason: "completion-rule-unavailable" as const,
            };
          }
          if (!completionRulesMatch(activeCompletionRule, context.completionRule)) {
            return {
              accepted: false as const,
              reason: "completion-rule-mismatch" as const,
            };
          }
          const profile = streamerProfileSchema.safeParse(context.profile);
          const session = streamSessionSchema.safeParse(context.session);
          if (
            !profile.success ||
            !session.success ||
            session.data.sessionId !== input.currentState.envelope.sessionId ||
            profile.data.streamerId !== session.data.broadcasterId
          ) {
            return {
              accepted: false as const,
              reason: "unknown-evidence" as const,
            };
          }
          if (session.data.status !== "live") {
            return {
              accepted: false as const,
              reason: "blocked-gameplay-context" as const,
            };
          }
          const intelligence = intelligenceSnapshotSchema.safeParse({
            envelope: {
              ...input.currentState.envelope,
              messageId: `${input.command.commandId}-progress-context`,
              source: "orchestrator",
            },
            gameplay: context.gameplay,
            audience: context.audience ?? {
              envelope: {
                ...input.currentState.envelope,
                messageId: `${input.command.commandId}-progress-audience-unavailable`,
                source: "orchestrator",
              },
              sampleSize: 0,
              signals: [],
            },
          });
          if (!intelligence.success) {
            return {
              accepted: false as const,
              reason: "unknown-evidence" as const,
            };
          }
          return decideAutomaticProgress({
            currentProgress: input.currentState.progress,
            requestedValue: input.command.requestedValue,
            evidenceSignalIds: input.command.evidenceSignalIds,
            completionRule: activeCompletionRule,
            expectedGameId: profile.data.gameId,
            intelligence: intelligence.data,
            now: input.now,
          });
        })();

  if (!progressDecision.accepted) {
    return error("validation", "Quest progress update was rejected", {
      reason: progressDecision.reason,
    });
  }
  if (input.command.type === "system.quest-progress" && progressDecision.progress.value === 1) {
    return terminalTransition(
      input,
      "succeeded",
      "Fresh gameplay evidence matched the active quest completion predicate.",
      "quest-cycle.automatically-succeeded",
      {
        evidenceSignalCount: progressDecision.progress.evidenceSignalIds.length,
      },
      {},
      progressDecision.progress,
    );
  }

  return accept(
    input.currentState,
    { progress: progressDecision.progress },
    [
      event("quest-cycle.progress-updated", {
        method: progressDecision.progress.method,
        value: progressDecision.progress.value,
      }),
    ],
  );
}

function transitionIntelligenceReady(input: QuestEngineInput): QuestEngineResult {
  if (input.command.type !== "system.intelligence-ready" || input.candidateBatch === null) {
    return error("internal", "Intelligence transition received inconsistent input");
  }
  if (!["idle", "evaluating"].includes(input.currentState.status)) {
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
      completionRule: null,
      result: null,
    },
    [event("quest-cycle.proposed", { candidateCount: input.candidateBatch.candidates.length })],
  );
}

function terminalTransition(
  input: QuestEngineInput,
  outcome: "succeeded" | "failed" | "cancelled" | "skipped" | "expired",
  reasonOverride?: string,
  eventType = "quest-cycle.terminal",
  eventAttributes: QuestEngineEventDraft["attributes"] = {},
  statePatch: Omit<Partial<QuestCycleState>, "envelope"> = {},
  completedProgressOverride: QuestProgress | null = null,
): QuestEngineResult {
  const resultDisplayEndsAt = input.now + DEFAULT_RESULT_DISPLAY_MILLISECONDS;
  if (!Number.isSafeInteger(resultDisplayEndsAt)) {
    return error("validation", "Quest result display deadline exceeds supported range");
  }
  const activeCandidate = input.currentState.options.find(
    (candidate) => candidate.candidateId === input.currentState.activeCandidateId,
  ) ?? null;
  const outcomeDecision = decideQuestOutcome({
    outcome,
    activeCandidate,
    terminalAt: input.now,
  });
  if (outcomeDecision === null) {
    return error("internal", "Quest outcome policy rejected an invalid terminal transition");
  }
  const completedProgressDecision =
    outcome === "succeeded" && completedProgressOverride === null
      ? decideManualProgress(input.currentState.progress, 1, input.now)
      : null;
  if (completedProgressDecision !== null && !completedProgressDecision.accepted) {
    return error("internal", "Quest completion produced invalid manual progress");
  }
  const completedProgress =
    completedProgressOverride ??
    (completedProgressDecision?.accepted === true
      ? completedProgressDecision.progress
      : null);
  const reasonByOutcome = {
    succeeded: "Streamer marked the active quest as succeeded.",
    failed: "Streamer marked the active quest as failed.",
    cancelled: "Streamer cancelled the quest cycle.",
    skipped: "Streamer skipped the quest cycle.",
    expired: "The active quest reached its authoritative deadline.",
  } as const;

  return accept(
    input.currentState,
    {
      ...statePatch,
      status: outcome,
      availableStreamerActions: [...actionsByStatus[outcome]],
      endsAt: resultDisplayEndsAt,
      progress: completedProgress ?? input.currentState.progress,
      completionRule: null,
      result: {
        outcome,
        occurredAt: input.now,
        reason: reasonOverride ?? reasonByOutcome[outcome],
        rewardPointsAwarded: outcomeDecision.rewardPointsAwarded,
      },
    },
    [
      event(eventType, {
        outcome,
        rewardPointsAwarded: outcomeDecision.rewardPointsAwarded,
        hypeDelta: outcomeDecision.hypeDelta,
        historyCandidateId: outcomeDecision.historyCandidateId,
        cooldownEndsAt: outcomeDecision.cooldownEndsAt,
        ...eventAttributes,
      }),
    ],
  );
}

function idleAfterCooldown(
  input: QuestEngineInput,
  previousOutcome: string,
  precedingEvents: readonly QuestEngineEventDraft[] = [],
): QuestEngineResult {
  return accept(
    input.currentState,
    {
      status: "idle",
      options: [],
      activeCandidateId: null,
      availableStreamerActions: [...actionsByStatus.idle],
      voteTallies: [],
      startsAt: null,
      endsAt: null,
      progress: null,
      completionRule: null,
      result: null,
    },
    [...precedingEvents, event("quest-cycle.cooldown-ended", { previousOutcome })],
  );
}

function advanceTerminalTick(
  input: QuestEngineInput,
  precedingEvents: readonly QuestEngineEventDraft[] = [],
): QuestEngineResult {
  const result = input.currentState.result;
  if (result === null || result.outcome !== input.currentState.status) {
    return error("validation", "Terminal quest tick requires a matching authoritative result");
  }
  const resultDisplayEndsAt = result.occurredAt + DEFAULT_RESULT_DISPLAY_MILLISECONDS;
  const legacyTerminalWindow =
    input.currentState.endsAt === null ||
    input.currentState.endsAt === result.occurredAt;
  if (!Number.isSafeInteger(resultDisplayEndsAt)) {
    return error("validation", "Terminal quest display window is inconsistent");
  }
  if (
    !legacyTerminalWindow &&
    input.currentState.endsAt !== resultDisplayEndsAt
  ) {
    return error("validation", "Terminal quest display window is inconsistent");
  }
  if (!legacyTerminalWindow && input.now < resultDisplayEndsAt) {
    return accept(input.currentState, {}, [...precedingEvents]);
  }
  const cooldownEndsAt = defaultCooldownEndsAt(result.occurredAt);
  if (cooldownEndsAt === null) {
    return error("validation", "Quest cooldown deadline exceeds supported time");
  }
  const cooldownStarted = event("quest-cycle.cooldown-started", {
    cooldownEndsAt,
    previousOutcome: result.outcome,
  });
  if (input.now >= cooldownEndsAt) {
    return idleAfterCooldown(input, result.outcome, [...precedingEvents, cooldownStarted]);
  }
  return accept(
    input.currentState,
    {
      status: "cooldown",
      availableStreamerActions: [...actionsByStatus.cooldown],
      startsAt: result.occurredAt,
      endsAt: cooldownEndsAt,
      completionRule: null,
    },
    [...precedingEvents, cooldownStarted],
  );
}

function transitionQuestTick(input: QuestEngineInput): QuestEngineResult {
  if (input.command.type !== "system.quest-tick") {
    return error("internal", "Quest-tick transition received another command type");
  }

  if (input.currentState.status === "selected") {
    if (input.currentState.endsAt === null) {
      return accept(input.currentState, {}, []);
    }
    if (input.now < input.currentState.endsAt) {
      return accept(input.currentState, {}, []);
    }
    return activateSelectedWinner(input);
  }

  if (input.currentState.status === "active") {
    if (input.currentState.endsAt === null) {
      return error("validation", "Active quest tick requires an authoritative deadline");
    }
    if (input.now < input.currentState.endsAt) {
      return accept(input.currentState, {}, []);
    }
    const expiryDeadline = input.currentState.endsAt;
    const expired = terminalTransition({ ...input, now: expiryDeadline }, "expired");
    if (!expired.ok || input.now === expiryDeadline) return expired;
    return advanceTerminalTick(
      { ...input, currentState: expired.decision.nextState },
      expired.decision.events,
    );
  }

  if (["succeeded", "failed", "cancelled", "skipped", "expired"].includes(input.currentState.status)) {
    return advanceTerminalTick(input);
  }

  if (input.currentState.status === "cooldown") {
    const result = input.currentState.result;
    if (result === null) {
      return error("validation", "Cooldown tick requires an authoritative terminal result");
    }
    const expectedCooldownEndsAt = defaultCooldownEndsAt(result.occurredAt);
    if (expectedCooldownEndsAt === null) {
      return error("validation", "Quest cooldown deadline exceeds supported time");
    }
    if (
      input.currentState.startsAt !== result.occurredAt ||
      input.currentState.endsAt !== expectedCooldownEndsAt
    ) {
      return error("validation", "Cooldown state does not match its authoritative terminal result");
    }
    if (input.now < expectedCooldownEndsAt) {
      return accept(input.currentState, {}, []);
    }
    return idleAfterCooldown(input, result.outcome);
  }

  return accept(input.currentState, {}, []);
}

function stableHash(value: string): number {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

function noActivation(
  input: QuestEngineInput,
  voteTallies: QuestCycleState["voteTallies"],
  reasonCode: "zero-votes" | "session-not-live" | "winner-invalid",
  reason: string,
  details: QuestEngineEventDraft["attributes"] = {},
): QuestEngineResult {
  return terminalTransition(
    input,
    "cancelled",
    reason,
    "quest-cycle.vote-closed-no-activation",
    { reasonCode, ...details },
    { voteTallies: [...voteTallies] },
  );
}

function activateSelectedWinner(input: QuestEngineInput): QuestEngineResult {
  const winnerId = input.currentState.activeCandidateId;
  const winner = input.currentState.options.find(
    (candidate) => candidate.candidateId === winnerId,
  );
  if (input.currentState.status !== "selected" || winner === undefined) {
    return error("validation", "Selected quest activation requires an authoritative winner");
  }
  const questEndsAt = input.now + winner.durationSeconds * 1_000;
  if (!Number.isSafeInteger(questEndsAt)) {
    return error("validation", "Winning quest end time exceeds supported range");
  }
  return accept(
    input.currentState,
    {
      status: "active",
      availableStreamerActions: [...actionsByStatus.active],
      startsAt: input.now,
      endsAt: questEndsAt,
      progress: {
        value: 0,
        updatedAt: input.now,
        method: "unknown",
        evidenceSignalIds: [],
      },
      completionRule: winner.completionRule ?? null,
      result: null,
    },
    [event("quest-cycle.activated", { candidateId: winner.candidateId })],
  );
}

function transitionVoteClose(input: QuestEngineInput): QuestEngineResult {
  if (input.command.type !== "system.vote-close") {
    return error("internal", "Vote-close transition received another command type");
  }
  if (input.currentState.status !== "voting") return illegalCommand(input.currentState, input.command);
  if (input.currentState.endsAt === null) {
    return error("validation", "Voting cycle has no authoritative deadline");
  }
  if (input.now < input.currentState.endsAt) {
    return error("forbidden", "Voting cannot close before its authoritative deadline", {
      endsAt: input.currentState.endsAt,
      now: input.now,
    });
  }
  if (input.acceptedVoteTally == null || input.voteCloseValidationContext == null) {
    return error("dependency-unavailable", "Vote-close requires an accepted tally and current validation context");
  }

  const tally = acceptedVoteTallySnapshotSchema.safeParse(input.acceptedVoteTally);
  const profile = streamerProfileSchema.safeParse(input.voteCloseValidationContext.profile);
  const session = streamSessionSchema.safeParse(input.voteCloseValidationContext.session);
  const gameplay =
    input.voteCloseValidationContext.gameplay === null
      ? null
      : gameplaySnapshotSchema.safeParse(input.voteCloseValidationContext.gameplay);
  const audience =
    input.voteCloseValidationContext.audience === null
      ? null
      : audienceSnapshotSchema.safeParse(input.voteCloseValidationContext.audience);
  const recentQuests = input.voteCloseValidationContext.recentQuests;
  if (
    !tally.success ||
    !profile.success ||
    !session.success ||
    gameplay?.success === false ||
    audience?.success === false ||
    !Array.isArray(recentQuests) ||
    recentQuests.some(
      (quest) =>
        typeof quest.title !== "string" ||
        quest.title.trim().length < 3 ||
        quest.title.trim().length > 80 ||
        !Number.isSafeInteger(quest.occurredAt) ||
        quest.occurredAt < 0,
    )
  ) {
    return error("validation", "Vote-close tally or validation context is malformed");
  }

  const optionIds = input.currentState.options.map(({ candidateId }) => candidateId);
  const tallyIds = tally.data.tallies.map(({ candidateId }) => candidateId);
  const contextSnapshots = [
    gameplay === null ? null : gameplay.data,
    audience === null ? null : audience.data,
  ];
  if (
    tally.data.sessionId !== input.currentState.envelope.sessionId ||
    tally.data.questCycleId !== input.currentState.envelope.questCycleId ||
    tally.data.revision !== input.currentState.envelope.revision ||
    tally.data.closedAt !== input.now ||
    tally.data.closedAt < input.currentState.endsAt ||
    optionIds.some((candidateId, index) => tallyIds[index] !== candidateId) ||
    session.data.sessionId !== input.currentState.envelope.sessionId ||
    profile.data.streamerId !== session.data.broadcasterId ||
    contextSnapshots.some(
      (snapshot) =>
        snapshot !== null &&
        (snapshot.envelope.sessionId !== input.currentState.envelope.sessionId ||
          (snapshot.envelope.questCycleId !== null &&
            snapshot.envelope.questCycleId !== input.currentState.envelope.questCycleId)),
    )
  ) {
    return error("validation", "Vote-close tally or context does not belong to the current cycle");
  }

  if (tally.data.acceptedVoteCount === 0) {
    return noActivation(
      input,
      tally.data.tallies,
      "zero-votes",
      "Voting closed without an accepted vote; no quest was activated.",
      { acceptedVoteCount: 0 },
    );
  }

  const highestVotes = Math.max(...tally.data.tallies.map(({ votes }) => votes));
  const tiedCandidateIds = tally.data.tallies
    .filter(({ votes }) => votes === highestVotes)
    .map(({ candidateId }) => candidateId)
    .sort();
  const tieBreakUsed = tiedCandidateIds.length > 1;
  const winnerId = tieBreakUsed
    ? tiedCandidateIds[
        stableHash(
          [tally.data.sessionId, tally.data.questCycleId, ...tiedCandidateIds].join(":"),
        ) % tiedCandidateIds.length
      ]
    : tiedCandidateIds[0];
  const winner = input.currentState.options.find(({ candidateId }) => candidateId === winnerId);
  if (winner === undefined) {
    return error("internal", "Resolved vote winner is absent from the current options");
  }

  if (session.data.status !== "live") {
    return noActivation(
      input,
      tally.data.tallies,
      "session-not-live",
      "Voting closed after the stream session stopped being live; no quest was activated.",
      { candidateId: winner.candidateId, sessionStatus: session.data.status },
    );
  }

  const winnerValidation = validateCandidateAtVoteClose(winner, {
    audience: audience === null ? null : audience.data,
    profile: profile.data,
    gameplay: gameplay === null ? null : gameplay.data,
    currentState: input.currentState,
    recentQuests,
    now: input.now,
  });
  if (!winnerValidation.accepted) {
    return noActivation(
      input,
      tally.data.tallies,
      "winner-invalid",
      "The winning quest failed close-time safety or feasibility validation; no quest was activated.",
      {
        candidateId: winner.candidateId,
        validationCodes: winnerValidation.issues.map(({ code }) => code).join(","),
      },
    );
  }

  const automaticActivation =
    profile.data.voting.winnerActivationMode === "automatic";
  const winnerDisplayEndsAt = automaticActivation
    ? input.now + DEFAULT_WINNER_DISPLAY_MILLISECONDS
    : null;
  if (winnerDisplayEndsAt !== null && !Number.isSafeInteger(winnerDisplayEndsAt)) {
    return error("validation", "Winner display deadline exceeds supported range");
  }
  return accept(
    input.currentState,
    {
      status: "selected",
      activeCandidateId: winner.candidateId,
      availableStreamerActions: automaticActivation
        ? [...actionsByStatus.selected]
        : ["start", ...actionsByStatus.selected],
      voteTallies: [...tally.data.tallies],
      startsAt: input.now,
      endsAt: winnerDisplayEndsAt,
      progress: null,
      completionRule: null,
      result: null,
    },
    [
      event("quest-cycle.winner-selected", {
        candidateId: winner.candidateId,
        winningVotes: highestVotes,
        acceptedVoteCount: tally.data.acceptedVoteCount,
        tiedCandidateCount: tiedCandidateIds.length,
        tieBreakUsed,
        activationMode: profile.data.voting.winnerActivationMode,
        winnerDisplayEndsAt,
      }),
    ],
  );
}

function transitionStreamerCommand(input: QuestEngineInput): QuestEngineResult {
  if (input.command.type !== "streamer.quest") {
    return error("internal", "Streamer transition received another command type");
  }
  const { action } = input.command;
  const availableActions: readonly StreamerQuestAction[] =
    input.currentState.availableStreamerActions;
  if (!availableActions.includes(action)) {
    return illegalCommand(input.currentState, input.command);
  }

  if (action === "approve" && input.currentState.status === "proposed") {
    const profile = input.profile === null || input.profile === undefined
      ? null
      : streamerProfileSchema.safeParse(input.profile);
    if (profile !== null && !profile.success) {
      return error("validation", "Voting preferences are invalid");
    }
    const voteDurationSeconds = profile?.data.voting.voteDurationSeconds ??
      DEFAULT_VOTING_MILLISECONDS / 1_000;
    const votingEndsAt = input.now + voteDurationSeconds * 1_000;
    if (!Number.isSafeInteger(votingEndsAt)) {
      return error("validation", "Voting end time exceeds supported range");
    }
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
        endsAt: votingEndsAt,
      },
      [event("quest-cycle.voting-started", { voteDurationSeconds })],
    );
  }

  if (action === "start" && input.currentState.status === "selected") {
    if (input.currentState.endsAt !== null) {
      return error("forbidden", "Automatic quest activation is already scheduled");
    }
    if (
      input.command.candidateId !== null &&
      input.command.candidateId !== input.currentState.activeCandidateId
    ) {
      return error("validation", "Streamer approval does not match the selected winner");
    }
    return activateSelectedWinner(input);
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

  return illegalCommand(input.currentState, input.command);
}

function transitionVote(input: QuestEngineInput): QuestEngineResult {
  if (input.command.type !== "viewer.vote") {
    return error("internal", "Vote transition received another command type");
  }
  if (input.currentState.status !== "voting") return illegalCommand(input.currentState, input.command);
  if (input.currentState.endsAt === null || input.now >= input.currentState.endsAt) {
    return error("expired", "The authoritative voting window has closed", {
      endsAt: input.currentState.endsAt,
      now: input.now,
    });
  }
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
  decide(input: QuestEngineInput): QuestEngineResult {
    const boundaryError = validateBoundary(input);
    if (boundaryError !== null) return boundaryError;
    const batchError = validateCandidateBatch(input);
    if (batchError !== null) return batchError;

    switch (input.command.type) {
      case "system.intelligence-ready":
        return transitionIntelligenceReady(input);
      case "system.vote-close":
        return transitionVoteClose(input);
      case "system.quest-tick":
        return transitionQuestTick(input);
      case "streamer.quest-progress":
      case "system.quest-progress":
        return transitionQuestProgress(input);
      case "streamer.quest":
        return transitionStreamerCommand(input);
      case "streamer.quest-generation":
        return error(
          "unavailable-capability",
          "Manual fallback generation is handled by the Role 1 application seam",
        );
      case "viewer.vote":
        return transitionVote(input);
      case "viewer.react":
        return error("unavailable-capability", "Viewer reactions do not change Phase 1 quest state");
      case "streamer.emergency-clear":
        return error("unavailable-capability", "Emergency clear is handled by the Role 1 latch");
      case "streamer.profile-settings":
        return error("unavailable-capability", "Profile settings are handled by the Role 1 state seam");
      case "streamer.session-override":
        return error("unavailable-capability", "Session overrides are handled by the Role 1 state seam");
      case "streamer.live-director-intent":
      case "system.audience-snapshot-ready":
      case "system.gameplay-snapshot-ready":
      case "system.live-director-context-ready":
      case "system.live-director-cue-ready":
        return error(
          "unavailable-capability",
          "Live Director authority is handled by the Role 1 state seam",
        );
      case "streamer.live-director-cue":
        return error(
          "unavailable-capability",
          "Director Cue actions require the Role 3 cue lifecycle",
        );
      default:
        return error("validation", "Command type is not supported by the quest engine");
    }
  }
}

export function createDefaultQuestEngine(): QuestEngine {
  return new DefaultQuestEngine();
}
