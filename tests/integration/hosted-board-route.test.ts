import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { HostedBoardAccessShell } from "../../src/app";
import type { HostedBoardAccessResult } from "../../src/realtime";

describe("hosted board route shell", () => {
  it("renders a ready hosted-board access result without exposing private viewer state", () => {
    const access: HostedBoardAccessResult = {
      status: "granted",
      roomCode: "ABCDEFGH",
      sessionId: "fixture-session",
      revision: 4,
      viewRole: "viewer",
      expiresAt: 1_786_300_600_000,
      viewerPath: "/quest-board/ABCDEFGH",
      share: {
        roomCode: "ABCDEFGH",
        viewerPath: "/quest-board/ABCDEFGH",
        qrPayload: "/quest-board/ABCDEFGH",
      },
    };

    const html = renderToStaticMarkup(createElement(HostedBoardAccessShell, { access }));

    expect(html).toContain("Viewer board ready");
    expect(html).toContain("ABCDEFGH");
    expect(html).toContain("fixture-session");
    expect(html).toContain("/quest-board/ABCDEFGH");
    expect(html).not.toContain("acceptedCandidateId");
    expect(html).not.toContain("sessionPoints");
  });

  it("renders hosted-board error states as recovery text", () => {
    const access: HostedBoardAccessResult = {
      status: "not-found",
      roomCode: "ABCDEFGH",
      retryable: false,
      message: "No active ChatXPT session was found for that room code.",
    };

    const html = renderToStaticMarkup(createElement(HostedBoardAccessShell, { access }));

    expect(html).toContain("Quest board not found");
    expect(html).toContain("ABCDEFGH");
    expect(html).toContain("not-found");
    expect(html).toContain("No active ChatXPT session was found");
  });
});
