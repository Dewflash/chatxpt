import { NextResponse } from "next/server";

import { readBoundedJson } from "@/app/server/bounded-json";
import { getObsOverlayApplication } from "@/app/server/obs-overlay";

import {
  assertSecureObsOverlayRequest,
  obsOverlayErrorResponse,
  obsOverlayHeaders,
} from "../response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertSecureObsOverlayRequest(request);
    const body = await readBoundedJson(request, 2_048);
    const result = await getObsOverlayApplication().issueGrant(
      request.headers.get("x-chatxpt-obs-overlay-setup-key"),
      new URL(request.url).origin,
      body,
    );
    return NextResponse.json({ ok: true, ...result }, { status: 201, headers: obsOverlayHeaders });
  } catch (caught) {
    return obsOverlayErrorResponse(caught);
  }
}
