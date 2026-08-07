import { describe, expect, it } from "vitest";

import {
  assessExtractionEvidenceAsset,
  type ExtractionEvidenceAsset,
} from "./evidence-catalog";

const baseAsset: ExtractionEvidenceAsset = {
  id: "owned-brawl-stars-quiet-clip",
  kind: "gameplay-recording",
  acquisition: "recorded-owned-gameplay",
  source: "obs-virtual-camera",
  storage: "private-team-drive",
  privacyReviewed: true,
  annotationsSeparated: true,
  containsRawPersonalData: false,
  notes: "Team-owned short gameplay recording for Role 2 extraction evaluation.",
};

describe("extraction evidence catalogue", () => {
  it("allows owned gameplay recordings for real extraction evaluation without calling them live", () => {
    expect(assessExtractionEvidenceAsset(baseAsset)).toMatchObject({
      evidenceClass: "diagnostic",
      allowedUses: ["diagnostic-spike", "real-extraction-evaluation"],
      canSupportLiveDemoClaim: false,
      blockers: [],
    });
  });

  it("rejects synthetic fixtures as live extraction proof", () => {
    const assessment = assessExtractionEvidenceAsset({
      ...baseAsset,
      id: "synthetic-motion-fixture",
      acquisition: "synthetic-test-fixture",
      source: "test-fixture",
      storage: "repository-fixture",
      notes: "Synthetic pixels for deterministic component tests.",
    });

    expect(assessment).toMatchObject({
      evidenceClass: "fixture",
      allowedUses: ["fixture-test"],
      canSupportLiveDemoClaim: false,
    });
    expect(assessment.blockers).toContain(
      "Synthetic fixtures prove component behaviour only and cannot support live claims.",
    );
  });

  it("allows a privacy-reviewed live OBS frame to support the live demo claim", () => {
    expect(
      assessExtractionEvidenceAsset({
        ...baseAsset,
        id: "obs-live-frame-smoke",
        kind: "gameplay-frame",
        acquisition: "live-obs",
        storage: "not-stored",
        notes: "Ephemeral OBS Virtual Camera frame consumed by Role 2 sampler.",
      }),
    ).toMatchObject({
      evidenceClass: "live",
      allowedUses: ["diagnostic-spike", "real-extraction-evaluation", "live-demo-proof"],
      canSupportLiveDemoClaim: true,
      blockers: [],
    });
  });

  it("blocks gameplay clips when expected annotations are mixed into analyzer input", () => {
    const assessment = assessExtractionEvidenceAsset({
      ...baseAsset,
      annotationsSeparated: false,
    });

    expect(assessment.canSupportLiveDemoClaim).toBe(false);
    expect(assessment.blockers).toContain(
      "Expected annotations must stay separate from production analyzer inputs.",
    );
  });

  it("blocks unsanitised or privacy-unreviewed chat evidence", () => {
    const assessment = assessExtractionEvidenceAsset({
      ...baseAsset,
      id: "raw-chat-export",
      kind: "chat-transcript",
      acquisition: "recorded-owned-gameplay",
      source: "twitch",
      storage: "local-only",
      privacyReviewed: false,
      annotationsSeparated: true,
      containsRawPersonalData: true,
      notes: "Raw Twitch chat export held locally before sanitisation.",
    });

    expect(assessment.allowedUses).toContain("real-extraction-evaluation");
    expect(assessment.canSupportLiveDemoClaim).toBe(false);
    expect(assessment.blockers).toEqual([
      "Chat transcripts must be sanitised before Role 2 can use them as real audience evidence.",
      "Raw personal data must be removed or kept out of repository evidence before use.",
      "Privacy review is required before the asset can become project evidence.",
    ]);
  });

  it("rejects contradictory synthetic asset metadata", () => {
    expect(() =>
      assessExtractionEvidenceAsset({
        ...baseAsset,
        acquisition: "synthetic-test-fixture",
        source: "obs-virtual-camera",
      }),
    ).toThrow("Synthetic extraction fixtures must use test-fixture as their source");
  });
});
