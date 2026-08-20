import { describe, expect, it } from "vitest";

import type { MinecraftHudFact, MinecraftHudFingerprint } from "./minecraft-hud";
import { deriveMinecraftRuntimeFacts } from "./minecraft-runtime";
import type { MinecraftSceneFacts } from "./minecraft-scene";
import type { MotionInterpretation } from "./motion-interpretation";

const NOW = 1_786_000_000_000;

function fact<T extends string | number | boolean>(value: T, confidence = 0.9) {
  return {
    status: "known" as const,
    value,
    confidence,
    reason: "runtime fixture",
    sourceRegionIds: ["minecraft-health-search"],
  };
}

function unknown<T extends string | number | boolean>(reason: string): MinecraftHudFact<T> {
  return {
    status: "unknown" as const,
    value: null,
    confidence: 0,
    reason,
    sourceRegionIds: [],
  };
}

function unknownMenu(): MinecraftHudFact<"inventory" | "crafting" | "sleeping" | "pause" | "none"> {
  return unknown("menu unknown");
}

function hud(
  healthHearts: number,
  selectedHotbarCategory: MinecraftHudFingerprint["facts"]["selectedHotbarCategory"] = unknown<"tool" | "weapon" | "food" | "block" | "empty">("slot unsupported"),
): MinecraftHudFingerprint {
  return {
    status: "vanilla-like",
    confidence: 0.9,
    detectedAnchors: ["minecraft-health", "minecraft-hunger", "minecraft-hotbar"],
    missingAnchors: [],
    supportedSignals: ["minecraft-hud-layout"],
    reasons: ["fixture"],
    features: [],
    facts: {
      healthHearts: fact(healthHearts),
      hungerShanks: fact(8),
      armorPoints: unknown<number>("armor unsupported"),
      hotbarVisible: {
        status: "known",
        value: true,
        confidence: 0.9,
        reason: "fixture",
        sourceRegionIds: ["minecraft-hotbar-search"],
      },
      selectedHotbarCategory,
    },
  };
}

function sceneFacts(input: {
  readonly hostile?: "skeleton" | "zombie" | "creeper" | "spider" | "unknown-hostile";
  readonly environment?: string;
  readonly damageCause?: "mob" | "fire" | "drowning" | "lava";
}): MinecraftSceneFacts {
  return {
    visibleHostile: input.hostile === undefined ? unknown("no hostile") : fact(input.hostile, 0.76),
    biomeOrEnvironment: input.environment === undefined ? unknown("environment unknown") : fact(input.environment, 0.78),
    damageCauseHint: input.damageCause === undefined ? unknown("damage cause unknown") : fact(input.damageCause, 0.74),
  };
}

function interpretation(
  state: MotionInterpretation["state"],
  confidence = 0.9,
): MotionInterpretation {
  return {
    status: "known",
    state,
    confidence,
    observedAt: NOW,
    windowStartsAt: NOW - 600,
    sampleCount: 3,
    reasons: ["fixture"],
  };
}

