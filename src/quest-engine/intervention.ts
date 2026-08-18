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
export const DIRECTOR_CUE_COOLDOWN_MILLISECONDS = 120_000;
export const DIRECTOR_CUE_ATTENTION_WINDOW_MILLISECONDS = 10 * 60_000;
export const DIRECTOR_CUE_ATTENTION_LIMIT = 3;
export const DIRECTOR_CUE_REPETITION_MILLISECONDS = 30 * 60_000;

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

export type DirectorCueSuitability = "stay-silent" | "wait" | "offer-cue";

export type DirectorCueSuitabilityReason =
  | "eligible"
  | "invalid-context"
  | "cycle-unavailable"
  | "emergency-paused"
  | "missing-declared-intent"
  | "unsupported-gameplay-evidence"
  | "insufficient-gameplay-evidence"
  | "active-gameplay"
  | "transition"
  | "unsafe-moment"
  | "missing-audience-context"
  | "sparse-audience"
  | "conflicting-audience"
  | "ambiguous-audience"
  | "sarcasm-risk"
  | "stale-audience-context"
  | "low-confidence-audience-context"
  | "cue-cooldown"
  | "attention-budget-exhausted"
  | "repeated-cue"
  | "below-cue-threshold";

export type DirectorCueIntent =
  | {
      readonly status: "known";
      readonly intentId: string;
      readonly objective: string;
      readonly updatedAt: number;
    }
  | { readonly status: "unknown" };

export type DirectorCueAudienceContext =
  | {
      readonly status: "known";
      readonly pointerId: string;
      readonly topic: string;
      readonly observedAt: number;
      readonly confidence: number;
      readonly relevance: number;
      readonly intentAlignment: number;
      readonly uniqueParticipants: number;
      readonly qualifyingMessages: number;
      readonly sarcasmRisk: boolean;
      readonly evidenceSignalIds: readonly string[];
    }
  | { readonly status: "unknown"; readonly evidenceSignalIds: readonly string[] }
  | { readonly status: "conflicting"; readonly evidenceSignalIds: readonly string[] }
  | { readonly status: "ambiguous"; readonly evidenceSignalIds: readonly string[] };

export interface RecentDirectorCueSummary {
  readonly intentId: string;
  readonly topic: string;
  readonly offeredAt: number;
}

export interface DirectorCueSuitabilityInput {
  readonly currentState: QuestCycleState;
  readonly intelligence: IntelligenceSnapshot;
  readonly profile: StreamerProfile;
  readonly emergencyPaused: boolean;
  readonly declaredIntent: DirectorCueIntent;
  readonly audienceContext: DirectorCueAudienceContext;
  readonly recentCues: readonly RecentDirectorCueSummary[];
  readonly now: number;
}

