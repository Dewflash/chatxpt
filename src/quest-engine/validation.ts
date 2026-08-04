import {
  candidateBatchSchema,
  contractEnvelopeSchema,
  intelligenceSnapshotSchema,
  questCandidateSchema,
  questCycleStateSchema,
  streamerProfileSchema,
  type CandidateBatch,
  type ContractEnvelope,
  type IntelligenceSnapshot,
  type QuestCandidate,
  type QuestCycleState,
  type StreamerProfile,
} from "../core";
import { checkRecentQuestRepetition, type RecentQuestSummary } from "./intervention";

export const MINIMUM_CANDIDATE_CONFIDENCE = 0.5;
export const PREFERRED_MAXIMUM_DURATION_SECONDS = 180;
export const MAXIMUM_INSTRUCTION_WORDS = 36;
export const MAXIMUM_SIGNAL_AGE_MILLISECONDS = 15_000;
export const DIVERSITY_SIMILARITY_THRESHOLD = 0.55;

export type CandidateValidationCode =
  | "malformed"
  | "unsafe"
  | "streamer-restricted"
  | "accessibility-conflict"
  | "unsupported-evidence"
  | "unknown-dependent"
  | "low-confidence"
  | "duration-out-of-range"
  | "difficulty-mismatch"
  | "unclear"
  | "duplicate"
  | "recently-repeated"
  | "lifecycle-conflict"
  | "quality-warning";

export interface CandidateValidationIssue {
  readonly code: CandidateValidationCode;
  readonly severity: "reject" | "warning";
  readonly reason: string;
  readonly evidence: readonly string[];
  readonly repairable: false;
}

export interface CandidateValidationContext {
  readonly intelligence: IntelligenceSnapshot;
  readonly profile: StreamerProfile;
  readonly currentState: QuestCycleState;
  readonly recentQuests: readonly RecentQuestSummary[];
  readonly acceptedCandidates: readonly QuestCandidate[];
  readonly now: number;
}

export type CandidateValidationResult =
  | {
      readonly accepted: true;
      readonly candidate: QuestCandidate;
      readonly issues: readonly CandidateValidationIssue[];
    }
  | {
      readonly accepted: false;
      readonly candidate: QuestCandidate | null;
      readonly issues: readonly CandidateValidationIssue[];
    };

export interface CandidateAssemblyInput {
  readonly envelope: ContractEnvelope;
  readonly candidates: readonly unknown[];
  readonly intelligence: IntelligenceSnapshot;
  readonly profile: StreamerProfile;
  readonly currentState: QuestCycleState;
  readonly recentQuests: readonly RecentQuestSummary[];
  readonly now: number;
  readonly seed: string;
}

export interface CandidateAssemblyAudit {
  readonly candidateId: string | null;
  readonly source: "provided" | "fallback";
  readonly accepted: boolean;
  readonly issues: readonly CandidateValidationIssue[];
}

export type CandidateAssemblyResult =
  | {
      readonly ok: true;
      readonly batch: CandidateBatch;
      readonly audit: readonly CandidateAssemblyAudit[];
    }
  | {
      readonly ok: false;
      readonly code: "invalid-context" | "fallback-exhausted";
      readonly reason: string;
      readonly audit: readonly CandidateAssemblyAudit[];
    };

interface FallbackDefinition {
  readonly key: string;
  readonly title: string;
  readonly instruction: string;
  readonly durationSeconds: number;
  readonly difficulty: QuestCandidate["difficulty"];
  readonly rewardPoints: number;
  readonly rationale: string;
}

