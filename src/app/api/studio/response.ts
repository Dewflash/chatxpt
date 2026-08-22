import { NextResponse } from "next/server";

import { BoundedJsonError } from "@/app/server/bounded-json";
import {
  StudioSessionApplicationError,
  type StudioSessionApplicationErrorCode,
} from "@/app/server/studio-session";

export const STUDIO_SESSION_COOKIE = "chatxpt_studio_session";

export const studioHeaders = {
  "cache-control": "no-store",
  vary: "Authorization, Cookie, Origin, X-ChatXPT-Studio-Setup-Key",
};

type StudioCorsEnvironment = Readonly<{
  TWITCH_EXTENSION_ASSET_ORIGIN?: string;
  TWITCH_EXTENSION_CLIENT_ID?: string;
}>;

function exactOrigin(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (
      (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))) ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    ) return null;
    return url.origin;
  } catch {
    return null;
  }
}

/** Restricts Twitch Asset Hosting CORS to the registered Extension and one exact Local Test origin. */
export function isAllowedStudioCorsOrigin(
  origin: string | null,
  source: StudioCorsEnvironment = {
    TWITCH_EXTENSION_ASSET_ORIGIN: process.env.TWITCH_EXTENSION_ASSET_ORIGIN,
    TWITCH_EXTENSION_CLIENT_ID: process.env.TWITCH_EXTENSION_CLIENT_ID,
  },
): boolean {
  const candidate = exactOrigin(origin);
  if (candidate === null) return false;
  const clientId = source.TWITCH_EXTENSION_CLIENT_ID?.trim() ?? "";
  const hostedOrigin = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/iu.test(clientId)
    ? `https://${clientId.toLowerCase()}.ext-twitch.tv`
    : null;
  const localTestOrigin = exactOrigin(source.TWITCH_EXTENSION_ASSET_ORIGIN);
  return candidate === hostedOrigin || candidate === localTestOrigin;
}

export function studioCorsHeaders(request: Request, allowedMethods: readonly string[]): Headers {
  const headers = new Headers(studioHeaders);
  const origin = request.headers.get("origin");
  if (!isAllowedStudioCorsOrigin(origin)) return headers;
  headers.set("access-control-allow-origin", origin!);
  headers.set("access-control-allow-methods", allowedMethods.join(", "));
  headers.set("access-control-allow-headers", "Authorization, Content-Type");
  headers.set("access-control-max-age", "600");
  return headers;
}

export function studioPreflightResponse(request: Request, allowedMethods: readonly string[]) {
  if (!isAllowedStudioCorsOrigin(request.headers.get("origin"))) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "forbidden-origin",
          message: "This origin is not authorised to control ChatXPT Studio",
          retryable: false,
        },
      },
      { status: 403, headers: studioHeaders },
    );
  }
  return new NextResponse(null, { status: 204, headers: studioCorsHeaders(request, allowedMethods) });
}

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

function isStudioSessionApplicationError(
  caught: unknown,
): caught is StudioSessionApplicationError {
  if (caught instanceof StudioSessionApplicationError) return true;
  if (!(caught instanceof Error)) return false;
  const candidate = caught as Error & { code?: unknown; retryable?: unknown };
  return typeof candidate.code === "string" &&
    Object.prototype.hasOwnProperty.call(statuses, candidate.code) &&
    typeof candidate.retryable === "boolean";
}

export function studioErrorResponse(caught: unknown, headers: HeadersInit = studioHeaders) {
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
      { status: caught.kind === "too-large" ? 413 : 400, headers },
    );
  }
  if (isStudioSessionApplicationError(caught)) {
    return NextResponse.json(
      {
        ok: false,
        error: { code: caught.code, message: caught.message, retryable: caught.retryable },
      },
      { status: statuses[caught.code], headers },
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
    { status: 500, headers },
  );
}
