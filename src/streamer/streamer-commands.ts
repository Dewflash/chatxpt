import {
  CONTRACT_VERSION,
  streamerEmergencyClearCommandSchema,
  streamerProfileSettingsCommandSchema,
  streamerQuestCommandSchema,
  streamerQuestProgressCommandSchema,
  streamerServiceCommandSchema,
  type StreamerEmergencyClearCommand,
  type StreamerProfileSettingsCommand,
  type StreamerQuestAction,
  type StreamerQuestCommand,
  type StreamerQuestProgressCommand,
  type StreamerRewardPreferences,
  type StreamerServiceCommand,
  type StreamerSetupAction,
  type StreamerSetupServiceId,
  type StreamerViewModel,
  type StreamerVotingPreferences,
} from "../core";

export type StreamerUiCommand =
  | StreamerProfileSettingsCommand
  | StreamerQuestCommand
  | StreamerQuestProgressCommand
  | StreamerEmergencyClearCommand
  | StreamerServiceCommand;

export interface StreamerCommandFactory {
  readonly createId: (prefix: string) => string;
  readonly now: () => number;
}

export interface EditableProfileDefaults {
  readonly experience: Readonly<Record<string, number>>;
  readonly voting: StreamerVotingPreferences;
  readonly rewards: StreamerRewardPreferences;
}

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
    experience: { ...view.profile.experience },
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
  return streamerProfileSettingsCommandSchema.parse({
    ...metadata(view, factory, "profile-settings"),
    questCycleId: null,
    type: "streamer.profile-settings",
    experiencePatch: draft.experience,
    voting: draft.voting,
    rewards: draft.rewards,
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
