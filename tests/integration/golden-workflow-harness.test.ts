import { describe, expect, it } from "vitest";

import { goldenWorkflowDiagnosticGET, runFixtureGoldenWorkflow } from "../../src/app";

describe("Role 1 golden workflow diagnostic harness", () => {
  it("runs the fixture memory workflow from session start through result snapshots", async () => {
    const result = await runFixtureGoldenWorkflow();

    expect(result.ok).toBe(true);
    expect(result.reality).toMatchObject({
      evidenceClass: "fixture",
      liveInputsUsed: false,
      label: "local diagnostic golden workflow",
    });
    expect(result.steps).toEqual([
      expect.objectContaining({ name: "intervention-candidates-submitted", ok: true, questStatus: "proposed" }),
      expect.objectContaining({ name: "streamer-approves-vote", ok: true, questStatus: "voting" }),
      expect.objectContaining({ name: "viewer-one-votes", ok: true, questStatus: "voting" }),
      expect.objectContaining({ name: "viewer-two-votes", ok: true, questStatus: "voting" }),
      expect.objectContaining({ name: "vote-close-scheduler-activates-winner", ok: true, questStatus: "active" }),
      expect.objectContaining({ name: "streamer-updates-progress", ok: true, questStatus: "active" }),
      expect.objectContaining({ name: "streamer-marks-success", ok: true, questStatus: "succeeded" }),
    ]);
    expect(result.final).not.toBeNull();
    if (result.final === null) return;
    expect(result.final.sessionRevision).toBeGreaterThan(0);
    expect(result.final.streamerRevision).toBe(result.final.sessionRevision);
    expect(result.final.viewerRevision).toBe(result.final.sessionRevision);
    expect(result.final.overlayRevision).toBe(result.final.sessionRevision);
    expect(result.final.questStatus).toBe("succeeded");
    expect(result.final.activeCandidateId).toBe("golden-candidate-1");
    expect(result.final.resultOutcome).toBe("succeeded");
    expect(result.final.rewardPointsAwarded).toBe(100);
    expect(result.final.snapshots.streamer.questCycle.status).toBe("succeeded");
    expect(result.final.snapshots.viewer.questCycle.status).toBe("succeeded");
    expect(result.final.snapshots.overlay.questCycle.status).toBe("succeeded");
  });

  it("exposes the same fixture workflow through the local diagnostic route", async () => {
    const response = await goldenWorkflowDiagnosticGET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      reality: {
        evidenceClass: "fixture",
        liveInputsUsed: false,
      },
      final: {
        questStatus: "succeeded",
        streamerRevision: expect.any(Number),
        viewerRevision: expect.any(Number),
        overlayRevision: expect.any(Number),
      },
    });
  });
});
