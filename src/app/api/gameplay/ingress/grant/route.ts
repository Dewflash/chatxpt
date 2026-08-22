import { type NextRequest, NextResponse } from "next/server";

import { readBoundedJson } from "@/app/server/bounded-json";
import { getGameplayIngressApplication } from "@/app/server/gameplay-ingress";
import { getStudioSessionApplication } from "@/app/server/studio-session";
import { STUDIO_SESSION_COOKIE } from "@/app/api/studio/response";

import {
  assertSecureGameplayIngressRequest,
  gameplayIngressErrorResponse,
  gameplayIngressHeaders,
} from "../response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    assertSecureGameplayIngressRequest(request);
    const body = await readBoundedJson(request, 1_024);
    const cookieGrant = request.cookies.get(STUDIO_SESSION_COOKIE)?.value ?? null;
    const setupKey = request.headers.get("x-chatxpt-gameplay-setup-key");
    const application = getGameplayIngressApplication();
    const grant = cookieGrant !== null || request.headers.has("authorization")
      ? await application.issueGrantForStudio(
          body,
          (await getStudioSessionApplication().read(
            cookieGrant,
            request.headers.get("authorization"),
          )).view.session.sessionId,
        )
      : await application.issueGrant(setupKey, body);
    return NextResponse.json({ ok: true, grant }, { status: 201, headers: gameplayIngressHeaders });
  } catch (caught) {
    return gameplayIngressErrorResponse(caught);
  }
}
