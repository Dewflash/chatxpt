import { type NextRequest, NextResponse } from "next/server";

import { STUDIO_SESSION_COOKIE } from "@/app/api/studio/response";
import { readBoundedJson } from "@/app/server/bounded-json";
import { getObsOverlayApplication } from "@/app/server/obs-overlay";
import { getStudioSessionApplication } from "@/app/server/studio-session";

import {
  assertSecureObsOverlayRequest,
  obsOverlayErrorResponse,
  obsOverlayHeaders,
} from "../../obs/overlay/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    assertSecureObsOverlayRequest(request);
    const body = await readBoundedJson(request, 2_048);
    const studio = await getStudioSessionApplication().read(
      request.cookies.get(STUDIO_SESSION_COOKIE)?.value ?? null,
      request.headers.get("authorization"),
    );
    const result = await getObsOverlayApplication().issueLiveDirectorInstallation(
      studio.view.session.broadcasterId,
      new URL(request.url).origin,
      body,
    );
    return NextResponse.json({ ok: true, ...result }, { status: 201, headers: obsOverlayHeaders });
  } catch (caught) {
    return obsOverlayErrorResponse(caught);
  }
}
