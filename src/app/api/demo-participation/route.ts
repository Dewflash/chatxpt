import { NextResponse } from "next/server";
import { z } from "zod";

import { getTwitchExtensionViewerApplication } from "@/app/server/twitch-extension-viewer";
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

const clearRequestSchema = z
  .object({
    type: z.literal("clear"),
  })
  .strict();

const progressRequestSchema = z
  .object({
    type: z.literal("quest-progress"),
    value: z.number().min(0).max(1),
  })
  .strict();

const resultRequestSchema = z
  .object({
    type: z.literal("quest-result"),
    outcome: z.enum(["completed", "failed"]),
  })
  .strict();

const requestSchema = z.discriminatedUnion("type", [
  publishRequestSchema,
  voteRequestSchema,
  clearRequestSchema,
  progressRequestSchema,
  resultRequestSchema,
]);

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
  const current = store();
  try {
    const diagnostic =
      await getTwitchExtensionViewerApplication().readLocalDiagnosticSnapshot();
    if (
      diagnostic !== null &&
      diagnostic.quests.length === 3 &&
      diagnostic.quests.every((quest) => current.quests.some((currentQuest) => currentQuest.id === quest.id))
    ) {
      current.votes = { ...diagnostic.votes };
      current.updatedAt = diagnostic.updatedAt;
    }
  } catch {
    // The legacy control-room poll remains best-effort; the signed EBS is authoritative.
  }
  return NextResponse.json(snapshot(current), { headers: corsHeaders });
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

  if (command.type === "clear") {
    await getTwitchExtensionViewerApplication().clearLocalDiagnosticQuests();
    current.quests = [];
    current.votes = {};
    current.voterChoices = {};
    current.updatedAt = Date.now();
    return NextResponse.json({ ok: true, accepted: true, ...snapshot(current) }, { headers: corsHeaders });
  }

  if (command.type === "publish-quests") {
    try {
      getTwitchExtensionViewerApplication().stageLocalDiagnosticQuests(command.quests);
    } catch (caught) {
      return NextResponse.json(
        {
          error: caught instanceof Error ? caught.message : "Local Twitch diagnostic staging failed.",
        },
        { status: 503, headers: corsHeaders },
      );
    }
    current.quests = command.quests;
    current.votes = Object.fromEntries(command.quests.map((quest) => [quest.id, 0]));
    current.voterChoices = {};
    current.updatedAt = Date.now();
    return NextResponse.json({ ok: true, accepted: true, ...snapshot(current) }, { headers: corsHeaders });
  }

  if (command.type === "quest-progress" || command.type === "quest-result") {
    try {
      const state = await getTwitchExtensionViewerApplication().updateLocalDiagnosticQuest(
        command.type === "quest-progress"
          ? { type: "progress", value: command.value }
          : { type: "result", outcome: command.outcome === "completed" ? "succeed" : "fail" },
      );
      return NextResponse.json(
        {
          ok: true,
          accepted: true,
          questStatus: state.questCycle.status,
          revision: state.session.revision,
          ...snapshot(current),
        },
        { headers: corsHeaders },
      );
    } catch (caught) {
      return NextResponse.json(
        {
          ok: false,
          accepted: false,
          error: caught instanceof Error ? caught.message : "Quest update failed.",
          ...snapshot(current),
        },
        { status: 409, headers: corsHeaders },
      );
    }
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
