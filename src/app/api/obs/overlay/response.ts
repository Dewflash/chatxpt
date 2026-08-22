import { NextResponse } from "next/server";

import {
  ObsOverlayApplicationError,
  type ObsOverlayApplicationErrorCode,
} from "@/app/server/obs-overlay";
import { BoundedJsonError } from "@/app/server/bounded-json";

export const obsOverlayHeaders = {
  "cache-control": "no-store",
  vary: "Authorization, X-ChatXPT-OBS-Overlay-Setup-Key",
};

export function assertSecureObsOverlayRequest(request: Request): void {
  const url = new URL(request.url);
  const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",", 1)[0]?.trim();
  const local =
    url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]";
  if (!local && url.protocol !== "https:" && forwardedProtocol !== "https") {
    throw new ObsOverlayApplicationError(
      "forbidden",
      "OBS overlay setup and reads require HTTPS outside the local development host",
    );
  }
}

const statuses: Record<ObsOverlayApplicationErrorCode, number> = {
  misconfigured: 503,
  unauthenticated: 401,
  forbidden: 403,
  expired: 401,
  "session-not-found": 404,
  "session-inactive": 409,
  validation: 400,
  "dependency-unavailable": 503,
};

function isObsOverlayApplicationError(caught: unknown): caught is ObsOverlayApplicationError {
  if (caught instanceof ObsOverlayApplicationError) return true;
  if (!(caught instanceof Error)) return false;
  const candidate = caught as Error & { code?: unknown; retryable?: unknown };
  return typeof candidate.code === "string" &&
    Object.prototype.hasOwnProperty.call(statuses, candidate.code) &&
    typeof candidate.retryable === "boolean";
}

export function obsOverlayErrorResponse(caught: unknown) {
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
      { status: caught.kind === "too-large" ? 413 : 400, headers: obsOverlayHeaders },
    );
  }
  if (isObsOverlayApplicationError(caught)) {
    return NextResponse.json(
      { ok: false, error: { code: caught.code, message: caught.message, retryable: caught.retryable } },
      { status: statuses[caught.code], headers: obsOverlayHeaders },
    );
  }
  return NextResponse.json(
    {
      ok: false,
      error: { code: "internal", message: "OBS overlay request could not be completed", retryable: true },
    },
    { status: 500, headers: obsOverlayHeaders },
  );
}
