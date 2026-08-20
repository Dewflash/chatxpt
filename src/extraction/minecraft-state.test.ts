import { describe, expect, it } from "vitest";

import {
  knownMinecraftFact,
  minecraftFactSchema,
  minecraftGameFactsSchema,
  minecraftSupportedFacts,
  minecraftUnknownFacts,
  unknownMinecraftFact,
} from "./minecraft-state";

const NOW = 1_786_000_000_000;

function unknown(reason: string) {
  return unknownMinecraftFact(reason, {
    observedAt: NOW,
    method: "minecraft-state-test",
  });
}

describe("Minecraft state schema", () => {
  it("keeps known facts, unknown facts, and source IDs explicit", () => {
    const health = knownMinecraftFact(8, {
      observedAt: NOW,
      method: "minecraft-hud-pixel-test",
      sourceSignalIds: ["minecraft-health-hearts"],
      confidence: 0.9,
    });
    const menu = unknownMinecraftFact("Menu state is not parsed by this detector.", {
      observedAt: NOW,
      method: "minecraft-hud-pixel-test",
      confidence: 0,
    });

    expect(health).toMatchObject({
      status: "known",
      value: 8,
      sourceSignalIds: ["minecraft-health-hearts"],
    });
    expect(menu).toMatchObject({
      status: "unknown",
      value: null,
      reason: "Menu state is not parsed by this detector.",
    });
  });

  it("rejects ambiguous fact payloads", () => {
    expect(() =>
      minecraftFactSchema.parse({
        status: "known",
        value: null,
        confidence: 0.8,
        observedAt: NOW,
        expiresAt: NOW + 1_000,
        method: "fixture",
        sourceSignalIds: [],
      }),
    ).toThrow();
    expect(() =>
      minecraftFactSchema.parse({
        status: "unknown",
        value: "sleeping",
        confidence: 0,
        observedAt: NOW,
        expiresAt: NOW + 1_000,
        method: "fixture",
        sourceSignalIds: [],
        reason: "fixture",
      }),
    ).toThrow();
  });

  it("lists supported and unknown fact keys for model context", () => {
    const facts = minecraftGameFactsSchema.parse({
      edition: knownMinecraftFact("java", { observedAt: NOW, method: "profile", confidence: 0.9 }),
      mode: unknown("Mode is not confirmed."),
      hudLayout: knownMinecraftFact("vanilla-like", { observedAt: NOW, method: "hud", confidence: 0.91 }),
      healthHearts: knownMinecraftFact(10, { observedAt: NOW, method: "hud", confidence: 0.9 }),
      hungerShanks: knownMinecraftFact(8, { observedAt: NOW, method: "hud", confidence: 0.85 }),
      armorPoints: unknown("Armor is not parsed."),
      hotbarVisible: knownMinecraftFact(true, { observedAt: NOW, method: "hud", confidence: 0.88 }),
      selectedHotbarCategory: unknown("Selected slot category is not parsed."),
      menuState: unknown("Menu state is not parsed."),
      activity: unknown("Minecraft activity is not classified."),
      danger: unknown("Danger is not classified."),
      recentDamage: unknown("Recent damage is not detected."),
      likelyDamageCause: unknown("Damage cause is not classified."),
      visibleHostile: unknown("Hostiles are not detected."),
      biomeOrEnvironment: unknown("Biome is not classified."),
    });

    expect(minecraftSupportedFacts(facts)).toEqual([
      "edition",
      "hudLayout",
      "healthHearts",
      "hungerShanks",
      "hotbarVisible",
    ]);
    expect(minecraftUnknownFacts(facts)).toEqual(
      expect.arrayContaining(["mode", "menuState", "likelyDamageCause", "visibleHostile"]),
    );
  });
});
