import { NextResponse } from "next/server";

import {
  DIAGNOSTIC_UI_GATEWAY_REALITY,
  getDiagnosticUiGateway,
  diagnosticUiGatewaySessionId,
} from "./gateway";
import type { DomainError } from "../../../../core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function diagnosticsEnabled(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.CHATXPT_ENABLE_DIAGNOSTICS === "true";
}

function statusFor(error: DomainError): number {
  switch (error.code) {
    case "validation":
      return 400;
    case "unauthenticated":
      return 401;
    case "forbidden":
      return 403;
    case "duplicate":
    case "stale-revision":
      return 409;
    case "expired":
      return 410;
    case "dependency-unavailable":
    case "unavailable-capability":
      return 503;
    case "rate-limited":
      return 429;
    case "internal":
      return 500;
  }
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
  const result = await getDiagnosticUiGateway().readSnapshot({
    sessionId: url.searchParams.get("sessionId") ?? diagnosticUiGatewaySessionId,
    role: url.searchParams.get("role"),
    principalId: url.searchParams.get("principalId"),
  });
  return NextResponse.json(result, { status: result.ok ? 200 : statusFor(result.error) });
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

  const command = typeof body === "object" && body !== null && "command" in body ? body.command : body;
  const result = await getDiagnosticUiGateway().executeCommand(command);
  return NextResponse.json(result, { status: result.ok ? 200 : statusFor(result.error) });
}
