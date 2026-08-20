import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { getStudioSessionApplication } from "@/app/server/studio-session";
import { STUDIO_SESSION_COOKIE } from "@/app/api/studio/response";
import { TwitchOAuthClient } from "@/integrations/server";

const TWITCH_OAUTH_STATE_COOKIE = "chatxpt_twitch_oauth_state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function baseUrl(request: Request): string {
  const configured = process.env.CHATXPT_PUBLIC_BASE_URL?.trim();
  if (configured) return new URL(configured).origin;
  const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",", 1)[0]?.trim();
  const requestUrl = new URL(request.url);
  const protocol = forwardedProtocol ?? requestUrl.protocol.replace(":", "");
  return `${protocol}://${request.headers.get("host") ?? requestUrl.host}`;
}

function statesMatch(expected: string | undefined, received: string | null): boolean {
  if (expected === undefined || received === null) return false;
  const left = Buffer.from(expected);
  const right = Buffer.from(received);
  return left.length === right.length && timingSafeEqual(left, right);
}

function failure(request: Request, reason: string) {
  const response = NextResponse.redirect(new URL(`/studio?oauth=error&reason=${reason}`, request.url));
  response.cookies.delete(TWITCH_OAUTH_STATE_COOKIE);
  response.headers.set("cache-control", "no-store");
  return response;
}

function cookieValue(request: Request, name: string): string | undefined {
  const cookie = request.headers.get("cookie") ?? "";
  for (const part of cookie.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return undefined;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const error = url.searchParams.get("error");
  if (error !== null) {
    return failure(request, "denied");
  }
  if (!statesMatch(
    cookieValue(request, TWITCH_OAUTH_STATE_COOKIE),
    url.searchParams.get("state"),
  )) return failure(request, "state");
  const code = url.searchParams.get("code")?.trim() ?? "";
  if (code === "") return failure(request, "code");
  const origin = baseUrl(request);
  try {
    const connection = await new TwitchOAuthClient({
      clientId: process.env.TWITCH_CLIENT_ID ?? "",
      clientSecret: process.env.TWITCH_CLIENT_SECRET ?? "",
      eventSubSecret: process.env.TWITCH_EVENTSUB_SECRET ?? "",
      redirectUri: `${origin}/api/twitch/oauth/callback`,
      eventSubWebhookUrl: `${origin}/api/twitch/eventsub`,
    }).connect(code);
    const result = await getStudioSessionApplication().start(
      process.env.CHATXPT_STUDIO_SETUP_KEY ?? "",
      {
        channelId: connection.broadcasterId,
        displayName: connection.displayName,
        gameId: connection.gameId,
        gameName: connection.gameName,
      },
      true,
    );
    const response = NextResponse.redirect(new URL(
      `/studio?oauth=connected&eventsub=${connection.eventSub.status}`,
      request.url,
    ));
    const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    response.cookies.set(STUDIO_SESSION_COOKIE, result.grant, {
      httpOnly: true,
      sameSite: "strict",
      secure: !local,
      path: "/",
      expires: new Date(result.expiresAt),
    });
    response.cookies.delete(TWITCH_OAUTH_STATE_COOKIE);
    response.headers.set("cache-control", "no-store");
    return response;
  } catch {
    return failure(request, "connection");
  }
}
