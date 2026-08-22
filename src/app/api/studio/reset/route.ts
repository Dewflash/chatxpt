import { NextRequest, NextResponse } from "next/server";

import { readBoundedJson } from "@/app/server/bounded-json";
import {
  getStudioSessionApplication,
} from "@/app/server/studio-session";
import { HOSTED_BOARD_COOKIE } from "@/app/api/hosted-board/response";
import { TWITCH_BROADCASTER_CONNECTION_COOKIE } from "@/app/server/twitch-connection-grant";
import { streamerServiceCommandSchema } from "@/core";

import {
  STUDIO_SESSION_COOKIE,
  assertSecureStudioRequest,
  studioCorsHeaders,
  studioErrorResponse,
  studioPreflightResponse,
} from "../response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const corsMethods = ["POST", "OPTIONS"] as const;
const TWITCH_OAUTH_STATE_COOKIE = "chatxpt_twitch_oauth_state";

export function OPTIONS(request: NextRequest) {
  return studioPreflightResponse(request, corsMethods);
}

function clearStudioBrowserState(response: NextResponse, request: NextRequest) {
  const local =
    request.nextUrl.hostname === "localhost" || request.nextUrl.hostname === "127.0.0.1";
  const expiredCookie = {
    httpOnly: true,
    sameSite: "strict" as const,
    secure: !local,
    path: "/",
    expires: new Date(0),
    maxAge: 0,
  };
  response.cookies.set(STUDIO_SESSION_COOKIE, "", expiredCookie);
  response.cookies.set(TWITCH_BROADCASTER_CONNECTION_COOKIE, "", expiredCookie);
  response.cookies.set(HOSTED_BOARD_COOKIE, "", expiredCookie);
  response.cookies.set(TWITCH_OAUTH_STATE_COOKIE, "", {
    ...expiredCookie,
    sameSite: "lax",
    path: "/api/twitch/oauth/callback",
  });
}

export async function POST(request: NextRequest) {
  try {
    assertSecureStudioRequest(request);
    const body = await readBoundedJson(request, 32 * 1_024);
    const command = streamerServiceCommandSchema.safeParse(body);

    let result = {};
    if (command.success && command.data.type === "streamer.session" && command.data.action === "end") {
      try {
        result = await getStudioSessionApplication().execute(
          request.cookies.get(STUDIO_SESSION_COOKIE)?.value ?? null,
          request.headers.get("authorization"),
          command.data,
        );
      } catch {
        result = {
          message:
            "This browser was reset to a clean start. No active Studio session could be ended from the current browser state.",
        };
      }
    }

    const response = NextResponse.json(
      { ok: true, ...result, cleanStartReset: true },
      { headers: studioCorsHeaders(request, corsMethods) },
    );
    clearStudioBrowserState(response, request);
    return response;
  } catch (caught) {
    return studioErrorResponse(caught, studioCorsHeaders(request, corsMethods));
  }
}
