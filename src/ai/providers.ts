import {
  candidateBatchSchema,
  contractEnvelopeSchema,
  intelligenceSnapshotSchema,
  streamerProfileSchema,
  type CandidateInput,
  type CandidateProvider,
  type IntelligenceInput,
  type IntelligenceProvider,
  type QuestCandidate,
} from "../core";

export interface CandidateGenerationStrategy {
  generate(
    input: CandidateInput,
    signal?: AbortSignal,
  ): Promise<readonly QuestCandidate[]> | readonly QuestCandidate[];
}

function throwIfAborted(signal?: AbortSignal) {
  if (!signal?.aborted) return;
  if (signal.reason instanceof Error) throw signal.reason;
  throw new Error("Operation aborted");
}

function validateRecentQuestTitles(titles: readonly string[]) {
  if (
    !Array.isArray(titles) ||
    titles.some((title) => typeof title !== "string" || title.trim().length === 0 || title.length > 80)
  ) {
    throw new TypeError("recentQuestTitles must contain non-empty titles of at most 80 characters");
  }
  return [...titles];
}

/** Creates the canonical Role 2 intelligence composition boundary. */
export function createValidatingIntelligenceProvider(): IntelligenceProvider {
  return {
    async analyse(input: IntelligenceInput, signal?: AbortSignal) {
      throwIfAborted(signal);
      streamerProfileSchema.parse(input.profile);
      const snapshot = intelligenceSnapshotSchema.parse({
        envelope: contractEnvelopeSchema.parse(input.envelope),
        gameplay: input.gameplay,
        audience: input.audience,
      });
      throwIfAborted(signal);
      return snapshot;
    },
  };
}

/**
 * Wraps an injected Role 2 generation strategy with runtime validation. Role 3
 * still decides whether any candidate is safe, feasible, and eligible to vote.
 */
export function createValidatingCandidateProvider(
  strategy: CandidateGenerationStrategy,
): CandidateProvider {
  return {
    async generate(input: CandidateInput, signal?: AbortSignal) {
      throwIfAborted(signal);
      const safeInput: CandidateInput = {
        envelope: contractEnvelopeSchema.parse(input.envelope),
        intelligence: intelligenceSnapshotSchema.parse(input.intelligence),
        profile: streamerProfileSchema.parse(input.profile),
        recentQuestTitles: validateRecentQuestTitles(input.recentQuestTitles),
      };
      const candidates = await strategy.generate(safeInput, signal);
      throwIfAborted(signal);
      return candidateBatchSchema.parse({
        envelope: safeInput.envelope,
        candidates,
      });
    },
  };
}
