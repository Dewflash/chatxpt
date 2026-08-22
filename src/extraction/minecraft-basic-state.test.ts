import { describe, expect, it } from "vitest";

import { MinecraftBasicStateTracker } from "./minecraft-basic-state";
import type { MinecraftCameraMotionMeasurement } from "./minecraft-camera-motion";
import type { MinecraftHudFact, MinecraftHudFingerprint } from "./minecraft-hud";
import type { MinecraftMenuState } from "./minecraft-menu";
import type { MinecraftRuntimeFacts } from "./minecraft-runtime";

function known<T extends string | number | boolean>(value: T, observedAt = 0): MinecraftHudFact<T> {
  return {
    status: "known",
    value,
    confidence: 0.9,
    reason: "fixture",
    sourceRegionIds: ["fixture"],
    observedAt,
    expiresAt: observedAt + 3_000,
  };
}

function unknown<T extends string | number | boolean>(): MinecraftHudFact<T> {
  return { status: "unknown", value: null, confidence: 0, reason: "fixture unknown", sourceRegionIds: [] };
}

function menu(value?: MinecraftMenuState): MinecraftHudFact<MinecraftMenuState> {
  return value === undefined ? unknown() : known(value);
}

function hud(observedAt: number, input: { health?: number; hunger?: number; submerged?: boolean } = {}): MinecraftHudFingerprint {
  return {
    status: "vanilla-like",
    confidence: 0.9,
    detectedAnchors: ["minecraft-health-search", "minecraft-hunger-search", "minecraft-hotbar-search"],
    missingAnchors: [],
    supportedSignals: ["minecraft-hud-layout"],
    reasons: ["fixture"],
    features: [],
    facts: {
      healthHearts: known(input.health ?? 10, observedAt),
      hungerShanks: known(input.hunger ?? 8, observedAt),
      airBubbles: unknown(),
      submerged: input.submerged === undefined ? unknown() : known(input.submerged, observedAt),
      armorPoints: unknown(),
      hotbarVisible: known(true, observedAt),
      selectedHotbarCategory: unknown(),
    },
  };
}

function runtime(input: { combat?: boolean; damaged?: boolean; environment?: string } = {}): MinecraftRuntimeFacts {
  return {
    menuState: unknown(),
    activity: input.combat ? known("combat") : unknown(),
    danger: unknown(),
    recentDamage: input.damaged === undefined ? unknown() : known(input.damaged),
    likelyDamageCause: unknown(),
    visibleHostile: unknown(),
    biomeOrEnvironment: input.environment === undefined ? unknown() : known(input.environment),
  };
}

function motion(input: {
  dy?: number;
  radial?: number;
  yaw?: number;
  magnitude?: number;
} = {}): MinecraftCameraMotionMeasurement {
  return {
    reliableVectorCount: 10,
    meanDx: input.yaw ?? 0,
    meanDy: input.dy ?? 0,
    meanMagnitude: input.magnitude ?? 3.6,
    yawCoherence: input.yaw === undefined ? 0 : 0.8,
    yawStrength: input.yaw === undefined ? 0 : Math.abs(input.yaw) * 0.8,
    radialMotion: input.radial ?? 0.7,
    radialCoherence: 0.5,
    confidence: 0.8,
  };
}

function observe(
  tracker: MinecraftBasicStateTracker,
  observedAt: number,
  cameraMotion: MinecraftCameraMotionMeasurement | null,
  options: {
    menu?: MinecraftMenuState;
    health?: number;
    hunger?: number;
    submerged?: boolean;
    combat?: boolean;
    damaged?: boolean;
    hit?: boolean;
    eatingPose?: boolean;
    quietAction?: boolean;
    noHud?: boolean;
    environment?: string;
  } = {},
) {
  return tracker.observe({
    observedAt,
    cameraMotion,
    actionVisuals: options.hit || options.eatingPose || options.quietAction
      ? {
          hitFlash: options.hit ?? false,
          eatingPose: options.eatingPose ?? false,
          hitConfidence: options.hit ? 0.86 : 0,
          eatingConfidence: options.eatingPose ? 0.84 : 0,
        }
      : null,
    menuState: menu(options.menu),
    hud: options.noHud ? null : hud(observedAt, options),
    runtimeFacts: runtime(options),
  });
}

