import { NextResponse } from "next/server";

import { getTwitchExtensionViewerApplication } from "@/app/server/twitch-extension-viewer";
import {
  applicationErrorResponse,
  twitchExtensionCorsHeaders,
  twitchExtensionOptionsResponse,
} from "../response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const view = await getTwitchExtensionViewerApplication().readViewer(
      request.headers.get("authorization"),
    );
    return NextResponse.json(
      { ok: true, view },
      { headers: twitchExtensionCorsHeaders },
    );
  } catch (caught) {
    return applicationErrorResponse(caught);
  }
}

export function OPTIONS() {
  return twitchExtensionOptionsResponse();
}
