import { describe, expect, it } from "vitest";

import {
  ChatXptOrchestrator,
  authoritativeSessionStateSchema,
  gameplaySnapshotSchema,
  streamerQuestProgressCommandSchema,
  type GameplaySnapshot,
} from "@/core";
import {
  CanonicalFixtureViewProjector,
  FixedFixtureClock,
  FixtureProjectionContextResolver,
  ScriptedFixtureQuestEngine,
  SequenceFixtureMessageIds,
  contractFixtureGameplaySnapshot,
  contractFixtureProfile,
  contractFixtureQuestCycle,
  contractFixtureSession,
} from "@/core/testing";
import { bindPersistenceRuntime, createMemoryPersistenceRuntime } from "@/realtime";

import { GameplayIngressApplication } from "./gameplay-ingress";

const KEY = "fixture-gameplay-ingress-key-0123456789abcdef";
const FIXTURE_NOW = contractFixtureSession.createdAt;

function liveState() {
  const sessionId = contractFixtureSession.sessionId;
  return authoritativeSessionStateSchema.parse({
    session: structuredClone(contractFixtureSession),
    profile: structuredClone(contractFixtureProfile),
    services: [],
    gameplay: null,
    audience: null,
    questCycle: {
      ...structuredClone(contractFixtureQuestCycle),
      envelope: {
        ...structuredClone(contractFixtureQuestCycle.envelope),
        sessionId,
        source: "orchestrator",
        evidenceClass: "live",
      },
    },
    emergencyPaused: false,
    communityHype: 0,
  });
}

function liveSnapshot(
  state: ReturnType<typeof liveState>,
  occurredAt: number,
  messageId = "live-gameplay-1",
): GameplaySnapshot {
  const base = structuredClone(contractFixtureGameplaySnapshot);
  return gameplaySnapshotSchema.parse({
    ...base,
    envelope: {
      ...base.envelope,
      sessionId: state.session.sessionId,
      questCycleId: state.questCycle.envelope.questCycleId,
      messageId,
      correlationId: "obs-capture-live",
      revision: state.session.revision,
      occurredAt,
      receivedAt: occurredAt,
      source: "obs-virtual-camera",
      evidenceClass: "live",
    },
    signals: base.signals.map((signal) => ({
      ...signal,
      observation: {
        ...signal.observation,
        provenance: {
          ...signal.observation.provenance,
          source: "obs-virtual-camera",
          method: "fixture-ingress-contract-check",
          observedAt: occurredAt,
          receivedAt: occurredAt,
          evidenceClass: "live",
        },
      },
    })),
  });
}

async function setup() {
  let now = FIXTURE_NOW + 1_000;
  const persistence = createMemoryPersistenceRuntime();
  const state = liveState();
  await persistence.lifecycle.bootstrap({ roomCode: "ABCDEFGH", state, createdAt: FIXTURE_NOW });
  const application = new GameplayIngressApplication({
    persistence,
    setupKey: KEY,
    now: () => now,
    nextId: () => "grant-1",
  });
  return {
    application,
    persistence,
    state,
    setNow(value: number) {
      now = value;
    },
  };
}

