import { describe, expect, it } from "vitest";

import {
  streamerQuestCommandSchema,
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
