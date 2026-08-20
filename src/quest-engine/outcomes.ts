import {
  questProgressSchema,
  type IntelligenceSnapshot,
  type QuestCandidate,
  type QuestCompletionRule,
  type QuestProgress,
  type QuestResult,
} from "../core";
import { defaultCooldownEndsAt } from "./intervention";
import { MAXIMUM_SIGNAL_AGE_MILLISECONDS } from "./validation";

export const AUTOMATIC_PROGRESS_MINIMUM_CONFIDENCE = 0.75;

const AMBIGUOUS_VISUAL_COMPLETION_SIGNAL_KINDS = new Set([
  "activity-intensity",
  "global-motion-pattern",
  "scene-transition",
  "visual-state",
]);

const BLOCKING_VISUAL_STATES = new Set([
  "cutscene",
  "menu",
  "scene-transition",
  "transition",
]);

export type ProgressUpdateRejection =
  | "invalid-time"
  | "invalid-value"
  | "progress-time-regression"
  | "progress-regression"
  | "missing-evidence"
  | "duplicate-evidence"
  | "unknown-evidence"
  | "unavailable-evidence"
  | "contradictory-evidence"
  | "unsupported-evidence"
  | "disallowed-evidence"
  | "low-confidence-evidence"
  | "stale-evidence"
  | "cross-game-evidence"
  | "blocked-gameplay-context"
  | "completion-rule-unavailable"
  | "completion-rule-mismatch"
  | "completion-predicate-unavailable"
  | "completion-predicate-mismatch"
  | "missing-corroboration"
  | "unproven-progress-value"
  | "ambiguous-completion-evidence";

export type ProgressUpdateDecision =
  | { readonly accepted: true; readonly progress: QuestProgress }
  | { readonly accepted: false; readonly reason: ProgressUpdateRejection };

export interface AutomaticProgressInput {
  readonly currentProgress: QuestProgress | null;
  readonly requestedValue: number;
  readonly evidenceSignalIds: readonly string[];
  /** Persisted deterministic rule; system-requested values never replace its predicate. */
  readonly completionRule: QuestCompletionRule;
  /** Saved game identity, when known, used to isolate calibrated evidence across games. */
  readonly expectedGameId?: string | null;
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

  const gameplay = input.intelligence.gameplay;
  if (
    input.expectedGameId != null &&
    gameplay.capabilities.gameId !== input.expectedGameId
  ) {
    return { accepted: false, reason: "cross-game-evidence" };
  }

  const allowedKinds = new Set(input.completionRule.allowedSignalKinds);
  if (
    gameplay.signals.some(
      (signal) =>
        allowedKinds.has(signal.kind) &&
        signal.observation.status === "unknown" &&
        signal.observation.reason === "conflicting",
    )
  ) {
    return { accepted: false, reason: "contradictory-evidence" };
  }

  if (hasBlockingGameplayContext(gameplay.signals, input.now)) {
    return { accepted: false, reason: "blocked-gameplay-context" };
  }

  const citedSignalKinds: string[] = [];
  let requestedValueProven = false;

  for (const signalId of input.evidenceSignalIds) {
    const signal = gameplay.signals.find(
      (candidate) => candidate.signalId === signalId,
    );
    if (signal === undefined) {
      return { accepted: false, reason: "unknown-evidence" };
    }
    if (signal.observation.status === "unknown") {
      return {
        accepted: false,
        reason:
          signal.observation.reason === "conflicting"
            ? "contradictory-evidence"
            : "unknown-evidence",
      };
    }
    if (signal.observation.status === "stale") {
      return { accepted: false, reason: "stale-evidence" };
    }
    if (signal.observation.status === "unavailable") {
      return { accepted: false, reason: "unavailable-evidence" };
    }
    if (!gameplay.capabilities.supportedSignals.includes(signal.kind)) {
      return { accepted: false, reason: "unsupported-evidence" };
    }
    if (!input.completionRule.allowedSignalKinds.includes(signal.kind)) {
      return { accepted: false, reason: "disallowed-evidence" };
    }
    if (signal.observation.provenance.confidence < AUTOMATIC_PROGRESS_MINIMUM_CONFIDENCE) {
      return { accepted: false, reason: "low-confidence-evidence" };
    }
    const age = input.now - signal.observation.provenance.observedAt;
    if (age < 0 || age > MAXIMUM_SIGNAL_AGE_MILLISECONDS) {
      return { accepted: false, reason: "stale-evidence" };
    }
    citedSignalKinds.push(signal.kind);
    requestedValueProven ||= signalProvesRequestedValue(
      signal.observation.value,
      input.requestedValue,
    );
  }

