import { describe, expect, it } from "vitest";

import {
  CONTRACT_VERSION,
  liveDirectorStateSchema,
  streamerLiveDirectorCueCommandSchema,
  systemLiveDirectorCueCommandSchema,
  type LiveDirectorState,
} from "../core";
import { contractFixtureLiveDirectorState } from "../core/testing";
import {
  DefaultDirectorCueLifecycle,
  DIRECTOR_CUE_POSTPONE_MILLISECONDS,
  type DirectorCueAuthority,
} from ".";

const NOW = contractFixtureLiveDirectorState.liveContext!.compiledAt;
const authority = {
  sessionId: "fixture-session",
  questCycleId: "fixture-cycle",
  revision: 0,
} as const satisfies DirectorCueAuthority;
const baseState = liveDirectorStateSchema.parse({
  ...contractFixtureLiveDirectorState,
  cue: null,
});

function systemCommand(patch: Record<string, unknown> = {}) {
  return systemLiveDirectorCueCommandSchema.parse({
    contractVersion: CONTRACT_VERSION,
    sessionId: authority.sessionId,
    questCycleId: authority.questCycleId,
    commandId: "fixture-cue-system-command",
    correlationId: "fixture-cue-correlation",
    expectedRevision: authority.revision,
    issuedAt: NOW,
    actor: { kind: "system", actorId: "fixture-system" },
    type: "system.live-director-cue-ready",
    cueId: "fixture-director-cue",
    liveContextId: contractFixtureLiveDirectorState.liveContext!.contextId,
    ...patch,
  });
}

function streamerCommand(
  action: "acknowledge" | "turn-into-vote" | "later" | "dismiss",
  patch: Record<string, unknown> = {},
) {
  return streamerLiveDirectorCueCommandSchema.parse({
    contractVersion: CONTRACT_VERSION,
    sessionId: authority.sessionId,
    questCycleId: authority.questCycleId,
    commandId: `fixture-cue-${action}`,
    correlationId: "fixture-cue-correlation",
    expectedRevision: authority.revision,
    issuedAt: NOW,
    actor: { kind: "broadcaster", actorId: "fixture-broadcaster" },
    type: "streamer.live-director-cue",
    cueId: "fixture-director-cue",
    action,
    ...patch,
  });
}

const suitability = {
  disposition: "offer-cue" as const,
  score: 0.84,
  reasons: ["eligible"] as const,
  evidenceReferences: ["fixture-intent", "fixture-pointer", "fixture-activity"],
};

function offer() {
  return new DefaultDirectorCueLifecycle().offer({
    authority,
    current: baseState,
    command: systemCommand(),
    suitability,
    now: NOW,
  });
}

function proposedState(): LiveDirectorState {
  const result = offer();
  if (!result.ok) throw new Error(result.error.message);
  return liveDirectorStateSchema.parse({
    ...baseState,
    cue: result.decision.nextCue,
  });
}

