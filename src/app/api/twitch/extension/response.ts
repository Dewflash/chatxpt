import { NextResponse } from "next/server";

import {
  TwitchExtensionViewerApplicationError,
  type TwitchExtensionViewerApplicationErrorCode,
} from "@/app/server/twitch-extension-viewer";

export const twitchExtensionCorsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "authorization, content-type",
  "access-control-max-age": "86400",
  "cache-control": "no-store",
  vary: "Authorization",
};

const statuses: Record<TwitchExtensionViewerApplicationErrorCode, number> = {
  unauthenticated: 401,
  misconfigured: 503,
  "session-not-found": 404,
  "session-unavailable": 409,
  "invalid-command": 400,
  "dependency-unavailable": 503,
};

export function applicationErrorResponse(caught: unknown) {
  if (caught instanceof TwitchExtensionViewerApplicationError) {
    return NextResponse.json(
      {
        ok: false,
        error: { code: caught.code, message: caught.message, retryable: caught.retryable },
      },
      { status: statuses[caught.code], headers: twitchExtensionCorsHeaders },
    );
  }
  return NextResponse.json(
    {
      ok: false,
      error: {
        code: "internal",
        message: "The Twitch Extension service could not complete this request",
        retryable: true,
      },
    },
    { status: 500, headers: twitchExtensionCorsHeaders },
  );
}

export function twitchExtensionOptionsResponse() {
  return new Response(null, { status: 204, headers: twitchExtensionCorsHeaders });
}
