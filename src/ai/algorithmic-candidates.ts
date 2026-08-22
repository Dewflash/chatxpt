import type { CandidateInput, QuestCandidate } from "../core";
import { ProviderGenerationError } from "./provider-fallback";
import type { CandidateGenerationStrategy } from "./providers";

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

interface SelectedGame {
  readonly name: string;
  readonly isMinecraft: boolean;
}

function displayGameName(gameName: string | null, gameId: string | null): string | null {
  const value = gameName?.trim() || gameId?.trim();
  if (!value) return null;
  return value
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (character) => character.toLocaleUpperCase());
}

function selectedGame(input: CandidateInput): SelectedGame {
  const name = displayGameName(input.profile.gameName, input.profile.gameId);
  if (name === null) {
    throw new ProviderGenerationError(
      "malformed",
      "A selected game profile is required for game-aware candidate generation",
    );
  }
  const identity = `${input.profile.gameId ?? ""} ${input.profile.gameName ?? ""}`.toLocaleLowerCase();
  return { name, isMinecraft: identity.includes("minecraft") };
}

function algorithmicTemplatesFor(game: SelectedGame): readonly AlgorithmicTemplate[] {
  const instructions = game.isMinecraft
    ? {
        plan: "Before your next Minecraft action, explain whether you will build, explore, gather, or craft and why.",
        caster: "Narrate the next 45 seconds of Minecraft like a friendly sports commentator.",
        decision: "Before your next Minecraft action, explain why building, crafting, gathering, or exploring best supports your objective.",
        coach: "Teach viewers one Minecraft tip about building, crafting, resource gathering, or navigation.",
        focus: "For 60 seconds, name each Minecraft action before placing, breaking, crafting, or moving.",
        preview: "State your next three Minecraft actions using building, gathering, crafting, or exploration before acting.",
        positive: "Keep your Minecraft commentary constructive for the next 60 seconds.",
        mentor: "Teach one Minecraft mechanic and show how it informs your next decision within 60 seconds.",
        recap: "Give a dramatic recap of your most recent Minecraft decision in one minute.",
      }
    : {
        plan: `Before your next ${game.name} action, explain what you intend to do and why.`,
        caster: `Narrate the next 45 seconds of ${game.name} like a friendly sports commentator.`,
        decision: `Before your next major ${game.name} action, explain why it supports your objective.`,
        coach: `Teach viewers one useful beginner ${game.name} tip during the next 45 seconds.`,
        focus: `For 60 seconds of ${game.name}, describe one decision at a time before acting.`,
        preview: `State your next three intended ${game.name} actions before carrying them out.`,
        positive: `Keep your ${game.name} commentary constructive for the next 60 seconds.`,
        mentor: `Teach one ${game.name} mechanic and connect it to your next decision within 60 seconds.`,
        recap: `Give a dramatic recap of your most recent ${game.name} decision in one minute.`,
      };
  const rationale = (purpose: string) =>
    `Credential-free ${game.name} fallback ${purpose} without claiming unsupported current state.`;

  return [
    {
      key: "plan-out-loud",
      title: "Plan Out Loud",
      instruction: instructions.plan,
      durationSeconds: 45,
      difficulty: "easy",
      rewardPoints: 100,
      rationale: rationale("creates a measurable planning moment"),
      preferredSignals: ["audience-intent", "audience-repeated-requests"],
    },
    {
      key: "caster-mode",
      title: "Caster Mode",
      instruction: instructions.caster,
      durationSeconds: 45,
      difficulty: "easy",
      rewardPoints: 100,
      rationale: rationale("creates audience-safe commentary"),
      preferredSignals: ["audience-energy"],
    },
    {
      key: "decision-spotlight",
      title: "Decision Spotlight",
      instruction: instructions.decision,
      durationSeconds: 60,
      difficulty: "medium",
      rewardPoints: 200,
      rationale: rationale("rewards clear decision-making"),
      preferredSignals: ["activity-intensity", "audience-intent"],
    },
    {
      key: "audience-coach",
      title: "Audience Coach",
      instruction: instructions.coach,
      durationSeconds: 45,
      difficulty: "easy",
      rewardPoints: 100,
      rationale: rationale("creates a supportive teaching moment"),
      preferredSignals: ["audience-energy", "audience-repeated-requests"],
    },
    {
      key: "calm-focus",
      title: "Calm Focus",
      instruction: instructions.focus,
      durationSeconds: 60,
      difficulty: "easy",
      rewardPoints: 100,
      rationale: rationale("keeps the objective safe under noisy evidence"),
      preferredSignals: ["audience-negative-pressure"],
    },
    {
      key: "three-step-preview",
      title: "Three-Step Preview",
      instruction: instructions.preview,
      durationSeconds: 60,
      difficulty: "medium",
      rewardPoints: 200,
      rationale: rationale("creates a clear completion condition"),
      preferredSignals: ["activity-intensity"],
    },
    {
      key: "positive-commentary",
      title: "Positive Commentary",
      instruction: instructions.positive,
      durationSeconds: 60,
      difficulty: "easy",
      rewardPoints: 100,
      rationale: rationale("lowers risk when chat pressure is negative"),
      preferredSignals: ["audience-negative-pressure"],
    },
    {
      key: "one-minute-mentor",
      title: "One-Minute Mentor",
      instruction: instructions.mentor,
      durationSeconds: 60,
      difficulty: "medium",
      rewardPoints: 200,
      rationale: rationale("turns play into an accessible teaching moment"),
      preferredSignals: ["audience-intent"],
    },
    {
      key: "dramatic-recap",
      title: "Dramatic Recap",
      instruction: instructions.recap,
      durationSeconds: 60,
      difficulty: "medium",
      rewardPoints: 200,
      rationale: rationale("creates a personality-led reflection moment"),
      preferredSignals: ["audience-energy"],
    },
  ];
}

