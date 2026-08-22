import { describe, expect, it } from "vitest";

import {
  streamerQuestCommandSchema,
  streamerQuestProgressCommandSchema,
  streamerLiveDirectorCueCommandSchema,
  streamerLiveDirectorIntentCommandSchema,
  systemLiveDirectorContextCommandSchema,
  systemCurrentGameCommandSchema,
  systemQuestProgressCommandSchema,
  systemQuestTickCommandSchema,
  systemVoteCloseCommandSchema,
  viewerReactionCommandSchema,
  viewerVoteCommandSchema,
} from "../../src/core";
import {
  ServerCommandAuthorizer,
  StaticVerifiedActorResolver,
  type VerifiedCommandActor,
} from "../../src/realtime";
import { FIXTURE_NOW, persistenceState } from "./persistence-fixtures";

function streamerCommand(actor: "broadcaster" | "moderator", actorId: string, commandId: string) {
  const state = persistenceState();
  return streamerQuestCommandSchema.parse({
    contractVersion: "1.0.0",
    sessionId: state.session.sessionId,
    questCycleId: state.questCycle.envelope.questCycleId,
    commandId,
    correlationId: `correlation-${commandId}`,
    expectedRevision: state.session.revision,
    issuedAt: FIXTURE_NOW,
    actor: { kind: actor, actorId },
    type: "streamer.quest",
    action: "skip",
    candidateId: null,
  });
}

function grant(
  kind: VerifiedCommandActor["kind"],
  actorId: string | null,
  overrides: Partial<VerifiedCommandActor> = {},
): VerifiedCommandActor {
  return {
    kind,
    actorId,
    expiresAt: FIXTURE_NOW + 60_000,
    moderatorForBroadcasterIds: [],
    voterKey: kind === "viewer" || kind === "anonymous" ? "fixture-voter-key" : null,
    participationModes: ["twitch-extension", "hosted-board", "twitch-chat"],
    ...overrides,
  };
}

function liveState() {
  const state = persistenceState();
  return {
    ...state,
    session: { ...state.session, status: "live" as const, startedAt: FIXTURE_NOW },
  };
}

