import { NextRequest, NextResponse } from "next/server";

import { getStudioSessionApplication } from "@/app/server/studio-session";

import {
  STUDIO_SESSION_COOKIE,
  assertSecureStudioRequest,
  studioCorsHeaders,
  studioErrorResponse,
  studioPreflightResponse,
} from "../response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const corsMethods = ["GET", "OPTIONS"] as const;

export function OPTIONS(request: NextRequest) {
  return studioPreflightResponse(request, corsMethods);
}

export async function GET(request: NextRequest) {
  try {
    assertSecureStudioRequest(request);
    const state = await getStudioSessionApplication().read(
      request.cookies.get(STUDIO_SESSION_COOKIE)?.value ?? null,
      request.headers.get("authorization"),
    );
    return NextResponse.json({ ok: true, ...state }, { headers: studioCorsHeaders(request, corsMethods) });
  } catch (caught) {
    return studioErrorResponse(caught, studioCorsHeaders(request, corsMethods));
  }
}
