import { type NextRequest, NextResponse } from "next/server";

import { readBoundedJson } from "@/app/server/bounded-json";
import {
  getHostedBoardApplication,
  hostedBoardAccessRequestSchema,
} from "@/app/server/hosted-board";

import {
  HOSTED_BOARD_COOKIE,
  assertSecureHostedBoardRequest,
  hostedBoardErrorResponse,
  hostedBoardHeaders,
} from "../response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    assertSecureHostedBoardRequest(request);
    const body = await readBoundedJson(request, 1_024);
    const parsed = hostedBoardAccessRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: { code: "validation", message: "Room code is invalid", retryable: false } },
        { status: 400, headers: hostedBoardHeaders },
      );
    }
    const opened = await getHostedBoardApplication().open(
      parsed.data.roomCode,
      request.cookies.get(HOSTED_BOARD_COOKIE)?.value ?? null,
    );
    const response = NextResponse.json(
      { ok: true, roomCode: opened.roomCode, expiresAt: opened.expiresAt },
      { status: 201, headers: hostedBoardHeaders },
    );
    const url = new URL(request.url);
    response.cookies.set(HOSTED_BOARD_COOKIE, opened.token, {
      httpOnly: true,
      secure: url.hostname !== "localhost" && url.hostname !== "127.0.0.1" && url.hostname !== "[::1]",
      sameSite: "strict",
      path: "/",
      maxAge: Math.max(1, Math.floor((opened.expiresAt - Date.now()) / 1_000)),
    });
    return response;
  } catch (caught) {
    return hostedBoardErrorResponse(caught);
  }
}
