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
