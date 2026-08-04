import {
  intelligenceSnapshotSchema,
  questCycleStateSchema,
  streamerProfileSchema,
  type IntelligenceSnapshot,
  type NamedSignal,
  type QuestCycleState,
  type StreamerProfile,
} from "../core";

export const DEFAULT_COOLDOWN_MILLISECONDS = 120_000;
export const DEFAULT_REPETITION_MILLISECONDS = 30 * 60_000;
export const DEFAULT_REPETITION_CYCLES = 5;

export interface RecentQuestSummary {
  readonly title: string;
  readonly occurredAt: number;
}

export interface InterventionPolicyInput {
  readonly currentState: QuestCycleState;
  readonly intelligence: IntelligenceSnapshot;
  readonly profile: StreamerProfile;
  readonly emergencyPaused: boolean;
  readonly recentQuests: readonly RecentQuestSummary[];
  readonly now: number;
}

export type InterventionReason =
  | "eligible"
  | "invalid-context"
  | "cycle-unavailable"
  | "emergency-paused"
  | "insufficient-gameplay-evidence"
  | "busy-gameplay"
  | "unsafe-moment"
  | "below-suitability-threshold";

export interface InterventionDecision {
  readonly shouldPropose: boolean;
  readonly score: number;
  readonly reasons: readonly InterventionReason[];
  readonly evidenceSignalIds: readonly string[];
}

export interface RepetitionDecision {
  readonly repeated: boolean;
  readonly matchedQuestTitle: string | null;
}

export interface ActiveQuestInterruptionInput {
  readonly intelligence: IntelligenceSnapshot;
  readonly now: number;
  readonly emergencyPaused: boolean;
  readonly sessionEnded: boolean;
  readonly questImpossible: boolean;
}

export interface ActiveQuestInterruptionDecision {
  readonly action: "continue" | "cancel";
  readonly reason:
    | "continue"
    | "emergency-paused"
    | "session-ended"
    | "quest-impossible"
    | "unsafe-moment";
}

interface KnownSignalValue {
  readonly signalId: string;
  readonly value: string | number | boolean;
  readonly confidence: number;
}

const MINIMUM_SIGNAL_CONFIDENCE = 0.65;
const MAX_GAMEPLAY_AGE_MILLISECONDS = 15_000;
const MAX_AUDIENCE_AGE_MILLISECONDS = 30_000;
const BUSY_ACTIVITY_THRESHOLD = 0.75;
const SUITABILITY_THRESHOLD = 0.6;

function reject(reason: InterventionReason): InterventionDecision {
  return { shouldPropose: false, score: 0, reasons: [reason], evidenceSignalIds: [] };
}

function signalByKind(
  signals: readonly NamedSignal[],
  kind: string,
  now: number,
  maxAge: number,
): KnownSignalValue | null {
  const matching = signals
    .filter((signal) => signal.kind === kind && signal.observation.status === "known")
    .sort((left, right) => {
      const ageOrder = right.observation.provenance.observedAt - left.observation.provenance.observedAt;
      return ageOrder !== 0 ? ageOrder : left.signalId.localeCompare(right.signalId);
    });
  const signal = matching[0];
  if (signal === undefined || signal.observation.status !== "known") return null;

  const { provenance } = signal.observation;
  const age = now - provenance.observedAt;
  if (
    provenance.confidence < MINIMUM_SIGNAL_CONFIDENCE ||
    age < 0 ||
    age > maxAge
  ) {
    return null;
  }
  return {
    signalId: signal.signalId,
    value: signal.observation.value,
    confidence: provenance.confidence,
  };
}

function numericSignal(signal: KnownSignalValue | null): number | null {
  if (signal === null || typeof signal.value !== "number") return null;
  return Math.min(1, Math.max(0, signal.value));
}

function truthySignal(signal: KnownSignalValue | null): boolean {
  if (signal === null) return false;
  if (typeof signal.value === "boolean") return signal.value;
  if (typeof signal.value === "number") return signal.value >= 0.5;
  return signal.value.trim().toLocaleLowerCase() === "true";
}

function unsafeMoment(intelligence: IntelligenceSnapshot, now: number): boolean {
  const signals = intelligence.gameplay.signals;
  return (
    truthySignal(signalByKind(signals, "safety-risk", now, MAX_GAMEPLAY_AGE_MILLISECONDS)) ||
    truthySignal(signalByKind(signals, "knockdown", now, MAX_GAMEPLAY_AGE_MILLISECONDS))
  );
}

