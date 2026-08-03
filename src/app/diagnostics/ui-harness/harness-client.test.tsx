// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { contractFixtureStreamerView } from "@/core/testing";

import { HarnessClient } from "./harness-client";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("HarnessClient", () => {
  it("labels fixture evidence and exercises a typed command", async () => {
    const request = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/commands")) {
        const command = JSON.parse(String(init?.body)) as { command: { commandId: string } };
        return new Response(
          JSON.stringify({
            ok: true,
            outcome: "committed",
            commandId: command.command.commandId,
            currentRevision: 1,
            delivery: "published",
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({
          ok: true,
          snapshot: {
            contractVersion: "1.0.0",
            surface: "studio",
            role: "streamer",
            auth: {
              status: "authenticated",
              actorKind: "broadcaster",
              expiresAt: 4_102_444_800_000,
            },
            currentRevision: 0,
            view: contractFixtureStreamerView,
            readiness: {
              evidenceClass: "fixture",
              ready: true,
              services: ["twitch", "obs-capture", "realtime", "intelligence"].map((service) => ({
                service,
                configured: true,
                health: {
                  service,
                  status: "ready",
                  checkedAt: contractFixtureStreamerView.envelope.occurredAt,
                  retryable: false,
                },
                allowedActions: [],
              })),
              blockerCodes: [],
            },
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", request);
    const user = userEvent.setup();

    render(<HarnessClient surface="studio" />);

    expect(await screen.findByText("NOT LIVE EVIDENCE")).toBeInTheDocument();
    expect(await screen.findByText("auth: authenticated")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Send typed sample command" }));
    expect(await screen.findByText("committed: revision 1")).toBeInTheDocument();
    expect(request).toHaveBeenCalledTimes(2);
  });
});
