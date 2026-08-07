import { describe, expect, it } from "vitest";

import { demoStudioIntegrationHealthView } from "./demo-integration-health";
import { countByStatus, isDemoReady, statusFromServiceHealth, statusLabel } from "./integration-health-model";

describe("Studio integration health model", () => {
  it("maps service health to owner-approved configured/not-configured statuses", () => {
    expect(statusLabel("configured")).toBe("Configured");
    expect(statusFromServiceHealth({ service: "x", status: "ready", checkedAt: 1, retryable: false })).toBe("configured");
    expect(statusFromServiceHealth({ service: "x", status: "misconfigured", checkedAt: 1, retryable: true })).toBe("not-configured");
    expect(statusFromServiceHealth({ service: "x", status: "unavailable", checkedAt: 1, retryable: true })).toBe("not-ready");
  });

  it("summarises fixture integration state without treating infrastructure as streamer setup", () => {
    const counts = countByStatus(demoStudioIntegrationHealthView.items);

    expect(counts.configured).toBe(1);
    expect(counts.degraded).toBe(4);
    expect(counts["not-configured"]).toBe(3);
    expect(isDemoReady(demoStudioIntegrationHealthView)).toBe(false);
    expect(
      demoStudioIntegrationHealthView.items.filter((item) => !item.streamerFacing).map((item) => item.id),
    ).toContain("vercel");
    expect(
      demoStudioIntegrationHealthView.items.filter((item) => !item.streamerFacing).map((item) => item.id),
    ).toContain("supabase");
  });
});
