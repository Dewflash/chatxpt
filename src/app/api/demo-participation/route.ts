import { NextResponse } from "next/server";
import { z } from "zod";

import { sidequestSchema, type Sidequest } from "@/lib/domain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const stateKey = Symbol.for("chatxpt.demoParticipationState");

const publishRequestSchema = z
  .object({
    type: z.literal("publish-quests"),
    quests: z.array(sidequestSchema).length(3),
  })
  .strict();

const voteRequestSchema = z
  .object({
    type: z.literal("vote"),
    questId: z.string().trim().min(1),
    voterKey: z.string().trim().min(1).max(120),
  })
  .strict();

const requestSchema = z.discriminatedUnion("type", [publishRequestSchema, voteRequestSchema]);

type DemoParticipationState = {
  quests: Sidequest[];
  votes: Record<string, number>;
  voterChoices: Record<string, string>;
  updatedAt: number;
};

const globalStore = globalThis as typeof globalThis & {
  [stateKey]?: DemoParticipationState;
};

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type",
};

function store(): DemoParticipationState {
  globalStore[stateKey] ??= {
    quests: [],
    votes: {},
    voterChoices: {},
    updatedAt: Date.now(),
  };
  return globalStore[stateKey];
}

function snapshot(state: DemoParticipationState) {
  return {
    evidenceClass: "local-demo",
    participationMode: "twitch-extension",
    quests: state.quests,
    votes: state.votes,
    totalVotes: Object.values(state.votes).reduce((total, count) => total + count, 0),
    updatedAt: state.updatedAt,
  };
}

export async function GET() {
  return NextResponse.json(snapshot(store()), { headers: corsHeaders });
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400, headers: corsHeaders },
    );
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid demo participation command.", details: parsed.error.flatten() },
      { status: 400, headers: corsHeaders },
    );
  }

  const command = parsed.data;
  const current = store();

  if (command.type === "publish-quests") {
    current.quests = command.quests;
    current.votes = Object.fromEntries(command.quests.map((quest) => [quest.id, 0]));
    current.voterChoices = {};
    current.updatedAt = Date.now();
    return NextResponse.json({ ok: true, accepted: true, ...snapshot(current) }, { headers: corsHeaders });
  }

  const quest = current.quests.find((candidate) => candidate.id === command.questId);
  if (!quest) {
    return NextResponse.json(
      { ok: false, accepted: false, error: "Quest is not open for voting.", ...snapshot(current) },
      { status: 409, headers: corsHeaders },
    );
  }

  const previousChoice = current.voterChoices[command.voterKey];
  if (previousChoice) {
    return NextResponse.json(
      {
        ok: true,
        accepted: false,
        duplicate: true,
        previousChoice,
        ...snapshot(current),
      },
      { headers: corsHeaders },
    );
  }

  current.voterChoices[command.voterKey] = quest.id;
  current.votes[quest.id] = (current.votes[quest.id] ?? 0) + 1;
  current.updatedAt = Date.now();

  return NextResponse.json(
    {
      ok: true,
      accepted: true,
      duplicate: false,
      questId: quest.id,
      ...snapshot(current),
    },
    { headers: corsHeaders },
  );
}
