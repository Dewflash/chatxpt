import type { GameplaySnapshot } from "../core";
import type { StatusTone } from "../design-system";

export interface GameplayHealthSummary {
  readonly label: string;
  readonly tone: StatusTone;
  readonly knownCount: number;
  readonly unknownCount: number;
  readonly staleCount: number;
  readonly unavailableCount: number;
  readonly permissionDeniedCount: number;
  readonly totalCount: number;
  readonly averageKnownConfidence: number | null;
}

/**
 * Reduces canonical gameplay observations without upgrading unknown evidence.
 * Hard failures and stale evidence stay visible even when another signal is known.
 */
export function summarizeGameplayHealth(gameplay: GameplaySnapshot | null): GameplayHealthSummary {
  if (gameplay === null || gameplay.signals.length === 0) {
    return {
      label: "Unknown",
      tone: "neutral",
      knownCount: 0,
      unknownCount: 0,
      staleCount: 0,
      unavailableCount: 0,
      permissionDeniedCount: 0,
      totalCount: gameplay?.signals.length ?? 0,
      averageKnownConfidence: null,
    };
  }

  const known = gameplay.signals.filter((signal) => signal.observation.status === "known");
  const unknownCount = gameplay.signals.filter((signal) => signal.observation.status === "unknown").length;
  const staleCount = gameplay.signals.filter((signal) => signal.observation.status === "stale").length;
  const unavailableCount = gameplay.signals.filter((signal) => signal.observation.status === "unavailable").length;
  const permissionDeniedCount = gameplay.signals.filter(
    (signal) => signal.observation.status === "unknown" && signal.observation.reason === "permission-denied",
  ).length;
  const lowConfidenceUnknownCount = gameplay.signals.filter(
    (signal) => signal.observation.status === "unknown" && signal.observation.reason === "low-confidence",
  ).length;
  const averageKnownConfidence = known.length === 0
    ? null
    : known.reduce(
      (total, signal) => total + signal.observation.provenance.confidence,
      0,
    ) / known.length;

  let label = "Unknown";
  let tone: StatusTone = "neutral";

  if (permissionDeniedCount > 0) {
    label = "Permission denied";
    tone = "danger";
  } else if (unavailableCount > 0) {
    label = "Unavailable";
    tone = "danger";
  } else if (staleCount > 0) {
    label = "Stale";
    tone = "warning";
  } else if (
    lowConfidenceUnknownCount > 0 ||
    (averageKnownConfidence !== null && averageKnownConfidence < 0.6)
  ) {
    label = "Low confidence";
    tone = "warning";
  } else if (known.length > 0) {
    label = "Observed";
    tone = "success";
  }

  return {
    label,
    tone,
    knownCount: known.length,
    unknownCount,
    staleCount,
    unavailableCount,
    permissionDeniedCount,
    totalCount: gameplay.signals.length,
    averageKnownConfidence,
  };
}
