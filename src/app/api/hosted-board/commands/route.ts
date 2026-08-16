import { type NextRequest, NextResponse } from "next/server";

import { readBoundedJson } from "@/app/server/bounded-json";
import {
  getHostedBoardApplication,
  hostedBoardReactionRequestSchema,
  hostedBoardVoteRequestSchema,
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
    const body = await readBoundedJson(request, 2_048);
    const vote = hostedBoardVoteRequestSchema.safeParse(body);
    const reaction = hostedBoardReactionRequestSchema.safeParse(body);
    if (!vote.success && !reaction.success) {
      return NextResponse.json(
        { ok: false, error: { code: "validation", message: "Viewer command is invalid", retryable: false } },
        { status: 400, headers: hostedBoardHeaders },
      );
    }
    const token = request.cookies.get(HOSTED_BOARD_COOKIE)?.value ?? null;
    const result = vote.success
      ? await getHostedBoardApplication().vote(token, vote.data)
      : await getHostedBoardApplication().react(token, reaction.data);
    const status = result.ok
      ? 200
      : result.error.code === "stale-revision" || result.error.code === "duplicate"
        ? 409
        : result.error.code === "unauthenticated"
          ? 401
          : 400;
    return NextResponse.json(result, { status, headers: hostedBoardHeaders });
  } catch (caught) {
    return hostedBoardErrorResponse(caught);
  }
}
