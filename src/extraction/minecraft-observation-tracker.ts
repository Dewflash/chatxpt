import type {
  MinecraftHudFact,
  MinecraftHudFacts,
  MinecraftHudFingerprint,
  MinecraftHudTrackingStatus,
} from "./minecraft-hud";

const DEFAULT_CONFIRMATION_WINDOW_MS = 3_000;
const DEFAULT_RECONFIRMING_WINDOW_MS = 1_500;

interface TimedHud {
  readonly observedAt: number;
  readonly hud: MinecraftHudFingerprint;
}

export interface MinecraftObservationTrackerOptions {
  readonly confirmationWindowMs?: number;
  readonly reconfirmingWindowMs?: number;
  readonly historySize?: number;
}

function isConfirmedStatus(status: MinecraftHudFingerprint["status"]): boolean {
  return status === "vanilla-like" || status === "minecraft-like";
}

function hasKnownVitalPair(hud: MinecraftHudFingerprint): boolean {
  return (
    hud.facts.healthHearts.status === "known" &&
    hud.facts.healthHearts.value !== null &&
    hud.facts.hungerShanks.status === "known" &&
    hud.facts.hungerShanks.value !== null
  );
}

function unknownFact<T extends string | number | boolean>(reason: string): MinecraftHudFact<T> {
  return { status: "unknown", value: null, confidence: 0, reason, sourceRegionIds: [] };
}

function acquiringFingerprint(raw: MinecraftHudFingerprint): MinecraftHudFingerprint {
  return {
    ...raw,
    status: "candidate-unconfirmed",
    trackingStatus: "acquiring",
    lastConfirmedAt: null,
    supportedSignals: raw.supportedSignals.filter((signal) => signal !== "minecraft-hud-layout"),
    facts: {
      healthHearts: unknownFact("Minecraft health is acquiring a second recent observation."),
      hungerShanks: unknownFact("Minecraft hunger is acquiring a second recent observation."),
      airBubbles: unknownFact("Minecraft air bubbles are acquiring a second recent observation."),
      submerged: unknownFact("Minecraft submersion is acquiring a second recent observation."),
      armorPoints: unknownFact("Minecraft armor is acquiring a second recent observation."),
      hotbarVisible: unknownFact("Minecraft hotbar visibility is acquiring a second recent observation."),
      selectedHotbarCategory: unknownFact("Minecraft selected item is acquiring a second recent observation."),
    },
    reasons: [
      "A Minecraft-like HUD candidate is acquiring temporal confirmation.",
      "Game-specific facts remain unknown until two of the three most recent observations agree.",
    ],
  };
}

function trackedFact<T extends string | number | boolean>(
  observations: readonly TimedHud[],
  select: (facts: MinecraftHudFacts) => MinecraftHudFact<T>,
  label: string,
  expiresAfterMs: number,
): MinecraftHudFact<T> {
  const known = observations
    .map(({ observedAt, hud }) => ({ observedAt, fact: select(hud.facts) }))
    .filter((entry): entry is { observedAt: number; fact: MinecraftHudFact<T> & { status: "known"; value: T } } =>
      entry.fact.status === "known" && entry.fact.value !== null,
    );
  const counts = new Map<T, number>();
  for (const { fact } of known) counts.set(fact.value, (counts.get(fact.value) ?? 0) + 1);
  const winner = [...counts.entries()]
    .filter(([, count]) => count >= 2)
    .sort((left, right) => right[1] - left[1])[0]?.[0];
  if (winner === undefined) {
    return unknownFact(`${label} requires agreement from two of the three most recent HUD observations.`);
  }
  const matching = known.filter(({ fact }) => fact.value === winner);
  const newest = matching.reduce((latest, entry) => entry.observedAt > latest.observedAt ? entry : latest);
  return {
    ...newest.fact,
    confidence: Math.min(...matching.map(({ fact }) => fact.confidence)),
    reason: `${label} was confirmed by ${matching.length} matching recent HUD observations.`,
    sourceRegionIds: [...new Set(matching.flatMap(({ fact }) => fact.sourceRegionIds))],
    observedAt: newest.observedAt,
    expiresAt: newest.observedAt + expiresAfterMs,
  };
}

function trackedFacts(observations: readonly TimedHud[], expiresAfterMs: number): MinecraftHudFacts {
  return {
    healthHearts: trackedFact(observations, (facts) => facts.healthHearts, "Minecraft health", expiresAfterMs),
    hungerShanks: trackedFact(observations, (facts) => facts.hungerShanks, "Minecraft hunger", expiresAfterMs),
    airBubbles: trackedFact(observations, (facts) => facts.airBubbles, "Minecraft air bubbles", expiresAfterMs),
    submerged: trackedFact(observations, (facts) => facts.submerged, "Minecraft submersion", expiresAfterMs),
    armorPoints: trackedFact(observations, (facts) => facts.armorPoints, "Minecraft armor", expiresAfterMs),
    hotbarVisible: trackedFact(observations, (facts) => facts.hotbarVisible, "Minecraft hotbar visibility", expiresAfterMs),
    selectedHotbarCategory: trackedFact(
      observations,
      (facts) => facts.selectedHotbarCategory,
      "Minecraft selected hotbar category",
      expiresAfterMs,
    ),
  };
}

