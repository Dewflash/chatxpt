export const STUDIO_GAME_PROFILE_OPTIONS = [
  { value: "minecraft", label: "Minecraft", gameId: "minecraft", gameName: "Minecraft" },
  { value: "brawl-stars", label: "Brawl Stars", gameId: "brawl-stars", gameName: "Brawl Stars" },
  { value: "generic", label: "Generic game", gameId: "generic", gameName: "Generic game" },
] as const;

export type StudioGameProfileId = (typeof STUDIO_GAME_PROFILE_OPTIONS)[number]["value"];

export function studioGameProfileOption(value: StudioGameProfileId) {
  return STUDIO_GAME_PROFILE_OPTIONS.find((option) => option.value === value) ?? STUDIO_GAME_PROFILE_OPTIONS[2];
}

export function studioGameProfileIdFor(
  game: { readonly gameId: string | null; readonly gameName: string | null } | null,
): StudioGameProfileId {
  const gameId = game?.gameId?.toLowerCase() ?? "";
  const gameName = game?.gameName?.toLowerCase() ?? "";
  if (gameId.includes("minecraft") || gameName.includes("minecraft")) return "minecraft";
  if (gameId.includes("brawl") || gameName.includes("brawl")) return "brawl-stars";
  return "generic";
}
