import { NextResponse } from "next/server";

import {
  getTwitchExtensionViewerApplication,
  twitchExtensionReactionRequestSchema,
  twitchExtensionVoteRequestSchema,
} from "@/app/server/twitch-extension-viewer";
import {
  applicationErrorResponse,
  twitchExtensionCorsHeaders,
  twitchExtensionOptionsResponse,
} from "../response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const vote = twitchExtensionVoteRequestSchema.safeParse(body);
    const reaction = twitchExtensionReactionRequestSchema.safeParse(body);
    if (!vote.success && !reaction.success) {
      return NextResponse.json(
        {
          ok: false,
          error: { code: "validation", message: "Viewer command is invalid", retryable: false },
        },
        { status: 400, headers: twitchExtensionCorsHeaders },
      );
    }
    const result = vote.success
      ? await getTwitchExtensionViewerApplication().vote(
          request.headers.get("authorization"),
          vote.data,
        )
      : reaction.success
        ? await getTwitchExtensionViewerApplication().react(
            request.headers.get("authorization"),
            reaction.data,
          )
        : null;
    if (result === null) {
      return NextResponse.json(
        {
          ok: false,
          error: { code: "validation", message: "Viewer command is invalid", retryable: false },
        },
        { status: 400, headers: twitchExtensionCorsHeaders },
      );
    }
    const status = result.ok
      ? 200
      : result.error.code === "stale-revision" || result.error.code === "duplicate"
        ? 409
        : result.error.code === "unauthenticated"
          ? 401
          : 400;
    return NextResponse.json(result, { status, headers: twitchExtensionCorsHeaders });
  } catch (caught) {
    return applicationErrorResponse(caught);
  }
}

export function OPTIONS() {
  return twitchExtensionOptionsResponse();
}