function vitalOnlyFacts(
  observations: readonly TimedHud[],
  expiresAfterMs: number,
): MinecraftHudFacts {
  const tracked = trackedFacts(observations, expiresAfterMs);
  return {
    healthHearts: tracked.healthHearts,
    hungerShanks: tracked.hungerShanks,
    airBubbles: unknownFact("Minecraft air bubbles require a confirmed full HUD layout."),
    submerged: unknownFact("Minecraft submersion requires a confirmed full HUD layout."),
    armorPoints: unknownFact("Minecraft armor requires a confirmed full HUD layout."),
    hotbarVisible: unknownFact("Minecraft hotbar visibility requires a confirmed full HUD layout."),
    selectedHotbarCategory: unknownFact("Minecraft selected item requires a confirmed full HUD layout."),
  };
}

function confirmedVitalFingerprint(
  raw: MinecraftHudFingerprint,
  observations: readonly TimedHud[],
  observedAt: number,
  expiresAfterMs: number,
): MinecraftHudFingerprint | null {
  const facts = vitalOnlyFacts(observations, expiresAfterMs);
  if (facts.healthHearts.status !== "known" || facts.hungerShanks.status !== "known") {
    return null;
  }
  return {
    ...raw,
    status: isConfirmedStatus(raw.status) ? "candidate-unconfirmed" : raw.status,
    supportedSignals: [
      ...new Set([
        ...raw.supportedSignals.filter((signal) => signal !== "minecraft-hud-layout"),
        "minecraft-health-hearts",
        "minecraft-hunger-shanks",
      ]),
    ],
    facts,
    trackingStatus: "confirmed",
    lastConfirmedAt: observedAt,
    reasons: [
      ...raw.reasons,
      "Health and hunger are confirmed independently by two matching paired ten-slot colour observations.",
      "The full HUD layout remains unconfirmed until the hotbar also agrees.",
    ],
  };
}

function carriedFingerprint(
  stable: MinecraftHudFingerprint,
  status: Extract<MinecraftHudTrackingStatus, "reconfirming" | "stale">,
  ageMs: number,
): MinecraftHudFingerprint {
  return {
    ...stable,
    trackingStatus: status,
    reasons: [
      ...stable.reasons.filter((reason) => !reason.startsWith("HUD tracking is")),
      `HUD tracking is ${status}; the last pixel-confirmed facts are ${ageMs} ms old and retain their original expiry.`,
    ],
  };
}

/**
 * Stabilises independently parsed HUD frames without inventing new evidence.
 * A fact is promoted by a two-of-three vote and keeps the timestamp of the
 * pixels that supported it. Brief misses therefore do not flicker the UI, but
 * carried values still expire after the bounded confirmation window.
 */
export class MinecraftObservationTracker {
  private readonly confirmationWindowMs: number;
  private readonly reconfirmingWindowMs: number;
  private readonly historySize: number;
  private history: TimedHud[] = [];
  private stable: MinecraftHudFingerprint | null = null;
  private lastConfirmedAt: number | null = null;

  constructor(options: MinecraftObservationTrackerOptions = {}) {
    this.confirmationWindowMs = options.confirmationWindowMs ?? DEFAULT_CONFIRMATION_WINDOW_MS;
    this.reconfirmingWindowMs = options.reconfirmingWindowMs ?? DEFAULT_RECONFIRMING_WINDOW_MS;
    this.historySize = options.historySize ?? 3;
    if (this.confirmationWindowMs <= 0 || this.reconfirmingWindowMs < 0 || this.reconfirmingWindowMs > this.confirmationWindowMs) {
      throw new RangeError("Minecraft tracker windows must be positive and ordered");
    }
    if (!Number.isInteger(this.historySize) || this.historySize < 2 || this.historySize > 10) {
      throw new RangeError("Minecraft tracker historySize must be an integer from 2 to 10");
    }
  }

  reset(): void {
    this.history = [];
    this.stable = null;
    this.lastConfirmedAt = null;
  }

  observe(raw: MinecraftHudFingerprint, observedAt: number): MinecraftHudFingerprint {
    this.history = this.history.filter((entry) => observedAt - entry.observedAt <= this.confirmationWindowMs);
    if (isConfirmedStatus(raw.status) || hasKnownVitalPair(raw)) {
      this.history.push({ hud: raw, observedAt });
      this.history = this.history.slice(-this.historySize);
      const layoutHistory = this.history.filter(({ hud }) => isConfirmedStatus(hud.status));
      if (isConfirmedStatus(raw.status) && layoutHistory.length >= 2) {
        const result: MinecraftHudFingerprint = {
          ...raw,
          facts: trackedFacts(layoutHistory, this.confirmationWindowMs),
          trackingStatus: "confirmed",
          lastConfirmedAt: observedAt,
          reasons: [
            ...raw.reasons,
            "HUD tracking is confirmed by a two-of-three rolling observation window.",
          ],
        };
        this.stable = result;
        this.lastConfirmedAt = observedAt;
        return result;
      }
      const vitalHistory = this.history.filter(({ hud }) => hasKnownVitalPair(hud));
      if (vitalHistory.length >= 2) {
        const result = confirmedVitalFingerprint(
          raw,
          vitalHistory,
          observedAt,
          this.confirmationWindowMs,
        );
        if (result !== null) {
          this.stable = result;
          this.lastConfirmedAt = observedAt;
          return result;
        }
      }
      return acquiringFingerprint(raw);
    }

    if (this.stable !== null && this.lastConfirmedAt !== null) {
      const ageMs = observedAt - this.lastConfirmedAt;
      if (ageMs <= this.confirmationWindowMs) {
        return carriedFingerprint(
          this.stable,
          ageMs <= this.reconfirmingWindowMs ? "reconfirming" : "stale",
          ageMs,
        );
      }
    }
    return { ...raw, trackingStatus: "unknown", lastConfirmedAt: this.lastConfirmedAt };
  }
}
