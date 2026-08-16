import { NextRequest, NextResponse } from "next/server";

import { getStudioSessionApplication } from "@/app/server/studio-session";

import {
  STUDIO_SESSION_COOKIE,
  assertSecureStudioRequest,
  studioErrorResponse,
  studioHeaders,
} from "../response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    assertSecureStudioRequest(request);
    const state = await getStudioSessionApplication().read(
      request.cookies.get(STUDIO_SESSION_COOKIE)?.value ?? null,
      request.headers.get("authorization"),
    );
    return NextResponse.json({ ok: true, ...state }, { headers: studioHeaders });
  } catch (caught) {
    return studioErrorResponse(caught);
  }
}
