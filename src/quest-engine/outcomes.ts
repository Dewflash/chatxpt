import {
  questProgressSchema,
  type IntelligenceSnapshot,
  type QuestCandidate,
  type QuestProgress,
  type QuestResult,
} from "../core";
import { defaultCooldownEndsAt } from "./intervention";
import { MAXIMUM_SIGNAL_AGE_MILLISECONDS } from "./validation";

export const AUTOMATIC_PROGRESS_MINIMUM_CONFIDENCE = 0.75;

export type ProgressUpdateRejection =
  | "invalid-time"
  | "invalid-value"
  | "progress-time-regression"
  | "progress-regression"
  | "missing-evidence"
  | "duplicate-evidence"
  | "unknown-evidence"
  | "unsupported-evidence"
  | "disallowed-evidence"
  | "low-confidence-evidence"
  | "stale-evidence";

export type ProgressUpdateDecision =
  | { readonly accepted: true; readonly progress: QuestProgress }
  | { readonly accepted: false; readonly reason: ProgressUpdateRejection };

export interface AutomaticProgressInput {
  readonly currentProgress: QuestProgress | null;
  readonly requestedValue: number;
  readonly evidenceSignalIds: readonly string[];
  /** Signal kinds explicitly permitted by the quest's deterministic completion rule. */
  readonly allowedSignalKinds: readonly string[];
  readonly intelligence: IntelligenceSnapshot;
  readonly now: number;
}

export interface QuestOutcomePolicyInput {
  readonly outcome: QuestResult["outcome"];
  readonly activeCandidate: QuestCandidate | null;
  readonly terminalAt: number;
}

export interface QuestOutcomePolicyDecision {
  readonly rewardPointsAwarded: number;
  readonly hypeDelta: number;
  readonly historyCandidateId: string | null;
  readonly cooldownEndsAt: number;
}

function validateProgressValue(
  currentProgress: QuestProgress | null,
  requestedValue: number,
  now: number,
): ProgressUpdateRejection | null {
  if (!Number.isSafeInteger(now) || now < 0) return "invalid-time";
  if (!Number.isFinite(requestedValue) || requestedValue < 0 || requestedValue > 1) {
    return "invalid-value";
  }
  if (currentProgress !== null && requestedValue < currentProgress.value) {
    return "progress-regression";
  }
  if (currentProgress !== null && now < currentProgress.updatedAt) {
    return "progress-time-regression";
  }
  return null;
}

export function decideManualProgress(
  currentProgress: QuestProgress | null,
  requestedValue: number,
  now: number,
): ProgressUpdateDecision {
  const rejection = validateProgressValue(currentProgress, requestedValue, now);
  if (rejection !== null) return { accepted: false, reason: rejection };

  return {
    accepted: true,
    progress: questProgressSchema.parse({
      value: requestedValue,
      updatedAt: now,
      method: "manual",
      evidenceSignalIds: [],
    }),
  };
}

export function decideAutomaticProgress(input: AutomaticProgressInput): ProgressUpdateDecision {
  const rejection = validateProgressValue(
    input.currentProgress,
    input.requestedValue,
    input.now,
  );
  if (rejection !== null) return { accepted: false, reason: rejection };
  if (input.evidenceSignalIds.length === 0) {
    return { accepted: false, reason: "missing-evidence" };
  }
  if (new Set(input.evidenceSignalIds).size !== input.evidenceSignalIds.length) {
    return { accepted: false, reason: "duplicate-evidence" };
  }

  for (const signalId of input.evidenceSignalIds) {
    const signal = input.intelligence.gameplay.signals.find(
      (candidate) => candidate.signalId === signalId,
    );
    if (signal === undefined || signal.observation.status !== "known") {
      return { accepted: false, reason: "unknown-evidence" };
    }
    if (!input.intelligence.gameplay.capabilities.supportedSignals.includes(signal.kind)) {
      return { accepted: false, reason: "unsupported-evidence" };
    }
    if (!input.allowedSignalKinds.includes(signal.kind)) {
      return { accepted: false, reason: "disallowed-evidence" };
    }
    if (signal.observation.provenance.confidence < AUTOMATIC_PROGRESS_MINIMUM_CONFIDENCE) {
      return { accepted: false, reason: "low-confidence-evidence" };
    }
    const age = input.now - signal.observation.provenance.observedAt;
    if (age < 0 || age > MAXIMUM_SIGNAL_AGE_MILLISECONDS) {
      return { accepted: false, reason: "stale-evidence" };
    }
  }

  return {
    accepted: true,
    progress: questProgressSchema.parse({
      value: input.requestedValue,
      updatedAt: input.now,
      method: "automatic",
      evidenceSignalIds: [...input.evidenceSignalIds],
    }),
  };
}

export function decideQuestOutcome(
  input: QuestOutcomePolicyInput,
): QuestOutcomePolicyDecision | null {
  if (!Number.isSafeInteger(input.terminalAt) || input.terminalAt < 0) return null;
  if (
    (input.outcome === "succeeded" || input.outcome === "failed") &&
    input.activeCandidate === null
  ) {
    return null;
  }

  const cooldownEndsAt = defaultCooldownEndsAt(input.terminalAt);
  if (cooldownEndsAt === null) return null;

  return {
    rewardPointsAwarded:
      input.outcome === "succeeded" ? (input.activeCandidate?.rewardPoints ?? 0) : 0,
    hypeDelta: input.outcome === "succeeded" ? 10 : input.outcome === "failed" ? 2 : 0,
    historyCandidateId: input.activeCandidate?.candidateId ?? null,
    cooldownEndsAt,
  };
}
