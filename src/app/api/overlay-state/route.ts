import { NextResponse } from "next/server";
import { activeQuestSchema, type ActiveQuest } from "@/lib/domain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const stateKey = Symbol.for("chatxpt.demoOverlayState");

type OverlayStateStore = {
  activeQuest: ActiveQuest | null;
  updatedAt: number;
};

const globalStore = globalThis as typeof globalThis & {
  [stateKey]?: OverlayStateStore;
};

function store(): OverlayStateStore {
  globalStore[stateKey] ??= { activeQuest: null, updatedAt: Date.now() };
  return globalStore[stateKey];
}

export async function GET() {
  const current = store();
  return NextResponse.json({
    activeQuest: current.activeQuest,
    updatedAt: current.updatedAt,
  });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const parsed = activeQuestSchema.nullable().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid overlay quest state.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const current = store();
  current.activeQuest = parsed.data;
  current.updatedAt = Date.now();
  return NextResponse.json({
    activeQuest: current.activeQuest,
    updatedAt: current.updatedAt,
  });
}
