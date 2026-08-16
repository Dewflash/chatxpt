import { NextResponse } from "next/server";

import { BoundedJsonError, readBoundedText } from "@/app/server/bounded-json";
import { getTwitchChatApplication } from "@/app/server/twitch-chat";
import {
  TwitchEventSubError,
  parseTwitchEventSubMessage,
  verifyTwitchEventSubMessage,
} from "@/integrations/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = { "cache-control": "no-store" };

function secure(request: Request): boolean {
  const url = new URL(request.url);
  const forwarded = request.headers.get("x-forwarded-proto")?.split(",", 1)[0]?.trim();
  const local =
    url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]";
  return local || url.protocol === "https:" || forwarded === "https";
}

export async function POST(request: Request) {
  if (!secure(request)) {
    return NextResponse.json(
      { ok: false, error: { code: "forbidden", message: "Twitch EventSub requires HTTPS" } },
      { status: 403, headers },
    );
  }
  try {
    const rawBody = await readBoundedText(request, 64 * 1_024);
    const occurredAt = verifyTwitchEventSubMessage({
      messageId: request.headers.get("twitch-eventsub-message-id"),
      messageTimestamp: request.headers.get("twitch-eventsub-message-timestamp"),
      messageSignature: request.headers.get("twitch-eventsub-message-signature"),
      rawBody,
      secret: process.env.TWITCH_EVENTSUB_SECRET ?? "",
    });
    const payload = parseTwitchEventSubMessage(
      rawBody,
      request.headers.get("twitch-eventsub-message-type"),
    );
    if (payload.kind === "challenge") {
      return new Response(payload.challenge, {
        status: 200,
        headers: { ...headers, "content-type": "text/plain; charset=utf-8" },
      });
    }
    if (payload.kind === "chat-message") {
      await getTwitchChatApplication().ingest({
        broadcasterId: payload.broadcasterId,
        chatterId: payload.chatterId,
        messageId: payload.messageId,
        text: payload.text,
        occurredAt,
        receivedAt: Math.max(Date.now(), occurredAt),
      });
    }
    return new Response(null, { status: 204, headers });
  } catch (caught) {
    const status = caught instanceof TwitchEventSubError
      ? caught.code === "misconfigured"
        ? 503
        : 403
      : caught instanceof BoundedJsonError
        ? caught.kind === "too-large" ? 413 : 400
        : 503;
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: caught instanceof TwitchEventSubError ? caught.code : "invalid-request",
          message: caught instanceof Error ? caught.message : "Twitch EventSub request failed",
        },
      },
      { status, headers },
    );
  }
}
