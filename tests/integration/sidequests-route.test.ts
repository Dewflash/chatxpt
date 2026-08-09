import { afterEach, describe, expect, it, vi } from "vitest";

import { postSidequests } from "../../src/app";

type SidequestRouteBody = {
  provider: string;
  quests: Array<{ title: string; instruction: string }>;
};

describe("sidequest generation route", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("labels the no-credential path as algorithmic and returns exactly three quests", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");

    const response = await postSidequests(
      new Request("http://localhost/api/sidequests", {
        method: "POST",
        body: JSON.stringify({
          gameplay: {
            game: "Mario Kart",
            phase: "combat",
            health: 80,
            squadStatus: "all-up",
            recentEvent: "under-fire",
          },
          sentiment: {
            energy: 4,
            mood: "hyped",
            request: "make it dramatic",
          },
          profile: {
            displayName: "Demo",
            style: "competitive",
            intensity: 2,
            allowRoleplay: true,
            boundaries: ["No deliberate team sabotage"],
          },
        }),
      }),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as SidequestRouteBody;
    expect(body.provider).toBe("algorithmic");
    expect(body.quests).toHaveLength(3);
    expect(body.quests.map((quest) => `${quest.title} ${quest.instruction}`).join(" ")).toMatch(
      /corner|lap|overtake/i,
    );
  });
});
