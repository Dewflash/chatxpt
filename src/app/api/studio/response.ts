import { NextResponse } from "next/server";

import { BoundedJsonError } from "@/app/server/bounded-json";
import {
  StudioSessionApplicationError,
  type StudioSessionApplicationErrorCode,
} from "@/app/server/studio-session";

export const STUDIO_SESSION_COOKIE = "chatxpt_studio_session";

export const studioHeaders = {
  "cache-control": "no-store",
  vary: "Authorization, Cookie, X-ChatXPT-Studio-Setup-Key",
};

export function assertSecureStudioRequest(request: Request): void {
  const url = new URL(request.url);
  const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",", 1)[0]?.trim();
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]";
  if (!local && url.protocol !== "https:" && forwardedProtocol !== "https") {
    throw new StudioSessionApplicationError(
      "forbidden",
      "Studio authorization requires HTTPS outside the local development host",
    );
  }
}

const statuses: Record<StudioSessionApplicationErrorCode, number> = {
  misconfigured: 503,
  unauthenticated: 401,
  forbidden: 403,
  expired: 401,
  "session-not-found": 404,
  validation: 400,
  "stale-revision": 409,
  duplicate: 409,
  "unavailable-capability": 409,
  "dependency-unavailable": 503,
  internal: 500,
};

export function studioErrorResponse(caught: unknown) {
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
      { status: caught.kind === "too-large" ? 413 : 400, headers: studioHeaders },
    );
  }
  if (caught instanceof StudioSessionApplicationError) {
    return NextResponse.json(
      {
        ok: false,
        error: { code: caught.code, message: caught.message, retryable: caught.retryable },
      },
      { status: statuses[caught.code], headers: studioHeaders },
    );
  }
  return NextResponse.json(
    {
      ok: false,
      error: {
        code: "internal",
        message: "Studio could not complete the request",
        retryable: true,
      },
    },
    { status: 500, headers: studioHeaders },
  );
}