  if (input.requestedValue < 1 && !requestedValueProven) {
    return { accepted: false, reason: "unproven-progress-value" };
  }

  if (input.requestedValue === 1) {
    const predicate = input.completionRule.predicate;
    if (predicate == null) {
      return { accepted: false, reason: "completion-predicate-unavailable" };
    }
    if (gameplay.capabilities.gameId !== predicate.gameId) {
      return { accepted: false, reason: "cross-game-evidence" };
    }
    const predicateSignals = input.evidenceSignalIds
      .map((signalId) => gameplay.signals.find((signal) => signal.signalId === signalId))
      .filter((signal) => signal?.kind === predicate.signalKind);
    if (
      predicateSignals.length !== 1 ||
      predicateSignals[0]?.observation.status !== "known" ||
      !valueMatchesPredicate(
        predicateSignals[0].observation.value,
        predicate.comparison,
        predicate.target,
      )
    ) {
      return { accepted: false, reason: "completion-predicate-mismatch" };
    }
    const citedKinds = new Set(citedSignalKinds);
    if (
      predicate.corroboratingSignalKinds.some(
        (signalKind) => !citedKinds.has(signalKind),
      )
    ) {
      return { accepted: false, reason: "missing-corroboration" };
    }
    if (
      citedSignalKinds.every((kind) =>
        AMBIGUOUS_VISUAL_COMPLETION_SIGNAL_KINDS.has(kind),
      )
    ) {
      return { accepted: false, reason: "ambiguous-completion-evidence" };
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

function valueMatchesPredicate(
  actual: string | number | boolean,
  comparison: "equals" | "at-least" | "at-most",
  target: string | number | boolean,
): boolean {
  if (comparison === "equals") {
    if (typeof actual !== typeof target) return false;
    if (typeof actual === "string" && typeof target === "string") {
      return normalisedSignalString(actual) === normalisedSignalString(target);
    }
    return actual === target;
  }
  if (typeof actual !== "number" || typeof target !== "number") return false;
  return comparison === "at-least" ? actual >= target : actual <= target;
}

function normalisedSignalString(value: string | number | boolean): string | null {
  return typeof value === "string" ? value.trim().toLocaleLowerCase() : null;
}

function signalProvesRequestedValue(
  value: string | number | boolean,
  requestedValue: number,
): boolean {
  if (typeof value === "number") {
    return value >= 0 && value <= 1 && value >= requestedValue;
  }
  return typeof value === "boolean" && value && requestedValue === 1;
}

function hasBlockingGameplayContext(
  signals: IntelligenceSnapshot["gameplay"]["signals"],
  now: number,
): boolean {
  return signals.some((signal) => {
    const isBlockingKind = [
      "cutscene-state",
      "match-active",
      "menu-state",
      "scene-transition",
      "visual-state",
    ].includes(signal.kind);
    if (
      isBlockingKind &&
      signal.observation.status === "unknown" &&
      signal.observation.reason === "conflicting"
    ) {
      return true;
    }
    if (signal.observation.status !== "known") return false;
    const age = now - signal.observation.provenance.observedAt;
    if (
      signal.observation.provenance.confidence < AUTOMATIC_PROGRESS_MINIMUM_CONFIDENCE ||
      age < 0 ||
      age > MAXIMUM_SIGNAL_AGE_MILLISECONDS
    ) {
      return false;
    }
    const value = signal.observation.value;
    if (signal.kind === "scene-transition") return value === true;
    if (signal.kind === "menu-state" || signal.kind === "cutscene-state") {
      return value === true || normalisedSignalString(value) === "true";
    }
    if (signal.kind === "match-active") return value === false;
    if (signal.kind === "visual-state") {
      const state = normalisedSignalString(value);
      return state !== null && BLOCKING_VISUAL_STATES.has(state);
    }
    return false;
  });
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
