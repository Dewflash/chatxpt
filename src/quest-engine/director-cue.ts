import {
  directorCueSchema,
  domainErrorSchema,
  liveDirectorStateSchema,
  streamerLiveDirectorCueCommandSchema,
  systemLiveDirectorCueCommandSchema,
  type DirectorCue,
  type DirectorCueAction,
  type DirectorCueLifecycle,
  type DomainError,
  type LiveDirectorState,
  type QuestEngineEventDraft,
  type StreamerLiveDirectorCueCommand,
  type SystemLiveDirectorCueCommand,
} from "../core";
import type { DirectorCueSuitabilityDecision } from "./intervention";

export const DIRECTOR_CUE_POSTPONE_MILLISECONDS = 10_000;

const INITIAL_ACTIONS = [
  "acknowledge",
  "turn-into-vote",
  "later",
  "dismiss",
] as const satisfies readonly DirectorCueAction[];

const RESURFACED_ACTIONS = [
  "acknowledge",
  "turn-into-vote",
  "dismiss",
] as const satisfies readonly DirectorCueAction[];

export interface DirectorCueAuthority {
  readonly sessionId: string;
  readonly questCycleId: string;
  readonly revision: number;
}

export interface DirectorCueDecision {
  readonly nextCue: DirectorCue;
  readonly events: readonly QuestEngineEventDraft[];
}

export type DirectorCueResult =
  | { readonly ok: true; readonly decision: DirectorCueDecision }
  | { readonly ok: false; readonly error: DomainError };

export interface OfferDirectorCueInput {
  readonly authority: DirectorCueAuthority;
  readonly current: LiveDirectorState;
  readonly command: SystemLiveDirectorCueCommand;
  readonly suitability: DirectorCueSuitabilityDecision;
  readonly now: number;
}

export interface ApplyDirectorCueActionInput {
  readonly authority: DirectorCueAuthority;
  readonly current: LiveDirectorState;
  readonly command: StreamerLiveDirectorCueCommand;
  readonly emergencyPaused: boolean;
  readonly now: number;
}

export interface ResurfaceDirectorCueInput {
  readonly authority: DirectorCueAuthority;
  readonly current: LiveDirectorState;
  readonly command: SystemLiveDirectorCueCommand;
  readonly emergencyPaused: boolean;
  readonly now: number;
}

export interface ReconcileDirectorCueInput {
  readonly current: LiveDirectorState;
  readonly emergencyPaused: boolean;
  readonly sessionEnded: boolean;
  /** Role 1 sets this only after accepting a different canonical Live Context. */
  readonly contextChanged: boolean;
  /** More specific accepted invalidation when Role 1 can identify it. */
  readonly contextInvalidation?: DirectorCueContextInvalidation;
  readonly now: number;
}

export type DirectorCueContextInvalidation =
  | "none"
  | "ordinary-gameplay-change"
  | "supporting-context-changed"
  | "intent-updated"
  | "audience-expired"
  | "safety-changed"
  | "quest-impossible";

const DIRECTOR_CUE_CONTEXT_INVALIDATIONS = new Set<DirectorCueContextInvalidation>([
  "none",
  "ordinary-gameplay-change",
  "supporting-context-changed",
  "intent-updated",
  "audience-expired",
  "safety-changed",
  "quest-impossible",
]);

function error(
  code: DomainError["code"],
  message: string,
  details?: DomainError["details"],
): DirectorCueResult {
  return {
    ok: false,
    error: domainErrorSchema.parse({ code, message, retryable: false, details }),
  };
}

function event(
  eventType: string,
  attributes: QuestEngineEventDraft["attributes"] = {},
): QuestEngineEventDraft {
  return { eventType, attributes };
}

