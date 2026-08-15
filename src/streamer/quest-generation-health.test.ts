import { describe, expect, it } from "vitest";

import { candidateGenerationSchema, type QuestCandidate } from "../core";
import { summarizeQuestGeneration } from "./quest-generation-health";

function option(method: QuestCandidate["generation"]["method"]): Pick<QuestCandidate, "generation"> {
  return {
    generation: candidateGenerationSchema.parse({
      method,
      provider: method === "ai-provider" ? "fixture-provider" : null,
      generatedAt: 1_786_020_000_000,
    }),
  };
}

describe("summarizeQuestGeneration", () => {
  it.each([
    ["ai-provider", "AI intelligence active", "success"],
    ["algorithmic", "Algorithmic intelligence", "info"],
    ["deterministic-fallback", "Fallback active", "warning"],
  ] as const)("reports a uniform %s batch", (method, label, tone) => {
    expect(summarizeQuestGeneration([option(method), option(method), option(method)])).toMatchObject({
      label,
      tone,
    });
  });

  it("warns when AI candidates include validated fallback replacements", () => {
    expect(summarizeQuestGeneration([
      option("ai-provider"),
      option("deterministic-fallback"),
      option("ai-provider"),
    ])).toMatchObject({
      label: "AI + validated replacements",
      tone: "warning",
    });
  });

  it("does not hide other mixed generation routes", () => {
    expect(summarizeQuestGeneration([
      option("ai-provider"),
      option("algorithmic"),
      option("ai-provider"),
    ])).toMatchObject({
      label: "Mixed intelligence routes",
      tone: "warning",
    });
  });

  it("keeps a missing candidate route unknown", () => {
    expect(summarizeQuestGeneration([])).toMatchObject({
      label: "Intelligence unknown",
      tone: "neutral",
    });
  });
});
