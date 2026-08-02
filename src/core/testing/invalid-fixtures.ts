import { contractFixtureCandidateBatch, contractFixtureEnvelope } from "./fixtures";

export const invalidLiveFixtureEnvelope = {
  ...contractFixtureEnvelope,
  evidenceClass: "live",
} as const;

export const invalidShortCandidateBatch = {
  ...contractFixtureCandidateBatch,
  candidates: contractFixtureCandidateBatch.candidates.slice(0, 2),
};

export const invalidUnknownSignalWithValue = {
  status: "unknown",
  reason: "not-observed",
  value: 42,
  provenance: {
    source: "test-fixture",
    method: "invalid-contract-fixture",
    confidence: 0,
    observedAt: 1,
    receivedAt: 1,
    evidenceClass: "fixture",
  },
} as const;

export const invalidCalibratedCapabilitiesWithoutAdapter = {
  tier: "calibrated-hud",
  gameId: "fixture-game",
  adapterId: null,
  supportedSignals: ["health"],
} as const;
