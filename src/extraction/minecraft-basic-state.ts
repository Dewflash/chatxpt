import type { MinecraftCameraMotionMeasurement } from "./minecraft-camera-motion";
import type { MinecraftActionVisualMeasurement } from "./minecraft-action-visual";
import type { MinecraftHudFact, MinecraftHudFingerprint } from "./minecraft-hud";
import type { MinecraftMenuState } from "./minecraft-menu";
import type { MinecraftRuntimeFacts } from "./minecraft-runtime";

export type MinecraftMovementState = "stationary" | "moving" | "walking" | "running";
export type MinecraftCombatState = "none" | "attacking" | "fighting";
export type MinecraftHealthTrend = "stable" | "taking-damage" | "regenerating";
export type MinecraftScreenState = "gameplay" | "pause" | "inventory" | "sleeping" | "dead";
export type MinecraftEnvironmentState = "land" | "water";
export type MinecraftLifeState = "alive" | "dead";

export interface MinecraftBasicStateFacts {
  readonly movement: MinecraftHudFact<MinecraftMovementState>;
  readonly turning: MinecraftHudFact<boolean>;
  readonly combat: MinecraftHudFact<MinecraftCombatState>;
  readonly eating: MinecraftHudFact<boolean>;
  readonly healthTrend: MinecraftHudFact<MinecraftHealthTrend>;
  readonly screen: MinecraftHudFact<MinecraftScreenState>;
  readonly environment: MinecraftHudFact<MinecraftEnvironmentState>;
  readonly life: MinecraftHudFact<MinecraftLifeState>;
}

interface TimedCameraMotion {
  readonly observedAt: number;
  readonly measurement: MinecraftCameraMotionMeasurement;
}

interface TimedActionVisual {
  readonly observedAt: number;
  readonly measurement: MinecraftActionVisualMeasurement;
}

interface HeldHealthTrend {
  readonly value: MinecraftHealthTrend;
  readonly confidence: number;
  readonly expiresAt: number;
  readonly sourceRegionIds: readonly string[];
}

function known<T extends string | number | boolean>(
  value: T,
  confidence: number,
  reason: string,
  sourceRegionIds: readonly string[],
): MinecraftHudFact<T> {
  return {
    status: "known",
    value,
    confidence: Math.max(0, Math.min(1, confidence)),
    reason,
    sourceRegionIds,
  };
}

function unknown<T extends string | number | boolean>(
  reason: string,
  confidence = 0,
  sourceRegionIds: readonly string[] = [],
): MinecraftHudFact<T> {
  return {
    status: "unknown",
    value: null,
    confidence: Math.max(0, Math.min(1, confidence)),
    reason,
    sourceRegionIds,
  };
}

function confirmedHud(hud: MinecraftHudFingerprint | null): hud is MinecraftHudFingerprint {
  return hud?.status === "vanilla-like" || hud?.status === "minecraft-like";
}

function screenFact(input: {
  readonly menuState: MinecraftHudFact<MinecraftMenuState>;
  readonly hud: MinecraftHudFingerprint | null;
}): MinecraftHudFact<MinecraftScreenState> {
  if (input.menuState.status === "known" && input.menuState.value !== null) {
    const source = input.menuState.sourceRegionIds;
    if (input.menuState.value === "pause") {
      return known("pause", input.menuState.confidence, "The vanilla Minecraft pause screen is open.", source);
    }
    if (["inventory", "crafting", "container"].includes(input.menuState.value)) {
      return known("inventory", input.menuState.confidence, "A Minecraft inventory or container screen is open.", source);
    }
    if (input.menuState.value === "sleeping") {
      return known("sleeping", input.menuState.confidence, "The Minecraft sleeping overlay is open.", source);
    }
    if (input.menuState.value === "death") {
      return known("dead", input.menuState.confidence, "The Minecraft death screen is open.", source);
    }
  }
  if (confirmedHud(input.hud)) {
    return known(
      "gameplay",
      input.hud.confidence,
      "The confirmed Minecraft HUD is visible without a detected menu overlay.",
      input.hud.facts.hotbarVisible.sourceRegionIds,
    );
  }
  return unknown(
    "No confirmed gameplay HUD, pause, inventory, sleep, or death screen is visible.",
    input.menuState.confidence,
    input.menuState.sourceRegionIds,
  );
}

