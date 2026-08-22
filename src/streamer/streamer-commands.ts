import {
  CONTRACT_VERSION,
  streamerEmergencyClearCommandSchema,
  streamerCurrentGameCommandSchema,
  streamerLiveDirectorCueCommandSchema,
  streamerLiveDirectorIntentCommandSchema,
  streamerProfileSchema,
  streamerProfileSettingsCommandSchema,
  streamerQuestGenerationCommandSchema,
  streamerSessionOverrideCommandSchema,
  streamerQuestCommandSchema,
  streamerQuestProgressCommandSchema,
  streamerServiceCommandSchema,
  type StreamerEmergencyClearCommand,
  type StreamerCurrentGameCommand,
  type DirectorCueAction,
  type StreamerLiveDirectorCueCommand,
  type StreamerLiveDirectorIntentCommand,
  type StreamerProfileSettingsCommand,
  type StreamerQuestGenerationCommand,
  type StreamerSessionOverrideCommand,
  type StreamerQuestAction,
  type StreamerQuestCommand,
  type StreamerQuestProgressCommand,
  type StreamerRewardPreferences,
  type StreamerDesktopDirectorPreferences,
  type StreamerProfile,
  type StreamPreset,
  type StreamerServiceCommand,
  type StreamerSetupAction,
  type StreamerSetupServiceId,
  type StreamerViewModel,
  type StreamerVotingPreferences,
} from "../core";

export type StreamerUiCommand =
  | StreamerProfileSettingsCommand
  | StreamerCurrentGameCommand
  | StreamerQuestGenerationCommand
  | StreamerSessionOverrideCommand
  | StreamerLiveDirectorIntentCommand
  | StreamerLiveDirectorCueCommand
  | StreamerQuestCommand
  | StreamerQuestProgressCommand
  | StreamerEmergencyClearCommand
  | StreamerServiceCommand;

export interface StreamerCommandFactory {
  readonly createId: (prefix: string) => string;
  readonly now: () => number;
}

export interface EditableProfileDefaults {
  readonly gameId: string | null;
  readonly gameName: string | null;
  readonly experience: Readonly<Record<string, number>>;
  readonly restrictions: readonly string[];
  readonly preferredQuestTypes: readonly string[];
  readonly forbiddenQuestTypes: readonly string[];
  readonly accessibilityNeeds: readonly string[];
  readonly keywordWatchlist: readonly string[];
  readonly streamPresets: readonly StreamPreset[];
  readonly selectedPresetId: string | null;
  readonly desktopDirector: StreamerDesktopDirectorPreferences;
  readonly voting: StreamerVotingPreferences;
  readonly rewards: StreamerRewardPreferences;
}

export interface LiveDirectorIntentDraft {
  readonly goal: string;
  readonly objective: string;
  readonly desiredAudienceInvolvement: string | null;
  readonly inputMethod?: "manual" | "speech";
  readonly confidence?: number;
}

export const DEFAULT_LIVE_DIRECTOR_INTENT_LIFETIME_MILLISECONDS = 2 * 60 * 60 * 1_000;