const ROLE3_COMPATIBLE_MINIMUM_SIGNAL_CONFIDENCE = 0.5;
const ROLE3_COMPATIBLE_MAXIMUM_GAMEPLAY_SIGNAL_AGE_MS = 15_000;
const ROLE3_COMPATIBLE_MAXIMUM_AUDIENCE_SIGNAL_AGE_MS = 30_000;

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
  const now = input.envelope.occurredAt;
  for (const [snapshot, maximumAgeMs] of [
    [input.intelligence.gameplay, ROLE3_COMPATIBLE_MAXIMUM_GAMEPLAY_SIGNAL_AGE_MS],
    [input.intelligence.audience, ROLE3_COMPATIBLE_MAXIMUM_AUDIENCE_SIGNAL_AGE_MS],
  ] as const) {
    for (const signal of snapshot.signals) {
      if (signal.observation.status !== "known") continue;
      const ageMs = now - signal.observation.provenance.observedAt;
      if (
        ageMs < 0 ||
        ageMs > maximumAgeMs ||
        signal.observation.provenance.confidence < ROLE3_COMPATIBLE_MINIMUM_SIGNAL_CONFIDENCE ||
        !signalSupportsTemplate(signal.kind, signal.observation.value)
      ) {
        continue;
      }
      byKind.set(signal.kind, [...(byKind.get(signal.kind) ?? []), signal.signalId]);
    }
  }
  return byKind;
}

function signalSupportsTemplate(kind: string, value: string | number | boolean): boolean {
  switch (kind) {
    case "audience-negative-pressure":
    case "audience-repeated-requests":
    case "audience-chat-vote-messages":
      return typeof value === "number" && value > 0;
    case "audience-energy":
      return typeof value === "number" && value >= 0.45;
    case "audience-intent":
      return typeof value === "string" && ["requesting", "cheering", "concerned"].includes(value);
    case "activity-intensity":
      return typeof value === "number" && value >= 0.15;
    default:
      return true;
  }
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
      const game = selectedGame(input);
      const algorithmicTemplates = algorithmicTemplatesFor(game);
      const seed = `${input.envelope.sessionId}:${input.envelope.questCycleId ?? "session"}:${input.envelope.revision}`;
      const recentTitles = new Set(input.recentQuestTitles.map(normaliseTitle));
      const availableSignals = knownSignalIds(input);
      const rotated = rotate(algorithmicTemplates, hash(`${seed}:${game.name}`));
      const ranked = rotated
        .map((template, index) => ({
          template,
          index,
          supportCount: sourceSignalIds(template, availableSignals).length,
        }))
        .sort((left, right) => right.supportCount - left.supportCount || left.index - right.index)
        .map(({ template }) => template);
      const preferred = ranked.filter((template) => !recentTitles.has(normaliseTitle(template.title)));
      const selected = [...preferred, ...ranked].filter(
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
