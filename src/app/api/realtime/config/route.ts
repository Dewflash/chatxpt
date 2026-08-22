import { NextResponse } from "next/server";

import { realtimePublicConfiguration } from "@/app/server/realtime-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    { ok: true, ...realtimePublicConfiguration() },
    { headers: { "cache-control": "no-store" } },
  );
}
