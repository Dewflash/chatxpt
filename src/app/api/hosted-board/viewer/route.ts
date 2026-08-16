import { type NextRequest, NextResponse } from "next/server";

import { getHostedBoardApplication } from "@/app/server/hosted-board";

import {
  HOSTED_BOARD_COOKIE,
  assertSecureHostedBoardRequest,
  hostedBoardErrorResponse,
  hostedBoardHeaders,
} from "../response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    assertSecureHostedBoardRequest(request);
    const view = await getHostedBoardApplication().read(
      request.cookies.get(HOSTED_BOARD_COOKIE)?.value ?? null,
    );
    return NextResponse.json({ ok: true, view }, { headers: hostedBoardHeaders });
  } catch (caught) {
    return hostedBoardErrorResponse(caught);
  }
}
