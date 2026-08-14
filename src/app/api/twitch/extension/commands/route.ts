import { NextResponse } from "next/server";

import {
  getTwitchExtensionViewerApplication,
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
    const parsed = twitchExtensionVoteRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: { code: "validation", message: "Vote command is invalid", retryable: false },
        },
        { status: 400, headers: twitchExtensionCorsHeaders },
      );
    }
    const result = await getTwitchExtensionViewerApplication().vote(
      request.headers.get("authorization"),
      parsed.data,
    );
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
