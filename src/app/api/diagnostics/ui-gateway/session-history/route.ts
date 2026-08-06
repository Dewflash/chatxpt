import { NextResponse } from "next/server";

import {
  DIAGNOSTIC_UI_GATEWAY_REALITY,
  diagnosticUiGatewayBroadcasterId,
  diagnosticUiGatewayStatusFor,
  getDiagnosticUiGateway,
} from "../gateway";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function diagnosticsEnabled(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.CHATXPT_ENABLE_DIAGNOSTICS === "true";
}

function disabledResponse() {
  return NextResponse.json(
    {
      ok: false,
      reality: DIAGNOSTIC_UI_GATEWAY_REALITY,
      error: "Diagnostic fixture routes are disabled in production.",
    },
    { status: 404 },
  );
}

export async function GET(request: Request) {
  if (!diagnosticsEnabled()) return disabledResponse();

  const url = new URL(request.url);
  const result = await getDiagnosticUiGateway().readSessionHistory({
    broadcasterId: url.searchParams.get("broadcasterId") ?? diagnosticUiGatewayBroadcasterId,
    limit: url.searchParams.get("limit") ?? undefined,
  });
  return NextResponse.json(
    result,
    { status: result.ok ? 200 : diagnosticUiGatewayStatusFor(result.error) },
  );
}
