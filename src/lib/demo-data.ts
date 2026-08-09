import type { GenerationRequest } from "./domain";

export const goldenScenario: GenerationRequest = {
  gameplay: {
    game: "Brawl Stars",
    phase: "combat",
    health: 38,
    squadStatus: "all-up",
    recentEvent: "under-fire",
  },
  sentiment: {
    energy: 5,
    mood: "hyped",
    request: "Make the next push dramatic!",
  },
  profile: {
    displayName: "Dewflash",
    style: "comedic",
    intensity: 2,
    allowRoleplay: true,
    boundaries: ["No deliberate team sabotage", "No real-world dares"],
  },
};

export const sampleChat = [
  { name: "orbitz", message: "PUSH GOAL 😭", tone: "hype" },
  { name: "mei.exe", message: "caster voice or no courage", tone: "teasing" },
  { name: "solace", message: "hold lane and don't feed!", tone: "supportive" },
  { name: "pixelprawn", message: "CHAT WE VOTE CHAOS", tone: "chaos" },
] as const;
