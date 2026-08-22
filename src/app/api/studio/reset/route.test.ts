import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { HOSTED_BOARD_COOKIE } from "@/app/api/hosted-board/response";
import { TWITCH_BROADCASTER_CONNECTION_COOKIE } from "@/app/server/twitch-connection-grant";

import { STUDIO_SESSION_COOKIE } from "../response";
import { POST } from "./route";

describe("Studio clean-start reset route", () => {
  it("clears ChatXPT browser cookies even when no Studio session is loaded", async () => {
    const response = await POST(new NextRequest("http://localhost:3000/api/studio/reset", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ cleanStartReset: true }),
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      cleanStartReset: true,
    });
    const cookies = response.headers.getSetCookie().join("\n");
    expect(cookies).toContain(`${STUDIO_SESSION_COOKIE}=`);
    expect(cookies).toContain(`${TWITCH_BROADCASTER_CONNECTION_COOKIE}=`);
    expect(cookies).toContain(`${HOSTED_BOARD_COOKIE}=`);
    expect(cookies).toContain("chatxpt_twitch_oauth_state=");
    expect(cookies).toContain("Max-Age=0");
  });
});
