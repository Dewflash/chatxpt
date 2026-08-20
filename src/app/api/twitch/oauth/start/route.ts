import { randomBytes } from "node:crypto";

import { type NextRequest, NextResponse } from "next/server";

import { twitchAuthorizationUrl } from "@/integrations/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TWITCH_OAUTH_STATE_COOKIE = "chatxpt_twitch_oauth_state";

function baseUrl(request: NextRequest): string {
  const configured = process.env.CHATXPT_PUBLIC_BASE_URL?.trim();
  if (configured) return new URL(configured).origin;
  const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",", 1)[0]?.trim();
  const protocol = forwardedProtocol ?? request.nextUrl.protocol.replace(":", "");
  return `${protocol}://${request.headers.get("host") ?? request.nextUrl.host}`;
}

export async function GET(request: NextRequest) {
  const clientId = process.env.TWITCH_CLIENT_ID?.trim() ?? "";
  if (clientId === "") {
    const response = NextResponse.redirect(new URL("/studio?oauth=error&reason=misconfigured", request.url));
    response.headers.set("cache-control", "no-store");
    return response;
  }
  const state = randomBytes(32).toString("base64url");
  const redirectUri = `${baseUrl(request)}/api/twitch/oauth/callback`;
  const response = NextResponse.redirect(twitchAuthorizationUrl({ clientId, redirectUri, state }));
  const local = request.nextUrl.hostname === "localhost" || request.nextUrl.hostname === "127.0.0.1";
  response.cookies.set(TWITCH_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: !local,
    path: "/api/twitch/oauth/callback",
    maxAge: 10 * 60,
  });
  response.headers.set("cache-control", "no-store");
  return response;
}
