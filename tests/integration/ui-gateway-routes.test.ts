import { describe, expect, it } from "vitest";

import { getUiGatewayFixture, postUiGatewayCommand } from "../../src/app";

describe("UI gateway diagnostic routes", () => {
  it("serves the fixture snapshot without credentials", async () => {
    const response = await getUiGatewayFixture();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.evidenceClass).toBe("fixture");
    expect(body.routes.fixtureJson).toBe("/api/ui-gateway/fixture");
    expect(body.views.viewer.questCycle.options).toHaveLength(3);
  });

  it("validates a fixture command and rejects stale revisions", async () => {
    const fixtureResponse = await getUiGatewayFixture();
    const fixture = await fixtureResponse.json();
    const command = fixture.commands.viewer[0].command;

    const accepted = await postUiGatewayCommand(
      new Request("http://localhost/api/ui-gateway/commands", {
        method: "POST",
        body: JSON.stringify(command),
      }),
    );
    expect(accepted.status).toBe(200);
    await expect(accepted.json()).resolves.toMatchObject({
      ok: true,
      accepted: false,
      status: "validated-fixture-only",
    });

    const stale = await postUiGatewayCommand(
      new Request("http://localhost/api/ui-gateway/commands", {
        method: "POST",
        body: JSON.stringify({ ...command, expectedRevision: command.expectedRevision - 1 }),
      }),
    );
    expect(stale.status).toBe(409);
    await expect(stale.json()).resolves.toMatchObject({
      ok: false,
      status: "stale-revision",
    });
  });
});