function fallbackId(prefix: string): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now()}-${random}`;
}

export const defaultStreamerCommandFactory: StreamerCommandFactory = {
  createId(prefix) {
    if (typeof globalThis.crypto?.randomUUID === "function") {
      return `${prefix}-${globalThis.crypto.randomUUID()}`;
    }
    return fallbackId(prefix);
  },
  now() {
    return Date.now();
  },
};

export function resolveDesktopDirectorSetupMode(profile: {
  readonly desktopDirector?: {
    readonly setupMode?: StreamerDesktopDirectorPreferences["setupMode"];
  } | null;
}): StreamerDesktopDirectorPreferences["setupMode"] {
  return profile.desktopDirector?.setupMode === "manual" ? "manual" : "automatic";
}

function metadata(
  view: StreamerViewModel,
  factory: StreamerCommandFactory,
  prefix: string,
) {
  const commandId = factory.createId(prefix);
  return {
    contractVersion: CONTRACT_VERSION,
    sessionId: view.session.sessionId,
    commandId,
    correlationId: commandId,
    expectedRevision: view.envelope.revision,
    issuedAt: factory.now(),
    actor: { kind: "broadcaster" as const, actorId: view.profile.streamerId },
  };
}

export function editableDefaultsFromProfile(profile: StreamerProfile): EditableProfileDefaults {
  return {
    gameId: profile.gameId,
    gameName: profile.gameName,
    experience: { ...profile.experience },
    restrictions: [...profile.restrictions],
    preferredQuestTypes: [...profile.preferredQuestTypes],
    forbiddenQuestTypes: [...profile.forbiddenQuestTypes],
    accessibilityNeeds: [...profile.accessibilityNeeds],
    keywordWatchlist: [...profile.keywordWatchlist],
    streamPresets: profile.streamPresets.map((preset) => ({
      ...preset,
      experience: { ...preset.experience },
      preferredQuestTypes: [...preset.preferredQuestTypes],
      voting: { ...preset.voting },
      rewards: { ...preset.rewards },
    })),
    selectedPresetId: profile.selectedPresetId,
    desktopDirector: { setupMode: resolveDesktopDirectorSetupMode(profile) },
    voting: { ...profile.voting },
    rewards: { ...profile.rewards },
  };
}

export function editableDefaultsFromView(view: StreamerViewModel): EditableProfileDefaults {
  return editableDefaultsFromProfile(view.profile);
}

export function applyEditableDefaultsToProfile(
  profile: StreamerProfile,
  defaults: EditableProfileDefaults,
  revision = profile.revision + 1,
): StreamerProfile {
  return streamerProfileSchema.parse({
    ...profile,
    ...defaults,
    revision,
    experience: { ...defaults.experience },
    restrictions: [...defaults.restrictions],
    preferredQuestTypes: [...defaults.preferredQuestTypes],
    forbiddenQuestTypes: [...defaults.forbiddenQuestTypes],
    accessibilityNeeds: [...defaults.accessibilityNeeds],
    keywordWatchlist: [...defaults.keywordWatchlist],
    desktopDirector: { ...defaults.desktopDirector },
    streamPresets: defaults.streamPresets.map((preset) => ({
      ...preset,
      experience: { ...preset.experience },
      preferredQuestTypes: [...preset.preferredQuestTypes],
      voting: { ...preset.voting },
      rewards: { ...preset.rewards },
    })),
    voting: { ...defaults.voting },
    rewards: { ...defaults.rewards },
  });
}

export function profileDefaultsChanged(
  saved: EditableProfileDefaults,
  draft: EditableProfileDefaults,
): boolean {
  return JSON.stringify(saved) !== JSON.stringify(draft);
}

export function buildProfileSettingsCommand(
  view: StreamerViewModel,
  draft: EditableProfileDefaults,
  factory: StreamerCommandFactory = defaultStreamerCommandFactory,
): StreamerProfileSettingsCommand {
  const votingChanged = JSON.stringify(draft.voting) !== JSON.stringify(view.profile.voting);
  const rewardsChanged = JSON.stringify(draft.rewards) !== JSON.stringify(view.profile.rewards);
  return streamerProfileSettingsCommandSchema.parse({
    ...metadata(view, factory, "profile-settings"),
    questCycleId: null,
    type: "streamer.profile-settings",
    expectedProfileRevision: view.profile.revision,
    gameApplication: "saved-only",
    game: {
      gameId: draft.gameId,
      gameName: draft.gameName,
    },
    experiencePatch: draft.experience,
    restrictions: [...draft.restrictions],
    preferredQuestTypes: [...draft.preferredQuestTypes],
    forbiddenQuestTypes: [...draft.forbiddenQuestTypes],
    accessibilityNeeds: [...draft.accessibilityNeeds],
    keywordWatchlist: [...draft.keywordWatchlist],
    streamPresets: draft.streamPresets.map((sourcePreset) => ({
      ...sourcePreset,
      voting:
        sourcePreset.presetId === draft.selectedPresetId && votingChanged
          ? { ...draft.voting }
          : { ...sourcePreset.voting },
      rewards:
        sourcePreset.presetId === draft.selectedPresetId && rewardsChanged
          ? { ...draft.rewards }
          : { ...sourcePreset.rewards },
      experience: { ...sourcePreset.experience },
      preferredQuestTypes: [...sourcePreset.preferredQuestTypes],
    })),
    selectedPresetId: draft.selectedPresetId,
    desktopDirector: { ...draft.desktopDirector },
    voting: draft.voting,
    rewards: draft.rewards,
  });
}

export function buildCurrentGameProfileSettingsCommand(
  view: StreamerViewModel,
  draft: EditableProfileDefaults,
  factory: StreamerCommandFactory = defaultStreamerCommandFactory,
): StreamerProfileSettingsCommand {
  return streamerProfileSettingsCommandSchema.parse({
    ...buildProfileSettingsCommand(view, draft, factory),
    gameApplication: "saved-and-current",
  });
}

export function buildCurrentStreamGameCommand(
  view: StreamerViewModel,
  game: { readonly gameId: string; readonly gameName: string },
  factory: StreamerCommandFactory = defaultStreamerCommandFactory,
): StreamerCurrentGameCommand {
  return streamerCurrentGameCommandSchema.parse({
    ...metadata(view, factory, "current-game"),
    questCycleId: view.questCycle.envelope.questCycleId,
    type: "streamer.current-game",
    game,
  });
}

export function buildSessionOverrideCommand(
  view: StreamerViewModel,
  experiencePatch: Readonly<Record<string, number>> | null,
  factory: StreamerCommandFactory = defaultStreamerCommandFactory,
  presetId: string | null = null,
): StreamerSessionOverrideCommand {
  return streamerSessionOverrideCommandSchema.parse({
    ...metadata(view, factory, experiencePatch === null ? "session-override-clear" : "session-override-apply"),
    questCycleId: null,
    type: "streamer.session-override",
    action: experiencePatch === null ? "clear" : "apply",
    presetId: experiencePatch === null ? null : presetId,
    experiencePatch: experiencePatch ?? {},
  });
}

export function buildQuestCommand(
  view: StreamerViewModel,
  action: StreamerQuestAction,
  candidateId: string | null,
  factory: StreamerCommandFactory = defaultStreamerCommandFactory,
): StreamerQuestCommand {
  return streamerQuestCommandSchema.parse({
    ...metadata(view, factory, `quest-${action}`),
    questCycleId: view.questCycle.envelope.questCycleId,
    type: "streamer.quest",
    action,
    candidateId,
  });
}

export function buildQuestGenerationCommand(
  view: StreamerViewModel,
  factory: StreamerCommandFactory = defaultStreamerCommandFactory,
): StreamerQuestGenerationCommand {
  return streamerQuestGenerationCommandSchema.parse({
    ...metadata(view, factory, "quest-generation"),
    questCycleId: view.questCycle.envelope.questCycleId,
    type: "streamer.quest-generation",
    mode: "deterministic-fallback",
  });
}

export function buildQuestProgressCommand(
  view: StreamerViewModel,
  requestedValue: number,
  factory: StreamerCommandFactory = defaultStreamerCommandFactory,
): StreamerQuestProgressCommand {
  return streamerQuestProgressCommandSchema.parse({
    ...metadata(view, factory, "quest-progress"),
    questCycleId: view.questCycle.envelope.questCycleId,
    type: "streamer.quest-progress",
    requestedValue,
  });
}

export function buildEmergencyClearCommand(
  view: StreamerViewModel,
  factory: StreamerCommandFactory = defaultStreamerCommandFactory,
): StreamerEmergencyClearCommand {
  return streamerEmergencyClearCommandSchema.parse({
    ...metadata(view, factory, "emergency-clear"),
    questCycleId: view.questCycle.envelope.questCycleId,
    type: "streamer.emergency-clear",
  });
}

export function buildLiveDirectorIntentCommand(
  view: StreamerViewModel,
  intent: LiveDirectorIntentDraft | null,
  factory: StreamerCommandFactory = defaultStreamerCommandFactory,
): StreamerLiveDirectorIntentCommand {
  const commandMetadata = metadata(view, factory, "live-director-intent");
  return streamerLiveDirectorIntentCommandSchema.parse({
    ...commandMetadata,
    questCycleId: null,
    type: "streamer.live-director-intent",
    action: intent === null ? "clear" : "set",
    intent: intent === null
      ? null
      : {
          ...intent,
          inputMethod: intent.inputMethod ?? "manual",
          confidence: intent.confidence ?? 1,
          requestedExpiresAt:
            commandMetadata.issuedAt + DEFAULT_LIVE_DIRECTOR_INTENT_LIFETIME_MILLISECONDS,
        },
  });
}

export function buildLiveDirectorCueCommand(
  view: StreamerViewModel,
  cueId: string,
  action: DirectorCueAction,
  factory: StreamerCommandFactory = defaultStreamerCommandFactory,
): StreamerLiveDirectorCueCommand {
  return streamerLiveDirectorCueCommandSchema.parse({
    ...metadata(view, factory, `live-director-cue-${action}`),
    questCycleId: view.questCycle.envelope.questCycleId,
    type: "streamer.live-director-cue",
    cueId,
    action,
  });
}

export function buildSetupCommand(
  view: StreamerViewModel,
  service: StreamerSetupServiceId,
  action: StreamerSetupAction,
  factory: StreamerCommandFactory = defaultStreamerCommandFactory,
): StreamerServiceCommand {
  if (service === "session" && (action === "start-session" || action === "end-session")) {
    return streamerServiceCommandSchema.parse({
      ...metadata(view, factory, action),
      type: "streamer.session",
      action: action === "start-session" ? "start" : "end",
    });
  }

  return streamerServiceCommandSchema.parse({
    ...metadata(view, factory, `setup-${action}`),
    type: "streamer.setup",
    service,
    action,
  });
}
