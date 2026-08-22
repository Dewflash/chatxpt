import { NextRequest, NextResponse } from "next/server";

import { readBoundedJson } from "@/app/server/bounded-json";
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

const corsMethods = ["POST", "OPTIONS"] as const;

export function OPTIONS(request: NextRequest) {
  return studioPreflightResponse(request, corsMethods);
}

export async function POST(request: NextRequest) {
  try {
    assertSecureStudioRequest(request);
    const body = await readBoundedJson(request, 32 * 1_024);
    const result = await getStudioSessionApplication().execute(
      request.cookies.get(STUDIO_SESSION_COOKIE)?.value ?? null,
      request.headers.get("authorization"),
      body,
    );
    return NextResponse.json({ ok: true, ...result }, { headers: studioCorsHeaders(request, corsMethods) });
  } catch (caught) {
    return studioErrorResponse(caught, studioCorsHeaders(request, corsMethods));
  }
}
