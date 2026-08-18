import { z } from "zod";

const identifierSchema = z.string().trim().min(1).max(80).regex(/^[a-z0-9][a-z0-9-]*$/);

export const normalizedVisualRegionSchema = z
  .object({
    regionId: identifierSchema,
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    width: z.number().positive().max(1),
    height: z.number().positive().max(1),
    purpose: z.enum(["motion-exclusion", "hud-anchor", "ocr", "template"]),
  })
  .strict()
  .superRefine((region, context) => {
    if (region.x + region.width > 1 + Number.EPSILON) {
      context.addIssue({ code: "custom", message: "region exceeds the frame width", path: ["width"] });
    }
    if (region.y + region.height > 1 + Number.EPSILON) {
      context.addIssue({ code: "custom", message: "region exceeds the frame height", path: ["height"] });
    }
  });

export const gameCalibrationProfileSchema = z
  .object({
    profileId: identifierSchema,
    gameId: identifierSchema.nullable(),
    displayName: z.string().trim().min(1).max(100),
    variant: z.string().trim().min(1).max(100),
    calibrationVersion: z.number().int().positive(),
    universalSignals: z.array(identifierSchema).min(1).max(32),
    calibratedSignalCandidates: z.array(identifierSchema).max(32),
    regions: z.array(normalizedVisualRegionSchema).max(32),
  })
  .strict()
  .superRefine((profile, context) => {
    for (const [path, values] of [
      ["universalSignals", profile.universalSignals],
      ["calibratedSignalCandidates", profile.calibratedSignalCandidates],
      ["regions", profile.regions.map(({ regionId }) => regionId)],
    ] as const) {
      if (new Set(values).size !== values.length) {
        context.addIssue({ code: "custom", message: `${path} must be distinct`, path: [path] });
      }
    }
    if (profile.gameId === null && profile.calibratedSignalCandidates.length > 0) {
      context.addIssue({
        code: "custom",
        message: "generic profiles cannot advertise calibrated signal candidates",
        path: ["calibratedSignalCandidates"],
      });
    }
  });

export type NormalizedVisualRegion = z.infer<typeof normalizedVisualRegionSchema>;
export type GameCalibrationProfile = z.infer<typeof gameCalibrationProfileSchema>;

const UNIVERSAL_SIGNALS = [
  "activity-intensity",
  "visual-state",
  "global-motion-pattern",
  "scene-transition",
] as const;

export const genericActionGameProfile = gameCalibrationProfileSchema.parse({
  profileId: "generic-action-v1",
  gameId: null,
  displayName: "Generic action game",
  variant: "universal visual analysis",
  calibrationVersion: 1,
  universalSignals: UNIVERSAL_SIGNALS,
  calibratedSignalCandidates: [],
  regions: [],
});

export const brawlStarsGameProfile = gameCalibrationProfileSchema.parse({
  profileId: "brawl-stars-standard-v1",
  gameId: "brawl-stars",
  displayName: "Brawl Stars",
  variant: "standard spectator-free HUD",
  calibrationVersion: 1,
  universalSignals: UNIVERSAL_SIGNALS,
  calibratedSignalCandidates: [
    "brawl-hud-layout",
    "match-active",
    "match-timer",
    "match-score",
    "match-outcome",
  ],
  regions: [
    { regionId: "brawl-left-score", x: 0, y: 0, width: 0.16, height: 0.14, purpose: "hud-anchor" },
    { regionId: "brawl-right-score", x: 0.86, y: 0, width: 0.14, height: 0.14, purpose: "hud-anchor" },
    { regionId: "brawl-timer-anchor", x: 0.47, y: 0.015, width: 0.06, height: 0.085, purpose: "hud-anchor" },
    { regionId: "brawl-match-timer", x: 0.47, y: 0.015, width: 0.06, height: 0.085, purpose: "ocr" },
    { regionId: "brawl-center-overlay", x: 0.2, y: 0.12, width: 0.6, height: 0.5, purpose: "ocr" },
    { regionId: "brawl-lower-controls", x: 0, y: 0.78, width: 1, height: 0.22, purpose: "motion-exclusion" },
  ],
});

