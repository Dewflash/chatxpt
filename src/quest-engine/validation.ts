import {
  audienceSnapshotSchema,
  candidateBatchSchema,
  contractEnvelopeSchema,
  gameplaySnapshotSchema,
  intelligenceSnapshotSchema,
  questCandidateSchema,
  questCycleStateSchema,
  streamerProfileSchema,
  type AudienceSnapshot,
  type CandidateBatch,
  type ContractEnvelope,
  type GameplaySnapshot,
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
export const MAXIMUM_AUDIENCE_SIGNAL_AGE_MILLISECONDS = 30_000;
export const DIVERSITY_SIMILARITY_THRESHOLD = 0.55;

export type CandidateValidationCode =
  | "malformed"
  | "unsafe"
  | "streamer-restricted"
  | "accessibility-conflict"
  | "game-mismatch"
  | "unsupported-evidence"
  | "unsupported-completion-rule"
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

export interface VoteCloseCandidateValidationContext {
  readonly audience: AudienceSnapshot | null;
  readonly gameplay: GameplaySnapshot | null;
  readonly profile: StreamerProfile;
  readonly currentState: QuestCycleState;
  readonly recentQuests: readonly RecentQuestSummary[];
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

interface SelectedGame {
  readonly name: string;
  readonly isMinecraft: boolean;
}

function selectedGameFrom(profile: StreamerProfile): SelectedGame | null {
  const rawName = profile.gameName?.trim() || profile.gameId?.trim();
  if (!rawName) return null;
  const name = rawName
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (character) => character.toLocaleUpperCase());
  const identity = `${profile.gameId ?? ""} ${profile.gameName ?? ""}`.toLocaleLowerCase();
  return { name, isMinecraft: identity.includes("minecraft") };
}

function fallbackLibraryFor(game: SelectedGame): readonly FallbackDefinition[] {
  const instructions = game.isMinecraft
    ? {
        plan: "Before your next Minecraft action, explain whether you will build, explore, gather, or craft and why.",
        caster: "Narrate the next 45 seconds of Minecraft like a friendly sports commentator.",
        focus: "For 60 seconds, name each Minecraft action before placing, breaking, crafting, or moving.",
        preview: "State your next three Minecraft actions using building, gathering, crafting, or exploration before acting.",
        coach: "Teach viewers one Minecraft tip about building, crafting, resource gathering, or navigation.",
        recap: "Give a dramatic recap of your most recent Minecraft decision in one minute.",
        decision: "Before your next Minecraft action, explain why building, crafting, gathering, or exploring best supports your objective.",
        mentor: "Teach one Minecraft mechanic and show how it informs your next decision within 60 seconds.",
        positive: "Keep your Minecraft commentary constructive for the next 60 seconds.",
      }
    : {
        plan: `Before your next ${game.name} action, explain what you intend to do and why.`,
        caster: `Narrate the next 45 seconds of ${game.name} like a friendly sports commentator.`,
        focus: `For 60 seconds of ${game.name}, describe one decision at a time before acting.`,
        preview: `State your next three intended ${game.name} actions before carrying them out.`,
        coach: `Teach viewers one useful beginner ${game.name} tip during the next 45 seconds.`,
        recap: `Give a dramatic recap of your most recent ${game.name} decision in one minute.`,
        decision: `Before your next major ${game.name} action, explain why it supports your objective.`,
        mentor: `Teach one ${game.name} mechanic and connect it to your next decision within 60 seconds.`,
        positive: `Keep your ${game.name} commentary constructive for the next 60 seconds.`,
      };
  const rationale = (purpose: string) =>
    `A deterministic ${game.name} fallback ${purpose} without claiming unsupported current state.`;

  return [
    {
      key: "plan-out-loud",
      title: "Plan Out Loud",
      instruction: instructions.plan,
      durationSeconds: 45,
      difficulty: "easy",
      rewardPoints: 100,
      rationale: rationale("creates a measurable planning moment"),
    },
    {
      key: "caster-mode",
      title: "Caster Mode",
      instruction: instructions.caster,
      durationSeconds: 45,
      difficulty: "easy",
      rewardPoints: 100,
      rationale: rationale("creates audience-safe commentary"),
    },
    {
      key: "calm-focus",
      title: "Calm Focus",
      instruction: instructions.focus,
      durationSeconds: 60,
      difficulty: "easy",
      rewardPoints: 100,
      rationale: rationale("keeps the objective safe under noisy evidence"),
    },
    {
      key: "three-step-preview",
      title: "Three-Step Preview",
      instruction: instructions.preview,
      durationSeconds: 60,
      difficulty: "medium",
      rewardPoints: 200,
      rationale: rationale("creates a clear completion condition"),
    },
    {
      key: "audience-coach",
      title: "Audience Coach",
      instruction: instructions.coach,
      durationSeconds: 45,
      difficulty: "easy",
      rewardPoints: 100,
      rationale: rationale("creates a supportive teaching moment"),
    },
    {
      key: "dramatic-recap",
      title: "Dramatic Recap",
      instruction: instructions.recap,
      durationSeconds: 60,
      difficulty: "medium",
      rewardPoints: 200,
      rationale: rationale("creates a personality-led reflection moment"),
    },
    {
      key: "decision-spotlight",
      title: "Decision Spotlight",
      instruction: instructions.decision,
      durationSeconds: 60,
      difficulty: "medium",
      rewardPoints: 200,
      rationale: rationale("rewards clear decision-making"),
    },
    {
      key: "one-minute-mentor",
      title: "One-Minute Mentor",
      instruction: instructions.mentor,
      durationSeconds: 60,
      difficulty: "medium",
      rewardPoints: 200,
      rationale: rationale("turns play into an accessible teaching moment"),
    },
    {
      key: "positive-commentary",
      title: "Positive Commentary",
      instruction: instructions.positive,
      durationSeconds: 60,
      difficulty: "easy",
      rewardPoints: 100,
      rationale: rationale("creates a constructive commentary moment"),
    },
  ];
}

const safetyRules = [
  {
    category: "sensitive-data",
    patterns: [/\b(password|credential|api key|secret key|private key)\b/i],
  },
  {
    category: "wagering",
    patterns: [/\b(real money|cash|bet|wager|gambl(?:e|ing))\b/i],
  },
  {
    category: "humiliation-or-sexual",
    patterns: [/\b(humiliat(?:e|ing|ion)|harass|discriminat(?:e|ion)|sexual)\b/i],
  },
  {
    category: "harmful-instruction",
    patterns: [
      /\b(self[- ]?harm|dangerous act)\b/i,
      /\b(drink|swallow|ingest|consume|eat)\b.{0,40}\b(bleach|poison|detergent|cleaning (?:fluid|product)|household chemical|medication|pills?)\b/i,
      /\b(bleach|poison|detergent|cleaning (?:fluid|product)|household chemical)\b.{0,40}\b(drink|swallow|ingest|consume|eat)\b/i,
      /\b(cut|burn|choke|strangle|stab|electrocute|injure|hurt)\b.{0,40}\b(yourself|someone|another person|viewer|streamer)\b/i,
      /\b(run|walk|step|jump)\b.{0,30}\b(traffic|moving vehicle|roof|ledge)\b/i,
    ],
  },
  {
    category: "illegal-instruction",
    patterns: [
      /\b(illegal act|shoplift|burglarize)\b/i,
      /\b(break|sneak)\s+into\s+(?:a\s+)?(home|house|store|shop|car|vehicle)\b/i,
      /\b(hack|phish)\b.{0,30}\b(account|password|network|website|server)\b/i,
      /\bsteal\b.{0,30}\b(wallet|phone|car|vehicle|money|cash|credit card|identity)\b/i,
      /\b(buy|sell|take|use)\b.{0,30}\b(illegal drugs?|stolen goods?|fake id)\b/i,
    ],
  },
  {
    category: "physical-dare",
    patterns: [
      /\b(do|perform|complete)\s+(?:\d+\s+|some\s+)?(push[- ]?ups?|sit[- ]?ups?|squats?|burpees?|jumping jacks?)\b/i,
      /\b(hold|stop)\b.{0,20}\b(?:your\s+)?breath\b/i,
      /\b(stand|balance|hop)\b.{0,20}\b(?:on\s+)?(?:one|a single)\s+(leg|foot)\b/i,
      /\b(blindfold yourself|cover your eyes)\b/i,
    ],
  },
  {
    category: "privacy",
    patterns: [/\b(dox|address|phone number|personal data)\b/i],
  },
] as const;

const factDependencies = [
  { pattern: /\b(?:health|hearts?)\b/i, kinds: ["health", "minecraft-health-hearts"] },
  { pattern: /\b(kill|elimination)s?\b/i, kinds: ["kill"] },
  { pattern: /\bknock(?:ed|down)?\b/i, kinds: ["knockdown"] },
  { pattern: /\bloot(?:ing)?\b/i, kinds: ["looting"] },
  { pattern: /\b(final circle|match phase)\b/i, kinds: ["match-phase"] },
  { pattern: /\b(?:hunger|shanks?|food bar)\b/i, kinds: ["minecraft-hunger-shanks"] },
  { pattern: /\b(?:armor|armour)\b/i, kinds: ["minecraft-armor-points"] },
  { pattern: /\b(?:hotbar|selected slot|selected item|held item)\b/i, kinds: ["minecraft-hotbar-visible", "minecraft-selected-hotbar-category"] },
  { pattern: /\b(?:sleep|bed|inventory|crafting table|menu|death screen)\b/i, kinds: ["minecraft-menu-state"] },
  { pattern: /\b(?:mining|mine|building|build|crafting|smelting|farming|fishing|exploring|caving)\b/i, kinds: ["minecraft-activity"] },
  { pattern: /\b(?:danger|safe area|peaceful moment|panic)\b/i, kinds: ["minecraft-danger"] },
  { pattern: /\b(?:recent damage|took damage|take damage|damaged)\b/i, kinds: ["minecraft-recent-damage"] },
  { pattern: /\b(?:fall damage|lava|fire damage|drowning|suffocat|starv|damage cause|mob damage)\b/i, kinds: ["minecraft-likely-damage-cause"] },
  { pattern: /\b(?:skeleton|zombie|creeper|spider|enderman|hostile mob|monster)\b/i, kinds: ["minecraft-visible-hostile"] },
  { pattern: /\b(?:biome|nether|overworld|end dimension|desert|forest|village|cave|ocean)\b/i, kinds: ["minecraft-biome-environment"] },
  { pattern: /\b(?:daytime|nighttime|daylight|sunrise|sunset|dawn|dusk|before night|during the day|at night)\b/i, kinds: ["minecraft-day-night"] },
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
  gameplay: GameplaySnapshot,
  now: number,
): ReadonlyMap<string, readonly string[]> {
  const result = new Map<string, string[]>();
  const supported = new Set(gameplay.capabilities.supportedSignals);
  for (const signal of gameplay.signals) {
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

function safetyAndBoundaryIssues(
  candidate: QuestCandidate,
  profile: StreamerProfile,
): readonly CandidateValidationIssue[] {
  const issues: CandidateValidationIssue[] = [];
  const text = `${candidate.title} ${candidate.instruction} ${candidate.rationale}`;
  const matchedSafetyCategories = safetyRules
    .filter(({ patterns }) => patterns.some((pattern) => pattern.test(text)))
    .map(({ category }) => category);
  if (matchedSafetyCategories.length > 0) {
    issues.push(
      issue(
        "unsafe",
        "reject",
        "Candidate violates the legal, non-harmful, non-wagering, or no-physical-dare safety boundary.",
        matchedSafetyCategories,
      ),
    );
  }

  const restrictions = [...profile.restrictions, ...profile.forbiddenQuestTypes];
  const matchedRestriction = restrictions.find((boundary) => matchesBoundary(text, boundary));
  if (matchedRestriction !== undefined) {
    issues.push(
      issue(
        "streamer-restricted",
        "reject",
        "Candidate conflicts with a saved streamer restriction.",
        [matchedRestriction],
      ),
    );
  }
  const matchedAccessibilityNeed = profile.accessibilityNeeds.find((need) =>
    matchesBoundary(text, need),
  );
  if (matchedAccessibilityNeed !== undefined) {
    issues.push(
      issue(
        "accessibility-conflict",
        "reject",
        "Candidate conflicts with a saved accessibility need.",
        [matchedAccessibilityNeed],
      ),
    );
  }
  return issues;
}

export function validateCandidateAtVoteClose(
  candidateInput: unknown,
  context: VoteCloseCandidateValidationContext,
): CandidateValidationResult {
  const candidate = questCandidateSchema.safeParse(candidateInput);
  const profile = streamerProfileSchema.safeParse(context.profile);
  const currentState = questCycleStateSchema.safeParse(context.currentState);
  if (
    !candidate.success ||
    !profile.success ||
    !currentState.success ||
    !Number.isSafeInteger(context.now) ||
    context.now < 0
  ) {
    return {
      accepted: false,
      candidate: candidate.success ? candidate.data : null,
      issues: [issue("malformed", "reject", "Vote-close candidate or validation context is invalid.")],
    };
  }

  const envelope = {
    ...currentState.data.envelope,
    messageId: `${currentState.data.envelope.messageId}-vote-close-validation`,
    source: "quest-engine" as const,
  };
  const gameplay = gameplaySnapshotSchema.safeParse(
    context.gameplay === null
      ? {
          envelope,
          capabilities: {
            tier: "universal-visual",
            gameId: null,
            adapterId: null,
            supportedSignals: [],
          },
          signals: [],
        }
      : {
          ...context.gameplay,
          envelope: {
            ...context.gameplay.envelope,
            questCycleId:
              context.gameplay.envelope.questCycleId ?? currentState.data.envelope.questCycleId,
            revision: envelope.revision,
          },
        },
  );
  const audience = audienceSnapshotSchema.safeParse(
    context.audience === null
      ? {
          envelope,
          sampleSize: 0,
          signals: [],
        }
      : {
          ...context.audience,
          envelope: {
            ...context.audience.envelope,
            questCycleId:
              context.audience.envelope.questCycleId ?? currentState.data.envelope.questCycleId,
            revision: envelope.revision,
          },
        },
  );
  const intelligence = intelligenceSnapshotSchema.safeParse({
    envelope,
    gameplay: gameplay.success ? gameplay.data : null,
    audience: audience.success ? audience.data : null,
  });
  if (
    !gameplay.success ||
    !audience.success ||
    !intelligence.success ||
    gameplay.data.envelope.evidenceClass !== envelope.evidenceClass ||
    audience.data.envelope.evidenceClass !== envelope.evidenceClass
  ) {
    return {
      accepted: false,
      candidate: candidate.data,
      issues: [issue("malformed", "reject", "Vote-close intelligence context is invalid.")],
    };
  }

  const validationState = questCycleStateSchema.parse({
    ...currentState.data,
    status: "idle",
    activeCandidateId: null,
    availableStreamerActions: [],
    voteTallies: [],
    startsAt: null,
    endsAt: null,
    progress: null,
    result: null,
  });
  return new DefaultCandidateValidator().validate(candidate.data, {
    intelligence: intelligence.data,
    profile: profile.data,
    currentState: validationState,
    recentQuests: context.recentQuests,
    acceptedCandidates: currentState.data.options.filter(
      ({ candidateId }) => candidateId !== candidate.data.candidateId,
    ),
    now: context.now,
  });
}

function freshKnownEvidenceIdsFromSnapshots(
  gameplay: GameplaySnapshot | null,
  audience: AudienceSnapshot | null,
  now: number,
): ReadonlySet<string> {
  const result = new Set<string>();
  for (const [signals, maximumAge] of [
    [gameplay?.signals ?? [], MAXIMUM_SIGNAL_AGE_MILLISECONDS],
    [audience?.signals ?? [], MAXIMUM_AUDIENCE_SIGNAL_AGE_MILLISECONDS],
  ] as const) {
    for (const signal of signals) {
      if (signal.observation.status !== "known") continue;
      const age = now - signal.observation.provenance.observedAt;
      if (
        age >= 0 &&
        age <= maximumAge &&
        signal.observation.provenance.confidence >= MINIMUM_CANDIDATE_CONFIDENCE
      ) {
        result.add(signal.signalId);
      }
    }
  }
  return result;
}

function freshKnownEvidenceIds(
  intelligence: IntelligenceSnapshot,
  now: number,
): ReadonlySet<string> {
  return freshKnownEvidenceIdsFromSnapshots(
    intelligence.gameplay,
    intelligence.audience,
    now,
  );
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
    const issues: CandidateValidationIssue[] = [
      ...safetyAndBoundaryIssues(candidate, context.profile),
    ];
    const text = `${candidate.title} ${candidate.instruction} ${candidate.rationale}`;

    const knownGameplaySignals = knownSignalIdsByKind(context.intelligence.gameplay, context.now);
    const knownEvidenceIds = freshKnownEvidenceIds(context.intelligence, context.now);
    const unsupportedIds = candidate.sourceSignalIds.filter(
      (signalId) => !knownEvidenceIds.has(signalId),
    );
    if (unsupportedIds.length > 0) {
      issues.push(issue("unsupported-evidence", "reject", "Candidate cites stale, unknown, low-confidence, or unsupported evidence.", unsupportedIds));
    }
    const completionRule = candidate.completionRule;
    if (completionRule?.mode === "signal") {
      const predicate = completionRule.predicate;
      const supportedSignals = new Set(
        context.intelligence.gameplay.capabilities.supportedSignals,
      );
      const unsupportedRuleSignals = completionRule.allowedSignalKinds.filter(
        (signalKind) => !supportedSignals.has(signalKind),
      );
      if (
        predicate == null ||
        context.profile.gameId == null ||
        predicate.gameId !== context.profile.gameId ||
        context.intelligence.gameplay.capabilities.gameId !== predicate.gameId ||
        unsupportedRuleSignals.length > 0
      ) {
        issues.push(
          issue(
            "unsupported-completion-rule",
            "reject",
            "Automatic completion requires an explicit predicate for the selected game and supported gameplay capabilities.",
            unsupportedRuleSignals,
          ),
        );
      }
    }
    for (const dependency of factDependencies) {
      if (!dependency.pattern.test(text)) continue;
      const supportingIds = dependency.kinds.flatMap((kind) => [
        ...(knownGameplaySignals.get(kind) ?? []),
      ]);
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

function explicitlyNamesGame(candidate: QuestCandidate, game: SelectedGame): boolean {
  const text = `${candidate.title} ${candidate.instruction}`.toLocaleLowerCase();
  if (text.includes(game.name.toLocaleLowerCase())) return true;
  // Twitch/profile display names may include the Java Edition variant while
  // safe game-aware quest copy uses the established Minecraft product name.
  return game.isMinecraft && /\bminecraft\b/u.test(text);
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

    const selectedGame = selectedGameFrom(profile.data);
    if (selectedGame === null) {
      return {
        ok: false,
        code: "invalid-context",
        reason: "A selected game profile is required for game-aware candidate assembly.",
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
      if (result.accepted && !explicitlyNamesGame(result.candidate, selectedGame)) {
        audit.push({
          candidateId: result.candidate.candidateId,
          source,
          accepted: false,
          issues: [
            ...result.issues,
            issue(
              "game-mismatch",
              "reject",
              "Candidate does not explicitly identify the selected game.",
              [selectedGame.name],
            ),
          ],
        });
        return;
      }
      audit.push({
        candidateId: result.candidate?.candidateId ?? null,
        source,
        accepted: result.accepted,
        issues: result.issues,
      });
      if (result.accepted) accepted.push(result.candidate);
    };

    for (const candidate of input.candidates) {
      if (accepted.length === 3) break;
      validate(candidate, "provided");
    }
    const orderedFallbacks = [...fallbackLibraryFor(selectedGame)].sort((left, right) => {
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
