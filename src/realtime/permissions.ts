import {
  domainErrorSchema,
  type CommandAuthorizer,
  type CommandEnvelope,
  type DomainError,
  type ParticipationSourceMode,
  type AuthoritativeSessionState,
} from "../core";

export interface VerifiedCommandActor {
  readonly kind: CommandEnvelope["actor"]["kind"];
  readonly actorId: string | null;
  readonly expiresAt: number | null;
  readonly moderatorForBroadcasterIds: readonly string[];
  /** Opaque, session-scoped participation identity resolved from trusted auth. */
  readonly voterKey: string | null;
  readonly participationModes: readonly ParticipationSourceMode[];
}

export interface VerifiedCommandActorResolver {
  resolve(command: CommandEnvelope): Promise<VerifiedCommandActor | null> | VerifiedCommandActor | null;
}

function denial(
  code: DomainError["code"],
  message: string,
  retryable = false,
): DomainError {
  return domainErrorSchema.parse({ code, message, retryable });
}

function actorMatches(command: CommandEnvelope, verified: VerifiedCommandActor): boolean {
  return command.actor.kind === verified.kind && command.actor.actorId === verified.actorId;
}

export class ServerCommandAuthorizer implements CommandAuthorizer {
  constructor(
    private readonly actors: VerifiedCommandActorResolver,
    private readonly now: () => number = Date.now,
  ) {}

  async authorize(
    command: CommandEnvelope,
    state: AuthoritativeSessionState,
  ): Promise<DomainError | null> {
    const verified = await this.actors.resolve(command);
    if (verified === null || !actorMatches(command, verified)) {
      return denial("unauthenticated", "Command identity could not be verified");
    }
    if (verified.expiresAt !== null && verified.expiresAt <= this.now()) {
      return denial("unauthenticated", "Command identity has expired");
    }
    if (state.session.status === "ended" || state.session.status === "offline") {
      return denial("expired", "The stream session is no longer active");
    }

    if (verified.kind === "broadcaster") {
      return verified.actorId === state.session.broadcasterId
        ? null
        : denial("forbidden", "Broadcaster does not own this session");
    }

    if (verified.kind === "moderator") {
      return (command.type === "streamer.quest" ||
        command.type === "streamer.quest-progress" ||
        command.type === "streamer.emergency-clear" ||
        command.type === "streamer.live-director-cue") &&
        verified.moderatorForBroadcasterIds.includes(state.session.broadcasterId)
        ? null
        : denial("forbidden", "Moderator is not authorised for this stream-time control");
    }

    if (verified.kind === "system") {
      return command.type === "system.intelligence-ready" ||
        command.type === "system.vote-close" ||
        command.type === "system.quest-tick" ||
        command.type === "system.quest-progress" ||
        command.type === "system.audience-snapshot-ready" ||
        command.type === "system.gameplay-snapshot-ready" ||
        command.type === "system.current-game" ||
        command.type === "system.live-director-context-ready" ||
        command.type === "system.live-director-cue-ready"
        ? null
        : denial("forbidden", "System identity may only submit trusted lifecycle commands");
    }

    if (state.session.status !== "live") {
      return denial("unavailable-capability", "Viewer participation is available only while live");
    }
    if (command.type !== "viewer.vote" && command.type !== "viewer.react") {
      return denial("forbidden", "Viewer identities may only vote or react");
    }
    if (verified.kind === "anonymous" && !state.session.capabilities.anonymousParticipation) {
      return denial("unavailable-capability", "Anonymous participation is disabled");
    }
    if (command.type === "viewer.react" && !state.session.capabilities.reactions) {
      return denial("unavailable-capability", "Reactions are disabled");
    }
    if (
      command.type === "viewer.vote" &&
      !state.session.capabilities.twitchExtension &&
      !state.session.capabilities.hostedViewerBoard &&
      !state.session.capabilities.twitchChatVoting
    ) {
      return denial("unavailable-capability", "No voting participation path is available");
    }
    if (
      command.type === "viewer.vote" &&
      ((command.sourceMode === "twitch-extension" && !state.session.capabilities.twitchExtension) ||
        (command.sourceMode === "hosted-board" && !state.session.capabilities.hostedViewerBoard) ||
        (command.sourceMode === "twitch-chat" && !state.session.capabilities.twitchChatVoting))
    ) {
      return denial("unavailable-capability", "The selected participation path is unavailable");
    }
    if (
      command.type === "viewer.vote" &&
      (verified.voterKey === null || verified.voterKey !== command.voterKey)
    ) {
      return denial("forbidden", "Vote identity does not match the verified participation grant");
    }
    if (
      command.type === "viewer.vote" &&
      !verified.participationModes.includes(command.sourceMode)
    ) {
      return denial("forbidden", "Vote source is not allowed by the verified participation grant");
    }
    return null;
  }
}

export class StaticVerifiedActorResolver implements VerifiedCommandActorResolver {
  constructor(private readonly actorsByCommandId: ReadonlyMap<string, VerifiedCommandActor>) {}

  resolve(command: CommandEnvelope): VerifiedCommandActor | null {
    return this.actorsByCommandId.get(command.commandId) ?? null;
  }
}
