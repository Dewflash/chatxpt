import { z } from "zod";

export const gameplayStateSchema = z.object({
  game: z.string().trim().min(1).max(60),
  phase: z.enum(["looting", "rotation", "combat", "final-circle"]),
  health: z.number().int().min(0).max(100),
  squadStatus: z.enum(["all-up", "teammate-knocked", "last-alive"]),
  recentEvent: z.enum(["quiet", "recent-kill", "missed-shots", "under-fire"]),
});

export const viewerSentimentSchema = z.object({
  energy: z.number().int().min(1).max(5),
  mood: z.enum(["bored", "hyped", "chaotic", "supportive", "teasing"]),
  request: z.string().trim().max(160),
});

export const streamerProfileSchema = z.object({
  displayName: z.string().trim().min(1).max(40),
  style: z.enum(["aggressive", "supportive", "comedic", "beginner", "competitive"]),
  intensity: z.number().int().min(1).max(3),
  allowRoleplay: z.boolean(),
  boundaries: z.array(z.string().trim().min(1).max(80)).max(8),
});

export const generationRequestSchema = z.object({
  gameplay: gameplayStateSchema,
  sentiment: viewerSentimentSchema,
  profile: streamerProfileSchema,
});

export const sidequestSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(3).max(48),
  instruction: z.string().trim().min(8).max(180),
  durationSeconds: z.number().int().min(20).max(180),
  difficulty: z.enum(["easy", "medium", "hard"]),
  rewardPoints: z.number().int().min(50).max(1000),
  rationale: z.string().trim().min(8).max(200),
});

export const sidequestBundleSchema = z.object({
  quests: z.array(sidequestSchema).length(3),
});

export type GameplayState = z.infer<typeof gameplayStateSchema>;
export type ViewerSentiment = z.infer<typeof viewerSentimentSchema>;
export type StreamerProfile = z.infer<typeof streamerProfileSchema>;
export type GenerationRequest = z.infer<typeof generationRequestSchema>;
export type Sidequest = z.infer<typeof sidequestSchema>;

export type GenerationProvider = "mock" | "openai";

export type GenerationResponse = {
  quests: Sidequest[];
  provider: GenerationProvider;
  warning?: string;
};

export type QuestStatus = "active" | "completed" | "failed" | "skipped";

export type ActiveQuest = {
  quest: Sidequest;
  startedAt: number;
  status: QuestStatus;
};
