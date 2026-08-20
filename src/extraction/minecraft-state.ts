import { z } from "zod";

import { confidenceSchema, identifierSchema, signalValueSchema, timestampSchema } from "../core";

export const minecraftFactStatusSchema = z.enum([
  "known",
  "unknown",
  "stale",
  "conflicting",
  "unsupported",
]);

export const minecraftFactSchema = z
  .object({
    status: minecraftFactStatusSchema,
    value: signalValueSchema.nullable(),
    confidence: confidenceSchema,
    observedAt: timestampSchema,
    expiresAt: timestampSchema,
    method: z.string().trim().min(1).max(80),
    sourceSignalIds: z.array(identifierSchema).max(16),
    reason: z.string().trim().min(1).max(160).optional(),
  })
  .strict()
  .superRefine((fact, context) => {
    if (fact.expiresAt <= fact.observedAt) {
      context.addIssue({
        code: "custom",
        message: "Minecraft facts must expire after they are observed",
        path: ["expiresAt"],
      });
    }
    if (fact.status === "known" && fact.value === null) {
      context.addIssue({
        code: "custom",
        message: "Known Minecraft facts require a value",
        path: ["value"],
      });
    }
    if (fact.status !== "known" && fact.value !== null) {
      context.addIssue({
        code: "custom",
        message: "Only known Minecraft facts can carry a value",
        path: ["value"],
      });
    }
    if (fact.status !== "known" && fact.reason === undefined) {
      context.addIssue({
        code: "custom",
        message: "Unknown, stale, conflicting, and unsupported Minecraft facts require a reason",
        path: ["reason"],
      });
    }
    if (new Set(fact.sourceSignalIds).size !== fact.sourceSignalIds.length) {
      context.addIssue({
        code: "custom",
        message: "Minecraft fact sourceSignalIds must be distinct",
        path: ["sourceSignalIds"],
      });
    }
  });

export type MinecraftFactStatus = z.infer<typeof minecraftFactStatusSchema>;
export type MinecraftFact = z.infer<typeof minecraftFactSchema>;

export const minecraftGameFactsSchema = z
  .object({
    edition: minecraftFactSchema,
    mode: minecraftFactSchema,
    hudLayout: minecraftFactSchema,
    healthHearts: minecraftFactSchema,
    hungerShanks: minecraftFactSchema,
    armorPoints: minecraftFactSchema,
    hotbarVisible: minecraftFactSchema,
    selectedHotbarCategory: minecraftFactSchema,
    menuState: minecraftFactSchema,
    activity: minecraftFactSchema,
    danger: minecraftFactSchema,
    recentDamage: minecraftFactSchema,
    likelyDamageCause: minecraftFactSchema,
    visibleHostile: minecraftFactSchema,
    biomeOrEnvironment: minecraftFactSchema,
  })
  .strict();

export type MinecraftGameFacts = z.infer<typeof minecraftGameFactsSchema>;

export const minecraftIntentContextSchema = z
  .object({
    streamerGoal: z.string().trim().min(1).max(240).nullable(),
  })
  .strict();

export type MinecraftIntentContext = z.infer<typeof minecraftIntentContextSchema>;

export const minecraftAwareContextSchema = z
  .object({
    gameId: z.literal("minecraft"),
    gameFacts: minecraftGameFactsSchema,
    streamerIntent: minecraftIntentContextSchema,
    activeChatXptQuest: z.string().trim().min(1).max(240).nullable(),
    supportedFacts: z.array(identifierSchema).max(64),
    unknownFacts: z.array(identifierSchema).max(64),
  })
  .strict()
  .superRefine((contextValue, context) => {
    const supported = new Set(contextValue.supportedFacts);
    if (supported.size !== contextValue.supportedFacts.length) {
      context.addIssue({
        code: "custom",
        message: "supportedFacts must be distinct",
        path: ["supportedFacts"],
      });
    }
    const unknown = new Set(contextValue.unknownFacts);
    if (unknown.size !== contextValue.unknownFacts.length) {
      context.addIssue({
        code: "custom",
        message: "unknownFacts must be distinct",
        path: ["unknownFacts"],
      });
    }
  });

export type MinecraftAwareContext = z.infer<typeof minecraftAwareContextSchema>;

export interface MinecraftFactInput {
  readonly observedAt: number;
  readonly expiresAt?: number;
  readonly method: string;
  readonly sourceSignalIds?: readonly string[];
  readonly confidence?: number;
  readonly reason?: string;
}

const DEFAULT_FACT_TTL_MS = 3_000;

function factBase(input: MinecraftFactInput) {
  return {
    confidence: input.confidence ?? 0,
    observedAt: input.observedAt,
    expiresAt: input.expiresAt ?? input.observedAt + DEFAULT_FACT_TTL_MS,
    method: input.method,
    sourceSignalIds: [...(input.sourceSignalIds ?? [])],
  };
}

export function knownMinecraftFact(
  value: string | number | boolean,
  input: MinecraftFactInput,
): MinecraftFact {
  return minecraftFactSchema.parse({
    status: "known",
    value,
    ...factBase({ ...input, confidence: input.confidence ?? 1 }),
  });
}

export function unknownMinecraftFact(
  reason: string,
  input: MinecraftFactInput,
  status: Exclude<MinecraftFactStatus, "known"> = "unknown",
): MinecraftFact {
  return minecraftFactSchema.parse({
    status,
    value: null,
    reason,
    ...factBase(input),
  });
}

export function isKnownMinecraftFact(fact: MinecraftFact): boolean {
  return fact.status === "known";
}

export function minecraftUnknownFacts(facts: MinecraftGameFacts): readonly string[] {
  return Object.entries(facts)
    .filter(([, fact]) => fact.status !== "known")
    .map(([key]) => key);
}

export function minecraftSupportedFacts(facts: MinecraftGameFacts): readonly string[] {
  return Object.entries(facts)
    .filter(([, fact]) => fact.status === "known")
    .map(([key]) => key);
}
