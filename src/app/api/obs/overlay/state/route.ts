import { NextResponse } from "next/server";

import { getObsOverlayApplication } from "@/app/server/obs-overlay";

import {
  assertSecureObsOverlayRequest,
  obsOverlayErrorResponse,
  obsOverlayHeaders,
} from "../response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    assertSecureObsOverlayRequest(request);
    const url = new URL(request.url);
    const view = await getObsOverlayApplication().read(
      request.headers.get("authorization"),
      {
        broadcasterId: url.searchParams.get("broadcasterId"),
        sessionId: url.searchParams.get("sessionId"),
      },
    );
    return NextResponse.json({ ok: true, view }, { headers: obsOverlayHeaders });
  } catch (caught) {
    return obsOverlayErrorResponse(caught);
  }
}
