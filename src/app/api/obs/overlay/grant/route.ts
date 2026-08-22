import { type NextRequest, NextResponse } from "next/server";

import { readBoundedJson } from "@/app/server/bounded-json";
import { getObsOverlayApplication } from "@/app/server/obs-overlay";
import { getStudioSessionApplication } from "@/app/server/studio-session";
import { STUDIO_SESSION_COOKIE } from "@/app/api/studio/response";

import {
  assertSecureObsOverlayRequest,
  obsOverlayErrorResponse,
  obsOverlayHeaders,
} from "../response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    assertSecureObsOverlayRequest(request);
    const body = await readBoundedJson(request, 2_048);
    const cookieGrant = request.cookies.get(STUDIO_SESSION_COOKIE)?.value ?? null;
    const setupKey = request.headers.get("x-chatxpt-obs-overlay-setup-key");
    const application = getObsOverlayApplication();
    const result = cookieGrant !== null || request.headers.has("authorization")
      ? await application.issueGrantForStudio(
          new URL(request.url).origin,
          body,
          (await getStudioSessionApplication().read(
            cookieGrant,
            request.headers.get("authorization"),
          )).view.session.sessionId,
        )
      : await application.issueGrant(setupKey, new URL(request.url).origin, body);
    return NextResponse.json({ ok: true, ...result }, { status: 201, headers: obsOverlayHeaders });
  } catch (caught) {
    return obsOverlayErrorResponse(caught);
  }
}
