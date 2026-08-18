import type { CandidateInput, QuestCandidate } from "../core";
import type { CandidateGenerationStrategy } from "./providers";
import { acceptedSignalEvidence } from "./signal-evidence";

interface AlgorithmicTemplate {
  readonly key: string;
  readonly title: string;
  readonly instruction: string;
  readonly durationSeconds: number;
  readonly difficulty: QuestCandidate["difficulty"];
  readonly rewardPoints: number;
  readonly rationale: string;
  readonly preferredSignals: readonly string[];
}

const algorithmicTemplates: readonly AlgorithmicTemplate[] = [
  {
    key: "plan-out-loud",
    title: "Plan Out Loud",
    instruction: "Explain your plan before taking the next major game action.",
    durationSeconds: 45,
    difficulty: "easy",
    rewardPoints: 100,
    rationale: "Credential-free fallback uses a game-neutral planning prompt.",
    preferredSignals: ["audience-intent", "audience-repeated-requests"],
  },
  {
    key: "caster-mode",
    title: "Caster Mode",
    instruction: "Narrate the next 45 seconds like a friendly sports commentator.",
    durationSeconds: 45,
    difficulty: "easy",
    rewardPoints: 100,
    rationale: "Credential-free fallback uses audience-safe commentary without unsupported game facts.",
    preferredSignals: ["audience-energy"],
  },
  {
    key: "decision-spotlight",
    title: "Decision Spotlight",
    instruction: "Explain why you chose your next major action before completing it.",
    durationSeconds: 60,
    difficulty: "medium",
    rewardPoints: 200,
    rationale: "Credential-free fallback rewards clear decision-making under uncertain signals.",
    preferredSignals: ["activity-intensity", "audience-intent"],
  },
  {
    key: "audience-coach",
    title: "Audience Coach",
    instruction: "Share one useful beginner tip during the next 45 seconds.",
    durationSeconds: 45,
    difficulty: "easy",
    rewardPoints: 100,
    rationale: "Credential-free fallback turns audience attention into a supportive teaching moment.",
    preferredSignals: ["audience-energy", "audience-repeated-requests"],
  },
  {
    key: "calm-focus",
    title: "Calm Focus",
    instruction: "Describe one decision at a time for the next 60 seconds.",
    durationSeconds: 60,
    difficulty: "easy",
    rewardPoints: 100,
    rationale: "Credential-free fallback stays safe when gameplay facts are unknown or noisy.",
    preferredSignals: ["audience-negative-pressure"],
  },
  {
    key: "three-step-preview",
    title: "Three-Step Preview",
    instruction: "State your next three intended actions before carrying them out.",
    durationSeconds: 60,
    difficulty: "medium",
    rewardPoints: 200,
    rationale: "Credential-free fallback creates a clear, game-neutral completion condition.",
    preferredSignals: ["activity-intensity"],
  },
  {
    key: "positive-commentary",
    title: "Positive Commentary",
    instruction: "Keep your commentary constructive for the next 60 seconds.",
    durationSeconds: 60,
    difficulty: "easy",
    rewardPoints: 100,
    rationale: "Credential-free fallback lowers risk when chat pressure is negative.",
    preferredSignals: ["audience-negative-pressure"],
  },
  {
    key: "one-minute-mentor",
    title: "One-Minute Mentor",
    instruction: "Teach one general strategy lesson during the next 60 seconds.",
    durationSeconds: 60,
    difficulty: "medium",
    rewardPoints: 200,
    rationale: "Credential-free fallback remains useful across game genres and unknown HUDs.",
    preferredSignals: ["audience-intent"],
  },
] as const;

function normaliseTitle(title: string): string {
  return title.trim().toLocaleLowerCase();
}

function hash(value: string): number {
  let result = 0;
  for (let index = 0; index < value.length; index += 1) {
    result = (result * 31 + value.charCodeAt(index)) >>> 0;
  }
  return result;
}

function rotate<T>(values: readonly T[], offset: number): readonly T[] {
  if (values.length === 0) return values;
  const safeOffset = offset % values.length;
  return [...values.slice(safeOffset), ...values.slice(0, safeOffset)];
}

function knownSignalIds(input: CandidateInput): ReadonlyMap<string, readonly string[]> {
  const byKind = new Map<string, string[]>();
  for (const { signal } of acceptedSignalEvidence(input)) {
    byKind.set(signal.kind, [...(byKind.get(signal.kind) ?? []), signal.signalId]);
  }
  return byKind;
}

function sourceSignalIds(
  template: AlgorithmicTemplate,
  availableSignals: ReadonlyMap<string, readonly string[]>,
): readonly string[] {
  const ids = [];
  for (const kind of template.preferredSignals) {
    ids.push(...(availableSignals.get(kind) ?? []));
    if (ids.length >= 3) break;
  }
  return ids.slice(0, 3);
}

function confidenceFor(template: AlgorithmicTemplate, signalIds: readonly string[]): number {
  const base = template.difficulty === "medium" ? 0.58 : 0.62;
  return Math.min(0.82, base + signalIds.length * 0.05);
}

export function createAlgorithmicCandidateStrategy(): CandidateGenerationStrategy {
  return {
    generate(input) {
      const recentTitles = new Set(input.recentQuestTitles.map(normaliseTitle));
      const availableSignals = knownSignalIds(input);
      const rotated = rotate(
        algorithmicTemplates,
        hash(`${input.envelope.sessionId}:${input.envelope.questCycleId ?? "session"}:${input.envelope.revision}`),
      );
      const preferred = rotated.filter((template) => !recentTitles.has(normaliseTitle(template.title)));
      const selected = [...preferred, ...rotated].filter(
        (template, index, candidates) =>
          candidates.findIndex((candidate) => candidate.key === template.key) === index,
      ).slice(0, 3);

      return selected.map((template, index): QuestCandidate => {
        const signalIds = sourceSignalIds(template, availableSignals);
        return {
          candidateId: `algorithmic-${template.key}-${input.envelope.revision}-${index + 1}`,
          title: template.title,
          instruction: template.instruction,
          durationSeconds: template.durationSeconds,
          difficulty: template.difficulty,
          rewardPoints: template.rewardPoints,
          rationale: template.rationale,
          sourceSignalIds: [...signalIds],
          confidence: confidenceFor(template, signalIds),
          generation: {
            method: "algorithmic",
            provider: null,
            generatedAt: input.envelope.occurredAt,
          },
        };
      });
    },
  };
}