describe("authenticated gameplay snapshot ingress", () => {
  it("issues a short-lived session grant and stores only a canonical live OBS snapshot", async () => {
    const { application, persistence, state } = await setup();
    const grant = await application.issueGrant(KEY, { sessionId: state.session.sessionId });
    const snapshot = liveSnapshot(state, FIXTURE_NOW + 1_000);

    await expect(application.ingest(`Bearer ${grant.token}`, snapshot)).resolves.toMatchObject({
      result: { status: "accepted" },
      authority: {
        sessionId: state.session.sessionId,
        revision: state.session.revision,
        evidenceClass: "live",
      },
    });
    await expect(
      persistence.gameplaySnapshots.readCurrent({
        sessionId: state.session.sessionId,
        questCycleId: state.questCycle.envelope.questCycleId,
        revision: state.session.revision,
        evidenceClass: "live",
      }),
    ).resolves.toMatchObject({ envelope: { messageId: "live-gameplay-1" } });
  });

  it("makes an accepted ingress snapshot available to the sole orchestrator on its next command", async () => {
    const { application, persistence, state } = await setup();
    const grant = await application.issueGrant(KEY, { sessionId: state.session.sessionId });
    await application.ingest(
      `Bearer ${grant.token}`,
      liveSnapshot(state, FIXTURE_NOW + 1_000),
    );
    const command = streamerQuestProgressCommandSchema.parse({
      contractVersion: "1.0.0",
      sessionId: state.session.sessionId,
      questCycleId: state.questCycle.envelope.questCycleId,
      commandId: "ingress-orchestrator-command",
      correlationId: "ingress-orchestrator-cycle",
      expectedRevision: state.session.revision,
      issuedAt: FIXTURE_NOW + 2_000,
      actor: { kind: "broadcaster", actorId: state.session.broadcasterId },
      type: "streamer.quest-progress",
      requestedValue: 0.5,
    });
    let engineGameplayMessageId: string | null = null;
    const orchestrator = new ChatXptOrchestrator(
      bindPersistenceRuntime(
        {
          authorizer: { authorize: () => null },
          engine: new ScriptedFixtureQuestEngine((input) => {
            engineGameplayMessageId =
              input.questProgressValidationContext?.gameplay?.envelope.messageId ?? null;
            return {
              ok: false,
              error: {
                code: "validation",
                message: "Stop after observing hydrated gameplay in this boundary test",
                retryable: false,
              },
            };
          }),
          projectionContext: new FixtureProjectionContextResolver({
            participationMode: "hosted-board",
            viewerId: null,
            sessionPoints: 0,
            acceptedCandidateId: null,
            connection: {
              service: "fixture-ingress",
              status: "ready",
              checkedAt: FIXTURE_NOW + 2_000,
              retryable: false,
            },
          }),
          projector: new CanonicalFixtureViewProjector(),
          clock: new FixedFixtureClock(FIXTURE_NOW + 2_000),
          ids: new SequenceFixtureMessageIds(),
        },
        persistence,
      ),
    );

    const result = await orchestrator.execute(command);
    expect(result).toMatchObject({ ok: false, error: { code: "validation" } });
    expect(engineGameplayMessageId).toBe("live-gameplay-1");
  });

  it("preserves duplicate retry, bounds burst cadence, and rejects fixture or stale capture", async () => {
    const { application, state, setNow } = await setup();
    const grant = await application.issueGrant(KEY, { sessionId: state.session.sessionId });
    const header = `Bearer ${grant.token}`;
    const first = liveSnapshot(state, FIXTURE_NOW + 1_000);

    await application.ingest(header, first);
    await expect(application.ingest(header, first)).resolves.toMatchObject({
      result: { status: "duplicate" },
    });
    await expect(
      application.ingest(header, liveSnapshot(state, FIXTURE_NOW + 1_001, "live-gameplay-2")),
    ).rejects.toMatchObject({ code: "rate-limited" });

    setNow(FIXTURE_NOW + 20_000);
    await expect(application.ingest(header, first)).rejects.toMatchObject({ code: "validation" });
    await expect(
      application.ingest(header, {
        ...first,
        envelope: { ...first.envelope, evidenceClass: "fixture", source: "test-fixture" },
        signals: first.signals.map((signal) => ({
          ...signal,
          observation: {
            ...signal.observation,
            provenance: { ...signal.observation.provenance, evidenceClass: "fixture" },
          },
        })),
      }),
    ).rejects.toMatchObject({ code: "validation" });
  });

  it("fails closed for wrong bootstrap credentials, expired grants, and another session", async () => {
    const { application, state, setNow } = await setup();
    await expect(
      application.issueGrant("wrong-key", { sessionId: state.session.sessionId }),
    ).rejects.toMatchObject({ code: "unauthenticated" });
    const grant = await application.issueGrant(KEY, { sessionId: state.session.sessionId });
    const current = liveSnapshot(state, FIXTURE_NOW + 1_000);
    const anotherSessionSnapshot = {
      ...current,
      envelope: { ...current.envelope, sessionId: "another-session" },
    };
    await expect(
      application.ingest(`Bearer ${grant.token}`, anotherSessionSnapshot),
    ).rejects.toMatchObject({ code: "forbidden" });

    setNow(grant.expiresAt);
    await expect(application.readAuthority(`Bearer ${grant.token}`)).rejects.toMatchObject({
      code: "expired",
    });
  });
});
