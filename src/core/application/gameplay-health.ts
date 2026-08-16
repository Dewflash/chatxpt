import {
  serviceHealthSchema,
  type GameplaySnapshot,
  type ServiceHealth,
} from "../contracts";

export const GAMEPLAY_SNAPSHOT_STALE_AFTER_MS = 5_000;

export function deriveGameplayServiceHealth(
  snapshot: GameplaySnapshot | null,
  checkedAt: number,
  staleAfterMs = GAMEPLAY_SNAPSHOT_STALE_AFTER_MS,
): ServiceHealth {
  if (snapshot === null) {
    return serviceHealthSchema.parse({
      service: "gameplay-extraction",
      status: "unavailable",
      checkedAt,
      message: "Gameplay Capture is unavailable because no current snapshot exists.",
      retryable: true,
    });
  }

  const ageMs = Math.max(0, checkedAt - snapshot.envelope.occurredAt);
  const permissionDenied = snapshot.signals.some(
    (signal) =>
      signal.observation.status === "unknown" &&
      signal.observation.reason === "permission-denied",
  );
  const knownSignalCount = snapshot.signals.filter(
    (signal) => signal.observation.status === "known",
  ).length;
  const profile = snapshot.capabilities.gameId ?? "generic game";
  const tier = snapshot.capabilities.tier;

  if (permissionDenied) {
    return serviceHealthSchema.parse({
      service: "gameplay-extraction",
      status: "permission-denied",
      checkedAt,
      message: `Gameplay Capture permission is required for ${profile}.`,
      retryable: true,
    });
  }
  if (ageMs > staleAfterMs) {
    return serviceHealthSchema.parse({
      service: "gameplay-extraction",
      status: "degraded",
      checkedAt,
      message: `Gameplay Capture is stale (${ageMs}ms old).`,
      retryable: true,
    });
  }
  if (knownSignalCount === 0) {
    return serviceHealthSchema.parse({
      service: "gameplay-extraction",
      status: "degraded",
      checkedAt,
      message: `Gameplay Capture is active for ${profile} at ${tier}, but Signal Confidence is still low.`,
      retryable: true,
    });
  }
  return serviceHealthSchema.parse({
    service: "gameplay-extraction",
    status: "ready",
    checkedAt,
    message: `Gameplay Capture is current for ${profile} at ${tier} (${knownSignalCount} observed signals).`,
    retryable: false,
  });
}

export function upsertGameplayServiceHealth(
  services: readonly ServiceHealth[],
  health: ServiceHealth,
): readonly ServiceHealth[] {
  return [...services.filter((service) => service.service !== health.service), health];
}
