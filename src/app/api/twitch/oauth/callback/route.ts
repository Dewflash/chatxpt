import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const error = url.searchParams.get("error");
  if (error !== null) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "twitch-oauth-denied",
          message: "Twitch returned an OAuth error before ChatXPT token exchange.",
        },
      },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json(
    {
      ok: false,
      error: {
        code: "twitch-oauth-not-enabled",
        message: "The callback route is reserved. Token exchange is not enabled in this build.",
      },
    },
    { status: 501, headers: { "Cache-Control": "no-store" } },
  );
}