export interface DirectorCueSuitabilityDecision {
  readonly disposition: DirectorCueSuitability;
  readonly score: number;
  readonly reasons: readonly DirectorCueSuitabilityReason[];
  readonly evidenceReferences: readonly string[];
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
const DEFAULT_PROFILE_INTENSITY = 0.5;
const MINIMUM_DIRECTOR_CUE_AUDIENCE_CONFIDENCE = 0.65;
const MAXIMUM_DIRECTOR_CUE_AUDIENCE_AGE_MILLISECONDS = 30_000;
const MINIMUM_DIRECTOR_CUE_PARTICIPANTS = 2;
const MINIMUM_DIRECTOR_CUE_MESSAGES = 2;

function profileTimingThresholds(profile: StreamerProfile) {
  const intensity = profile.experience.intensity ?? DEFAULT_PROFILE_INTENSITY;
  return {
    busyActivity: 0.65 + 0.2 * intensity,
    suitability: 0.7 - 0.2 * intensity,
  };
}

function reject(reason: InterventionReason): InterventionDecision {
  return { shouldPropose: false, score: 0, reasons: [reason], evidenceSignalIds: [] };
}

function cueDecision(
  disposition: DirectorCueSuitability,
  reason: DirectorCueSuitabilityReason,
  score = 0,
  evidenceReferences: readonly string[] = [],
): DirectorCueSuitabilityDecision {
  return { disposition, score, reasons: [reason], evidenceReferences };
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

function directorCueThresholds(profile: StreamerProfile) {
  const intensity = profile.experience.intensity ?? DEFAULT_PROFILE_INTENSITY;
  return {
    busyActivity: 0.55 + 0.2 * intensity,
    suitability: 0.72 - 0.12 * intensity,
  };
}

function validDirectorCueIntent(
  intent: DirectorCueIntent,
  now: number,
): intent is Extract<DirectorCueIntent, { readonly status: "known" }> {
  return (
    intent.status === "known" &&
    intent.intentId.trim().length > 0 &&
    intent.intentId.length <= 120 &&
    intent.objective.trim().length > 0 &&
    intent.objective.length <= 240 &&
    Number.isSafeInteger(intent.updatedAt) &&
    intent.updatedAt >= 0 &&
    intent.updatedAt <= now
  );
}

function validAudienceContext(
  context: Extract<DirectorCueAudienceContext, { readonly status: "known" }>,
): boolean {
  return (
    context.pointerId.trim().length > 0 &&
    context.pointerId.length <= 120 &&
    context.topic.trim().length > 0 &&
    context.topic.length <= 240 &&
    Number.isSafeInteger(context.observedAt) &&
    context.observedAt >= 0 &&
    Number.isFinite(context.confidence) &&
    context.confidence >= 0 &&
    context.confidence <= 1 &&
    Number.isFinite(context.relevance) &&
    context.relevance >= 0 &&
    context.relevance <= 1 &&
    Number.isFinite(context.intentAlignment) &&
    context.intentAlignment >= 0 &&
    context.intentAlignment <= 1 &&
    Number.isSafeInteger(context.uniqueParticipants) &&
    context.uniqueParticipants >= 0 &&
    Number.isSafeInteger(context.qualifyingMessages) &&
    context.qualifyingMessages >= 0 &&
    context.evidenceSignalIds.every(
      (signalId) => signalId.trim().length > 0 && signalId.length <= 120,
    )
  );
}

function recentCueHistoryIsValid(
  recentCues: readonly RecentDirectorCueSummary[],
  now: number,
): boolean {
  return recentCues.every(
    (cue) =>
      cue.intentId.trim().length > 0 &&
      cue.intentId.length <= 120 &&
      cue.topic.trim().length > 0 &&
      cue.topic.length <= 240 &&
      Number.isSafeInteger(cue.offeredAt) &&
      cue.offeredAt >= 0 &&
      cue.offeredAt <= now,
  );
}

/**
 * Pure Role 3 policy for the private Live Director cue opportunity.
 *
 * `declaredIntent` and `audienceContext` are a temporary Role 3 adapter for the
 * proposed LD-R1-01 fixture. The policy will consume the canonical Core seam
 * once Role 1 publishes it; no persistence, projection, or UI authority lives
 * here.
 */
export class DefaultDirectorCueSuitabilityPolicy {
  decide(input: DirectorCueSuitabilityInput): DirectorCueSuitabilityDecision {
    const state = questCycleStateSchema.safeParse(input.currentState);
    const intelligence = intelligenceSnapshotSchema.safeParse(input.intelligence);
    const profile = streamerProfileSchema.safeParse(input.profile);
    if (
      !state.success ||
      !intelligence.success ||
      !profile.success ||
      !Number.isSafeInteger(input.now) ||
      input.now < 0 ||
      !recentCueHistoryIsValid(input.recentCues, input.now)
    ) {
      return cueDecision("stay-silent", "invalid-context");
    }
    if (
      state.data.envelope.sessionId !== intelligence.data.envelope.sessionId ||
      state.data.envelope.questCycleId !== intelligence.data.envelope.questCycleId ||
      state.data.envelope.revision !== intelligence.data.envelope.revision ||
      state.data.envelope.evidenceClass !== intelligence.data.envelope.evidenceClass
    ) {
      return cueDecision("stay-silent", "invalid-context");
    }

    // Hard lifecycle and safety gates always precede evidence scoring.
    if (state.data.status !== "idle") {
      return cueDecision("stay-silent", "cycle-unavailable");
    }
    if (input.emergencyPaused) {
      return cueDecision("stay-silent", "emergency-paused");
    }
    if (unsafeMoment(intelligence.data, input.now)) {
      return cueDecision("stay-silent", "unsafe-moment");
    }
    const declaredIntent = input.declaredIntent;
    if (declaredIntent.status === "unknown") {
      return cueDecision("stay-silent", "missing-declared-intent");
    }
    if (!validDirectorCueIntent(declaredIntent, input.now)) {
      return cueDecision("stay-silent", "invalid-context");
    }

    const gameplay = intelligence.data.gameplay;
    if (!gameplay.capabilities.supportedSignals.includes("activity-intensity")) {
      return cueDecision("wait", "unsupported-gameplay-evidence");
    }
    const activity = signalByKind(
      gameplay.signals,
      "activity-intensity",
      input.now,
      MAX_GAMEPLAY_AGE_MILLISECONDS,
    );
    const activityValue = numericSignal(activity);
    if (activity === null || activityValue === null) {
      return cueDecision("wait", "insufficient-gameplay-evidence");
    }
    if (
      truthySignal(signalByKind(gameplay.signals, "transition", input.now, MAX_GAMEPLAY_AGE_MILLISECONDS)) ||
      truthySignal(signalByKind(gameplay.signals, "scene-transition", input.now, MAX_GAMEPLAY_AGE_MILLISECONDS))
    ) {
      return cueDecision("wait", "transition", 0, [activity.signalId]);
    }
    const thresholds = directorCueThresholds(profile.data);
    if (
      activityValue >= thresholds.busyActivity ||
      truthySignal(signalByKind(gameplay.signals, "fight", input.now, MAX_GAMEPLAY_AGE_MILLISECONDS)) ||
      truthySignal(signalByKind(gameplay.signals, "high-focus", input.now, MAX_GAMEPLAY_AGE_MILLISECONDS))
    ) {
      return cueDecision("wait", "active-gameplay", 0, [activity.signalId]);
    }

    const audience = input.audienceContext;
    if (audience.status === "unknown") {
      return cueDecision("wait", "missing-audience-context", 0, [activity.signalId]);
    }
    if (audience.status === "conflicting") {
      return cueDecision("wait", "conflicting-audience", 0, [activity.signalId, ...audience.evidenceSignalIds]);
    }
    if (audience.status === "ambiguous") {
      return cueDecision("wait", "ambiguous-audience", 0, [activity.signalId, ...audience.evidenceSignalIds]);
    }
    if (!validAudienceContext(audience)) {
      return cueDecision("stay-silent", "invalid-context");
    }
    const audienceAge = input.now - audience.observedAt;
    if (audienceAge < 0) {
      return cueDecision("stay-silent", "invalid-context");
    }
    if (audienceAge > MAXIMUM_DIRECTOR_CUE_AUDIENCE_AGE_MILLISECONDS) {
      return cueDecision("wait", "stale-audience-context", 0, [activity.signalId, ...audience.evidenceSignalIds]);
    }
    if (audience.confidence < MINIMUM_DIRECTOR_CUE_AUDIENCE_CONFIDENCE) {
      return cueDecision("wait", "low-confidence-audience-context", 0, [activity.signalId, ...audience.evidenceSignalIds]);
    }
    if (
      audience.uniqueParticipants < MINIMUM_DIRECTOR_CUE_PARTICIPANTS ||
      audience.qualifyingMessages < MINIMUM_DIRECTOR_CUE_MESSAGES
    ) {
      return cueDecision("wait", "sparse-audience", 0, [activity.signalId, ...audience.evidenceSignalIds]);
    }
    if (audience.sarcasmRisk) {
      return cueDecision("wait", "sarcasm-risk", 0, [activity.signalId, ...audience.evidenceSignalIds]);
    }

    const recentCues = [...input.recentCues].sort(
      (left, right) => right.offeredAt - left.offeredAt || left.topic.localeCompare(right.topic),
    );
    if (
      recentCues.some(
        (cue) => input.now - cue.offeredAt < DIRECTOR_CUE_COOLDOWN_MILLISECONDS,
      )
    ) {
      return cueDecision("stay-silent", "cue-cooldown");
    }
    const attentionWindowCues = recentCues.filter(
      (cue) => input.now - cue.offeredAt <= DIRECTOR_CUE_ATTENTION_WINDOW_MILLISECONDS,
    );
    if (attentionWindowCues.length >= DIRECTOR_CUE_ATTENTION_LIMIT) {
      return cueDecision("stay-silent", "attention-budget-exhausted");
    }
    const repeatedCue = recentCues.some(
      (cue) =>
        cue.intentId === declaredIntent.intentId &&
        input.now - cue.offeredAt <= DIRECTOR_CUE_REPETITION_MILLISECONDS &&
        substantiallySimilar(cue.topic, audience.topic),
    );
    if (repeatedCue) {
      return cueDecision("stay-silent", "repeated-cue");
    }

    const evidenceReferences = [
      declaredIntent.intentId,
      activity.signalId,
      audience.pointerId,
      ...audience.evidenceSignalIds,
    ];
    const score = Number(
      (
        0.35 * (1 - activityValue) +
        0.25 * audience.relevance +
        0.2 * audience.confidence +
        0.2 * audience.intentAlignment
      ).toFixed(4),
    );
    if (score < thresholds.suitability) {
      return cueDecision("wait", "below-cue-threshold", score, evidenceReferences);
    }
    return cueDecision("offer-cue", "eligible", score, evidenceReferences);
  }
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
    if (
      state.data.envelope.sessionId !== intelligence.data.envelope.sessionId ||
      state.data.envelope.questCycleId !== intelligence.data.envelope.questCycleId ||
      state.data.envelope.revision !== intelligence.data.envelope.revision ||
      state.data.envelope.evidenceClass !== intelligence.data.envelope.evidenceClass
    ) {
      return reject("invalid-context");
    }
    if (state.data.status !== "idle") return reject("cycle-unavailable");
    if (input.emergencyPaused) return reject("emergency-paused");

    const gameplaySignals = intelligence.data.gameplay.signals;
    const timingThresholds = profileTimingThresholds(profile.data);
    const activity = signalByKind(
      gameplaySignals,
      "activity-intensity",
      input.now,
      MAX_GAMEPLAY_AGE_MILLISECONDS,
    );
    const activityValue = numericSignal(activity);
    if (activityValue === null) return reject("insufficient-gameplay-evidence");
    if (
      activityValue >= timingThresholds.busyActivity ||
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
    if (score < timingThresholds.suitability) {
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