function hasTravelEvidence(measurement: MinecraftCameraMotionMeasurement): boolean {
  return measurement.reliableVectorCount >= 3 && (
    Math.abs(measurement.meanDy) >= 0.45 ||
    (Math.abs(measurement.radialMotion) >= 0.5 && Math.abs(measurement.radialCoherence) >= 0.22)
  );
}

function hasTurningEvidence(measurement: MinecraftCameraMotionMeasurement): boolean {
  return measurement.reliableVectorCount >= 3 &&
    measurement.yawStrength >= 0.45 &&
    measurement.yawCoherence >= 0.2;
}

function spanMs(rows: readonly TimedCameraMotion[]): number {
  return rows.length < 2 ? 0 : rows.at(-1)!.observedAt - rows[0].observedAt;
}

function ratio(rows: readonly TimedCameraMotion[], predicate: (row: TimedCameraMotion) => boolean): number {
  return rows.length === 0 ? 0 : rows.filter(predicate).length / rows.length;
}

function motionConfidence(rows: readonly TimedCameraMotion[]): number {
  if (rows.length === 0) return 0;
  const reliableRatio = rows.reduce(
    (total, row) => total + Math.min(1, row.measurement.reliableVectorCount / 8),
    0,
  ) / rows.length;
  return Math.max(0.75, Math.min(0.94, 0.72 + reliableRatio * 0.22));
}

/**
 * Stabilises independent Minecraft state axes. The tracker intentionally does
 * not force one exclusive activity: walking can coexist with turning, eating
 * can coexist with regeneration, and fighting can coexist with damage.
 */
export class MinecraftBasicStateTracker {
  private motionHistory: TimedCameraMotion[] = [];
  private lastObservedAt: number | null = null;
  private previousHealth: { readonly value: number; readonly observedAt: number; readonly confidence: number; readonly sources: readonly string[] } | null = null;
  private previousHunger: { readonly value: number; readonly observedAt: number; readonly confidence: number; readonly sources: readonly string[] } | null = null;
  private heldHealthTrend: HeldHealthTrend | null = null;
  private eatingUntil = 0;
  private eatingConfidence = 0;
  private eatingSources: readonly string[] = [];
  private heldOverlayScreen: { readonly fact: MinecraftHudFact<MinecraftScreenState>; readonly lastSeenAt: number } | null = null;
  private actionHistory: TimedActionVisual[] = [];

  reset(): void {
    this.motionHistory = [];
    this.lastObservedAt = null;
    this.previousHealth = null;
    this.previousHunger = null;
    this.heldHealthTrend = null;
    this.eatingUntil = 0;
    this.eatingConfidence = 0;
    this.eatingSources = [];
    this.heldOverlayScreen = null;
    this.actionHistory = [];
  }

