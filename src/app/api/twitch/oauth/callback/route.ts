import { NextResponse } from "next/server";

import { resolveTwitchSetupReadiness } from "../../../../../integrations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function publicBaseUrl(request: Request): string {
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const setup = resolveTwitchSetupReadiness(process.env, {
    baseUrl: publicBaseUrl(request),
  });
  const hasCode = (url.searchParams.get("code") ?? "").trim().length > 0;
  const hasState = (url.searchParams.get("state") ?? "").trim().length > 0;

  if (!hasCode || !hasState) {
    return NextResponse.json(
      {
        ok: false,
        setup,
        error: {
          code: "validation",
          message: "Twitch OAuth callback requires code and state query parameters.",
          retryable: false,
        },
      },
      { status: 400 },
    );
  }

  if (!setup.ok) {
    return NextResponse.json(
      {
        ok: false,
        setup,
        error: {
          code: "dependency-unavailable",
          message: "Twitch credentials are not fully configured.",
          retryable: false,
        },
      },
      { status: 503 },
    );
  }

  return NextResponse.json(
    {
      ok: false,
      setup,
      error: {
        code: "dependency-unavailable",
        message: "Twitch OAuth token exchange is reserved but not enabled in this build.",
        retryable: false,
      },
    },
    { status: 501 },
  );
}
