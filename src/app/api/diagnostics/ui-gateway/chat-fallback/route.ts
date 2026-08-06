import { NextResponse } from "next/server";

import {
  DIAGNOSTIC_UI_GATEWAY_REALITY,
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
  const result = await getDiagnosticUiGateway().readChatFallback({
    kind: url.searchParams.get("kind") ?? "poll-open",
    outcome: url.searchParams.get("outcome") ?? undefined,
    winnerTitle: url.searchParams.get("winnerTitle"),
    deliveryStatus: url.searchParams.get("deliveryStatus") ?? "not-attempted",
    deliveredAt:
      url.searchParams.get("deliveredAt") === null
        ? null
        : Number(url.searchParams.get("deliveredAt")),
  });
  return NextResponse.json(
    result,
    { status: result.ok ? 200 : diagnosticUiGatewayStatusFor(result.error) },
  );
}

export async function POST(request: Request) {
  if (!diagnosticsEnabled()) return disabledResponse();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        ok: false,
        reality: DIAGNOSTIC_UI_GATEWAY_REALITY,
        error: {
          code: "validation",
          message: "Request body must be valid JSON.",
          retryable: false,
        },
      },
      { status: 400 },
    );
  }

  const result = await getDiagnosticUiGateway().buildChatAcknowledgement(body);
  return NextResponse.json(
    result,
    { status: result.ok ? 200 : diagnosticUiGatewayStatusFor(result.error) },
  );
}
