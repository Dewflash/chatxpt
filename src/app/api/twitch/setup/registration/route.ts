import { NextResponse } from "next/server";

import { resolveTwitchSetupRegistrationManifest } from "../../../../../integrations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function publicBaseUrl(request: Request): string {
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

export async function GET(request: Request) {
  const manifest = resolveTwitchSetupRegistrationManifest(process.env, {
    baseUrl: publicBaseUrl(request),
  });

  return NextResponse.json(manifest, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
