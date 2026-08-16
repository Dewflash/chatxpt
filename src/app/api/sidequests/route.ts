import { NextResponse } from "next/server";
import { generationRequestSchema, type GenerationResponse } from "@/lib/domain";
import { generateMockSidequests } from "@/lib/mock-engine";
import {
  generateOpenAISidequests,
  isLegacyOpenAISidequestPathEnabled,
} from "@/lib/openai-engine";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const parsed = generationRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid generation signals.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  if (isLegacyOpenAISidequestPathEnabled()) {
    try {
      const result: GenerationResponse = {
        quests: await generateOpenAISidequests(parsed.data),
        provider: "openai",
      };
      return NextResponse.json(result);
    } catch (error) {
      console.error("OpenAI generation failed; using algorithmic fallback", error instanceof Error ? error.message : error);
      const fallback: GenerationResponse = {
        quests: generateMockSidequests(parsed.data),
        provider: "algorithmic",
        warning: "Live AI was unavailable, so ChatXPT used its credential-free algorithmic engine.",
      };
      return NextResponse.json(fallback);
    }
  }

  const result: GenerationResponse = {
    quests: generateMockSidequests(parsed.data),
    provider: "algorithmic",
  };
  return NextResponse.json(result);
}
