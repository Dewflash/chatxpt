// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  diagnosticUiGatewayPrincipals,
  diagnosticUiGatewayQuestCycleId,
  diagnosticUiGatewaySessionId,
  DiagnosticUiHarnessClient,
  getDiagnosticUiGateway,
  resetDiagnosticUiGateway,
} from "../../src/app";

const endpoint = "http://localhost/api/diagnostics/ui-gateway";

async function readGatewaySnapshot(role: "streamer" | "viewer" | "overlay") {
  const principalId = diagnosticUiGatewayPrincipals[role];
  const result = await getDiagnosticUiGateway().readSnapshot({
    sessionId: diagnosticUiGatewaySessionId,
    role,
    principalId,
  });
  if (!result.ok) throw new Error(result.error.message);
  return result.snapshot;
}

function urlRole(input: RequestInfo | URL): "streamer" | "viewer" | "overlay" {
  const url = new URL(String(input));
  const role = url.searchParams.get("role");
  if (role !== "streamer" && role !== "viewer" && role !== "overlay") {
    throw new Error("Unexpected diagnostic role");
  }
  return role;
}

describe("diagnostic UI harness client", () => {
  beforeEach(() => {
    resetDiagnosticUiGateway();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders fixture surfaces and submits a viewer vote through the gateway command path", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === "POST") {
          const body = JSON.parse(String(init.body)) as { command: unknown };
          return Response.json(await getDiagnosticUiGateway().executeCommand(body.command));
        }
        const role = urlRole(input);
        return Response.json({
          ok: true,
          reality: {
            evidenceClass: "fixture",
            liveInputsUsed: false,
            label: "local diagnostic UI gateway",
          },
          sessionId: diagnosticUiGatewaySessionId,
          role,
          snapshot: await readGatewaySnapshot(role),
        });
      }),
    );

    render(
      <DiagnosticUiHarnessClient
        contractVersion="1.0.0"
        endpoint={endpoint}
        principals={diagnosticUiGatewayPrincipals}
        questCycleId={diagnosticUiGatewayQuestCycleId}
        sessionId={diagnosticUiGatewaySessionId}
      />,
    );

    expect(await screen.findByText("Fixture revision 3")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Vote In Progress" })).toBeInTheDocument();
    expect(screen.getByText("Hold Your Ground")).toBeInTheDocument();
    expect(screen.getByText("30s")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Viewer Board" }));
    expect(screen.getByRole("heading", { name: "Choose A Quest" })).toBeInTheDocument();
    const firstChoice = screen.getAllByRole("article")[0];
    await userEvent.click(within(firstChoice).getByRole("button", { name: "0 votes" }));

    expect(await screen.findByRole("heading", { name: "Vote Accepted" })).toBeInTheDocument();
    expect(await screen.findByText("Fixture revision 4")).toBeInTheDocument();
    expect(within(firstChoice).getByRole("button", { name: "1 votes" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Overlay" }));
    expect(screen.getByRole("heading", { name: "Hold Your Ground" })).toBeInTheDocument();
  });
});
