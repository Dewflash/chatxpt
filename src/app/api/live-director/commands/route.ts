import { NextResponse } from "next/server";

import { readBoundedJson } from "@/app/server/bounded-json";
import { getObsOverlayApplication } from "@/app/server/obs-overlay";

import {
  assertSecureObsOverlayRequest,
  obsOverlayErrorResponse,
  obsOverlayHeaders,
} from "../../obs/overlay/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertSecureObsOverlayRequest(request);
    const url = new URL(request.url);
    const body = await readBoundedJson(request, 8 * 1_024);
    const result = await getObsOverlayApplication().executeLiveDirectorCommand(
      request.headers.get("authorization"),
      url.searchParams.get("broadcasterId"),
      body,
    );
    return NextResponse.json({ ok: true, ...result }, { headers: obsOverlayHeaders });
  } catch (caught) {
    return obsOverlayErrorResponse(caught);
  }
}
