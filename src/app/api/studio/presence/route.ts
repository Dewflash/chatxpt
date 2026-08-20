import { type NextRequest, NextResponse } from "next/server";

import { readBoundedJson } from "@/app/server/bounded-json";
import { getStudioSessionApplication } from "@/app/server/studio-session";

import {
  STUDIO_SESSION_COOKIE,
  assertSecureStudioRequest,
  studioErrorResponse,
  studioHeaders,
} from "../response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    assertSecureStudioRequest(request);
    const presence = await getStudioSessionApplication().presence(
      request.cookies.get(STUDIO_SESSION_COOKIE)?.value ?? null,
      request.headers.get("authorization"),
      await readBoundedJson(request, 256),
    );
    return NextResponse.json({ ok: true, presence }, { headers: studioHeaders });
  } catch (caught) {
    return studioErrorResponse(caught);
  }
}