describe("Minecraft basic concurrent state tracker", () => {
  it("keeps walking and turning as concurrent facts", () => {
    const tracker = new MinecraftBasicStateTracker();
    let state = observe(tracker, 0, null);
    for (let index = 1; index <= 8; index += 1) {
      const dy = Math.floor((index - 1) / 2) % 2 === 0 ? 1 : -1;
      state = observe(tracker, index * 250, motion({ dy, yaw: 3 }));
    }

    expect(state.movement).toMatchObject({ status: "known", value: "walking" });
    expect(state.turning).toMatchObject({ status: "known", value: true });
    expect(state.screen).toMatchObject({ status: "known", value: "gameplay" });
    expect(state.life).toMatchObject({ status: "known", value: "alive" });
  });

  it("promotes a faster camera-bob cadence to running", () => {
    const tracker = new MinecraftBasicStateTracker();
    let state = observe(tracker, 0, null);
    for (let index = 1; index <= 9; index += 1) {
      state = observe(tracker, index * 250, motion({ dy: index % 2 === 0 ? 1.4 : -1.4, magnitude: 4.8 }));
    }

    expect(state.movement).toMatchObject({ status: "known", value: "running" });
    expect(state.turning).toMatchObject({ status: "known", value: false });
  });

  it("classifies positive camera motion without requiring HUD recognition first", () => {
    const tracker = new MinecraftBasicStateTracker();
    let state = observe(tracker, 0, null, { noHud: true });
    for (let index = 1; index <= 8; index += 1) {
      const dy = Math.floor((index - 1) / 2) % 2 === 0 ? 1 : -1;
      state = observe(tracker, index * 250, motion({ dy, yaw: 3 }), { noHud: true });
    }

    expect(state.screen).toMatchObject({ status: "unknown" });
    expect(state.movement).toMatchObject({ status: "known", value: "walking" });
    expect(state.turning).toMatchObject({ status: "known", value: true });
  });

  it("does not mistake camera-only turning drift for player travel", () => {
    const tracker = new MinecraftBasicStateTracker();
    let state = observe(tracker, 0, null);
    for (let index = 1; index <= 6; index += 1) {
      state = observe(tracker, index * 250, {
        ...motion({ dy: index % 2 === 0 ? 1 : -1, yaw: 3, radial: 0.8 }),
        radialCoherence: 0.3,
      });
    }

    expect(state.movement).not.toMatchObject({ status: "known", value: "moving" });
    expect(state.turning).toMatchObject({ status: "known", value: true });
  });

  it("uses positive action evidence without requiring HUD recognition first", () => {
    const tracker = new MinecraftBasicStateTracker();
    observe(tracker, 0, null, { noHud: true, eatingPose: true });
    const eating = observe(tracker, 250, motion(), { noHud: true, eatingPose: true });
    const attacking = observe(tracker, 500, motion(), { noHud: true, hit: true });

    expect(eating.eating).toMatchObject({ status: "known", value: true });
    expect(attacking.combat).toMatchObject({ status: "known", value: "attacking" });
  });

  it("returns combat to none after a quiet observed gameplay window", () => {
    const tracker = new MinecraftBasicStateTracker();
    observe(tracker, 0, null, { hit: true });
    observe(tracker, 2_400, motion(), { quietAction: true });
    const state = observe(tracker, 3_000, motion(), { quietAction: true });

    expect(state.combat).toMatchObject({ status: "known", value: "none" });
  });

  it("still blocks motion and action while a detected non-gameplay screen is open", () => {
    const tracker = new MinecraftBasicStateTracker();
    let state = observe(tracker, 0, null, { menu: "pause", noHud: true, hit: true });
    for (let index = 1; index <= 4; index += 1) {
      state = observe(tracker, index * 250, motion({ dy: 1, yaw: 3 }), {
        menu: "pause",
        noHud: true,
        hit: true,
      });
    }

    expect(state.screen).toMatchObject({ status: "known", value: "pause" });
    expect(state.movement).toMatchObject({ status: "unknown" });
    expect(state.turning).toMatchObject({ status: "unknown" });
    expect(state.combat).toMatchObject({ status: "known", value: "none" });
  });

  it("allows eating and health regeneration to overlap", () => {
    const tracker = new MinecraftBasicStateTracker();
    observe(tracker, 0, null, { health: 7, hunger: 5, eatingPose: true });
    const state = observe(tracker, 500, motion({ dy: 0, radial: 0, magnitude: 0 }), { health: 8, hunger: 6, eatingPose: true });

    expect(state.eating).toMatchObject({ status: "known", value: true });
    expect(state.healthTrend).toMatchObject({ status: "known", value: "regenerating" });
  });

  it("reports pause, inventory, sleep, death, water, and combat without collapsing the axes", () => {
    const paused = observe(new MinecraftBasicStateTracker(), 0, null, { menu: "pause", noHud: true });
    const inventory = observe(new MinecraftBasicStateTracker(), 0, null, { menu: "container", noHud: true });
    const sleeping = observe(new MinecraftBasicStateTracker(), 0, null, { menu: "sleeping", noHud: true });
    const dead = observe(new MinecraftBasicStateTracker(), 0, null, { menu: "death", noHud: true });
    const water = observe(new MinecraftBasicStateTracker(), 0, null, { submerged: true });
    const fighting = observe(new MinecraftBasicStateTracker(), 0, null, { combat: true, damaged: true, hit: true });

    expect(paused.screen).toMatchObject({ status: "known", value: "pause" });
    expect(inventory.screen).toMatchObject({ status: "known", value: "inventory" });
    expect(sleeping.screen).toMatchObject({ status: "known", value: "sleeping" });
    expect(dead).toMatchObject({ screen: { value: "dead" }, life: { value: "dead" } });
    expect(water.environment).toMatchObject({ status: "known", value: "water" });
    expect(fighting.combat).toMatchObject({ status: "known", value: "fighting" });
  });

  it("publishes the scene environment without requiring a full HUD", () => {
    const state = new MinecraftBasicStateTracker().observe({
      observedAt: 0,
      cameraMotion: null,
      actionVisuals: null,
      menuState: menu(),
      hud: null,
      runtimeFacts: runtime({ environment: "forest" }),
    });

    expect(state.environment).toMatchObject({ status: "known", value: "forest" });
  });
});