  observe(input: {
    readonly observedAt: number;
    readonly cameraMotion: MinecraftCameraMotionMeasurement | null;
    readonly actionVisuals?: MinecraftActionVisualMeasurement | null;
    readonly menuState: MinecraftHudFact<MinecraftMenuState>;
    readonly hud: MinecraftHudFingerprint | null;
    readonly runtimeFacts: MinecraftRuntimeFacts;
  }): MinecraftBasicStateFacts {
    if (!Number.isInteger(input.observedAt) || input.observedAt < 0) {
      throw new RangeError("Minecraft basic-state timestamps must be non-negative integers");
    }
    if (this.lastObservedAt !== null && input.observedAt <= this.lastObservedAt) {
      throw new RangeError("Minecraft basic-state timestamps must be strictly increasing");
    }
    this.lastObservedAt = input.observedAt;
    const rawScreen = screenFact(input);
    if (rawScreen.status === "known" && rawScreen.value !== "gameplay") {
      this.heldOverlayScreen = { fact: rawScreen, lastSeenAt: input.observedAt };
    } else if (
      this.heldOverlayScreen !== null &&
      input.observedAt - this.heldOverlayScreen.lastSeenAt > 800
    ) {
      this.heldOverlayScreen = null;
    }
    const screen = this.heldOverlayScreen?.fact ?? rawScreen;
    const gameplayVisible = screen.status === "known" && screen.value === "gameplay";

    if (gameplayVisible && input.actionVisuals !== null && input.actionVisuals !== undefined) {
      this.actionHistory.push({ observedAt: input.observedAt, measurement: input.actionVisuals });
      this.actionHistory = this.actionHistory.filter(({ observedAt }) => observedAt >= input.observedAt - 1_500);
    } else if (!gameplayVisible) {
      this.actionHistory = [];
    }

    if (gameplayVisible && input.cameraMotion !== null) {
      this.motionHistory.push({ observedAt: input.observedAt, measurement: input.cameraMotion });
      this.motionHistory = this.motionHistory.filter(({ observedAt }) => observedAt >= input.observedAt - 3_000);
    } else {
      this.motionHistory = [];
    }

    const recent = this.motionHistory.filter(({ observedAt }) => observedAt >= input.observedAt - 1_000);
    const recentSpan = spanMs(recent);
    const travelRatio = ratio(recent, ({ measurement }) => hasTravelEvidence(measurement));
    const turningRatio = ratio(recent, ({ measurement }) => hasTurningEvidence(measurement));
    const activeRatio = ratio(recent, ({ measurement }) =>
      measurement.reliableVectorCount >= 3 && measurement.meanMagnitude >= 0.8,
    );
    let movement: MinecraftHudFact<MinecraftMovementState>;
    let turning: MinecraftHudFact<boolean>;

    if (!gameplayVisible) {
      const reason = screen.status === "known"
        ? `Movement is gated while the Minecraft ${screen.value} screen is open.`
        : "A confirmed gameplay screen is required before movement can be classified.";
      movement = unknown(reason, screen.confidence, screen.sourceRegionIds);
      turning = unknown(reason, screen.confidence, screen.sourceRegionIds);
    } else if (recent.length < 3 || recentSpan < 400) {
      movement = unknown("A short recent camera-motion window is still being acquired.");
      turning = unknown("A short recent camera-motion window is still being acquired.");
    } else {
      const confidence = motionConfidence(recent);
      if (travelRatio >= 0.45) {
        const paceWindow = this.motionHistory.filter(
          ({ observedAt, measurement }) => observedAt >= input.observedAt - 2_500 && hasTravelEvidence(measurement),
        );
        const paceSpan = spanMs(paceWindow);
        const verticalBuckets = new Map<number, number[]>();
        for (const row of paceWindow) {
          const bucket = Math.floor(row.observedAt / 250);
          verticalBuckets.set(bucket, [...(verticalBuckets.get(bucket) ?? []), row.measurement.meanDy]);
        }
        const directions = [...verticalBuckets.entries()]
          .sort(([left], [right]) => left - right)
          .map(([, values]) => values.reduce((total, value) => total + value, 0) / values.length)
          .filter((value) => Math.abs(value) >= 0.25)
          .map(Math.sign);
        const reversals = directions.slice(1).filter((value, index) => value !== directions[index]).length;
        const reversalRate = paceSpan <= 0 ? 0 : reversals / (paceSpan / 1_000);
        const meanMagnitude = paceWindow.reduce(
          (total, row) => total + row.measurement.meanMagnitude,
          0,
        ) / Math.max(1, paceWindow.length);
        if (paceSpan < 800) {
          movement = unknown(
            "Travel-like motion is present, but a longer window is required to reject camera-only movement.",
            confidence,
            ["minecraft-camera-field"],
          );
        } else if (paceSpan < 1_200) {
          movement = known(
            "moving",
            confidence,
            "Player travel is observed; walking versus running needs a longer camera-bob window.",
            ["minecraft-camera-field"],
          );
        } else if (reversalRate >= 2.7 && meanMagnitude >= 4.4) {
          movement = known(
            "running",
            confidence,
            "Sustained fast travel and camera-bob cadence support running.",
            ["minecraft-camera-field"],
          );
        } else if (reversalRate <= 1.8 && meanMagnitude <= 4) {
          movement = known(
            "walking",
            confidence,
            "Sustained moderate travel and camera-bob cadence support walking.",
            ["minecraft-camera-field"],
          );
        } else {
          movement = known(
            "moving",
            confidence,
            "Player travel is observed, but walking and running cannot be separated reliably in this window.",
            ["minecraft-camera-field"],
          );
        }
      } else if (activeRatio <= 0.12) {
        movement = known(
          "stationary",
          Math.max(0.86, confidence),
          "The recent scene field is stable without player-travel evidence.",
          ["minecraft-camera-field"],
        );
      } else {
        movement = unknown(
          "Scene motion is present but does not reliably distinguish travel from camera-only movement.",
          confidence,
          ["minecraft-camera-field"],
        );
      }

      if (turningRatio >= 0.3) {
        turning = known(
          true,
          confidence,
          "Recent scene vectors show coherent horizontal camera rotation.",
          ["minecraft-camera-field"],
        );
      } else if (turningRatio <= 0.1) {
        turning = known(
          false,
          confidence,
          "The recent scene field does not show coherent horizontal rotation.",
          ["minecraft-camera-field"],
        );
      } else {
        turning = unknown(
          "The recent horizontal motion is too mixed to confirm or reject turning.",
          confidence,
          ["minecraft-camera-field"],
        );
      }
    }

    const health = input.hud?.facts.healthHearts;
    if (
      gameplayVisible && health?.status === "known" && typeof health.value === "number" &&
      health.observedAt !== undefined && health.observedAt !== this.previousHealth?.observedAt
    ) {
      if (this.previousHealth !== null) {
        const confidence = Math.min(health.confidence, this.previousHealth.confidence);
        const sources = [...new Set([...this.previousHealth.sources, ...health.sourceRegionIds])];
        if (health.value > this.previousHealth.value) {
          this.heldHealthTrend = { value: "regenerating", confidence, expiresAt: input.observedAt + 2_000, sourceRegionIds: sources };
        } else if (health.value < this.previousHealth.value) {
          this.heldHealthTrend = { value: "taking-damage", confidence, expiresAt: input.observedAt + 2_000, sourceRegionIds: sources };
        } else if (this.heldHealthTrend === null || this.heldHealthTrend.expiresAt < input.observedAt) {
          this.heldHealthTrend = { value: "stable", confidence, expiresAt: input.observedAt + 1_000, sourceRegionIds: sources };
        }
      }
      this.previousHealth = {
        value: health.value,
        observedAt: health.observedAt,
        confidence: health.confidence,
        sources: health.sourceRegionIds,
      };
    }

    const hunger = input.hud?.facts.hungerShanks;
    if (
      gameplayVisible && hunger?.status === "known" && typeof hunger.value === "number" &&
      hunger.observedAt !== undefined && hunger.observedAt !== this.previousHunger?.observedAt
    ) {
      const selectedFood = input.hud?.facts.selectedHotbarCategory.status === "known" &&
        input.hud.facts.selectedHotbarCategory.value === "food";
      if (this.previousHunger !== null && hunger.value > this.previousHunger.value && selectedFood) {
        this.eatingUntil = input.observedAt + 2_200;
        this.eatingConfidence = Math.min(hunger.confidence, this.previousHunger.confidence);
        this.eatingSources = [...new Set([...this.previousHunger.sources, ...hunger.sourceRegionIds])];
      }
      this.previousHunger = {
        value: hunger.value,
        observedAt: hunger.observedAt,
        confidence: hunger.confidence,
        sources: hunger.sourceRegionIds,
      };
    }

    const healthTrend = this.heldHealthTrend !== null && this.heldHealthTrend.expiresAt >= input.observedAt
      ? known(
          this.heldHealthTrend.value,
          this.heldHealthTrend.confidence,
          this.heldHealthTrend.value === "regenerating"
            ? "Confirmed health increased across recent HUD observations."
            : this.heldHealthTrend.value === "taking-damage"
              ? "Confirmed health decreased across recent HUD observations."
              : "Confirmed health remained unchanged across recent HUD observations.",
          this.heldHealthTrend.sourceRegionIds,
        )
      : unknown<MinecraftHealthTrend>("Two fresh confirmed health observations are required for a health trend.");
    const recentActions = this.actionHistory.filter(({ observedAt }) => observedAt >= input.observedAt - 1_000);
    const eatingPoses = recentActions.filter(({ measurement }) => measurement.eatingPose);
    const eatingPoseSpan = eatingPoses.length < 2
      ? 0
      : eatingPoses.at(-1)!.observedAt - eatingPoses[0].observedAt;
    const confirmedEatingPose = eatingPoses.length >= 2 && eatingPoseSpan >= 100;
    const eating = confirmedEatingPose
      ? known(
          true,
          Math.min(...eatingPoses.map(({ measurement }) => measurement.eatingConfidence)),
          "Repeated vanilla item-use poses support active eating.",
          ["minecraft-action-eating-region"],
        )
      : this.eatingUntil >= input.observedAt
        ? known(true, this.eatingConfidence, "A selected food item and confirmed hunger increase support recent eating.", this.eatingSources)
      : screen.status === "known" && screen.value !== "gameplay"
        ? known(false, screen.confidence, "Eating is not active on the detected non-gameplay screen.", screen.sourceRegionIds)
        : unknown<boolean>("No confirmed hunger increase or food-use sequence supports an eating claim.");

    let combat: MinecraftHudFact<MinecraftCombatState>;
    if (screen.status === "known" && screen.value !== "gameplay") {
      combat = known("none", screen.confidence, "Combat is not active on the detected non-gameplay screen.", screen.sourceRegionIds);
    } else if (recentActions.some(({ measurement }) => measurement.hitFlash)) {
      const hitEvidence = recentActions.filter(({ measurement }) => measurement.hitFlash);
      const takingDamage = input.runtimeFacts.recentDamage.status === "known" && input.runtimeFacts.recentDamage.value === true;
      combat = known(
        takingDamage ? "fighting" : "attacking",
        Math.min(0.9, Math.max(...hitEvidence.map(({ measurement }) => measurement.hitConfidence))),
        takingDamage
          ? "A successful-hit flash overlaps a confirmed recent health drop."
          : "A successful-hit flash is visible without a confirmed recent health drop.",
        [...new Set([
          "minecraft-action-hit-region",
          ...input.runtimeFacts.recentDamage.sourceRegionIds,
        ])],
      );
    } else {
      combat = unknown("No confirmed weapon-use sequence supports attacking or fighting.");
    }

    let environment: MinecraftHudFact<MinecraftEnvironmentState>;
    const submerged = input.hud?.facts.submerged;
    if (gameplayVisible && submerged?.status === "known" && submerged.value === true) {
      environment = known("water", submerged.confidence, "The Minecraft air/HUD band confirms submersion.", submerged.sourceRegionIds);
    } else if (gameplayVisible && submerged?.status === "known" && submerged.value === false) {
      environment = known("land", submerged.confidence, "The confirmed gameplay HUD shows no submersion state.", submerged.sourceRegionIds);
    } else {
      environment = unknown("Land versus water is not confirmed by the current HUD and scene evidence.");
    }

    const life: MinecraftHudFact<MinecraftLifeState> = screen.status !== "known"
      ? unknown("Alive versus dead requires a confirmed gameplay, menu, sleep, or death screen.")
      : screen.value === "dead"
        ? known("dead", screen.confidence, "The Minecraft death screen confirms the player is dead.", screen.sourceRegionIds)
        : known("alive", screen.confidence, "A live Minecraft gameplay or menu state is visible.", screen.sourceRegionIds);

    return { movement, turning, combat, eating, healthTrend, screen, environment, life };
  }
}
