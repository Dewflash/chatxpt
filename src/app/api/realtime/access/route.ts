import { type NextRequest, NextResponse } from "next/server";

import { readBoundedJson } from "@/app/server/bounded-json";
import { getHostedBoardApplication } from "@/app/server/hosted-board";
import { getObsOverlayApplication } from "@/app/server/obs-overlay";
import {
  grantRealtimeSnapshotAccess,
  RealtimeAccessError,
  realtimeAccessRequestSchema,
} from "@/app/server/realtime-access";
import { getStudioSessionApplication } from "@/app/server/studio-session";
import { getTwitchExtensionViewerApplication } from "@/app/server/twitch-extension-viewer";
import { HOSTED_BOARD_COOKIE } from "@/app/api/hosted-board/response";
import { STUDIO_SESSION_COOKIE } from "@/app/api/studio/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = { "cache-control": "no-store", vary: "Authorization, Cookie" };

function errorResponse(caught: unknown) {
  const error = caught instanceof RealtimeAccessError
    ? caught
    : new RealtimeAccessError("forbidden", "Realtime access could not be authorised");
  const status = error.code === "unauthenticated" ? 401 : error.code === "forbidden" ? 403 : error.code === "validation" ? 400 : 503;
  return NextResponse.json(
    { ok: false, error: { code: error.code, message: error.message, retryable: error.retryable } },
    { status, headers },
  );
}

export async function POST(request: NextRequest) {
  try {
    const parsed = realtimeAccessRequestSchema.safeParse(await readBoundedJson(request, 1_024));
    if (!parsed.success) throw new RealtimeAccessError("validation", "Realtime access request is invalid");
    const { sessionId, role } = parsed.data;
    const surfaceAuthorization = request.headers.get("x-chatxpt-surface-authorization");
    let authorisedSessionId: string;
    if (role === "streamer") {
      authorisedSessionId = (await getStudioSessionApplication().read(
        request.cookies.get(STUDIO_SESSION_COOKIE)?.value ?? null,
        surfaceAuthorization === null ? null : `Bearer ${surfaceAuthorization}`,
      )).view.session.sessionId;
    } else if (role === "viewer") {
      authorisedSessionId = surfaceAuthorization === null
        ? (await getHostedBoardApplication().read(
            request.cookies.get(HOSTED_BOARD_COOKIE)?.value ?? null,
          )).session.sessionId
        : (await getTwitchExtensionViewerApplication().readViewer(
            `Bearer ${surfaceAuthorization}`,
          )).session.sessionId;
    } else {
      if (surfaceAuthorization === null) {
        throw new RealtimeAccessError("unauthenticated", "Overlay authorization is required");
      }
      authorisedSessionId = (await getObsOverlayApplication().read(
        `Bearer ${surfaceAuthorization}`,
        sessionId,
      )).session.sessionId;
    }
    if (authorisedSessionId !== sessionId) {
      throw new RealtimeAccessError("forbidden", "Realtime access belongs to another session");
    }
    const grant = await grantRealtimeSnapshotAccess({
      authorizationHeader: request.headers.get("authorization"),
      sessionId,
      role,
    });
    return NextResponse.json({ ok: true, ...grant }, { status: 201, headers });
  } catch (caught) {
    return errorResponse(caught);
  }
}
