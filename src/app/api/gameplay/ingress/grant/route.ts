import { NextResponse } from "next/server";

import { readBoundedJson } from "@/app/server/bounded-json";
import { getGameplayIngressApplication } from "@/app/server/gameplay-ingress";

import {
  assertSecureGameplayIngressRequest,
  gameplayIngressErrorResponse,
  gameplayIngressHeaders,
} from "../response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertSecureGameplayIngressRequest(request);
    const body = await readBoundedJson(request, 1_024);
    const grant = await getGameplayIngressApplication().issueGrant(
      request.headers.get("x-chatxpt-gameplay-setup-key"),
      body,
    );
    return NextResponse.json({ ok: true, grant }, { status: 201, headers: gameplayIngressHeaders });
  } catch (caught) {
    return gameplayIngressErrorResponse(caught);
  }
}
