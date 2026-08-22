import {
  CONTRACT_VERSION,
  streamerEmergencyClearCommandSchema,
  streamerLiveDirectorCueCommandSchema,
  streamerLiveDirectorIntentCommandSchema,
  streamerProfileSettingsCommandSchema,
  streamerQuestGenerationCommandSchema,
  streamerSessionOverrideCommandSchema,
  streamerQuestCommandSchema,
  streamerQuestProgressCommandSchema,
  streamerServiceCommandSchema,
  type StreamerEmergencyClearCommand,
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
  type StreamPreset,
  type StreamerServiceCommand,
  type StreamerSetupAction,
  type StreamerSetupServiceId,
  type StreamerViewModel,
  type StreamerVotingPreferences,
} from "../core";

export type StreamerUiCommand =
  | StreamerProfileSettingsCommand
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

export function editableDefaultsFromView(view: StreamerViewModel): EditableProfileDefaults {
  return {
    gameId: view.profile.gameId,
    gameName: view.profile.gameName,
    experience: { ...view.profile.experience },
    restrictions: [...view.profile.restrictions],
    preferredQuestTypes: [...view.profile.preferredQuestTypes],
    forbiddenQuestTypes: [...view.profile.forbiddenQuestTypes],
    accessibilityNeeds: [...view.profile.accessibilityNeeds],
    keywordWatchlist: [...view.profile.keywordWatchlist],
    streamPresets: view.profile.streamPresets.map((preset) => ({
      ...preset,
      experience: { ...preset.experience },
      preferredQuestTypes: [...preset.preferredQuestTypes],
      voting: { ...preset.voting },
      rewards: { ...preset.rewards },
    })),
    selectedPresetId: view.profile.selectedPresetId,
    voting: { ...view.profile.voting },
    rewards: { ...view.profile.rewards },
  };
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
    voting: draft.voting,
    rewards: draft.rewards,
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
