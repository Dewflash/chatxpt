import {
  commandEnvelopeSchema,
  liveDirectorStateSchema,
  type CandidateBatch,
  type CommandEnvelope,
  type DomainError,
  type LiveDirectorState,
  type QuestEngineDecision,
  type QuestEngineEventDraft,
} from "../core";
import { DefaultQuestEngine } from "./engine";
import {
  DefaultCandidateAssembler,
  type CandidateAssemblyAudit,
  type CandidateAssemblyInput,
} from "./validation";

type IntelligenceReadyCommand = Extract<
  CommandEnvelope,
  { readonly type: "system.intelligence-ready" }
>;

export interface DirectorCueConversionInput
  extends Omit<CandidateAssemblyInput, "candidates"> {
  readonly liveDirector: LiveDirectorState;
  /** `null` represents provider/algorithmic unavailability; deterministic fallback still runs. */
  readonly candidates: readonly unknown[] | null;
  readonly command: IntelligenceReadyCommand;
  readonly emergencyPaused: boolean;
  readonly sessionEnded: boolean;
  readonly questImpossible: boolean;
}

export type DirectorCueConversionFailureCode =
  | "cue-not-converted"
  | "invalid-context"
  | "fallback-exhausted"
  | "proposal-rejected";

export type DirectorCueConversionResult =
  | {
      readonly ok: true;
      readonly cueId: string;
      readonly batch: CandidateBatch;
      readonly audit: readonly CandidateAssemblyAudit[];
      readonly decision: QuestEngineDecision;
      readonly readyForStreamerApproval: true;
    }
  | {
      readonly ok: false;
      readonly disposition: "no-publication";
      readonly code: DirectorCueConversionFailureCode;
      readonly reason: string;
      readonly audit: readonly CandidateAssemblyAudit[];
      readonly error?: DomainError;
    };

function noPublication(
  code: DirectorCueConversionFailureCode,
  reason: string,
  audit: readonly CandidateAssemblyAudit[] = [],
  error?: DomainError,
): DirectorCueConversionResult {
  return {
    ok: false,
    disposition: "no-publication",
    code,
    reason,
    audit,
    ...(error === undefined ? {} : { error }),
  };
}

function cueMatchesCurrentContext(state: LiveDirectorState, now: number): boolean {
  const cue = state.cue;
  if (cue === null || cue.state !== "converted") return false;
  if (state.liveContext?.contextId !== cue.contextId) return false;
  if (state.liveContext.expiresAt <= now || cue.expiresAt <= now) return false;
  if (state.declaredIntent.status !== "known" || state.declaredIntent.intentId !== cue.intentId) {
    return false;
  }
  if (state.declaredIntent.expiresAt <= now) return false;
  if (cue.audiencePointerId === null) return true;
  return (
    state.audiencePointer?.status === "known" &&
    state.audiencePointer.pointerId === cue.audiencePointerId &&
    state.audiencePointer.expiresAt > now
  );
}

/**
 * Pure LD-R3-03 coordinator. It consumes an already-authorised converted cue,
 * reuses the existing assembler and quest engine, and stops at the private
 * streamer-approval-ready `proposed` state. Role 1 still owns generation,
 * authentication, revisions, persistence, broadcast, and viewer publication.
 */
export class DefaultDirectorCueConverter {
  constructor(
    private readonly assembler = new DefaultCandidateAssembler(),
    private readonly engine = new DefaultQuestEngine(),
  ) {}

  convert(input: DirectorCueConversionInput): DirectorCueConversionResult {
    const liveDirector = liveDirectorStateSchema.safeParse(input.liveDirector);
    const command = commandEnvelopeSchema.safeParse(input.command);
    if (
      !liveDirector.success ||
      !command.success ||
      command.data.type !== "system.intelligence-ready" ||
      !Number.isSafeInteger(input.now) ||
      input.now < 0 ||
      typeof input.emergencyPaused !== "boolean" ||
      typeof input.sessionEnded !== "boolean" ||
      typeof input.questImpossible !== "boolean"
    ) {
      return noPublication("invalid-context", "Director Cue conversion input is invalid.");
    }
    if (input.emergencyPaused || input.sessionEnded || input.questImpossible) {
      return noPublication(
        "invalid-context",
        input.emergencyPaused
          ? "Emergency pause prevents Director Cue conversion."
          : input.sessionEnded
            ? "An ended session cannot convert a Director Cue."
            : "An impossible opportunity cannot convert a Director Cue.",
      );
    }
    if (!cueMatchesCurrentContext(liveDirector.data, input.now)) {
      return noPublication(
        "cue-not-converted",
        "Only the current canonical converted Director Cue may request candidates.",
      );
    }

    const assembled = this.assembler.assemble({
      envelope: input.envelope,
      candidates: input.candidates ?? [],
      intelligence: input.intelligence,
      profile: input.profile,
      currentState: input.currentState,
      recentQuests: input.recentQuests,
      now: input.now,
      seed: input.seed,
    });
    if (!assembled.ok) {
      return noPublication(assembled.code, assembled.reason, assembled.audit);
    }

    const proposed = this.engine.decide({
      currentState: input.currentState,
      command: command.data,
      candidateBatch: assembled.batch,
      now: input.now,
    });
    if (
      !proposed.ok ||
      proposed.decision.nextState.status !== "proposed" ||
      proposed.decision.nextState.options.length !== 3 ||
      !proposed.decision.nextState.availableStreamerActions.includes("approve") ||
      !proposed.decision.nextState.availableStreamerActions.includes("reject")
    ) {
      return noPublication(
        "proposal-rejected",
        proposed.ok
          ? "Exactly-three conversion did not reach streamer approval."
          : proposed.error.message,
        assembled.audit,
        proposed.ok ? undefined : proposed.error,
      );
    }

    const cue = liveDirector.data.cue!;
    const conversionEvent = {
      eventType: "live-director.cue-conversion-ready",
      attributes: {
        cueId: cue.cueId,
        contextId: cue.contextId,
        candidateCount: assembled.batch.candidates.length,
        fallbackCount: assembled.batch.candidates.filter(
          ({ generation }) => generation.method === "deterministic-fallback",
        ).length,
        streamerApprovalRequired: true,
        candidatePublication: false,
      },
    } satisfies QuestEngineEventDraft;

    return {
      ok: true,
      cueId: cue.cueId,
      batch: assembled.batch,
      audit: assembled.audit,
      decision: {
        nextState: proposed.decision.nextState,
        events: [...proposed.decision.events, conversionEvent],
      },
      readyForStreamerApproval: true,
    };
  }
}
