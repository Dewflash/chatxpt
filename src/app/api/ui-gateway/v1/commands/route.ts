import { NextResponse } from "next/server";

import { uiGatewayDispatchRequestSchema } from "@/core";
import {
  bearerToken,
  diagnosticHarnessEnabled,
  diagnosticUiGateway,
  mutationRequestAllowed,
} from "@/realtime/server";

export const dynamic = "force-dynamic";

function statusFor(result: Awaited<ReturnType<typeof diagnosticUiGateway.dispatch>>): number {
  if (result.ok) return 200;
  switch (result.error.code) {
    case "unauthenticated":
    case "expired":
      return 401;
    case "forbidden":
      return 403;
    case "stale-revision":
    case "duplicate":
      return 409;
    case "dependency-unavailable":
      return 503;
    default:
      return 400;
  }
}

export async function POST(request: Request) {
  if (!diagnosticHarnessEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!mutationRequestAllowed(request)) {
    return NextResponse.json(
      {
        ok: false,
        commandId: null,
        currentRevision: null,
        error: {
          code: "forbidden",
          message: "Command origin or anti-CSRF marker is invalid",
          retryable: false,
        },
      },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = null;
  }
  const parsed = uiGatewayDispatchRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        commandId: null,
        currentRevision: null,
        error: { code: "validation", message: "Command body is invalid", retryable: false },
      },
      { status: 400 },
    );
  }
  const result = await diagnosticUiGateway.dispatch(parsed.data, bearerToken(request));
  return NextResponse.json(result, {
    status: statusFor(result),
    headers: { "cache-control": "no-store" },
  });
}