describe("server-authoritative command permissions", () => {
  it("allows only a verified system identity to close a vote", async () => {
    const state = liveState();
    const command = systemVoteCloseCommandSchema.parse({
      contractVersion: "1.0.0",
      sessionId: state.session.sessionId,
      questCycleId: state.questCycle.envelope.questCycleId,
      commandId: "system-vote-close",
      correlationId: "system-vote-close-correlation",
      expectedRevision: 0,
      issuedAt: FIXTURE_NOW,
      actor: { kind: "system", actorId: "fixture-orchestrator" },
      type: "system.vote-close",
    });
    const authorizer = new ServerCommandAuthorizer(
      new StaticVerifiedActorResolver(
        new Map([[command.commandId, grant("system", "fixture-orchestrator")]]),
      ),
      () => FIXTURE_NOW,
    );

    expect(await authorizer.authorize(command, state)).toBeNull();
    expect(
      (
        await new ServerCommandAuthorizer(
          new StaticVerifiedActorResolver(new Map()),
          () => FIXTURE_NOW,
        ).authorize(command, state)
      )?.code,
    ).toBe("unauthenticated");
  });

  it("allows only the verified system path to apply Twitch current-game metadata", async () => {
    const state = liveState();
    const command = systemCurrentGameCommandSchema.parse({
      contractVersion: "1.0.0",
      sessionId: state.session.sessionId,
      questCycleId: state.questCycle.envelope.questCycleId,
      commandId: "system-current-game",
      correlationId: "system-current-game-correlation",
      expectedRevision: state.session.revision,
      issuedAt: FIXTURE_NOW,
      actor: { kind: "system", actorId: "verified-twitch" },
      type: "system.current-game",
      game: { gameId: "minecraft", gameName: "Minecraft" },
    });
    const authorizer = new ServerCommandAuthorizer(
      new StaticVerifiedActorResolver(
        new Map([[command.commandId, grant("system", "verified-twitch")]]),
      ),
      () => FIXTURE_NOW,
    );

    expect(await authorizer.authorize(command, state)).toBeNull();
    expect(
      await new ServerCommandAuthorizer(
        new StaticVerifiedActorResolver(
          new Map([[command.commandId, grant("system", "different-system")]]),
        ),
        () => FIXTURE_NOW,
      ).authorize(command, state),
    ).toMatchObject({ code: "unauthenticated" });
  });

  it("authorizes trusted timer/progress identities without widening viewer authority", async () => {
    const state = liveState();
    const tick = systemQuestTickCommandSchema.parse({
      contractVersion: "1.0.0",
      sessionId: state.session.sessionId,
      questCycleId: state.questCycle.envelope.questCycleId,
      commandId: "system-quest-tick",
      correlationId: "system-quest-tick-correlation",
      expectedRevision: 0,
      issuedAt: FIXTURE_NOW,
      actor: { kind: "system", actorId: "fixture-orchestrator" },
      type: "system.quest-tick",
    });
    const progress = systemQuestProgressCommandSchema.parse({
      ...tick,
      commandId: "system-quest-progress",
      correlationId: "system-quest-progress-correlation",
      type: "system.quest-progress",
      requestedValue: 0.4,
      evidenceSignalIds: ["fixture-signal"],
    });
    const moderatorProgress = streamerQuestProgressCommandSchema.parse({
      ...tick,
      commandId: "moderator-quest-progress",
      correlationId: "moderator-quest-progress-correlation",
      actor: { kind: "moderator", actorId: "fixture-moderator" },
      type: "streamer.quest-progress",
      requestedValue: 0.4,
    });
    const authorizer = new ServerCommandAuthorizer(
      new StaticVerifiedActorResolver(
        new Map([
          [tick.commandId, grant("system", "fixture-orchestrator")],
          [progress.commandId, grant("system", "fixture-orchestrator")],
          [
            moderatorProgress.commandId,
            grant("moderator", "fixture-moderator", {
              moderatorForBroadcasterIds: [state.session.broadcasterId],
            }),
          ],
        ]),
      ),
      () => FIXTURE_NOW,
    );

    expect(await authorizer.authorize(tick, state)).toBeNull();
    expect(await authorizer.authorize(progress, state)).toBeNull();
    expect(await authorizer.authorize(moderatorProgress, state)).toBeNull();
  });

  it("keeps Live Director intent, context, and cue actions in their permission classes", async () => {
    const state = liveState();
    const intent = streamerLiveDirectorIntentCommandSchema.parse({
      contractVersion: "1.0.0",
      sessionId: state.session.sessionId,
      questCycleId: null,
      commandId: "live-director-intent",
      correlationId: "live-director-intent-correlation",
      expectedRevision: 0,
      issuedAt: FIXTURE_NOW,
      actor: { kind: "broadcaster", actorId: state.session.broadcasterId },
      type: "streamer.live-director-intent",
      action: "set",
      intent: {
        goal: "Reach shelter safely",
        objective: "Invite chat to choose the next safe route.",
        desiredAudienceInvolvement: "Vote on the route.",
        requestedExpiresAt: FIXTURE_NOW + 60_000,
      },
    });
    const context = systemLiveDirectorContextCommandSchema.parse({
      contractVersion: "1.0.0",
      sessionId: state.session.sessionId,
      questCycleId: state.questCycle.envelope.questCycleId,
      commandId: "live-director-context",
      correlationId: "live-director-context-correlation",
      expectedRevision: 0,
      issuedAt: FIXTURE_NOW,
      actor: { kind: "system", actorId: "fixture-orchestrator" },
      type: "system.live-director-context-ready",
      liveContextId: "live-director-context",
      audiencePointerId: null,
    });
    const cue = streamerLiveDirectorCueCommandSchema.parse({
      contractVersion: "1.0.0",
      sessionId: state.session.sessionId,
      questCycleId: state.questCycle.envelope.questCycleId,
      commandId: "live-director-cue",
      correlationId: "live-director-cue-correlation",
      expectedRevision: 0,
      issuedAt: FIXTURE_NOW,
      actor: { kind: "moderator", actorId: "fixture-moderator" },
      type: "streamer.live-director-cue",
      cueId: "fixture-cue",
      action: "dismiss",
    });
    const actors = new Map([
      [intent.commandId, grant("broadcaster", state.session.broadcasterId)],
      [context.commandId, grant("system", "fixture-orchestrator")],
      [
        cue.commandId,
        grant("moderator", "fixture-moderator", {
          moderatorForBroadcasterIds: [state.session.broadcasterId],
        }),
      ],
    ]);
    const authorizer = new ServerCommandAuthorizer(
      new StaticVerifiedActorResolver(actors),
      () => FIXTURE_NOW,
    );

    expect(await authorizer.authorize(intent, state)).toBeNull();
    expect(await authorizer.authorize(context, state)).toBeNull();
    expect(await authorizer.authorize(cue, state)).toBeNull();
  });

  it("allows only the owning broadcaster full streamer command authority", async () => {
    const command = streamerCommand("broadcaster", "fixture-broadcaster", "owner-command");
    const resolver = new StaticVerifiedActorResolver(
      new Map([[command.commandId, grant("broadcaster", "fixture-broadcaster")]]),
    );
    const authorizer = new ServerCommandAuthorizer(resolver, () => FIXTURE_NOW);

    expect(await authorizer.authorize(command, persistenceState())).toBeNull();

    const impostor = streamerCommand("broadcaster", "other-broadcaster", "impostor-command");
    const denied = await new ServerCommandAuthorizer(
      new StaticVerifiedActorResolver(
        new Map([[impostor.commandId, grant("broadcaster", "other-broadcaster")]]),
      ),
      () => FIXTURE_NOW,
    ).authorize(impostor, persistenceState());
    expect(denied?.code).toBe("forbidden");
  });

  it("limits moderators to an explicitly granted broadcaster", async () => {
    const command = streamerCommand("moderator", "fixture-moderator", "moderator-command");
    const allowed = new ServerCommandAuthorizer(
      new StaticVerifiedActorResolver(
        new Map([
          [
            command.commandId,
            grant("moderator", "fixture-moderator", {
              moderatorForBroadcasterIds: ["fixture-broadcaster"],
            }),
          ],
        ]),
      ),
      () => FIXTURE_NOW,
    );
    expect(await allowed.authorize(command, persistenceState())).toBeNull();

    const denied = new ServerCommandAuthorizer(
      new StaticVerifiedActorResolver(
        new Map([[command.commandId, grant("moderator", "fixture-moderator")]]),
      ),
      () => FIXTURE_NOW,
    );
    expect((await denied.authorize(command, persistenceState()))?.code).toBe("forbidden");
  });

  it("rejects expired verified identities", async () => {
    const command = streamerCommand("broadcaster", "fixture-broadcaster", "expired-command");
    const authorizer = new ServerCommandAuthorizer(
      new StaticVerifiedActorResolver(
        new Map([
          [command.commandId, grant("broadcaster", "fixture-broadcaster", { expiresAt: FIXTURE_NOW })],
        ]),
      ),
      () => FIXTURE_NOW,
    );
    expect((await authorizer.authorize(command, persistenceState()))?.code).toBe("unauthenticated");
  });

  it("allows live viewer votes but enforces anonymous and reaction capabilities", async () => {
    const state = liveState();
    const vote = viewerVoteCommandSchema.parse({
      contractVersion: "1.0.0",
      sessionId: state.session.sessionId,
      questCycleId: state.questCycle.envelope.questCycleId,
      commandId: "anonymous-vote",
      correlationId: "anonymous-vote-correlation",
      expectedRevision: 0,
      issuedAt: FIXTURE_NOW,
      actor: { kind: "anonymous", actorId: null },
      type: "viewer.vote",
      candidateId: "fixture-candidate-1",
      voterKey: "fixture-voter-key",
      sourceMode: "hosted-board",
    });
    const reaction = viewerReactionCommandSchema.parse({
      contractVersion: "1.0.0",
      sessionId: state.session.sessionId,
      questCycleId: state.questCycle.envelope.questCycleId,
      commandId: "anonymous-reaction",
      correlationId: "anonymous-reaction-correlation",
      expectedRevision: 0,
      issuedAt: FIXTURE_NOW,
      actor: { kind: "anonymous", actorId: null },
      type: "viewer.react",
      reaction: "hype",
    });
    const resolver = new StaticVerifiedActorResolver(
      new Map([
        [vote.commandId, grant("anonymous", null, { expiresAt: null })],
        [reaction.commandId, grant("anonymous", null, { expiresAt: null })],
      ]),
    );
    const authorizer = new ServerCommandAuthorizer(resolver, () => FIXTURE_NOW);

    expect(await authorizer.authorize(vote, state)).toBeNull();
    expect((await authorizer.authorize(reaction, state))?.code).toBe("unavailable-capability");
  });

  it("rejects a spoofed vote identity or participation source", async () => {
    const baseState = liveState();
    const state = {
      ...baseState,
      session: {
        ...baseState.session,
        capabilities: { ...baseState.session.capabilities, twitchChatVoting: true },
      },
    };
    const vote = viewerVoteCommandSchema.parse({
      contractVersion: "1.0.0",
      sessionId: state.session.sessionId,
      questCycleId: state.questCycle.envelope.questCycleId,
      commandId: "verified-vote",
      correlationId: "verified-vote-correlation",
      expectedRevision: 0,
      issuedAt: FIXTURE_NOW,
      actor: { kind: "viewer", actorId: "fixture-viewer" },
      type: "viewer.vote",
      candidateId: "fixture-candidate-1",
      voterKey: "spoofed-voter-key",
      sourceMode: "twitch-chat",
    });
    const authorizer = new ServerCommandAuthorizer(
      new StaticVerifiedActorResolver(
        new Map([
          [
            vote.commandId,
            grant("viewer", "fixture-viewer", {
              voterKey: "verified-voter-key",
              participationModes: ["twitch-extension"],
            }),
          ],
        ]),
      ),
      () => FIXTURE_NOW,
    );

    expect((await authorizer.authorize(vote, state))?.code).toBe("forbidden");
    expect(
      (
        await authorizer.authorize(
          { ...vote, voterKey: "verified-voter-key" },
          state,
        )
      )?.code,
    ).toBe("forbidden");
  });

  it("rejects a verified vote when its concrete participation path is disabled", async () => {
    const state = liveState();
    const vote = viewerVoteCommandSchema.parse({
      contractVersion: "1.0.0",
      sessionId: state.session.sessionId,
      questCycleId: state.questCycle.envelope.questCycleId,
      commandId: "disabled-extension-vote",
      correlationId: "disabled-extension-vote-correlation",
      expectedRevision: 0,
      issuedAt: FIXTURE_NOW,
      actor: { kind: "viewer", actorId: "fixture-viewer" },
      type: "viewer.vote",
      candidateId: "fixture-candidate-1",
      voterKey: "fixture-voter-key",
      sourceMode: "twitch-extension",
    });
    const authorizer = new ServerCommandAuthorizer(
      new StaticVerifiedActorResolver(
        new Map([[vote.commandId, grant("viewer", "fixture-viewer")]]),
      ),
      () => FIXTURE_NOW,
    );

    expect((await authorizer.authorize(vote, state))?.code).toBe("unavailable-capability");
  });

  it("rejects every command after access lifecycle ends", async () => {
    const command = streamerCommand("broadcaster", "fixture-broadcaster", "ended-command");
    const ended = {
      ...persistenceState(),
      session: {
        ...persistenceState().session,
        status: "ended" as const,
        startedAt: FIXTURE_NOW,
        endedAt: FIXTURE_NOW + 1_000,
      },
    };
    const authorizer = new ServerCommandAuthorizer(
      new StaticVerifiedActorResolver(
        new Map([[command.commandId, grant("broadcaster", "fixture-broadcaster")]]),
      ),
      () => FIXTURE_NOW,
    );
    expect((await authorizer.authorize(command, ended))?.code).toBe("expired");
  });
});
