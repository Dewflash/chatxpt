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

export async function GET(request: Request) {
  try {
    assertSecureGameplayIngressRequest(request);
    const status = await getGameplayIngressApplication().readStatus(
      request.headers.get("authorization"),
    );
    return NextResponse.json({ ok: true, ...status }, { headers: gameplayIngressHeaders });
  } catch (caught) {
    return gameplayIngressErrorResponse(caught);
  }
}

export async function POST(request: Request) {
  try {
    assertSecureGameplayIngressRequest(request);
    const body = await readBoundedJson(request, 128 * 1_024);
    const ingestion = await getGameplayIngressApplication().ingest(
      request.headers.get("authorization"),
      body,
    );
    let status: number;
    if ("reason" in ingestion.result) {
      status = ingestion.result.reason === "session-missing" ? 404 : 409;
    } else {
      status = ingestion.result.status === "accepted" ? 202 : 200;
    }
    return NextResponse.json(
      { ok: ingestion.result.status !== "rejected", ...ingestion },
      { status, headers: gameplayIngressHeaders },
    );
  } catch (caught) {
    return gameplayIngressErrorResponse(caught);
  }
}
