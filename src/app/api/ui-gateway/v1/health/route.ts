import { NextResponse } from "next/server";

import {
  diagnosticHarnessEnabled,
  diagnosticUiGateway,
} from "@/realtime/server";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!diagnosticHarnessEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(await diagnosticUiGateway.health(), {
    headers: { "cache-control": "no-store" },
  });
}
