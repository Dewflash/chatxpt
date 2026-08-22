import type { MinecraftHudFact, MinecraftHudFingerprint } from "./minecraft-hud";
import type { MinecraftMenuState } from "./minecraft-menu";
import type { MinecraftSceneFacts } from "./minecraft-scene";
import type { MotionInterpretation } from "./motion-interpretation";

export interface MinecraftRuntimeFacts {
  readonly menuState: MinecraftHudFact<MinecraftMenuState>;
  readonly activity: MinecraftHudFact<
    "exploring" | "mining" | "building" | "combat" | "crafting" | "inventory" | "sleeping" | "recovering"
  >;
  readonly danger: MinecraftHudFact<"none" | "nearby-hostile" | "taking-damage" | "low-health" | "environmental-risk">;
  readonly recentDamage: MinecraftHudFact<boolean>;
  readonly likelyDamageCause: MinecraftHudFact<"mob" | "fall" | "fire" | "drowning" | "lava">;
  readonly visibleHostile: MinecraftHudFact<"skeleton" | "zombie" | "creeper" | "spider" | "unknown-hostile">;
  readonly biomeOrEnvironment: MinecraftHudFact<string>;
}

const UNKNOWN_RUNTIME_FACTS: MinecraftRuntimeFacts = {
  menuState: unknownRuntimeFact("Minecraft menu, inventory, sleep, and death screens are not parsed yet."),
  activity: unknownRuntimeFact("Minecraft-specific activity is not classified from this frame window."),
  danger: unknownRuntimeFact("Minecraft danger state is not confirmed."),
  recentDamage: unknownRuntimeFact("A previous confirmed health fact is required to detect recent damage."),
  likelyDamageCause: unknownRuntimeFact("Minecraft damage cause is not classified yet."),
  visibleHostile: unknownRuntimeFact("Visible Minecraft hostile mobs are not detected yet."),
  biomeOrEnvironment: unknownRuntimeFact("Minecraft biome or environment is not classified yet."),
};

