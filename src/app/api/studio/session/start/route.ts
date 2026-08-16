import { NextRequest, NextResponse } from "next/server";

import { readBoundedJson } from "@/app/server/bounded-json";
import { getStudioSessionApplication } from "@/app/server/studio-session";

import {
  STUDIO_SESSION_COOKIE,
  assertSecureStudioRequest,
  studioErrorResponse,
  studioHeaders,
} from "../../response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    assertSecureStudioRequest(request);
    const body = await readBoundedJson(request, 4_096);
    const result = await getStudioSessionApplication().start(
      request.headers.get("x-chatxpt-studio-setup-key"),
      body,
    );
    const response = NextResponse.json(
      {
        ok: true,
        view: result.view,
        readiness: result.readiness,
        roomCode: result.roomCode,
      },
      { status: 201, headers: studioHeaders },
    );
    const local = request.nextUrl.hostname === "localhost" || request.nextUrl.hostname === "127.0.0.1";
    response.cookies.set(STUDIO_SESSION_COOKIE, result.grant, {
      httpOnly: true,
      sameSite: "strict",
      secure: !local,
      path: "/",
      expires: new Date(result.expiresAt),
    });
    return response;
  } catch (caught) {
    return studioErrorResponse(caught);
  }
}
