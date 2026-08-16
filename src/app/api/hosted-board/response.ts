import { NextResponse } from "next/server";

import {
  HostedBoardApplicationError,
  type HostedBoardApplicationErrorCode,
} from "@/app/server/hosted-board";
import { BoundedJsonError } from "@/app/server/bounded-json";

export const HOSTED_BOARD_COOKIE = "chatxpt_hosted_board";

export const hostedBoardHeaders = {
  "cache-control": "no-store",
  vary: "Cookie",
};

export function assertSecureHostedBoardRequest(request: Request): void {
  const url = new URL(request.url);
  const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",", 1)[0]?.trim();
  const local =
    url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]";
  if (!local && url.protocol !== "https:" && forwardedProtocol !== "https") {
    throw new HostedBoardApplicationError(
      "forbidden",
      "Hosted Quest Board access requires HTTPS outside the local development host",
    );
  }
}

const statuses: Record<HostedBoardApplicationErrorCode, number> = {
  misconfigured: 503,
  unauthenticated: 401,
  forbidden: 403,
  "session-not-found": 404,
  "session-unavailable": 409,
  "invalid-command": 400,
  "dependency-unavailable": 503,
};

export function hostedBoardErrorResponse(caught: unknown) {
  if (caught instanceof BoundedJsonError) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: caught.kind === "too-large" ? "payload-too-large" : "validation",
          message: caught.message,
          retryable: false,
        },
      },
      { status: caught.kind === "too-large" ? 413 : 400, headers: hostedBoardHeaders },
    );
  }
  if (caught instanceof HostedBoardApplicationError) {
    return NextResponse.json(
      { ok: false, error: { code: caught.code, message: caught.message, retryable: caught.retryable } },
      { status: statuses[caught.code], headers: hostedBoardHeaders },
    );
  }
  return NextResponse.json(
    {
      ok: false,
      error: { code: "internal", message: "Hosted Quest Board request failed", retryable: true },
    },
    { status: 500, headers: hostedBoardHeaders },
  );
}
