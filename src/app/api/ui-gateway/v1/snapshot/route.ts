import { NextResponse } from "next/server";

import { uiGatewayReadRequestSchema } from "@/core";
import {
  bearerToken,
  diagnosticHarnessEnabled,
  diagnosticUiGateway,
} from "@/realtime/server";

export const dynamic = "force-dynamic";

function statusFor(result: Awaited<ReturnType<typeof diagnosticUiGateway.read>>): number {
  if (result.ok) return 200;
  if (result.error.code === "unauthenticated" || result.error.code === "expired") return 401;
  if (result.error.code === "forbidden") return 403;
  if (result.error.code === "dependency-unavailable") return 503;
  return 400;
}

export async function GET(request: Request) {
  if (!diagnosticHarnessEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const url = new URL(request.url);
  const parsed = uiGatewayReadRequestSchema.safeParse({
    surface: url.searchParams.get("surface"),
    sessionId: url.searchParams.get("sessionId"),
    scenario: url.searchParams.get("scenario") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: { code: "validation", message: "Snapshot query is invalid", retryable: false },
        currentRevision: null,
      },
      { status: 400 },
    );
  }
  const result = await diagnosticUiGateway.read(parsed.data, bearerToken(request));
  return NextResponse.json(result, {
    status: statusFor(result),
    headers: { "cache-control": "no-store" },
  });
}