function accept(
  cue: unknown,
  events: readonly QuestEngineEventDraft[],
): DirectorCueResult {
  const parsed = directorCueSchema.safeParse(cue);
  if (!parsed.success) {
    return error("internal", "Director Cue transition produced invalid canonical state");
  }
  return { ok: true, decision: { nextCue: parsed.data, events } };
}

function validAuthority(authority: DirectorCueAuthority): boolean {
  return (
    authority.sessionId.trim().length > 0 &&
    authority.questCycleId.trim().length > 0 &&
    Number.isSafeInteger(authority.revision) &&
    authority.revision >= 0
  );
}

function validateCommandAuthority(
  authority: DirectorCueAuthority,
  command: SystemLiveDirectorCueCommand | StreamerLiveDirectorCueCommand,
): DirectorCueResult | null {
  if (!validAuthority(authority)) {
    return error("validation", "Director Cue authority is invalid");
  }
  if (command.sessionId !== authority.sessionId) {
    return error("validation", "Director Cue command belongs to another session");
  }
  if (command.questCycleId !== authority.questCycleId) {
    return error("validation", "Director Cue command belongs to another quest cycle");
  }
  if (command.expectedRevision !== authority.revision) {
    return error("stale-revision", "Director Cue command expected a stale revision", {
      currentRevision: authority.revision,
      expectedRevision: command.expectedRevision,
    });
  }
  return null;
}

function invalidationReason(
  state: LiveDirectorState,
  cue: DirectorCue,
  now: number,
): "stale" | "expired" | null {
  if (now >= cue.expiresAt) return "expired";
  const context = state.liveContext;
  const intent = state.declaredIntent;
  if (
    context === null ||
    context.contextId !== cue.contextId ||
    context.expiresAt <= now ||
    intent.status !== "known" ||
    intent.intentId !== cue.intentId ||
    intent.expiresAt <= now
  ) {
    return "stale";
  }
  const pointer = state.audiencePointer;
  if (
    cue.audiencePointerId !== null &&
    (pointer === null ||
      pointer.status !== "known" ||
      pointer.pointerId !== cue.audiencePointerId ||
      pointer.expiresAt <= now)
  ) {
    return "stale";
  }
  return null;
}

function terminalise(
  cue: DirectorCue,
  state: "stale" | "expired" | "cancelled",
  now: number,
  reason: string,
): DirectorCueResult {
  const updatedAt = state === "expired" ? Math.max(now, cue.expiresAt) : now;
  return accept(
    { ...cue, state, reason, updatedAt, availableActions: [] },
    [event(`live-director.cue-${state}`, { cueId: cue.cueId, contextId: cue.contextId, reason })],
  );
}

function reconcileActiveCue(
  state: LiveDirectorState,
  cue: DirectorCue,
  now: number,
  emergencyPaused: boolean,
  sessionEnded: boolean,
  contextChanged: boolean,
  contextInvalidation: DirectorCueContextInvalidation = "none",
): DirectorCueResult | null {
  if (cue.state !== "proposed" && cue.state !== "postponed") return null;
  if (emergencyPaused) return terminalise(cue, "cancelled", now, "emergency-paused");
  if (sessionEnded) return terminalise(cue, "cancelled", now, "session-ended");
  if (contextInvalidation === "safety-changed") {
    return terminalise(cue, "cancelled", now, contextInvalidation);
  }
  if (contextInvalidation === "quest-impossible") {
    return terminalise(cue, "stale", now, contextInvalidation);
  }
  if (
    contextChanged ||
    ["supporting-context-changed", "intent-updated", "audience-expired"].includes(
      contextInvalidation,
    )
  ) {
    return terminalise(
      cue,
      "stale",
      now,
      contextInvalidation === "none" ? "supporting-context-changed" : contextInvalidation,
    );
  }
  const invalidation = invalidationReason(state, cue, now);
  if (invalidation === "expired") {
    return terminalise(cue, "expired", now, "cue-expired");
  }
  if (invalidation === "stale") {
    return terminalise(cue, "stale", now, "supporting-context-changed");
  }
  return null;
}

