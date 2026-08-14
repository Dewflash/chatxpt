import { NextResponse } from "next/server";

import {
  GameplayIngressApplicationError,
  type GameplayIngressApplicationErrorCode,
} from "@/app/server/gameplay-ingress";
import { BoundedJsonError } from "@/app/server/bounded-json";

export const gameplayIngressHeaders = {
  "cache-control": "no-store",
  vary: "Authorization, X-ChatXPT-Gameplay-Setup-Key",
};

export function assertSecureGameplayIngressRequest(request: Request): void {
  const url = new URL(request.url);
  const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",", 1)[0]?.trim();
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]";
  if (!local && url.protocol !== "https:" && forwardedProtocol !== "https") {
    throw new GameplayIngressApplicationError(
      "forbidden",
      "Gameplay ingress requires HTTPS outside the local development host",
    );
  }
}

const statuses: Record<GameplayIngressApplicationErrorCode, number> = {
  misconfigured: 503,
  unauthenticated: 401,
  forbidden: 403,
  expired: 401,
  "session-not-found": 404,
  "session-inactive": 409,
  validation: 400,
  "rate-limited": 429,
  "dependency-unavailable": 503,
};

export function gameplayIngressErrorResponse(caught: unknown) {
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
      { status: caught.kind === "too-large" ? 413 : 400, headers: gameplayIngressHeaders },
    );
  }
  if (caught instanceof GameplayIngressApplicationError) {
    return NextResponse.json(
      {
        ok: false,
        error: { code: caught.code, message: caught.message, retryable: caught.retryable },
      },
      { status: statuses[caught.code], headers: gameplayIngressHeaders },
    );
  }
  return NextResponse.json(
    {
      ok: false,
      error: {
        code: "internal",
        message: "Gameplay ingress could not complete the request",
        retryable: true,
      },
    },
    { status: 500, headers: gameplayIngressHeaders },
  );
}
