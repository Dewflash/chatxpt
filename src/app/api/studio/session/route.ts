import { NextRequest, NextResponse } from "next/server";

import { getStudioSessionApplication } from "@/app/server/studio-session";
import {
  TWITCH_BROADCASTER_CONNECTION_COOKIE,
  TwitchBroadcasterConnectionAuthority,
  studioSessionSecret,
} from "@/app/server/twitch-connection-grant";
import {
  ensureLocalTwitchEventSub,
  shouldUseLocalTwitchEventSub,
} from "@/app/server/twitch-local-eventsub";

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
  const application = getStudioSessionApplication();
  const studioGrant = request.cookies.get(STUDIO_SESSION_COOKIE)?.value ?? null;
  const connectionToken = request.cookies.get(TWITCH_BROADCASTER_CONNECTION_COOKIE)?.value;
  const resumeFromConnectedTwitch = async (createIfMissing: boolean) => {
    if (request.headers.get("authorization") !== null || connectionToken === undefined) return null;
    const connection = new TwitchBroadcasterConnectionAuthority(studioSessionSecret()).verify(
      connectionToken,
    );
    const identity = {
      channelId: connection.broadcasterId,
      displayName: connection.displayName,
      gameId: connection.gameId,
      gameName: connection.gameName,
    };
    const resumed = createIfMissing
      ? await application.startFromVerifiedTwitch(identity)
      : await application.resumeExistingFromVerifiedTwitch(identity);
    if (resumed === null) return null;
    if (shouldUseLocalTwitchEventSub(request.nextUrl.origin)) {
      try {
        await ensureLocalTwitchEventSub(connection.broadcasterId);
      } catch {
        // The authoritative Studio session remains usable while the stored
        // Twitch authorization is retried or Connect Twitch offers recovery.
      }
    }
    const response = NextResponse.json(
      {
        ok: true,
        view: resumed.view,
        readiness: resumed.readiness,
        roomCode: resumed.roomCode,
      },
      { headers: studioCorsHeaders(request, corsMethods) },
    );
    const local = request.nextUrl.hostname === "localhost" || request.nextUrl.hostname === "127.0.0.1";
    response.cookies.set(STUDIO_SESSION_COOKIE, resumed.grant, {
      httpOnly: true,
      sameSite: "strict",
      secure: !local,
      path: "/",
      expires: new Date(resumed.expiresAt),
    });
    return response;
  };
  try {
    assertSecureStudioRequest(request);
    const state = await application.read(studioGrant, request.headers.get("authorization"));
    if (
      connectionToken !== undefined &&
      request.headers.get("authorization") === null &&
      shouldUseLocalTwitchEventSub(request.nextUrl.origin)
    ) {
      try {
        const connection = new TwitchBroadcasterConnectionAuthority(studioSessionSecret()).verify(
          connectionToken,
        );
        void ensureLocalTwitchEventSub(connection.broadcasterId).catch(() => undefined);
      } catch {
        // The normal Studio response remains available while Connect Twitch offers recovery.
      }
    }
    if (state.view.session.status === "ended" || state.view.session.status === "offline") {
      try {
        const resumed = await resumeFromConnectedTwitch(false);
        if (resumed !== null) return resumed;
      } catch {
        // Preserve the terminal session view when no active Twitch session can be resumed.
      }
    }
    return NextResponse.json({ ok: true, ...state }, { headers: studioCorsHeaders(request, corsMethods) });
  } catch (caught) {
    if (request.headers.get("authorization") === null && connectionToken !== undefined) {
      try {
        const resumed = await resumeFromConnectedTwitch(true);
        if (resumed !== null) return resumed;
      } catch {
        // Return the original Studio authorization error when automatic resume cannot recover.
      }
    }
    return studioErrorResponse(caught, studioCorsHeaders(request, corsMethods));
  }
}