function parseCurrent(value: LiveDirectorState): LiveDirectorState | null {
  const parsed = liveDirectorStateSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/** Pure LD-R3-02 lifecycle. Role 1 remains the command and runtime authority. */
export class DefaultDirectorCueLifecycle implements DirectorCueLifecycle {
  offer(input: OfferDirectorCueInput): DirectorCueResult {
    const command = systemLiveDirectorCueCommandSchema.safeParse(input.command);
    const current = parseCurrent(input.current);
    if (!command.success || current === null || !Number.isSafeInteger(input.now) || input.now < 0) {
      return error("validation", "Director Cue offer input is invalid");
    }
    const boundary = validateCommandAuthority(input.authority, command.data);
    if (boundary !== null) return boundary;
    if (current.cue !== null && ["proposed", "postponed"].includes(current.cue.state)) {
      return error("forbidden", "Another Director Cue is already active");
    }
    const context = current.liveContext;
    const intent = current.declaredIntent;
    const pointer = current.audiencePointer;
    if (
      context === null ||
      context.contextId !== command.data.liveContextId ||
      intent.status !== "known" ||
      context.declaredIntentId !== intent.intentId ||
      pointer === null ||
      pointer.status !== "known" ||
      context.audiencePointerId !== pointer.pointerId ||
      input.now < context.compiledAt ||
      context.expiresAt <= input.now ||
      intent.expiresAt <= input.now ||
      pointer.expiresAt <= input.now
    ) {
      return error("expired", "Director Cue supporting context is unavailable or stale");
    }
    const suitability = input.suitability;
    if (
      suitability.disposition !== "offer-cue" ||
      !suitability.reasons.includes("eligible") ||
      !Number.isFinite(suitability.score) ||
      suitability.score < 0 ||
      suitability.score > 1 ||
      suitability.evidenceReferences.length === 0 ||
      new Set(suitability.evidenceReferences).size !== suitability.evidenceReferences.length
    ) {
      return error("validation", "Director Cue suitability did not authorise an offer");
    }
    const expiresAt = Math.min(context.expiresAt, intent.expiresAt, pointer.expiresAt);
    const availableActions =
      input.now + DIRECTOR_CUE_POSTPONE_MILLISECONDS < expiresAt
        ? INITIAL_ACTIONS
        : RESURFACED_ACTIONS;
    return accept(
      {
        cueId: command.data.cueId,
        contextId: context.contextId,
        intentId: intent.intentId,
        audiencePointerId: pointer.pointerId,
        state: "proposed",
        reason: "Fresh private engagement opportunity",
        evidenceReferences: suitability.evidenceReferences,
        createdAt: input.now,
        updatedAt: input.now,
        expiresAt,
        availableActions,
      },
      [
        event("live-director.cue-proposed", {
          cueId: command.data.cueId,
          contextId: context.contextId,
          availableActionCount: availableActions.length,
        }),
      ],
    );
  }

  applyAction(input: ApplyDirectorCueActionInput): DirectorCueResult {
    const command = streamerLiveDirectorCueCommandSchema.safeParse(input.command);
    const current = parseCurrent(input.current);
    if (!command.success || current === null || !Number.isSafeInteger(input.now) || input.now < 0) {
      return error("validation", "Director Cue action input is invalid");
    }
    const boundary = validateCommandAuthority(input.authority, command.data);
    if (boundary !== null) return boundary;
    const cue = current.cue;
    if (cue === null || cue.cueId !== command.data.cueId) {
      return error("validation", "Director Cue command does not match the current cue");
    }
    const reconciled = reconcileActiveCue(
      current,
      cue,
      input.now,
      input.emergencyPaused,
      false,
      false,
      "none",
    );
    if (reconciled !== null) return reconciled;
    if (!cue.availableActions.includes(command.data.action)) {
      return error("forbidden", `${command.data.action} is not available for this Director Cue`, {
        cueId: cue.cueId,
        state: cue.state,
      });
    }

    if (command.data.action === "later") {
      if (input.now + DIRECTOR_CUE_POSTPONE_MILLISECONDS >= cue.expiresAt) {
        return error("forbidden", "Director Cue cannot be postponed beyond fresh context");
      }
      return accept(
        {
          ...cue,
          state: "postponed",
          reason: "Streamer postponed this cue once",
          updatedAt: input.now,
          availableActions: [],
        },
        [event("live-director.cue-postponed", { cueId: cue.cueId })],
      );
    }
    const nextState = {
      acknowledge: "acknowledged",
      "turn-into-vote": "converted",
      dismiss: "dismissed",
    } as const;
    const state = nextState[command.data.action];
    return accept(
      {
        ...cue,
        state,
        reason:
          command.data.action === "turn-into-vote"
            ? "Streamer requested exactly-three candidate conversion"
            : `Streamer ${state} the cue`,
        updatedAt: input.now,
        availableActions: [],
      },
      [event(`live-director.cue-${state}`, { cueId: cue.cueId, action: command.data.action, candidatePublication: false })],
    );
  }

  resurface(input: ResurfaceDirectorCueInput): DirectorCueResult {
    const command = systemLiveDirectorCueCommandSchema.safeParse(input.command);
    const current = parseCurrent(input.current);
    if (!command.success || current === null || !Number.isSafeInteger(input.now) || input.now < 0) {
      return error("validation", "Director Cue resurface input is invalid");
    }
    const boundary = validateCommandAuthority(input.authority, command.data);
    if (boundary !== null) return boundary;
    const cue = current.cue;
    if (cue === null || cue.cueId !== command.data.cueId || cue.contextId !== command.data.liveContextId) {
      return error("validation", "Director Cue resurface command does not match the current cue");
    }
    const reconciled = reconcileActiveCue(
      current,
      cue,
      input.now,
      input.emergencyPaused,
      false,
      false,
      "none",
    );
    if (reconciled !== null) return reconciled;
    if (cue.state !== "postponed") {
      return error("forbidden", "Only a postponed Director Cue may resurface");
    }
    if (input.now < cue.updatedAt + DIRECTOR_CUE_POSTPONE_MILLISECONDS) {
      return error("forbidden", "Director Cue is not ready to resurface", {
        availableAt: cue.updatedAt + DIRECTOR_CUE_POSTPONE_MILLISECONDS,
      });
    }
    return accept(
      {
        ...cue,
        state: "proposed",
        reason: "Postponed cue resurfaced once while evidence remained fresh",
        updatedAt: input.now,
        availableActions: RESURFACED_ACTIONS,
      },
      [event("live-director.cue-resurfaced", { cueId: cue.cueId, laterAvailable: false })],
    );
  }

  reconcile(input: ReconcileDirectorCueInput): DirectorCueResult {
    const current = parseCurrent(input.current);
    if (
      current === null ||
      !Number.isSafeInteger(input.now) ||
      input.now < 0 ||
      typeof input.emergencyPaused !== "boolean" ||
      typeof input.sessionEnded !== "boolean" ||
      typeof input.contextChanged !== "boolean" ||
      (input.contextInvalidation !== undefined &&
        !DIRECTOR_CUE_CONTEXT_INVALIDATIONS.has(input.contextInvalidation))
    ) {
      return error("validation", "Director Cue reconciliation input is invalid");
    }
    if (current.cue === null) {
      return error("validation", "There is no Director Cue to reconcile");
    }
    const reconciled = reconcileActiveCue(
      current,
      current.cue,
      input.now,
      input.emergencyPaused,
      input.sessionEnded,
      input.contextChanged,
      input.contextInvalidation,
    );
    if (reconciled !== null) return reconciled;
    return accept(current.cue, []);
  }
}
