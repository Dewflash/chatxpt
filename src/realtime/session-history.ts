import {
  CONTRACT_VERSION,
  emptySessionHistorySnapshot,
  sessionHistorySnapshotSchema,
  type AcceptedCommandReceipt,
  type SessionHistoryEntry,
  type SessionHistoryOutcome,
  type SessionHistorySnapshot,
} from "../core";

const TERMINAL_OUTCOMES = new Set<SessionHistoryOutcome>([
  "succeeded",
  "failed",
  "cancelled",
  "skipped",
  "expired",
]);

function clampLimit(limit: number | undefined): number {
  if (limit === undefined) return 25;
  return Math.min(100, Math.max(1, Math.trunc(limit)));
}

function acceptedVoteCount(entry: Pick<SessionHistoryEntry, "voteTallies">): number {
  return entry.voteTallies.reduce((total, tally) => total + tally.votes, 0);
}

function averageCompletionSeconds(entries: readonly SessionHistoryEntry[]): number | null {
  const durations = entries
    .map((entry) => entry.durationSeconds)
    .filter((duration): duration is number => duration !== null);
  if (durations.length === 0) return null;
  return durations.reduce((total, duration) => total + duration, 0) / durations.length;
}

function summary(entries: readonly SessionHistoryEntry[]) {
  return {
    totalQuestCycles: entries.length,
    succeeded: entries.filter((entry) => entry.outcome === "succeeded").length,
    failed: entries.filter((entry) => entry.outcome === "failed").length,
    cancelled: entries.filter((entry) => entry.outcome === "cancelled").length,
    skipped: entries.filter((entry) => entry.outcome === "skipped").length,
    expired: entries.filter((entry) => entry.outcome === "expired").length,
    totalAcceptedVotes: entries.reduce((total, entry) => total + entry.acceptedVoteCount, 0),
    totalRewardPointsAwarded: entries.reduce(
      (total, entry) => total + entry.rewardPointsAwarded,
      0,
    ),
    averageCompletionSeconds: averageCompletionSeconds(entries),
  };
}

function snapshotEvidenceClass(
  entries: readonly SessionHistoryEntry[],
  input: Pick<BuildSessionHistoryInput, "source" | "evidenceClass">,
): BuildSessionHistoryInput["evidenceClass"] {
  const classes = new Set(entries.map((entry) => entry.evidenceClass));
  if (
    classes.size === 1 &&
    classes.has("live") &&
    input.source !== "test-fixture" &&
    input.evidenceClass === "live"
  ) {
    return "live";
  }
  if (classes.size === 1 && classes.has("fixture") && input.source === "test-fixture") {
    return "fixture";
  }
  return "diagnostic";
}

export interface BuildSessionHistoryInput {
  readonly broadcasterId: string;
  readonly receipts: readonly AcceptedCommandReceipt[];
  readonly generatedAt: number;
  readonly limit?: number;
  readonly source: "orchestrator" | "test-fixture";
  readonly evidenceClass: "live" | "diagnostic" | "fixture";
}

export function buildSessionHistoryFromReceipts(input: BuildSessionHistoryInput): SessionHistorySnapshot {
  const limit = clampLimit(input.limit);
  const byCycle = new Map<string, SessionHistoryEntry>();
  for (const receipt of input.receipts) {
    const state = receipt.state;
    const questCycle = state.questCycle;
    const result = questCycle.result;
    const questCycleId = questCycle.envelope.questCycleId;
    if (
      state.session.broadcasterId !== input.broadcasterId ||
      questCycleId === null ||
      result === null ||
      !TERMINAL_OUTCOMES.has(result.outcome)
    ) {
      continue;
    }

    const activeCandidate =
      questCycle.activeCandidateId === null
        ? null
        : questCycle.options.find(
            (candidate) => candidate.candidateId === questCycle.activeCandidateId,
          ) ?? null;
    const durationSeconds =
      questCycle.startsAt === null
        ? null
        : Math.max(0, Math.round((result.occurredAt - questCycle.startsAt) / 1_000));
    const entry: SessionHistoryEntry = {
      sessionId: state.session.sessionId,
      questCycleId,
      sessionRevision: state.session.revision,
      title: activeCandidate?.title ?? null,
      activeCandidateId: questCycle.activeCandidateId,
      outcome: result.outcome,
      reason: result.reason,
      startedAt: questCycle.startsAt,
      endedAt: result.occurredAt,
      durationSeconds,
      acceptedVoteCount: acceptedVoteCount(questCycle),
      voteTallies: [...questCycle.voteTallies],
      rewardPointsAwarded: result.rewardPointsAwarded,
      evidenceClass: questCycle.envelope.evidenceClass,
    };
    const key = `${entry.sessionId}:${entry.questCycleId}`;
    const existing = byCycle.get(key);
    if (existing === undefined || existing.sessionRevision <= entry.sessionRevision) {
      byCycle.set(key, entry);
    }
  }

  const entries = [...byCycle.values()]
    .sort(
      (left, right) =>
        right.endedAt - left.endedAt ||
        right.sessionRevision - left.sessionRevision ||
        left.sessionId.localeCompare(right.sessionId) ||
        left.questCycleId.localeCompare(right.questCycleId),
    )
    .slice(0, limit);

  if (entries.length === 0) {
    return emptySessionHistorySnapshot({
      broadcasterId: input.broadcasterId,
      generatedAt: input.generatedAt,
      source: input.source,
      evidenceClass: input.evidenceClass,
      limit,
    });
  }

  return sessionHistorySnapshotSchema.parse({
    contractVersion: CONTRACT_VERSION,
    broadcasterId: input.broadcasterId,
    generatedAt: input.generatedAt,
    source: input.source,
    evidenceClass: snapshotEvidenceClass(entries, input),
    limit,
    entries,
    summary: summary(entries),
    privacy: {
      rawChatHistoryRetained: false,
      viewerIdentifiersIncluded: false,
      privateVoteReceiptsIncluded: false,
      retentionNote:
        "Session history stores terminal quest outcomes and aggregate engagement only; raw chat and viewer identifiers are not retained in this read model.",
    },
  });
}
