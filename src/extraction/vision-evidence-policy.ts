import { evidenceClassSchema } from "../core";
import {
  interpretMotionWindow,
  type MotionInterpretationPolicy,
} from "./motion-interpretation";

export interface MultiGameVisionEvidencePolicy {
  readonly policyId: string;
  readonly calibrationEvidenceClass: "live" | "diagnostic" | "fixture";
  readonly calibrationSourceIds: readonly string[];
  readonly approvedProfileIds: readonly string[];
  readonly minimumConfidence: number;
  readonly staleAfterMs: number;
  readonly interpretation: MotionInterpretationPolicy;
}

function distinctTrimmedIdentifiers(name: string, values: readonly string[], minimum: number): string[] {
  const parsed = values.map((value) => value.trim());
  if (
    parsed.length < minimum ||
    parsed.some((value) => value.length === 0 || value.length > 128) ||
    new Set(parsed).size !== parsed.length
  ) {
    throw new RangeError(`${name} must contain at least ${minimum} distinct bounded identifiers`);
  }
  return parsed;
}

/**
 * Validates an evidence-derived policy before it can unlock classifications.
 * No live policy is bundled: Role 2 must inject one only after matching live
 * calibration evidence is accepted.
 */
export function createMultiGameVisionEvidencePolicy(
  input: MultiGameVisionEvidencePolicy,
): MultiGameVisionEvidencePolicy {
  const policyId = input.policyId.trim();
  if (policyId.length === 0 || policyId.length > 128) {
    throw new RangeError("policyId must contain 1 to 128 trimmed characters");
  }
  const calibrationEvidenceClass = evidenceClassSchema.parse(input.calibrationEvidenceClass);
  const calibrationSourceIds = distinctTrimmedIdentifiers(
    "calibrationSourceIds",
    input.calibrationSourceIds,
    2,
  );
  const approvedProfileIds = distinctTrimmedIdentifiers(
    "approvedProfileIds",
    input.approvedProfileIds,
    1,
  );
  if (!Number.isFinite(input.minimumConfidence) || input.minimumConfidence < 0.75 || input.minimumConfidence > 1) {
    throw new RangeError("minimumConfidence must be between 0.75 and 1");
  }
  if (!Number.isInteger(input.staleAfterMs) || input.staleAfterMs < 1 || input.staleAfterMs > 3_000) {
    throw new RangeError("staleAfterMs must be an integer from 1 to 3000");
  }
  // The interpreter owns validation of every nested motion threshold.
  interpretMotionWindow([], input.interpretation);
  return {
    policyId,
    calibrationEvidenceClass,
    calibrationSourceIds,
    approvedProfileIds,
    minimumConfidence: input.minimumConfidence,
    staleAfterMs: input.staleAfterMs,
    interpretation: { ...input.interpretation },
  };
}