function knownRuntimeFact<T extends string | number | boolean>(
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

function unknownRuntimeFact<T extends string | number | boolean>(
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

function knownNumber(fact: MinecraftHudFact<number>): number | null {
  return fact.status === "known" && typeof fact.value === "number" ? fact.value : null;
}

function healthSources(
  current: MinecraftHudFingerprint,
  previous: MinecraftHudFingerprint | null,
): readonly string[] {
  return [
    ...current.facts.healthHearts.sourceRegionIds,
    ...(previous?.facts.healthHearts.sourceRegionIds ?? []),
  ].filter((value, index, values) => values.indexOf(value) === index);
}

function damageFact(input: {
  readonly hud: MinecraftHudFingerprint;
  readonly previousHud: MinecraftHudFingerprint | null;
}): MinecraftHudFact<boolean> {
  const currentHealth = knownNumber(input.hud.facts.healthHearts);
  const previousHealth = input.previousHud === null
    ? null
    : knownNumber(input.previousHud.facts.healthHearts);
  if (currentHealth === null || previousHealth === null) {
    return unknownRuntimeFact(
      "Two confirmed health observations are required to detect recent Minecraft damage.",
      Math.min(input.hud.facts.healthHearts.confidence, input.previousHud?.facts.healthHearts.confidence ?? 0),
      input.hud.facts.healthHearts.sourceRegionIds,
    );
  }
  if (
    input.hud.facts.healthHearts.observedAt !== undefined &&
    input.previousHud?.facts.healthHearts.observedAt !== undefined &&
    input.hud.facts.healthHearts.observedAt <= input.previousHud.facts.healthHearts.observedAt
  ) {
    return unknownRuntimeFact(
      "The stable health value was carried forward while a changed reading is reconfirmed; no damage claim is emitted yet.",
      input.hud.facts.healthHearts.confidence,
      healthSources(input.hud, input.previousHud),
    );
  }
  const confidence = Math.min(input.hud.facts.healthHearts.confidence, input.previousHud?.facts.healthHearts.confidence ?? 0);
  const sourceRegionIds = healthSources(input.hud, input.previousHud);
  if (previousHealth - currentHealth >= 1) {
    return knownRuntimeFact(
      true,
      confidence,
      "Confirmed Minecraft health hearts dropped since the previous HUD observation.",
      sourceRegionIds,
    );
  }
  return knownRuntimeFact(
    false,
    confidence,
    "Confirmed Minecraft health hearts did not drop since the previous HUD observation.",
    sourceRegionIds,
  );
}

function likelyDamageCauseFact(input: {
  readonly recentDamage: MinecraftHudFact<boolean>;
  readonly sceneFacts: MinecraftSceneFacts | null;
}): MinecraftHudFact<"mob" | "fall" | "fire" | "drowning" | "lava"> {
  if (input.recentDamage.status !== "known" || input.recentDamage.value !== true) {
    return unknownRuntimeFact(
      "A confirmed recent health drop is required before Minecraft damage cause can be classified.",
      input.recentDamage.confidence,
      input.recentDamage.sourceRegionIds,
    );
  }
  if (input.sceneFacts?.damageCauseHint.status === "known" && input.sceneFacts.damageCauseHint.value !== null) {
    return knownRuntimeFact(
      input.sceneFacts.damageCauseHint.value,
      Math.min(input.recentDamage.confidence, input.sceneFacts.damageCauseHint.confidence),
      input.sceneFacts.damageCauseHint.reason,
      [...input.recentDamage.sourceRegionIds, ...input.sceneFacts.damageCauseHint.sourceRegionIds],
    );
  }
  return unknownRuntimeFact(
    "Health dropped, but scene evidence does not support a specific Minecraft damage cause; fall damage remains unknown.",
    input.recentDamage.confidence,
    input.recentDamage.sourceRegionIds,
  );
}

function dangerFact(input: {
  readonly hud: MinecraftHudFingerprint;
  readonly recentDamage: MinecraftHudFact<boolean>;
  readonly likelyDamageCause: MinecraftHudFact<"mob" | "fall" | "fire" | "drowning" | "lava">;
  readonly visibleHostile: MinecraftHudFact<"skeleton" | "zombie" | "creeper" | "spider" | "unknown-hostile">;
}): MinecraftHudFact<"none" | "nearby-hostile" | "taking-damage" | "low-health" | "environmental-risk"> {
  const health = knownNumber(input.hud.facts.healthHearts);
  if (health !== null && health <= 3) {
    return knownRuntimeFact(
      "low-health",
      input.hud.facts.healthHearts.confidence,
      "Confirmed Minecraft health is at or below the low-health threshold.",
      input.hud.facts.healthHearts.sourceRegionIds,
    );
  }
  if (input.recentDamage.status === "known" && input.recentDamage.value === true) {
    if (input.likelyDamageCause.status === "known" && input.likelyDamageCause.value === "mob") {
      return knownRuntimeFact(
        "taking-damage",
        Math.min(input.recentDamage.confidence, input.likelyDamageCause.confidence),
        "Health dropped and visible hostile evidence supports a mob-damage interpretation.",
        [...input.recentDamage.sourceRegionIds, ...input.likelyDamageCause.sourceRegionIds],
      );
    }
    if (
      input.likelyDamageCause.status === "known" &&
      input.likelyDamageCause.value !== null &&
      ["fire", "lava", "drowning"].includes(input.likelyDamageCause.value)
    ) {
      return knownRuntimeFact(
        "environmental-risk",
        Math.min(input.recentDamage.confidence, input.likelyDamageCause.confidence),
        "Health dropped and scene evidence supports an environmental damage interpretation.",
        [...input.recentDamage.sourceRegionIds, ...input.likelyDamageCause.sourceRegionIds],
      );
    }
  }
  if (input.visibleHostile.status === "known") {
    return knownRuntimeFact(
      "nearby-hostile",
      input.visibleHostile.confidence,
      "A hostile-like Minecraft shape is visible, but no confirmed health drop is required for nearby-danger context.",
      input.visibleHostile.sourceRegionIds,
    );
  }
  if (input.recentDamage.status === "known" && input.recentDamage.value === true) {
    return unknownRuntimeFact(
      "Health dropped, but the cause is unknown; do not treat it as hostile danger or environmental risk.",
      input.recentDamage.confidence,
      input.recentDamage.sourceRegionIds,
    );
  }
  if (input.recentDamage.status === "known" && input.recentDamage.value === false && health !== null && health > 3) {
    return knownRuntimeFact(
      "none",
      Math.min(input.recentDamage.confidence, input.hud.facts.healthHearts.confidence),
      "Health is above the low-health threshold and no recent health drop was observed.",
      healthSources(input.hud, null),
    );
  }
  return unknownRuntimeFact("Minecraft danger state is not confirmed.");
}

function activityFromKnownMenu(
  menuState: MinecraftHudFact<MinecraftMenuState>,
): MinecraftHudFact<"crafting" | "inventory" | "sleeping"> | null {
  if (menuState.status !== "known" || menuState.value === null) return null;
  if (menuState.value === "sleeping") {
    return knownRuntimeFact(
      "sleeping",
      menuState.confidence,
      "The Minecraft menu-state detector identified a sleep overlay.",
      menuState.sourceRegionIds,
    );
  }
  if (menuState.value === "inventory" || menuState.value === "crafting") {
    return knownRuntimeFact(
      menuState.value,
      menuState.confidence,
      "The Minecraft menu-state detector identified an inventory or crafting panel.",
      menuState.sourceRegionIds,
    );
  }
  if (menuState.value === "container") {
    return knownRuntimeFact(
      "inventory",
      menuState.confidence,
      "A Minecraft container screen is open; exact inventory, crafting, or furnace activity remains unknown.",
      menuState.sourceRegionIds,
    );
  }
  return null;
}

function activityFact(input: {
  readonly hud: MinecraftHudFingerprint;
  readonly interpretation: MotionInterpretation;
  readonly menuState: MinecraftHudFact<MinecraftMenuState>;
  readonly danger: MinecraftHudFact<"none" | "nearby-hostile" | "taking-damage" | "low-health" | "environmental-risk">;
  readonly visibleHostile: MinecraftHudFact<"skeleton" | "zombie" | "creeper" | "spider" | "unknown-hostile">;
  readonly selectedHotbarCategory: MinecraftHudFact<"tool" | "weapon" | "food" | "block" | "empty">;
}): MinecraftHudFact<
  "exploring" | "mining" | "building" | "combat" | "crafting" | "inventory" | "sleeping" | "recovering"
> {
  const menuActivity = activityFromKnownMenu(input.menuState);
  if (menuActivity !== null) return menuActivity;
  if (input.interpretation.status !== "known") {
    return unknownRuntimeFact("Recent motion evidence is insufficient for Minecraft activity classification.");
  }
  if (input.danger.status === "known" && input.danger.value === "low-health" && input.interpretation.state === "stable") {
    return knownRuntimeFact(
      "recovering",
      Math.min(input.danger.confidence, input.interpretation.confidence),
      "The HUD shows low health while the recent visual window is stable.",
      input.danger.sourceRegionIds,
    );
  }
  if (
    input.visibleHostile.status === "known" &&
    ["coherent-global-motion", "rapid-coherent-global-motion", "erratic-global-motion"].includes(input.interpretation.state)
  ) {
    return knownRuntimeFact(
      "combat",
      Math.min(0.78, input.visibleHostile.confidence, input.interpretation.confidence),
      "A hostile-like shape is visible while recent motion suggests active engagement.",
      input.visibleHostile.sourceRegionIds,
    );
  }
  if (
    input.selectedHotbarCategory.status === "known" &&
    input.selectedHotbarCategory.value === "tool" &&
    input.interpretation.state === "mixed-local-action"
  ) {
    return knownRuntimeFact(
      "mining",
      Math.min(0.72, input.selectedHotbarCategory.confidence, input.interpretation.confidence),
      "A tool-like selected item and local visual activity support a conservative mining/building-adjacent interpretation.",
      input.selectedHotbarCategory.sourceRegionIds,
    );
  }
  if (
    input.selectedHotbarCategory.status === "known" &&
    input.selectedHotbarCategory.value === "block" &&
    input.interpretation.state === "mixed-local-action"
  ) {
    return knownRuntimeFact(
      "building",
      Math.min(0.72, input.selectedHotbarCategory.confidence, input.interpretation.confidence),
      "A block-like selected item and local visual activity support a conservative building interpretation.",
      input.selectedHotbarCategory.sourceRegionIds,
    );
  }
  if (
    input.danger.status === "known" &&
    input.danger.value === "none" &&
    ["coherent-global-motion", "rapid-coherent-global-motion"].includes(input.interpretation.state)
  ) {
    return knownRuntimeFact(
      "exploring",
      Math.min(0.82, input.interpretation.confidence),
      "The Minecraft HUD is confirmed and recent motion is coherent traversal without known danger.",
      input.hud.facts.hotbarVisible.sourceRegionIds,
    );
  }
  return unknownRuntimeFact(
    "Observed motion is insufficient to distinguish mining, building, combat, crafting, inventory, or sleep.",
    input.interpretation.confidence,
  );
}

export function deriveMinecraftRuntimeFacts(input: {
  readonly hud: MinecraftHudFingerprint | null;
  readonly previousHud: MinecraftHudFingerprint | null;
  readonly menuState: MinecraftHudFact<MinecraftMenuState>;
  readonly interpretation: MotionInterpretation;
  readonly sceneFacts?: MinecraftSceneFacts | null;
}): MinecraftRuntimeFacts {
  if (
    input.menuState.status === "known" &&
    input.menuState.value !== null &&
    input.menuState.value !== "none"
  ) {
    return {
      ...UNKNOWN_RUNTIME_FACTS,
      menuState: input.menuState,
      activity: activityFromKnownMenu(input.menuState) ?? UNKNOWN_RUNTIME_FACTS.activity,
      recentDamage: unknownRuntimeFact(
        "Health and action deltas are gated while a Minecraft menu or container overlay is open.",
        input.menuState.confidence,
        input.menuState.sourceRegionIds,
      ),
    };
  }
  if (!confirmedHud(input.hud)) {
    return {
      ...UNKNOWN_RUNTIME_FACTS,
      menuState: input.menuState,
      activity: activityFromKnownMenu(input.menuState) ?? UNKNOWN_RUNTIME_FACTS.activity,
      visibleHostile: input.sceneFacts?.visibleHostile ?? UNKNOWN_RUNTIME_FACTS.visibleHostile,
      biomeOrEnvironment: input.sceneFacts?.biomeOrEnvironment ?? UNKNOWN_RUNTIME_FACTS.biomeOrEnvironment,
    };
  }
  const recentDamage = damageFact({ hud: input.hud, previousHud: input.previousHud });
  const likelyDamageCause = likelyDamageCauseFact({
    recentDamage,
    sceneFacts: input.sceneFacts ?? null,
  });
  const visibleHostile = input.sceneFacts?.visibleHostile ?? UNKNOWN_RUNTIME_FACTS.visibleHostile;
  const danger = dangerFact({ hud: input.hud, recentDamage, likelyDamageCause, visibleHostile });
  return {
    menuState: input.menuState,
    activity: activityFact({
      hud: input.hud,
      interpretation: input.interpretation,
      menuState: input.menuState,
      danger,
      visibleHostile,
      selectedHotbarCategory: input.hud.facts.selectedHotbarCategory,
    }),
    danger,
    recentDamage,
    likelyDamageCause,
    visibleHostile,
    biomeOrEnvironment: input.sceneFacts?.biomeOrEnvironment ?? UNKNOWN_RUNTIME_FACTS.biomeOrEnvironment,
  };
}