function normalisedTitle(value: string): string[] {
  return value
    .toLocaleLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function substantiallySimilar(left: string, right: string): boolean {
  const leftTokens = new Set(normalisedTitle(left));
  const rightTokens = new Set(normalisedTitle(right));
  if (leftTokens.size === 0 || rightTokens.size === 0) return false;
  const intersection = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  const union = new Set([...leftTokens, ...rightTokens]).size;
  return intersection / union >= 0.7;
}

export class DefaultInterventionPolicy {
  decide(input: InterventionPolicyInput): InterventionDecision {
    const state = questCycleStateSchema.safeParse(input.currentState);
    const intelligence = intelligenceSnapshotSchema.safeParse(input.intelligence);
    const profile = streamerProfileSchema.safeParse(input.profile);
    if (
      !state.success ||
      !intelligence.success ||
      !profile.success ||
      !Number.isSafeInteger(input.now) ||
      input.now < 0
    ) {
      return reject("invalid-context");
    }
    if (state.data.status !== "idle") return reject("cycle-unavailable");
    if (input.emergencyPaused) return reject("emergency-paused");

    const gameplaySignals = intelligence.data.gameplay.signals;
    const activity = signalByKind(
      gameplaySignals,
      "activity-intensity",
      input.now,
      MAX_GAMEPLAY_AGE_MILLISECONDS,
    );
    const activityValue = numericSignal(activity);
    if (activityValue === null) return reject("insufficient-gameplay-evidence");
    if (
      activityValue >= BUSY_ACTIVITY_THRESHOLD ||
      truthySignal(signalByKind(gameplaySignals, "fight", input.now, MAX_GAMEPLAY_AGE_MILLISECONDS))
    ) {
      return reject("busy-gameplay");
    }
    if (unsafeMoment(intelligence.data, input.now)) return reject("unsafe-moment");

    const audienceSignals = intelligence.data.audience.signals;
    const boredom = signalByKind(
      audienceSignals,
      "audience-boredom",
      input.now,
      MAX_AUDIENCE_AGE_MILLISECONDS,
    );
    const hype = signalByKind(
      audienceSignals,
      "audience-hype",
      input.now,
      MAX_AUDIENCE_AGE_MILLISECONDS,
    );
    const audienceOpportunity = Math.max(numericSignal(boredom) ?? 0, numericSignal(hype) ?? 0);
    const usableSignals = [activity, boredom, hype].filter(
      (signal): signal is KnownSignalValue => signal !== null,
    );
    const averageConfidence =
      usableSignals.reduce((total, signal) => total + signal.confidence, 0) / usableSignals.length;
    const score = Number(
      (0.5 * (1 - activityValue) + 0.3 * audienceOpportunity + 0.2 * averageConfidence).toFixed(4),
    );
    if (score < SUITABILITY_THRESHOLD) {
      return {
        shouldPropose: false,
        score,
        reasons: ["below-suitability-threshold"],
        evidenceSignalIds: usableSignals.map((signal) => signal.signalId),
      };
    }
    return {
      shouldPropose: true,
      score,
      reasons: ["eligible"],
      evidenceSignalIds: usableSignals.map((signal) => signal.signalId),
    };
  }
}

export function checkRecentQuestRepetition(
  candidateTitle: string,
  recentQuests: readonly RecentQuestSummary[],
  now: number,
): RepetitionDecision {
  const eligibleHistory = [...recentQuests]
    .sort((left, right) => right.occurredAt - left.occurredAt || left.title.localeCompare(right.title))
    .filter(
    (quest, index) =>
      quest.occurredAt <= now &&
      (index < DEFAULT_REPETITION_CYCLES || now - quest.occurredAt <= DEFAULT_REPETITION_MILLISECONDS),
    );
  const match = eligibleHistory.find((quest) => substantiallySimilar(candidateTitle, quest.title));
  return { repeated: match !== undefined, matchedQuestTitle: match?.title ?? null };
}

export function defaultCooldownEndsAt(terminalAt: number): number | null {
  const endsAt = terminalAt + DEFAULT_COOLDOWN_MILLISECONDS;
  return Number.isSafeInteger(terminalAt) && terminalAt >= 0 && Number.isSafeInteger(endsAt)
    ? endsAt
    : null;
}

export function decideActiveQuestInterruption(
  input: ActiveQuestInterruptionInput,
): ActiveQuestInterruptionDecision {
  const intelligence = intelligenceSnapshotSchema.safeParse(input.intelligence);
  if (input.emergencyPaused) return { action: "cancel", reason: "emergency-paused" };
  if (input.sessionEnded) return { action: "cancel", reason: "session-ended" };
  if (input.questImpossible) return { action: "cancel", reason: "quest-impossible" };
  if (intelligence.success && unsafeMoment(intelligence.data, input.now)) {
    return { action: "cancel", reason: "unsafe-moment" };
  }
  return { action: "continue", reason: "continue" };
}
