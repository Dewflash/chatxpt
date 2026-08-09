import { describe, expect, it } from "vitest";

import {
  createFixtureUiGatewaySnapshot,
  uiGatewaySnapshotSchema,
  validateFixtureUiGatewayCommand,
} from "./ui-gateway";

describe("fixture UI gateway", () => {
  it("publishes one browser-safe fixture identity across all role views", () => {
    const snapshot = createFixtureUiGatewaySnapshot();

    expect(uiGatewaySnapshotSchema.safeParse(snapshot).success).toBe(true);
    expect(snapshot.evidenceClass).toBe("fixture");
    expect(snapshot.views.streamer.envelope.sessionId).toBe(snapshot.sessionId);
    expect(snapshot.views.viewer.envelope.sessionId).toBe(snapshot.sessionId);
    expect(snapshot.views.overlay.envelope.sessionId).toBe(snapshot.sessionId);
    expect(snapshot.views.streamer.envelope.revision).toBe(snapshot.revision);
    expect(snapshot.views.viewer.envelope.revision).toBe(snapshot.revision);
    expect(snapshot.views.overlay.envelope.revision).toBe(snapshot.revision);
    expect(snapshot.views.viewer.questCycle.options).toHaveLength(3);
    expect(snapshot.commands.overlay).toEqual([]);
  });

  it("validates a supported fixture command without claiming persistence", () => {
    const snapshot = createFixtureUiGatewaySnapshot();
    const result = validateFixtureUiGatewayCommand(snapshot.commands.viewer[0].command);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.accepted).toBe(false);
      expect(result.status).toBe("validated-fixture-only");
      expect(result.boundary).toContain("real acceptance");
    }
  });

  it("validates supported setup commands and rejects mismatched setup actions", () => {
    const snapshot = createFixtureUiGatewaySnapshot();
    const setupRoute = snapshot.commands.streamer.find(
      (route) => route.command.type === "streamer.setup" && route.command.service === "twitch",
    );
    if (setupRoute === undefined || setupRoute.command.type !== "streamer.setup") {
      throw new Error("missing setup route");
    }

    const accepted = validateFixtureUiGatewayCommand(setupRoute.command);
    const invalid = validateFixtureUiGatewayCommand({
      ...setupRoute.command,
      service: "obs-capture",
    });

    expect(accepted.ok).toBe(true);
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) {
      expect(invalid.status).toBe("invalid");
      expect(invalid.httpStatus).toBe(400);
    }
  });

  it("rejects stale fixture revisions", () => {
    const snapshot = createFixtureUiGatewaySnapshot();
    const result = validateFixtureUiGatewayCommand({
      ...snapshot.commands.streamer[0].command,
      expectedRevision: snapshot.revision - 1,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe("stale-revision");
      expect(result.httpStatus).toBe(409);
    }
  });
});