export const minecraftJavaGameProfile = gameCalibrationProfileSchema.parse({
  profileId: "minecraft-java-vanilla-v1",
  gameId: "minecraft",
  displayName: "Minecraft Java Edition",
  variant: "vanilla HUD baseline",
  calibrationVersion: 1,
  universalSignals: UNIVERSAL_SIGNALS,
  calibratedSignalCandidates: [
    "minecraft-hud-layout",
    "player-health",
    "player-hunger",
    "menu-state",
    "death-state",
  ],
  regions: [
    { regionId: "minecraft-health", x: 0.3, y: 0.79, width: 0.2, height: 0.1, purpose: "hud-anchor" },
    { regionId: "minecraft-hunger", x: 0.5, y: 0.79, width: 0.2, height: 0.1, purpose: "hud-anchor" },
    { regionId: "minecraft-hotbar", x: 0.3, y: 0.88, width: 0.4, height: 0.12, purpose: "hud-anchor" },
    { regionId: "minecraft-crosshair", x: 0.46, y: 0.42, width: 0.08, height: 0.16, purpose: "hud-anchor" },
    { regionId: "minecraft-bottom-hud", x: 0.25, y: 0.76, width: 0.5, height: 0.24, purpose: "motion-exclusion" },
  ],
});

export const gameProfileSelectionSchema = z
  .object({
    requestedGameId: identifierSchema.nullable(),
    requestedProfileId: identifierSchema.nullable().optional(),
    source: z.enum(["streamer-config", "platform-category", "visual-inference", "unknown"]),
    confidence: z.number().min(0).max(1),
  })
  .strict();

export type GameProfileSelection = z.infer<typeof gameProfileSelectionSchema>;

export interface ResolvedGameProfile {
  readonly profile: GameCalibrationProfile;
  readonly match: "exact-profile" | "game-default" | "generic-fallback" | "identity-unverified";
  readonly identityTrusted: boolean;
  readonly reason: string;
}

export class GameProfileRegistry {
  private readonly byProfileId = new Map<string, GameCalibrationProfile>();
  private readonly byGameId = new Map<string, GameCalibrationProfile[]>();
  private readonly generic: GameCalibrationProfile;

  constructor(profiles: readonly GameCalibrationProfile[]) {
    if (profiles.length === 0) throw new RangeError("game profile registry cannot be empty");
    const parsed = profiles.map((profile) => gameCalibrationProfileSchema.parse(profile));
    for (const profile of parsed) {
      if (this.byProfileId.has(profile.profileId)) {
        throw new RangeError(`duplicate game profile ${profile.profileId}`);
      }
      this.byProfileId.set(profile.profileId, profile);
      if (profile.gameId !== null) {
        const gameProfiles = this.byGameId.get(profile.gameId) ?? [];
        gameProfiles.push(profile);
        this.byGameId.set(profile.gameId, gameProfiles);
      }
    }
    const genericProfiles = parsed.filter(({ gameId }) => gameId === null);
    if (genericProfiles.length !== 1) {
      throw new RangeError("game profile registry requires exactly one generic profile");
    }
    this.generic = genericProfiles[0];
  }

  list(): readonly GameCalibrationProfile[] {
    return [...this.byProfileId.values()];
  }

  resolve(selection: GameProfileSelection): ResolvedGameProfile {
    const parsed = gameProfileSelectionSchema.parse(selection);
    const identityTrusted =
      (parsed.source === "streamer-config" || parsed.source === "platform-category") &&
      parsed.confidence >= 0.8;
    if (parsed.requestedGameId !== null && !identityTrusted) {
      return {
        profile: this.generic,
        match: "identity-unverified",
        identityTrusted: false,
        reason: "Game-specific analysis requires a trusted configured game or platform category.",
      };
    }
    if (parsed.requestedProfileId !== undefined && parsed.requestedProfileId !== null) {
      const exact = this.byProfileId.get(parsed.requestedProfileId);
      if (exact !== undefined && exact.gameId === parsed.requestedGameId) {
        return {
          profile: exact,
          match: "exact-profile",
          identityTrusted,
          reason: "The requested calibrated profile matches the trusted game identity.",
        };
      }
    }
    if (parsed.requestedGameId !== null) {
      const firstGameProfile = this.byGameId.get(parsed.requestedGameId)?.[0];
      if (firstGameProfile !== undefined) {
        return {
          profile: firstGameProfile,
          match: "game-default",
          identityTrusted,
          reason: "The trusted game identity selected its default calibrated profile.",
        };
      }
    }
    return {
      profile: this.generic,
      match: "generic-fallback",
      identityTrusted: parsed.requestedGameId === null && identityTrusted,
      reason: "No supported calibrated profile matched; universal visual analysis remains available.",
    };
  }
}

export function createDefaultGameProfileRegistry(): GameProfileRegistry {
  return new GameProfileRegistry([
    genericActionGameProfile,
    brawlStarsGameProfile,
    minecraftJavaGameProfile,
  ]);
}
