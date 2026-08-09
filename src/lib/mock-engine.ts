import type { GenerationRequest, Sidequest } from "./domain";

type QuestDraft = Omit<Sidequest, "id">;

function points(difficulty: Sidequest["difficulty"], intensity: number) {
  const base = difficulty === "hard" ? 500 : difficulty === "medium" ? 300 : 180;
  return base + intensity * 50;
}

function containsBoundary(draft: QuestDraft, boundaries: string[]) {
  const text = `${draft.title} ${draft.instruction}`.toLowerCase();
  return boundaries.some((boundary) => {
    const meaningfulWords = boundary
      .toLowerCase()
      .split(/\W+/)
      .filter((word) => word.length > 4 && !["deliberate", "world", "without"].includes(word));
    return meaningfulWords.some((word) => text.includes(word));
  });
}

export function generateMockSidequests(input: GenerationRequest): Sidequest[] {
  const { gameplay, sentiment, profile } = input;
  const candidates: QuestDraft[] = [];
  const isBrawlStars = /brawl\s*stars/i.test(gameplay.game);

  if (isBrawlStars && gameplay.health <= 40) {
    candidates.push({
      title: "Clutch Reset",
      instruction: "Back out of danger, heal up, then re-enter through cover for the next push.",
      durationSeconds: 60,
      difficulty: "medium",
      rewardPoints: points("medium", profile.intensity),
      rationale: "Low health in Brawl Stars calls for a visible reset instead of feeding another fight.",
    });
  } else if (isBrawlStars && gameplay.phase === "combat") {
    candidates.push({
      title: "Lane Lock",
      instruction: "Hold your lane and land three safe shots before crossing into the objective area.",
      durationSeconds: 60,
      difficulty: "medium",
      rewardPoints: points("medium", profile.intensity),
      rationale: "The live screen shows active movement, so the quest rewards controlled pressure.",
    });
  } else if (isBrawlStars && gameplay.phase === "rotation") {
    candidates.push({
      title: "Objective Pivot",
      instruction: "Rotate to the ball or main objective through cover without taking the first fight.",
      durationSeconds: 45,
      difficulty: "easy",
      rewardPoints: points("easy", profile.intensity),
      rationale: "A transition moment is best served by a clear objective movement challenge.",
    });
  } else if (gameplay.squadStatus === "teammate-knocked") {
    candidates.push({
      title: "Guardian Protocol",
      instruction: "Reach your knocked teammate and keep enemies off them until the revive finishes.",
      durationSeconds: 75,
      difficulty: gameplay.health < 45 ? "hard" : "medium",
      rewardPoints: points(gameplay.health < 45 ? "hard" : "medium", profile.intensity),
      rationale: "The squad needs a rescue while chat is asking for a dramatic team play.",
    });
  } else if (gameplay.health <= 40) {
    candidates.push({
      title: "Clutch Reposition",
      instruction: "Reach defensible cover without starting a new fight, then hold it for 30 seconds.",
      durationSeconds: 60,
      difficulty: "medium",
      rewardPoints: points("medium", profile.intensity),
      rationale: "Low health calls for a visible survival challenge instead of reckless aggression.",
    });
  } else if (gameplay.phase === "final-circle") {
    candidates.push({
      title: "Final Circle Focus",
      instruction: "Call every enemy position you spot and stay with the squad for the next 45 seconds.",
      durationSeconds: 45,
      difficulty: "hard",
      rewardPoints: points("hard", profile.intensity),
      rationale: "The final circle rewards concise communication and disciplined positioning.",
    });
  } else {
    candidates.push({
      title: "First Contact",
      instruction: "Tag an enemy, call their position, and relocate before taking the next shot.",
      durationSeconds: 60,
      difficulty: "medium",
      rewardPoints: points("medium", profile.intensity),
      rationale: "The current phase supports a clear tactical challenge without forcing a specific weapon.",
    });
  }

  if (isBrawlStars && profile.style === "comedic" && profile.allowRoleplay) {
    candidates.push({
      title: "Shoutcaster Push",
      instruction: "Narrate the next push like a Brawl Stars commentator until the fight ends.",
      durationSeconds: 60,
      difficulty: "easy",
      rewardPoints: points("easy", profile.intensity),
      rationale: "The streamer welcomes performance challenges and chat asked for drama.",
    });
  } else if (isBrawlStars && profile.style === "competitive") {
    candidates.push({
      title: "Super Discipline",
      instruction: "Save your super or gadget until it can secure objective pressure, not just damage.",
      durationSeconds: 90,
      difficulty: "hard",
      rewardPoints: points("hard", profile.intensity),
      rationale: "A competitive profile makes resource timing a meaningful, measurable challenge.",
    });
  } else if (profile.style === "comedic" && profile.allowRoleplay) {
    candidates.push({
      title: "Caster Mode",
      instruction: "Narrate the next fight like an overexcited sports commentator until combat ends.",
      durationSeconds: 90,
      difficulty: "easy",
      rewardPoints: points("easy", profile.intensity),
      rationale: "The streamer welcomes role-play and the audience is primed for a performance challenge.",
    });
  } else if (profile.style === "supportive") {
    candidates.push({
      title: "Squad Anchor",
      instruction: "Stay within support range of a teammate and call useful loot for 90 seconds.",
      durationSeconds: 90,
      difficulty: "easy",
      rewardPoints: points("easy", profile.intensity),
      rationale: "This reinforces the streamer's supportive style without disrupting the match.",
    });
  } else if (profile.style === "beginner") {
    candidates.push({
      title: "One Clean Habit",
      instruction: "Before each peek, name your cover and escape route out loud for 60 seconds.",
      durationSeconds: 60,
      difficulty: "easy",
      rewardPoints: points("easy", profile.intensity),
      rationale: "The quest turns a useful beginner habit into visible audience participation.",
    });
  } else {
    candidates.push({
      title: "Precision Window",
      instruction: "Land three controlled hits before reloading or switching weapons.",
      durationSeconds: 75,
      difficulty: profile.style === "competitive" ? "hard" : "medium",
      rewardPoints: points(profile.style === "competitive" ? "hard" : "medium", profile.intensity),
      rationale: "The profile favors a measurable mechanical challenge in the current fight.",
    });
  }

  if (isBrawlStars && sentiment.mood === "chaotic" && profile.intensity >= 2) {
    candidates.push({
      title: "No Panic Super",
      instruction: "Do not use your super for the next fight unless chat counts down from three.",
      durationSeconds: 75,
      difficulty: "medium",
      rewardPoints: points("medium", profile.intensity),
      rationale: "The audience gets chaos without forcing team sabotage or random throwing.",
    });
  } else if (isBrawlStars && (sentiment.mood === "bored" || gameplay.phase === "looting")) {
    candidates.push({
      title: "Objective Sprint",
      instruction: "Commit to the objective within 30 seconds and call the lane you are taking.",
      durationSeconds: 45,
      difficulty: "easy",
      rewardPoints: points("easy", profile.intensity),
      rationale: "A quiet Brawl Stars moment needs a quick, understandable objective prompt.",
    });
  } else if (sentiment.mood === "bored" || gameplay.phase === "looting") {
    candidates.push({
      title: "Loot Lightning",
      instruction: "Finish looting this area and move toward the next objective within 45 seconds.",
      durationSeconds: 45,
      difficulty: "easy",
      rewardPoints: points("easy", profile.intensity),
      rationale: "Audience energy needs a faster transition out of a quiet looting phase.",
    });
  } else if (sentiment.mood === "chaotic" && profile.intensity === 3) {
    candidates.push({
      title: "Sidearm Spotlight",
      instruction: "Use only your sidearm for the next enemy engagement, then return to normal play.",
      durationSeconds: 90,
      difficulty: "hard",
      rewardPoints: points("hard", profile.intensity),
      rationale: "The audience wants chaos and the streamer selected maximum intensity.",
    });
  } else {
    candidates.push({
      title: "Chat's Battle Cry",
      instruction: "Choose one short phrase from chat and shout it before your next committed push.",
      durationSeconds: 60,
      difficulty: "easy",
      rewardPoints: points("easy", profile.intensity),
      rationale: `The ${sentiment.mood} audience gets a direct, low-risk role in the next play.`,
    });
  }

  const safe = candidates.filter((candidate) => !containsBoundary(candidate, profile.boundaries));
  const fallbacks: QuestDraft[] = [
    ...(isBrawlStars
      ? [
          {
            title: "Cover Cooldown",
            instruction: "Use cover between every shot for the next fight instead of walking in a straight line.",
            durationSeconds: 60,
            difficulty: "easy" as const,
            rewardPoints: points("easy", profile.intensity),
            rationale: "A Brawl Stars-safe fallback that improves movement without inventing HUD facts.",
          },
          {
            title: "Lane Callout",
            instruction: "Say which lane you are holding and keep that lane until the next objective change.",
            durationSeconds: 60,
            difficulty: "easy" as const,
            rewardPoints: points("easy", profile.intensity),
            rationale: "A simple objective-aware challenge suited to Brawl Stars matches.",
          },
          {
            title: "Goal Patience",
            instruction: "Do not force the ball or objective alone; wait for one teammate to be nearby first.",
            durationSeconds: 75,
            difficulty: "medium" as const,
            rewardPoints: points("medium", profile.intensity),
            rationale: "A safe team-play challenge without knockdown or revive assumptions.",
          },
        ]
      : [
          {
            title: "Clear Comms",
            instruction: "Make three concise team callouts that identify position, threat, and intended move.",
            durationSeconds: 60,
            difficulty: "easy" as const,
            rewardPoints: points("easy", profile.intensity),
            rationale: "A universally safe option that improves team coordination.",
          },
          {
            title: "Cover to Cover",
            instruction: "Make your next two rotations using visible cover and announce each destination.",
            durationSeconds: 90,
            difficulty: "medium" as const,
            rewardPoints: points("medium", profile.intensity),
            rationale: "A measurable movement challenge suitable for most match states.",
          },
          {
            title: "Squad Compliment",
            instruction: "Celebrate the next helpful teammate action with a specific compliment.",
            durationSeconds: 90,
            difficulty: "easy" as const,
            rewardPoints: points("easy", profile.intensity),
            rationale: "A safe social challenge that builds positive stream energy.",
          },
        ]),
  ];

  for (const fallback of fallbacks) {
    if (safe.length >= 3) break;
    if (!containsBoundary(fallback, profile.boundaries)) safe.push(fallback);
  }

  return safe.slice(0, 3).map((quest, index) => ({
    ...quest,
    id: `mock-${index + 1}-${quest.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
  }));
}