const fallbackLibrary: readonly FallbackDefinition[] = [
  {
    key: "plan-out-loud",
    title: "Plan Out Loud",
    instruction: "Explain your plan before taking the next major game action.",
    durationSeconds: 45,
    difficulty: "easy",
    rewardPoints: 100,
    rationale: "A game-neutral strategy prompt that does not depend on hidden gameplay facts.",
  },
  {
    key: "caster-mode",
    title: "Caster Mode",
    instruction: "Narrate the next 45 seconds like a friendly sports commentator.",
    durationSeconds: 45,
    difficulty: "easy",
    rewardPoints: 100,
    rationale: "A game-neutral performance prompt suitable when specific gameplay facts are unknown.",
  },
  {
    key: "calm-focus",
    title: "Calm Focus",
    instruction: "Describe one decision at a time for the next 60 seconds.",
    durationSeconds: 60,
    difficulty: "easy",
    rewardPoints: 100,
    rationale: "A low-intensity focus prompt that remains judgeable without game telemetry.",
  },
  {
    key: "three-step-preview",
    title: "Three-Step Preview",
    instruction: "State your next three intended actions before carrying them out.",
    durationSeconds: 60,
    difficulty: "medium",
    rewardPoints: 200,
    rationale: "A game-neutral planning challenge with a clear completion condition.",
  },
  {
    key: "audience-coach",
    title: "Audience Coach",
    instruction: "Share one useful beginner tip during the next 45 seconds.",
    durationSeconds: 45,
    difficulty: "easy",
    rewardPoints: 100,
    rationale: "A supportive audience prompt that needs no specific state claim.",
  },
  {
    key: "dramatic-recap",
    title: "Dramatic Recap",
    instruction: "Give a dramatic recap of your most recent decision in one minute.",
    durationSeconds: 60,
    difficulty: "medium",
    rewardPoints: 200,
    rationale: "A comedic reflection prompt that avoids unsupported gameplay assertions.",
  },
  {
    key: "decision-spotlight",
    title: "Decision Spotlight",
    instruction: "Explain why you chose your next major action before completing it.",
    durationSeconds: 60,
    difficulty: "medium",
    rewardPoints: 200,
    rationale: "A competitive decision prompt that remains game-neutral and measurable.",
  },
  {
    key: "one-minute-mentor",
    title: "One-Minute Mentor",
    instruction: "Teach one general strategy lesson during the next 60 seconds.",
    durationSeconds: 60,
    difficulty: "medium",
    rewardPoints: 200,
    rationale: "A beginner-friendly teaching prompt that works without calibrated signals.",
  },
  {
    key: "positive-commentary",
    title: "Positive Commentary",
    instruction: "Keep your commentary constructive for the next 60 seconds.",
    durationSeconds: 60,
    difficulty: "easy",
    rewardPoints: 100,
    rationale: "A low-risk tone challenge with a clear time boundary.",
  },
] as const;

const safetyPatterns = [
  /\b(password|credential|api key|secret key|private key)\b/i,
  /\b(real money|cash|bet|wager|gambl(?:e|ing))\b/i,
  /\b(humiliat(?:e|ing|ion)|harass|discriminat(?:e|ion)|sexual)\b/i,
  /\b(self[- ]?harm|dangerous act|illegal act)\b/i,
  /\b(dox|address|phone number|personal data)\b/i,
] as const;

const factDependencies = [
  { pattern: /\bhealth\b/i, kinds: ["health"] },
  { pattern: /\b(kill|elimination)s?\b/i, kinds: ["kill"] },
  { pattern: /\bknock(?:ed|down)?\b/i, kinds: ["knockdown"] },
  { pattern: /\bloot(?:ing)?\b/i, kinds: ["looting"] },
  { pattern: /\b(final circle|match phase)\b/i, kinds: ["match-phase"] },
] as const;

const durationRangeByDifficulty = {
  easy: { minimum: 15, maximum: 90 },
  medium: { minimum: 30, maximum: 150 },
  hard: { minimum: 45, maximum: 180 },
} as const satisfies Record<QuestCandidate["difficulty"], { minimum: number; maximum: number }>;

const stopWords = new Set([
  "a",
  "an",
  "and",
  "at",
  "avoid",
  "challenge",
  "challenges",
  "for",
  "in",
  "never",
  "no",
  "of",
  "or",
  "the",
  "to",
  "with",
]);

function issue(
  code: CandidateValidationCode,
  severity: CandidateValidationIssue["severity"],
  reason: string,
  evidence: readonly string[] = [],
): CandidateValidationIssue {
  return { code, severity, reason, evidence, repairable: false };
}

function normalisedTokens(value: string): readonly string[] {
  return value
    .toLocaleLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 1 && !stopWords.has(token));
}

function substantiallySimilar(left: QuestCandidate, right: QuestCandidate): boolean {
  const leftTokens = new Set(normalisedTokens(`${left.title} ${left.instruction}`));
  const rightTokens = new Set(normalisedTokens(`${right.title} ${right.instruction}`));
  if (leftTokens.size === 0 || rightTokens.size === 0) return false;
  const intersection = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  const union = new Set([...leftTokens, ...rightTokens]).size;
  return intersection / union >= DIVERSITY_SIMILARITY_THRESHOLD;
}

function matchesBoundary(candidateText: string, boundary: string): boolean {
  const boundaryTokens = normalisedTokens(boundary);
  if (boundaryTokens.length === 0) return false;
  const candidateTokens = new Set(normalisedTokens(candidateText));
  return boundaryTokens.every((token) => candidateTokens.has(token));
}

