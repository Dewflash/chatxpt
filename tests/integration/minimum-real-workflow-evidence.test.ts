import { describe, expect, it } from "vitest";

import {
  MINIMUM_REAL_WORKFLOW_EVIDENCE_DECISION_ID,
  resolveMinimumRealWorkflowEvidence,
  type MinimumRealWorkflowEvidenceReport,
} from "../../src/integrations";

const validReport: MinimumRealWorkflowEvidenceReport = {
  decisionId: MINIMUM_REAL_WORKFLOW_EVIDENCE_DECISION_ID,
  evidenceClass: "real",
  realInputs: {
    ownedOrAuthorizedGameplay: true,
    obsVirtualCameraFrame: true,
    twitchActivity: true,
    noSimulatedInputsPresentedAsLive: true,
    rawFramesEphemeral: true,
    rawChatRetentionCompliant: true,
  },
  extraction: {
    universalVisualSignalsObserved: true,
    calibratedDemoFactKnown: true,
    unknownsLabelled: true,
    provenanceHasConfidenceAndTimestamps: true,
  },
  quest: {
    exactlyThreeRole2Candidates: true,
    exactlyThreeRole3ValidatedOptions: true,
    unsafeImpossibleRejectedOrAbsent: true,
    streamerControlObserved: true,
    terminalOutcome: "succeeded",
  },
  participation: {
    mode: "hosted-board",
    extensionUnavailableLabelled: true,
    twoDistinctViewers: true,
    acceptedVotesCount: 2,
    duplicateOrReconnectCaseObserved: true,
  },
  stateConsistency: {
    sameSessionId: true,
    sameQuestCycleId: true,
    sameRevisionObserved: true,
    observedSurfaces: ["orchestrator", "persistence", "studio", "hosted-board", "obs-overlay"],
    obsOverlayDisplayedWinnerOrActiveQuest: true,
    resultAndRewardDisplayed: true,
  },
  artifacts: [
    { reference: "team-drive-item:golden-real-workflow-01", privacyReviewed: true },
    { reference: "PR #999", privacyReviewed: true },
  ],
};

describe("minimum real workflow evidence gate", () => {
  it("accepts a real hosted-board fallback run when Extension unavailability is labelled", () => {
    const result = resolveMinimumRealWorkflowEvidence(validReport);

    expect(result).toMatchObject({
      ok: true,
      decisionId: MINIMUM_REAL_WORKFLOW_EVIDENCE_DECISION_ID,
      acceptedParticipationMode: "hosted-board",
      requiredSurfaces: ["orchestrator", "persistence", "studio", "hosted-board", "obs-overlay"],
      blockerCodes: [],
    });
    expect(result.limitations.join(" ")).toContain("does not create real evidence");
  });

  it("accepts Twitch Extension participation without requiring a fallback label", () => {
    const result = resolveMinimumRealWorkflowEvidence({
      ...validReport,
      participation: {
        ...validReport.participation,
        mode: "twitch-extension",
        extensionUnavailableLabelled: false,
      },
      stateConsistency: {
        ...validReport.stateConsistency,
        observedSurfaces: ["orchestrator", "persistence", "studio", "twitch-extension", "obs-overlay"],
      },
    });

    expect(result.ok).toBe(true);
    expect(result.acceptedParticipationMode).toBe("twitch-extension");
  });

  it("rejects fixture, memory, or inspection evidence pretending to satisfy the real gate", () => {
    const result = resolveMinimumRealWorkflowEvidence({
      ...validReport,
      evidenceClass: "fixture-only",
    });

    expect(result.ok).toBe(false);
    expect(result.acceptedParticipationMode).toBeNull();
    expect(result.blockerCodes).toContain("minimum-real-workflow-evidence-not-real");
  });

  it("rejects missing real gameplay, Twitch activity, calibrated extraction, and honest unknown handling", () => {
    const result = resolveMinimumRealWorkflowEvidence({
      ...validReport,
      realInputs: {
        ...validReport.realInputs,
        obsVirtualCameraFrame: false,
        twitchActivity: false,
        noSimulatedInputsPresentedAsLive: false,
      },
      extraction: {
        ...validReport.extraction,
        calibratedDemoFactKnown: false,
        unknownsLabelled: false,
      },
    });

    expect(result.ok).toBe(false);
    expect(result.blockerCodes).toEqual(expect.arrayContaining([
      "minimum-real-workflow-missing-obs-frame",
      "minimum-real-workflow-missing-twitch-activity",
      "minimum-real-workflow-simulated-input-claim",
      "minimum-real-workflow-missing-calibrated-demo-fact",
      "minimum-real-workflow-unknowns-not-labelled",
    ]));
  });

  it("rejects incomplete quest and participation evidence", () => {
    const result = resolveMinimumRealWorkflowEvidence({
      ...validReport,
      quest: {
        ...validReport.quest,
        exactlyThreeRole2Candidates: false,
        exactlyThreeRole3ValidatedOptions: false,
        streamerControlObserved: false,
        terminalOutcome: null,
      },
      participation: {
        ...validReport.participation,
        twoDistinctViewers: false,
        acceptedVotesCount: 1,
        duplicateOrReconnectCaseObserved: false,
      },
    });

    expect(result.ok).toBe(false);
    expect(result.blockerCodes).toEqual(expect.arrayContaining([
      "minimum-real-workflow-not-three-role2-candidates",
      "minimum-real-workflow-not-three-validated-options",
      "minimum-real-workflow-missing-streamer-control",
      "minimum-real-workflow-missing-terminal-outcome",
      "minimum-real-workflow-missing-two-viewers",
      "minimum-real-workflow-not-enough-accepted-votes",
      "minimum-real-workflow-missing-duplicate-or-reconnect",
    ]));
  });

  it("rejects fallback participation when Extension unavailability is not labelled", () => {
    const result = resolveMinimumRealWorkflowEvidence({
      ...validReport,
      participation: {
        ...validReport.participation,
        extensionUnavailableLabelled: false,
      },
    });

    expect(result.ok).toBe(false);
    expect(result.blockerCodes).toContain("minimum-real-workflow-fallback-not-labelled");
  });

  it("rejects mismatched revisions, missing OBS overlay, missing surfaces, and unreviewed artifacts", () => {
    const result = resolveMinimumRealWorkflowEvidence({
      ...validReport,
      stateConsistency: {
        ...validReport.stateConsistency,
        sameRevisionObserved: false,
        observedSurfaces: ["orchestrator", "persistence", "studio", "hosted-board"],
        obsOverlayDisplayedWinnerOrActiveQuest: false,
        resultAndRewardDisplayed: false,
      },
      artifacts: [
        { reference: "team-drive-item:golden-real-workflow-01", privacyReviewed: false },
      ],
    });

    expect(result.ok).toBe(false);
    expect(result.blockerCodes).toEqual(expect.arrayContaining([
      "minimum-real-workflow-revision-mismatch",
      "minimum-real-workflow-missing-obs-overlay",
      "minimum-real-workflow-missing-result-reward",
      "minimum-real-workflow-missing-surface-obs-overlay",
      "minimum-real-workflow-artifact-not-privacy-reviewed",
    ]));
  });

  it("rejects duplicate surface reports before resolving evidence", () => {
    expect(() =>
      resolveMinimumRealWorkflowEvidence({
        ...validReport,
        stateConsistency: {
          ...validReport.stateConsistency,
          observedSurfaces: ["orchestrator", "orchestrator", "studio", "hosted-board", "obs-overlay"],
        },
      }),
    ).toThrow("Observed real workflow surfaces must be unique");
  });
});
