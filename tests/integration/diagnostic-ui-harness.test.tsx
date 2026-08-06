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
const healthEndpoint = "http://localhost/api/health";

const healthReport = {
  ok: true,
  checkedAt: 1_786_200_000_000,
  deployment: "local",
  persistenceMode: "memory",
  services: [
    {
      service: "persistence",
      status: "ready",
      message: "Credential-free in-memory persistence is active for local development",
      retryable: false,
    },
    {
      service: "twitch-app",
      status: "unavailable",
      message: "Twitch application credentials are not configured",
      retryable: false,
    },
    {
      service: "twitch-extension",
      status: "unavailable",
      message: "Twitch Extension credentials are not configured",
      retryable: false,
    },
    {
      service: "obs-overlay",
      status: "unavailable",
      message: "OBS overlay setup key is not configured",
      retryable: false,
    },
  ],
  publicRealtime: null,
  limitations: [
    "Health reports configuration only; it does not prove a live Supabase realtime round trip.",
    "Unavailable Twitch or OBS services require Role 1-owned credentials and setup before live evidence.",
    "No server secrets are included in this response.",
  ],
} as const;

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
        const url = new URL(String(input));
        if (url.pathname === "/api/health") {
          return Response.json(healthReport);
        }
        if (init?.method === "POST") {
          const body = JSON.parse(String(init.body)) as { command: unknown };
          return Response.json(await getDiagnosticUiGateway().executeCommand(body.command));
        }
        const role = urlRole(input);
        return Response.json(await getDiagnosticUiGateway().readSnapshot({
          sessionId: diagnosticUiGatewaySessionId,
          role,
          principalId: diagnosticUiGatewayPrincipals[role],
        }));
      }),
    );

    render(
      <DiagnosticUiHarnessClient
        contractVersion="1.0.0"
        endpoint={endpoint}
        healthEndpoint={healthEndpoint}
        principals={diagnosticUiGatewayPrincipals}
        questCycleId={diagnosticUiGatewayQuestCycleId}
        sessionId={diagnosticUiGatewaySessionId}
      />,
    );

    expect(await screen.findByText("Fixture revision 3")).toBeInTheDocument();
    expect(screen.getByText("FIXTURE / NOT LIVE EVIDENCE")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Environment health" })).toBeInTheDocument();
    expect(screen.getByText("Environment Health")).toBeInTheDocument();
    expect(screen.getByText("Ready")).toBeInTheDocument();
    expect(screen.getByText("local")).toBeInTheDocument();
    expect(screen.getByText("memory")).toBeInTheDocument();
    expect(screen.getByText("persistence: ready")).toBeInTheDocument();
    expect(screen.getByText("twitch-app: unavailable")).toBeInTheDocument();
    expect(screen.getByText(/does not prove a live Supabase realtime round trip/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Vote In Progress" })).toBeInTheDocument();
    expect(screen.getByText("Vote Window")).toBeInTheDocument();
    expect(screen.getByText("Hold Your Ground")).toBeInTheDocument();
    expect(screen.getByText("30s")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Setup Readiness" })).toBeInTheDocument();
    expect(screen.getByText(/r4\.setup\.permission-denied\.v1/)).toBeInTheDocument();
    expect(screen.getByText(/r4\.setup\.misconfigured\.v1/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Intelligence Examples" })).toBeInTheDocument();
    expect(screen.getByText(/r4\.intelligence\.capture-denied\.v1/)).toBeInTheDocument();
    expect(screen.getByText(/r4\.generation\.algorithmic\.v1/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Session History" })).toBeInTheDocument();
    expect(screen.getByText(/2 quests \/ 1 succeeded \/ 3 votes \/ 100 pts/)).toBeInTheDocument();
    expect(screen.getByText(/Raw chat retained: no \/ viewer IDs: hidden/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Quest Examples" })).toBeInTheDocument();
    expect(screen.getByText(/r5\.vote\.tie\.v1/)).toBeInTheDocument();
    expect(screen.getByText(/r5\.quest\.succeeded-reward\.v1/)).toBeInTheDocument();
    expect(screen.getByText("0.50")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Live Config" }));
    await userEvent.click(screen.getByRole("button", { name: "Raise intensity" }));

    expect(await screen.findByText("Fixture revision 4")).toBeInTheDocument();
    expect(await screen.findByText("0.80")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Viewer Board" }));
    expect(screen.getByRole("heading", { name: "Choose A Quest" })).toBeInTheDocument();
    const firstChoice = screen.getAllByRole("article")[0];
    expect(firstChoice.querySelector(".diagnostic-vote-track i")).toHaveStyle({ width: "0%" });
    await userEvent.click(within(firstChoice).getByRole("button", { name: "0 votes" }));

    expect(await screen.findByRole("heading", { name: "Vote Accepted" })).toBeInTheDocument();
    expect(await screen.findByText("Fixture revision 5")).toBeInTheDocument();
    expect(within(firstChoice).getByRole("button", { name: "1 votes" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Overlay" }));
    expect(screen.getByRole("heading", { name: "Hold Your Ground" })).toBeInTheDocument();
  });
});