describe("Minecraft runtime fact derivation", () => {
  it("detects recent health drops without inventing a damage cause or hostile danger", () => {
    const facts = deriveMinecraftRuntimeFacts({
      previousHud: hud(10),
      hud: hud(8),
      menuState: unknownMenu(),
      interpretation: interpretation("stable"),
    });

    expect(facts.recentDamage).toMatchObject({ status: "known", value: true });
    expect(facts.danger).toMatchObject({ status: "unknown", value: null });
    expect(facts.likelyDamageCause).toMatchObject({ status: "unknown", value: null });
    expect(facts.visibleHostile).toMatchObject({ status: "unknown", value: null });
  });

  it("uses hostile scene evidence to distinguish mob damage from a plain health drop", () => {
    const facts = deriveMinecraftRuntimeFacts({
      previousHud: hud(10),
      hud: hud(8),
      menuState: unknownMenu(),
      interpretation: interpretation("erratic-global-motion"),
      sceneFacts: sceneFacts({ hostile: "skeleton", damageCause: "mob" }),
    });

    expect(facts.recentDamage).toMatchObject({ status: "known", value: true });
    expect(facts.likelyDamageCause).toMatchObject({ status: "known", value: "mob" });
    expect(facts.visibleHostile).toMatchObject({ status: "known", value: "skeleton" });
    expect(facts.danger).toMatchObject({ status: "known", value: "taking-damage" });
    expect(facts.activity).toMatchObject({ status: "known", value: "combat" });
  });

  it("uses lava scene evidence as environmental risk only when health drops", () => {
    const facts = deriveMinecraftRuntimeFacts({
      previousHud: hud(9),
      hud: hud(7),
      menuState: unknownMenu(),
      interpretation: interpretation("stable"),
      sceneFacts: sceneFacts({ environment: "lava-or-fire-nearby", damageCause: "lava" }),
    });

    expect(facts.likelyDamageCause).toMatchObject({ status: "known", value: "lava" });
    expect(facts.danger).toMatchObject({ status: "known", value: "environmental-risk" });
    expect(facts.biomeOrEnvironment).toMatchObject({ status: "known", value: "lava-or-fire-nearby" });
  });

  it("does not classify a lava scene as damage cause without a health drop", () => {
    const facts = deriveMinecraftRuntimeFacts({
      previousHud: hud(9),
      hud: hud(9),
      menuState: unknownMenu(),
      interpretation: interpretation("stable"),
      sceneFacts: sceneFacts({ environment: "lava-or-fire-nearby", damageCause: "lava" }),
    });

    expect(facts.recentDamage).toMatchObject({ status: "known", value: false });
    expect(facts.likelyDamageCause).toMatchObject({ status: "unknown", value: null });
  });

  it("uses selected hotbar category and local motion for mining or building hints", () => {
    const facts = deriveMinecraftRuntimeFacts({
      previousHud: hud(10),
      hud: hud(10, fact("tool", 0.86)),
      menuState: unknownMenu(),
      interpretation: interpretation("mixed-local-action"),
    });

    expect(facts.activity).toMatchObject({ status: "known", value: "mining" });
  });

  it("marks low health as danger and stable low-health windows as recovering", () => {
    const facts = deriveMinecraftRuntimeFacts({
      previousHud: hud(3),
      hud: hud(3),
      menuState: unknownMenu(),
      interpretation: interpretation("stable"),
    });

    expect(facts.recentDamage).toMatchObject({ status: "known", value: false });
    expect(facts.danger).toMatchObject({ status: "known", value: "low-health" });
    expect(facts.activity).toMatchObject({ status: "known", value: "recovering" });
  });

  it("classifies only broad safe traversal as exploring", () => {
    const facts = deriveMinecraftRuntimeFacts({
      previousHud: hud(10),
      hud: hud(10),
      menuState: unknownMenu(),
      interpretation: interpretation("rapid-coherent-global-motion"),
    });

    expect(facts.danger).toMatchObject({ status: "known", value: "none" });
    expect(facts.activity).toMatchObject({ status: "known", value: "exploring" });
    expect(facts.menuState).toMatchObject({ status: "unknown", value: null });
  });

  it("preserves known sleeping menu state even when the HUD is not confirmed", () => {
    const facts = deriveMinecraftRuntimeFacts({
      previousHud: null,
      hud: null,
      menuState: {
        status: "known",
        value: "sleeping",
        confidence: 0.9,
        reason: "sleep fixture",
        sourceRegionIds: ["minecraft-menu-lower-controls"],
      },
      interpretation: interpretation("stable"),
    });

    expect(facts.menuState).toMatchObject({ status: "known", value: "sleeping" });
    expect(facts.activity).toMatchObject({ status: "known", value: "sleeping" });
    expect(facts.recentDamage).toMatchObject({ status: "unknown", value: null });
  });
});