function knownSignalIdsByKind(
  intelligence: IntelligenceSnapshot,
  now: number,
): ReadonlyMap<string, readonly string[]> {
  const result = new Map<string, string[]>();
  const supported = new Set(intelligence.gameplay.capabilities.supportedSignals);
  for (const signal of intelligence.gameplay.signals) {
    if (signal.observation.status !== "known" || !supported.has(signal.kind)) continue;
    const age = now - signal.observation.provenance.observedAt;
    if (
      age < 0 ||
      age > MAXIMUM_SIGNAL_AGE_MILLISECONDS ||
      signal.observation.provenance.confidence < MINIMUM_CANDIDATE_CONFIDENCE
    ) {
      continue;
    }
    result.set(signal.kind, [...(result.get(signal.kind) ?? []), signal.signalId]);
  }
  return result;
}

export class DefaultCandidateValidator {
  validate(candidateInput: unknown, context: CandidateValidationContext): CandidateValidationResult {
    const parsed = questCandidateSchema.safeParse(candidateInput);
    if (!parsed.success) {
      return {
        accepted: false,
        candidate: null,
        issues: [issue("malformed", "reject", "Candidate does not match the canonical schema.")],
      };
    }
    const candidate = parsed.data;
    const issues: CandidateValidationIssue[] = [];
    const text = `${candidate.title} ${candidate.instruction} ${candidate.rationale}`;

    if (safetyPatterns.some((pattern) => pattern.test(text))) {
      issues.push(issue("unsafe", "reject", "Candidate violates the legal, non-harmful, non-wagering safety boundary."));
    }

    const restrictions = [...context.profile.restrictions, ...context.profile.forbiddenQuestTypes];
    const matchedRestriction = restrictions.find((boundary) => matchesBoundary(text, boundary));
    if (matchedRestriction !== undefined) {
      issues.push(issue("streamer-restricted", "reject", "Candidate conflicts with a saved streamer restriction.", [matchedRestriction]));
    }
    const matchedAccessibilityNeed = context.profile.accessibilityNeeds.find((need) => matchesBoundary(text, need));
    if (matchedAccessibilityNeed !== undefined) {
      issues.push(issue("accessibility-conflict", "reject", "Candidate conflicts with a saved accessibility need.", [matchedAccessibilityNeed]));
    }

    const knownSignals = knownSignalIdsByKind(context.intelligence, context.now);
    const allKnownIds = new Set([...knownSignals.values()].flat());
    const unsupportedIds = candidate.sourceSignalIds.filter((signalId) => !allKnownIds.has(signalId));
    if (unsupportedIds.length > 0) {
      issues.push(issue("unsupported-evidence", "reject", "Candidate cites stale, unknown, low-confidence, or unsupported evidence.", unsupportedIds));
    }
    for (const dependency of factDependencies) {
      if (!dependency.pattern.test(text)) continue;
      const supportingIds = dependency.kinds.flatMap((kind) => [...(knownSignals.get(kind) ?? [])]);
      if (!supportingIds.some((signalId) => candidate.sourceSignalIds.includes(signalId))) {
        issues.push(issue("unknown-dependent", "reject", "Candidate depends on a gameplay fact without matching known evidence.", dependency.kinds));
      }
    }

    if (candidate.confidence < MINIMUM_CANDIDATE_CONFIDENCE) {
      issues.push(issue("low-confidence", "reject", "Candidate confidence is below the deterministic acceptance threshold."));
    } else if (candidate.confidence < 0.65) {
      issues.push(issue("quality-warning", "warning", "Candidate confidence is acceptable but below the preferred level."));
    }
    if (candidate.durationSeconds < 15 || candidate.durationSeconds > PREFERRED_MAXIMUM_DURATION_SECONDS) {
      issues.push(issue("duration-out-of-range", "reject", "Candidate duration must be between 15 and 180 seconds for the MVP."));
    }
    const difficultyRange = durationRangeByDifficulty[candidate.difficulty];
    if (
      candidate.durationSeconds < difficultyRange.minimum ||
      candidate.durationSeconds > difficultyRange.maximum
    ) {
      issues.push(
        issue(
          "difficulty-mismatch",
          "reject",
          `${candidate.difficulty} candidates must last ${difficultyRange.minimum}-${difficultyRange.maximum} seconds.`,
        ),
      );
    }
    if (normalisedTokens(candidate.instruction).length > MAXIMUM_INSTRUCTION_WORDS) {
      issues.push(issue("unclear", "reject", "Candidate instruction is too long to understand under stream pressure."));
    }
    const duplicate = context.acceptedCandidates.find((accepted) => substantiallySimilar(candidate, accepted));
    if (duplicate !== undefined) {
      issues.push(issue("duplicate", "reject", "Candidate is not meaningfully distinct from another accepted option.", [duplicate.candidateId]));
    }
    const repetition = checkRecentQuestRepetition(candidate.title, context.recentQuests, context.now);
    if (repetition.repeated) {
      issues.push(issue("recently-repeated", "reject", "Candidate substantially repeats recent quest history.", repetition.matchedQuestTitle === null ? [] : [repetition.matchedQuestTitle]));
    }
    if (
      !Number.isSafeInteger(context.now) ||
      context.now < 0 ||
      !["idle", "evaluating"].includes(context.currentState.status)
    ) {
      issues.push(
        issue(
          "lifecycle-conflict",
          "reject",
          "Candidates may only be assembled for an idle or evaluating cycle.",
        ),
      );
    }

    return issues.some(({ severity }) => severity === "reject")
      ? { accepted: false, candidate, issues }
      : { accepted: true, candidate, issues };
  }
}

