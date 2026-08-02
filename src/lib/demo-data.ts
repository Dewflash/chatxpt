import type { GenerationRequest } from "./domain";

export const goldenScenario: GenerationRequest = {
  gameplay: {
    game: "Battle Royale",
    phase: "combat",
    health: 38,
    squadStatus: "teammate-knocked",
    recentEvent: "under-fire",
  },
  sentiment: {
    energy: 5,
    mood: "hyped",
    request: "Save the teammate and make it dramatic!",
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
  { name: "orbitz", message: "SAVE THEM 😭", tone: "hype" },
  { name: "mei.exe", message: "caster voice or no courage", tone: "teasing" },
  { name: "solace", message: "protect the squad!", tone: "supportive" },
  { name: "pixelprawn", message: "CHAT WE VOTE CHAOS", tone: "chaos" },
] as const;
