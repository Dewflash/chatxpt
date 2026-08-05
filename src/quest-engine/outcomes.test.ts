import { describe, expect, it } from "vitest";

import { intelligenceSnapshotSchema, questProgressSchema } from "../core";
import { DEFAULT_COOLDOWN_MILLISECONDS } from "./intervention";
import {
  AUTOMATIC_PROGRESS_MINIMUM_CONFIDENCE,
  decideAutomaticProgress,
  decideManualProgress,
  decideQuestOutcome,
} from "./outcomes";
import {
  ROLE_3_FIXTURE_TIME,
  role3FixtureCandidateBatch,
  role3FixtureIdleState,
} from "./testing";

const activeCandidate = role3FixtureCandidateBatch.candidates[0];

function intelligence(
  patch: {
    status?: "known" | "unknown";
    confidence?: number;
    observedAt?: number;
    supportedSignals?: string[];
  } = {},
) {
  const envelope = {
    ...role3FixtureIdleState.envelope,
    messageId: "role-3-progress-intelligence",
  };
  const status = patch.status ?? "known";
  const provenance = {
    source: "test-fixture" as const,
    method: "fixture-progress-signal",
    confidence: patch.confidence ?? AUTOMATIC_PROGRESS_MINIMUM_CONFIDENCE,
    observedAt: patch.observedAt ?? ROLE_3_FIXTURE_TIME,
    receivedAt: ROLE_3_FIXTURE_TIME,
    evidenceClass: "fixture" as const,
  };
  return intelligenceSnapshotSchema.parse({
    envelope,
    gameplay: {
      envelope: { ...envelope, messageId: "role-3-progress-gameplay" },
      capabilities: {
        tier: "calibrated-hud",
        gameId: "fixture-game",
        adapterId: "fixture-adapter",
        supportedSignals: patch.supportedSignals ?? ["objective-progress"],
      },
      signals: [
        {
          signalId: "fixture-progress-signal",
          kind: "objective-progress",
          observation:
            status === "known"
              ? { status, value: 0.5, provenance }
              : { status, reason: "not-observed", provenance },
        },
      ],
    },
    audience: {
      envelope: { ...envelope, messageId: "role-3-progress-audience" },
      sampleSize: 0,
      signals: [],
    },
  });
}

describe("progress policy", () => {
  it("accepts monotonic manual progress without fabricated evidence", () => {
    const result = decideManualProgress(null, 0.5, ROLE_3_FIXTURE_TIME);

    expect(result).toEqual({
      accepted: true,
      progress: {
        value: 0.5,
        updatedAt: ROLE_3_FIXTURE_TIME,
        method: "manual",
        evidenceSignalIds: [],
      },
    });
  });

  it("rejects manual progress regression", () => {
    const current = questProgressSchema.parse({
      value: 0.75,
      updatedAt: ROLE_3_FIXTURE_TIME,
      method: "manual",
      evidenceSignalIds: [],
    });

    expect(decideManualProgress(current, 0.5, ROLE_3_FIXTURE_TIME + 1)).toEqual({
      accepted: false,
      reason: "progress-regression",
    });
  });

  it("rejects an authoritative progress timestamp that moves backwards", () => {
    const current = questProgressSchema.parse({
      value: 0.5,
      updatedAt: ROLE_3_FIXTURE_TIME,
      method: "manual",
      evidenceSignalIds: [],
    });

    expect(decideManualProgress(current, 0.75, ROLE_3_FIXTURE_TIME - 1)).toEqual({
      accepted: false,
      reason: "progress-time-regression",
    });
  });

  it("accepts automatic progress only from fresh, supported, allowed, known evidence", () => {
    const result = decideAutomaticProgress({
      currentProgress: null,
      requestedValue: 0.5,
      evidenceSignalIds: ["fixture-progress-signal"],
      allowedSignalKinds: ["objective-progress"],
      intelligence: intelligence(),
      now: ROLE_3_FIXTURE_TIME,
    });

    expect(result).toMatchObject({
      accepted: true,
      progress: { value: 0.5, method: "automatic" },
    });
  });

  it.each([
    ["missing-evidence", { evidenceSignalIds: [] }],
    ["unknown-evidence", { intelligence: intelligence({ status: "unknown" }) }],
    ["unsupported-evidence", { intelligence: intelligence({ supportedSignals: [] }) }],
    ["disallowed-evidence", { allowedSignalKinds: ["another-signal"] }],
    [
      "low-confidence-evidence",
      { intelligence: intelligence({ confidence: AUTOMATIC_PROGRESS_MINIMUM_CONFIDENCE - 0.01 }) },
    ],
    [
      "stale-evidence",
      { intelligence: intelligence({ observedAt: ROLE_3_FIXTURE_TIME - 15_001 }) },
    ],
  ] as const)("rejects automatic progress with %s", (reason, patch) => {
    const result = decideAutomaticProgress({
      currentProgress: null,
      requestedValue: 0.5,
      evidenceSignalIds: ["fixture-progress-signal"],
      allowedSignalKinds: ["objective-progress"],
      intelligence: intelligence(),
      now: ROLE_3_FIXTURE_TIME,
      ...patch,
    });

    expect(result).toEqual({ accepted: false, reason });
  });
});

describe("quest outcome policy", () => {
  it("awards candidate points and positive hype only for success", () => {
    expect(
      decideQuestOutcome({
        outcome: "succeeded",
        activeCandidate,
        terminalAt: ROLE_3_FIXTURE_TIME,
      }),
    ).toEqual({
      rewardPointsAwarded: activeCandidate.rewardPoints,
      hypeDelta: 10,
      historyCandidateId: activeCandidate.candidateId,
      cooldownEndsAt: ROLE_3_FIXTURE_TIME + DEFAULT_COOLDOWN_MILLISECONDS,
    });
  });

  it.each([
    ["failed", 2],
    ["cancelled", 0],
    ["skipped", 0],
    ["expired", 0],
  ] as const)("keeps %s non-monetary and zero-point", (outcome, hypeDelta) => {
    expect(
      decideQuestOutcome({ outcome, activeCandidate, terminalAt: ROLE_3_FIXTURE_TIME }),
    ).toMatchObject({ rewardPointsAwarded: 0, hypeDelta });
  });

  it("does not fabricate history for a batch rejected before activation", () => {
    expect(
      decideQuestOutcome({
        outcome: "cancelled",
        activeCandidate: null,
        terminalAt: ROLE_3_FIXTURE_TIME,
      }),
    ).toMatchObject({ historyCandidateId: null, rewardPointsAwarded: 0, hypeDelta: 0 });
  });
});