function stableHash(value: string): number {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

function fallbackCandidate(definition: FallbackDefinition, input: CandidateAssemblyInput): QuestCandidate {
  return questCandidateSchema.parse({
    candidateId: `fallback-${definition.key}-${stableHash(`${input.seed}:${definition.key}`).toString(36)}`,
    title: definition.title,
    instruction: definition.instruction,
    durationSeconds: definition.durationSeconds,
    difficulty: definition.difficulty,
    rewardPoints: definition.rewardPoints,
    rationale: definition.rationale,
    sourceSignalIds: [],
    confidence: 1,
    generation: { method: "deterministic-fallback", provider: null, generatedAt: input.now },
  });
}

export class DefaultCandidateAssembler {
  constructor(private readonly validator = new DefaultCandidateValidator()) {}

  assemble(input: CandidateAssemblyInput): CandidateAssemblyResult {
    const envelope = contractEnvelopeSchema.safeParse(input.envelope);
    const intelligence = intelligenceSnapshotSchema.safeParse(input.intelligence);
    const profile = streamerProfileSchema.safeParse(input.profile);
    const currentState = questCycleStateSchema.safeParse(input.currentState);
    if (
      !envelope.success ||
      !intelligence.success ||
      !profile.success ||
      !currentState.success ||
      !Number.isSafeInteger(input.now) ||
      input.now < 0 ||
      input.seed.trim().length === 0
    ) {
      return { ok: false, code: "invalid-context", reason: "Candidate assembly context is invalid.", audit: [] };
    }
    if (
      envelope.data.sessionId !== intelligence.data.envelope.sessionId ||
      envelope.data.sessionId !== currentState.data.envelope.sessionId ||
      envelope.data.questCycleId !== intelligence.data.envelope.questCycleId ||
      envelope.data.questCycleId !== currentState.data.envelope.questCycleId ||
      envelope.data.revision !== intelligence.data.envelope.revision ||
      envelope.data.revision !== currentState.data.envelope.revision ||
      envelope.data.evidenceClass !== intelligence.data.envelope.evidenceClass ||
      envelope.data.evidenceClass !== currentState.data.envelope.evidenceClass
    ) {
      return {
        ok: false,
        code: "invalid-context",
        reason: "Candidate assembly context belongs to mismatched session, cycle, revision, or evidence.",
        audit: [],
      };
    }

    const accepted: QuestCandidate[] = [];
    const audit: CandidateAssemblyAudit[] = [];
    const validate = (candidate: unknown, source: CandidateAssemblyAudit["source"]) => {
      const result = this.validator.validate(candidate, {
        intelligence: intelligence.data,
        profile: profile.data,
        currentState: currentState.data,
        recentQuests: input.recentQuests,
        acceptedCandidates: accepted,
        now: input.now,
      });
      audit.push({ candidateId: result.candidate?.candidateId ?? null, source, accepted: result.accepted, issues: result.issues });
      if (result.accepted) accepted.push(result.candidate);
    };

    for (const candidate of input.candidates) {
      if (accepted.length === 3) break;
      validate(candidate, "provided");
    }
    const orderedFallbacks = [...fallbackLibrary].sort((left, right) => {
      const difference = stableHash(`${input.seed}:${left.key}`) - stableHash(`${input.seed}:${right.key}`);
      return difference !== 0 ? difference : left.key.localeCompare(right.key);
    });
    for (const definition of orderedFallbacks) {
      if (accepted.length === 3) break;
      validate(fallbackCandidate(definition, input), "fallback");
    }
    if (accepted.length !== 3) {
      return { ok: false, code: "fallback-exhausted", reason: "No safe, distinct exactly-three candidate set could be assembled.", audit };
    }
    const batch = candidateBatchSchema.safeParse({ envelope: envelope.data, candidates: accepted });
    if (!batch.success) {
      return { ok: false, code: "fallback-exhausted", reason: "Final candidate set failed the canonical batch contract.", audit };
    }
    return { ok: true, batch: batch.data, audit };
  }
}
