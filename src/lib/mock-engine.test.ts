import { describe, expect, it } from "vitest";
import { goldenScenario } from "./demo-data";
import { generateMockSidequests } from "./mock-engine";

describe("generateMockSidequests", () => {
  it("always generates exactly three distinct, valid options", () => {
    const quests = generateMockSidequests(goldenScenario);

    expect(quests).toHaveLength(3);
    expect(new Set(quests.map((quest) => quest.title)).size).toBe(3);
    expect(quests.every((quest) => quest.rewardPoints >= 50)).toBe(true);
  });

  it("reacts to a knocked teammate in the golden scenario", () => {
    const quests = generateMockSidequests(goldenScenario);
    expect(quests.some((quest) => quest.title === "Guardian Protocol")).toBe(true);
  });

  it("filters challenge language named in streamer boundaries", () => {
    const quests = generateMockSidequests({
      ...goldenScenario,
      profile: {
        ...goldenScenario.profile,
        boundaries: ["No roleplay or caster narration", "No deliberate team sabotage"],
      },
    });

    expect(quests).toHaveLength(3);
    expect(quests.some((quest) => /caster|narrat/i.test(`${quest.title} ${quest.instruction}`))).toBe(false);
  });
});
