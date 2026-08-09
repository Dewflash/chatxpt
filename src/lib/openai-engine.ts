import OpenAI from "openai";
import { sidequestBundleSchema, type GenerationRequest, type Sidequest } from "./domain";

const bundleJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["quests"],
  properties: {
    quests: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "id",
          "title",
          "instruction",
          "durationSeconds",
          "difficulty",
          "rewardPoints",
          "rationale",
        ],
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          instruction: { type: "string" },
          durationSeconds: { type: "integer", minimum: 20, maximum: 180 },
          difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
          rewardPoints: { type: "integer", minimum: 50, maximum: 1000 },
          rationale: { type: "string" },
        },
      },
    },
  },
} as const;

const instructions = `You generate livestream sidequests for an on-screen viewer vote.
Return exactly three distinct, game-appropriate options. Each must be glanceable, measurable, and completable in the current match.
Use gameplay state, viewer sentiment, and streamer profile. Respect every boundary.
First infer the broad game family from the provided game name only: arena action, tactical shooter, battle royale, MOBA/objective, racing, strategy, platformer, or unknown.
If the family is uncertain, use genre-neutral quests based on visible movement, communication, positioning, timing, or streamer performance. Do not invent HUD facts, items, powers, objectives, team states, ranks, maps, or game rules that are not in the input.
Produce one lower-risk stabilising option, one skill/tactical option, and one audience/personality option. The three options must differ in play pattern, not just wording.
Avoid weapon-only challenges unless the input makes weapons clearly appropriate. Avoid team-sabotage, forced throwing, griefing, gambling, and real-world physical dares.
Keep titles under six words and instructions easy to read aloud during gameplay.
Never create dangerous, illegal, sexual, discriminatory, humiliating, monetary, real-world physical, or non-consensual team-sabotage challenges.
Use rationale only for the producer. Use unique short ids.`;

export async function generateOpenAISidequests(input: GenerationRequest): Promise<Sidequest[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");

  const client = new OpenAI({ apiKey });
  const response = await client.responses.create({
    model: process.env.OPENAI_MODEL || "gpt-5.6-terra",
    instructions,
    input: JSON.stringify(input),
    reasoning: { effort: "low" },
    max_output_tokens: 1000,
    store: false,
    text: {
      format: {
        type: "json_schema",
        name: "chatxpt_sidequests",
        strict: true,
        schema: bundleJsonSchema,
      },
    },
  });

  if (!response.output_text) throw new Error("The model returned no sidequest payload");
  return sidequestBundleSchema.parse(JSON.parse(response.output_text)).quests;
}
