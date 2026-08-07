import { describe, expect, it } from "vitest";

import {
  CONTROLLED_GAMEPLAY_TEST_DECISION_ID,
  resolveControlledGameplayTestPlan,
  type ControlledGameplayRunReport,
} from "../../src/integrations";

const localRun: ControlledGameplayRunReport = {
  mode: "local-obs-virtual-camera",
  scenario: "brawl-stars-intended",
  ownership: "team-owned",
  teamControlledTwitchChannel: false,
  obsVirtualCameraUsed: true,
  rawGameSceneUsed: true,
  chatxptOverlayExcluded: true,
  annotationsRecordedSeparately: true,
  annotationsFedToExtractor: false,
  rawVideoPersisted: false,
  evidenceResourceIds: ["obs-gameplay-machine", "streamer-desktop-browser", "demo-recording"],
};

const twitchRun: ControlledGameplayRunReport = {
  mode: "team-controlled-twitch-stream",
  scenario: "brawl-stars-intended",
  ownership: "team-owned",
  teamControlledTwitchChannel: true,
  obsVirtualCameraUsed: true,
  rawGameSceneUsed: true,
  chatxptOverlayExcluded: true,
  annotationsRecordedSeparately: true,
  annotationsFedToExtractor: false,
  rawVideoPersisted: false,
  evidenceResourceIds: [
    "obs-gameplay-machine",
    "twitch-broadcaster",
    "streamer-desktop-browser",
    "demo-recording",
  ],
};

describe("controlled gameplay test procedure", () => {
  it("accepts paired local OBS and team-controlled Twitch runs for the same owned scenario", () => {
    const result = resolveControlledGameplayTestPlan({
      decisionId: CONTROLLED_GAMEPLAY_TEST_DECISION_ID,
      runs: [localRun, twitchRun],
    });

    expect(result).toMatchObject({
      ok: true,
      decisionId: CONTROLLED_GAMEPLAY_TEST_DECISION_ID,
      selectedScenario: "brawl-stars-intended",
      requiredRuns: ["local-obs-virtual-camera", "team-controlled-twitch-stream"],
      acceptedRuns: ["local-obs-virtual-camera", "team-controlled-twitch-stream"],
      requiredEvidenceResources: [
        "obs-gameplay-machine",
        "twitch-broadcaster",
        "streamer-desktop-browser",
        "demo-recording",
      ],
      blockerCodes: [],
    });
    expect(result.limitations.join(" ")).toContain("does not create real Twitch or OBS evidence");
  });

  it("requires both local capture and Twitch-delivered capture before the scenario can prove D1-10", () => {
    const result = resolveControlledGameplayTestPlan({
      decisionId: CONTROLLED_GAMEPLAY_TEST_DECISION_ID,
      runs: [localRun],
    });

    expect(result.ok).toBe(false);
    expect(result.acceptedRuns).toEqual(["local-obs-virtual-camera"]);
    expect(result.blockerCodes).toContain("controlled-gameplay-missing-team-controlled-twitch-stream");
  });

  it("rejects unapproved third-party gameplay, answer leakage, and raw video persistence", () => {
    const result = resolveControlledGameplayTestPlan({
      decisionId: CONTROLLED_GAMEPLAY_TEST_DECISION_ID,
      runs: [{
        ...localRun,
        ownership: "third-party-unapproved",
        annotationsFedToExtractor: true,
        rawVideoPersisted: true,
      }, twitchRun],
    });

    expect(result.ok).toBe(false);
    expect(result.blockerCodes).toEqual(expect.arrayContaining([
      "controlled-gameplay-unapproved-third-party",
      "controlled-gameplay-answer-leakage",
      "controlled-gameplay-raw-video-persisted",
    ]));
  });

  it("rejects Twitch stream evidence unless the Twitch channel is team controlled", () => {
    const result = resolveControlledGameplayTestPlan({
      decisionId: CONTROLLED_GAMEPLAY_TEST_DECISION_ID,
      runs: [localRun, { ...twitchRun, teamControlledTwitchChannel: false }],
    });

    expect(result.ok).toBe(false);
    expect(result.blockerCodes).toContain("controlled-gameplay-twitch-channel-not-controlled");
  });

  it("rejects a local OBS run that tries to stand in for the Twitch-stream run", () => {
    const result = resolveControlledGameplayTestPlan({
      decisionId: CONTROLLED_GAMEPLAY_TEST_DECISION_ID,
      runs: [{ ...localRun, teamControlledTwitchChannel: true }, twitchRun],
    });

    expect(result.ok).toBe(false);
    expect(result.blockerCodes).toContain("controlled-gameplay-local-run-claimed-twitch");
  });

  it("rejects plans that swap scenarios between local and Twitch paths", () => {
    const result = resolveControlledGameplayTestPlan({
      decisionId: CONTROLLED_GAMEPLAY_TEST_DECISION_ID,
      runs: [localRun, { ...twitchRun, scenario: "team-owned-pc-action-fallback" }],
    });

    expect(result.ok).toBe(false);
    expect(result.selectedScenario).toBeNull();
    expect(result.blockerCodes).toContain("controlled-gameplay-scenario-mismatch");
  });

  it("rejects reports that attach duplicate evidence resources", () => {
    expect(() =>
      resolveControlledGameplayTestPlan({
        decisionId: CONTROLLED_GAMEPLAY_TEST_DECISION_ID,
        runs: [{
          ...localRun,
          evidenceResourceIds: ["obs-gameplay-machine", "obs-gameplay-machine"],
        }],
      }),
    ).toThrow("Controlled gameplay evidence resources must be unique");
  });
});