describe("DefaultDirectorCueLifecycle", () => {
  it("offers one canonical cue with four server-authorised actions", () => {
    expect(offer()).toMatchObject({
      ok: true,
      decision: {
        nextCue: {
          cueId: "fixture-director-cue",
          state: "proposed",
          availableActions: ["acknowledge", "turn-into-vote", "later", "dismiss"],
          expiresAt: contractFixtureLiveDirectorState.liveContext!.expiresAt,
        },
        events: [{ eventType: "live-director.cue-proposed" }],
      },
    });
  });

  it("does not offer a cue from a wait decision", () => {
    expect(
      new DefaultDirectorCueLifecycle().offer({
        authority,
        current: baseState,
        command: systemCommand(),
        suitability: { ...suitability, disposition: "wait", reasons: ["active-gameplay"] },
        now: NOW,
      }),
    ).toMatchObject({ ok: false, error: { code: "validation" } });
  });

  it.each([
    ["acknowledge", "acknowledged"],
    ["turn-into-vote", "converted"],
    ["dismiss", "dismissed"],
  ] as const)("applies %s without publishing a quest", (action, state) => {
    const result = new DefaultDirectorCueLifecycle().applyAction({
      authority,
      current: proposedState(),
      command: streamerCommand(action),
      emergencyPaused: false,
      now: NOW + 1_000,
    });
    expect(result).toMatchObject({
      ok: true,
      decision: {
        nextCue: { state, availableActions: [] },
        events: [{ attributes: { action, candidatePublication: false } }],
      },
    });
  });

  it("postpones once and resurfaces only after the authoritative delay", () => {
    const lifecycle = new DefaultDirectorCueLifecycle();
    const postponed = lifecycle.applyAction({
      authority,
      current: proposedState(),
      command: streamerCommand("later"),
      emergencyPaused: false,
      now: NOW + 1_000,
    });
    expect(postponed).toMatchObject({
      ok: true,
      decision: { nextCue: { state: "postponed", availableActions: [] } },
    });
    if (!postponed.ok) throw new Error(postponed.error.message);
    const current = liveDirectorStateSchema.parse({
      ...baseState,
      cue: postponed.decision.nextCue,
    });
    expect(
      lifecycle.resurface({
        authority,
        current,
        command: systemCommand({ commandId: "fixture-resurface-early" }),
        emergencyPaused: false,
        now: NOW + DIRECTOR_CUE_POSTPONE_MILLISECONDS,
      }),
    ).toMatchObject({ ok: false, error: { code: "forbidden" } });
    expect(
      lifecycle.resurface({
        authority,
        current,
        command: systemCommand({ commandId: "fixture-resurface" }),
        emergencyPaused: false,
        now: NOW + 1_000 + DIRECTOR_CUE_POSTPONE_MILLISECONDS,
      }),
    ).toMatchObject({
      ok: true,
      decision: {
        nextCue: {
          state: "proposed",
          availableActions: ["acknowledge", "turn-into-vote", "dismiss"],
        },
        events: [{ eventType: "live-director.cue-resurfaced" }],
      },
    });
  });

  it("rejects Later after the one allowed resurface", () => {
    const initial = proposedState();
    const current = liveDirectorStateSchema.parse({
      ...initial,
      cue: {
        ...initial.cue!,
        availableActions: ["acknowledge", "turn-into-vote", "dismiss"],
      },
    });
    expect(
      new DefaultDirectorCueLifecycle().applyAction({
        authority,
        current,
        command: streamerCommand("later"),
        emergencyPaused: false,
        now: NOW + 2_000,
      }),
    ).toMatchObject({ ok: false, error: { code: "forbidden" } });
  });

  it("rejects Later when fresh context cannot survive the delay", () => {
    const current = proposedState();
    expect(
      new DefaultDirectorCueLifecycle().applyAction({
        authority,
        current,
        command: streamerCommand("later"),
        emergencyPaused: false,
        now: current.cue!.expiresAt - DIRECTOR_CUE_POSTPONE_MILLISECONDS,
      }),
    ).toMatchObject({ ok: false, error: { code: "forbidden" } });
  });

  it("expires a late action using authoritative time", () => {
    const current = proposedState();
    expect(
      new DefaultDirectorCueLifecycle().applyAction({
        authority,
        current,
        command: streamerCommand("acknowledge"),
        emergencyPaused: false,
        now: current.cue!.expiresAt,
      }),
    ).toMatchObject({
      ok: true,
      decision: {
        nextCue: { state: "expired", availableActions: [] },
        events: [{ eventType: "live-director.cue-expired" }],
      },
    });
  });

  it("stales a cue when its supporting context changes", () => {
    const current = proposedState();
    expect(
      new DefaultDirectorCueLifecycle().reconcile({
        current,
        emergencyPaused: false,
        sessionEnded: false,
        contextChanged: true,
        now: NOW + 1_000,
      }),
    ).toMatchObject({
      ok: true,
      decision: { nextCue: { state: "stale", availableActions: [] } },
    });
  });

  it.each([
    [true, false, "emergency-paused"],
    [false, true, "session-ended"],
  ] as const)("cancels for %s/%s authority state", (emergencyPaused, sessionEnded, reason) => {
    expect(
      new DefaultDirectorCueLifecycle().reconcile({
        current: proposedState(),
        emergencyPaused,
        sessionEnded,
        contextChanged: false,
        now: NOW + 1_000,
      }),
    ).toMatchObject({ ok: true, decision: { nextCue: { state: "cancelled", reason } } });
  });

  it.each([
    ["another session", { ...authority, sessionId: "other-session" }, "validation"],
    ["another cycle", { ...authority, questCycleId: "other-cycle" }, "validation"],
    ["a stale revision", { ...authority, revision: 1 }, "stale-revision"],
  ] as const)("rejects commands from %s", (_name, changedAuthority, code) => {
    expect(
      new DefaultDirectorCueLifecycle().applyAction({
        authority: changedAuthority,
        current: proposedState(),
        command: streamerCommand("acknowledge"),
        emergencyPaused: false,
        now: NOW + 1_000,
      }),
    ).toMatchObject({ ok: false, error: { code } });
  });

  it("rejects a command for another cue", () => {
    expect(
      new DefaultDirectorCueLifecycle().applyAction({
        authority,
        current: proposedState(),
        command: streamerCommand("dismiss", { cueId: "another-cue" }),
        emergencyPaused: false,
        now: NOW + 1_000,
      }),
    ).toMatchObject({ ok: false, error: { code: "validation" } });
  });

  it("replays identical lifecycle input deterministically", () => {
    const lifecycle = new DefaultDirectorCueLifecycle();
    const input = {
      authority,
      current: proposedState(),
      command: streamerCommand("dismiss"),
      emergencyPaused: false,
      now: NOW + 1_000,
    } as const;
    expect(lifecycle.applyAction(input)).toEqual(lifecycle.applyAction(input));
  });
});
