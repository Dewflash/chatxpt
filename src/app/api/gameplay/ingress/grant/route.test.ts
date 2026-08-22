import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { POST } from "./route";

describe("Gameplay ingress grant route", () => {
  it("tells browser capture to open Studio before requesting a grant without auth", async () => {
    const response = await POST(new NextRequest("http://localhost:3000/api/gameplay/ingress/grant", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId: "session-1" }),
    }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: {
        code: "unauthenticated",
        message: "Open Studio first so Gameplay Capture can find the live session",
        retryable: false,
      },
    });
  });
});
