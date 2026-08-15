import type { QuestCandidate } from "../core";
import type { StatusTone } from "../design-system";

export interface QuestGenerationHealth {
  readonly label: string;
  readonly tone: StatusTone;
  readonly detail: string;
}

export function summarizeQuestGeneration(
  options: readonly Pick<QuestCandidate, "generation">[],
): QuestGenerationHealth {
  const methods = new Set(options.map((option) => option.generation.method));
  const hasAi = methods.has("ai-provider");
  const hasAlgorithmic = methods.has("algorithmic");
  const hasFallback = methods.has("deterministic-fallback");

  if (methods.size > 1 && hasFallback) {
    return {
      label: hasAi
        ? "AI + validated replacements"
        : hasAlgorithmic
          ? "Algorithmic + validated replacements"
          : "Mixed candidate routes",
      tone: "warning",
      detail: "This candidate batch includes validated fallback replacements. Review all three options before acting.",
    };
  }

  if (methods.size > 1) {
    return {
      label: "Mixed intelligence routes",
      tone: "warning",
      detail: "This candidate batch combines multiple generation routes. Review all three options before acting.",
    };
  }

  if (hasAi) {
    return {
      label: "AI intelligence active",
      tone: "success",
      detail: "Provider-neutral AI candidate generation is active.",
    };
  }
  if (hasAlgorithmic) {
    return {
      label: "Algorithmic intelligence",
      tone: "info",
      detail: "Provider-neutral algorithmic candidate generation is active.",
    };
  }
  if (hasFallback) {
    return {
      label: "Fallback active",
      tone: "warning",
      detail: "The candidate batch uses the validated deterministic fallback route.",
    };
  }
  return {
    label: "Intelligence unknown",
    tone: "neutral",
    detail: "No candidate-generation route is visible yet.",
  };
}
