import {
  audiencePointerAggregateSchema,
  audiencePointerSchema,
  declaredStreamIntentSchema,
  liveContextFactSchema,
  liveDirectorStateSchema,
  type AudiencePointer,
  type AudiencePointerAggregate,
  type DeclaredStreamIntent,
  type GameplaySnapshot,
  type LiveContextFact,
  type LiveDirectorState,
  type StreamerLiveDirectorIntentCommand,
  type SystemLiveDirectorContextCommand,
} from "../contracts";
import type { AuthoritativeSessionState } from "./types";

export const LIVE_CONTEXT_TTL_MILLISECONDS = 30_000;
export const LIVE_CONTEXT_GAMEPLAY_FRESHNESS_MILLISECONDS = 15_000;

const LIVE_DIRECTOR_PRIVACY = {
  rawChatRetained: false,
  usernamesIncluded: false,
  viewerIdentifiersIncluded: false,
  providerPayloadIncluded: false,
} as const;

export class LiveDirectorContextCompositionError extends Error {
  constructor(
    readonly code: "validation" | "expired",
    message: string,
  ) {
    super(message);
    this.name = "LiveDirectorContextCompositionError";
  }
}

function scopedId(prefix: string, seed: string): string {
  return `${prefix}-${seed.slice(0, 127 - prefix.length)}`;
}

function contextExpiry(compiledAt: number): number {
  const expiresAt = compiledAt + LIVE_CONTEXT_TTL_MILLISECONDS;
  if (!Number.isSafeInteger(expiresAt)) {
    throw new LiveDirectorContextCompositionError("validation", "Live Context expiry is invalid");
  }
  return expiresAt;
}

function currentIntent(
  state: AuthoritativeSessionState,
  compiledAt: number,
): DeclaredStreamIntent {
  const intent = state.liveDirector?.declaredIntent;
  if (intent === undefined) {
    return declaredStreamIntentSchema.parse({
      status: "unknown",
      reason: "not-set",
      observedAt: compiledAt,
    });
  }
  if (intent.status === "known" && intent.expiresAt <= compiledAt) {
    return declaredStreamIntentSchema.parse({
      ...intent,
      status: "stale",
      staleAt: compiledAt,
    });
  }
  return declaredStreamIntentSchema.parse(intent);
}

export function applyDeclaredStreamIntent(
  state: AuthoritativeSessionState,
  command: StreamerLiveDirectorIntentCommand,
  acceptedAt: number,
): LiveDirectorState {
  let declaredIntent: DeclaredStreamIntent;
  if (command.action === "clear") {
    declaredIntent = declaredStreamIntentSchema.parse({
      status: "unknown",
      reason: "cleared",
      observedAt: acceptedAt,
    });
  } else {
    if (command.intent === null || command.intent.requestedExpiresAt <= acceptedAt) {
      throw new LiveDirectorContextCompositionError(
        "expired",
        "Declared stream intent already expired before it could be accepted",
      );
    }
    declaredIntent = declaredStreamIntentSchema.parse({
      status: "known",
      intentId: command.commandId,
      goal: command.intent.goal,
      objective: command.intent.objective,
      desiredAudienceInvolvement: command.intent.desiredAudienceInvolvement,
      authorId: command.actor.actorId,
      updatedAt: acceptedAt,
      expiresAt: command.intent.requestedExpiresAt,
    });
  }

  return liveDirectorStateSchema.parse({
    declaredIntent,
    // Pointer intent-alignment is no longer current after a goal change.
    audiencePointer: null,
    liveContext: null,
    cue: null,
    publicContext: null,
    privacy: LIVE_DIRECTOR_PRIVACY,
    updatedAt: acceptedAt,
  });
}

function unresolvedPointer(
  status: "unknown" | "conflicting" | "ambiguous" | "permission-denied",
  reason: string,
  observedAt: number,
  evidenceSignalIds: readonly string[],
): AudiencePointer {
  return audiencePointerSchema.parse({
    status,
    reason,
    observedAt,
    evidenceSignalIds: [...new Set(evidenceSignalIds)],
  });
}

export function composeAudiencePointer(
  input: AudiencePointerAggregate,
  acceptedAt: number,
): AudiencePointer {
  const aggregate = audiencePointerAggregateSchema.parse(input);
  if (aggregate.observedAt > acceptedAt || aggregate.envelope.receivedAt > acceptedAt) {
    throw new LiveDirectorContextCompositionError(
      "validation",
      "Audience pointer aggregate cannot come from the future",
    );
  }
  if (aggregate.status !== "known") {
    return unresolvedPointer(
      aggregate.status,
      aggregate.reason,
      aggregate.observedAt,
      aggregate.evidenceSignalIds,
    );
  }

  const deduplicated = new Map<string, (typeof aggregate.evidence)[number]>();
  for (const evidence of aggregate.evidence) {
    if (evidence.deleted) continue;
    const key = JSON.stringify([evidence.participantKey, evidence.messageFingerprint]);
    if (!deduplicated.has(key)) deduplicated.set(key, evidence);
  }
  const qualifyingEvidence = [...deduplicated.values()].sort(
    (left, right) =>
      left.observedAt - right.observedAt ||
      left.evidenceSignalId.localeCompare(right.evidenceSignalId),
  );
  if (qualifyingEvidence.length === 0) {
    return unresolvedPointer(
      "unknown",
      "Qualifying audience evidence was deleted or cleared.",
      aggregate.observedAt,
      [],
    );
  }

  const pointer = {
    status: acceptedAt >= aggregate.expiresAt ? ("stale" as const) : ("known" as const),
    pointerId: aggregate.pointerId,
    topic: aggregate.topic,
    observedAt: aggregate.observedAt,
    windowStartedAt: aggregate.windowStartedAt,
    windowEndedAt: aggregate.windowEndedAt,
    createdAt: aggregate.createdAt,
    expiresAt: aggregate.expiresAt,
    confidence: aggregate.confidence,
    relevance: aggregate.relevance,
    intentAlignment: aggregate.intentAlignment,
    uniqueParticipants: new Set(
      qualifyingEvidence.map((evidence) => evidence.participantKey),
    ).size,
    qualifyingMessages: qualifyingEvidence.length,
    sarcasmRisk: aggregate.sarcasmRisk,
    evidenceSignalIds: [
      ...new Set(qualifyingEvidence.map((evidence) => evidence.evidenceSignalId)),
    ].slice(0, 32),
    ...(acceptedAt >= aggregate.expiresAt ? { staleAt: acceptedAt } : {}),
  };
  return audiencePointerSchema.parse(pointer);
}

function declaredIntentFact(
  intent: DeclaredStreamIntent,
  contextId: string,
  compiledAt: number,
  evidenceClass: LiveContextFact["evidenceClass"],
): LiveContextFact {
  const expiresAt = contextExpiry(compiledAt);
  if (intent.status === "unknown") {
    return liveContextFactSchema.parse({
      factId: scopedId("streamer", contextId),
      sourceClass: "streamer-declared",
      kind: "current-objective",
      status: intent.reason === "permission-denied" ? "permission-denied" : "unknown",
      value: null,
      method: "declared-intent",
      confidence: 0,
      observedAt: intent.observedAt,
      expiresAt: Math.max(expiresAt, intent.observedAt + 1),
      evidenceClass,
      evidenceSignalIds: [],
    });
  }
  return liveContextFactSchema.parse({
    factId: scopedId("streamer", contextId),
    sourceClass: "streamer-declared",
    kind: "current-objective",
    status: intent.status,
    value: intent.objective,
    method: "declared-intent",
    confidence: 1,
    observedAt: intent.updatedAt,
    expiresAt: intent.expiresAt,
    evidenceClass,
    evidenceSignalIds: [intent.intentId],
  });
}

function gameplayFactStatus(
  signal: GameplaySnapshot["signals"][number],
  compiledAt: number,
): LiveContextFact["status"] {
  const observation = signal.observation;
  if (observation.provenance.observedAt > compiledAt) return "unknown";
  if (
    observation.status === "known" &&
    observation.provenance.observedAt + LIVE_CONTEXT_GAMEPLAY_FRESHNESS_MILLISECONDS <= compiledAt
  ) {
    return "stale";
  }
  if (observation.status === "known" || observation.status === "stale") {
    return observation.status;
  }
  if (observation.status === "unavailable") return "unavailable";
  if (observation.reason === "conflicting") return "conflicting";
  if (observation.reason === "permission-denied") return "permission-denied";
  return "unknown";
}

function gameplayFacts(
  gameplay: GameplaySnapshot | null,
  contextId: string,
  compiledAt: number,
  evidenceClass: LiveContextFact["evidenceClass"],
): readonly LiveContextFact[] {
  if (gameplay === null || gameplay.signals.length === 0) {
    return [
      liveContextFactSchema.parse({
        factId: scopedId("gameplay", contextId),
        sourceClass: "gameplay-observed",
        kind: "gameplay-context",
        status: "unknown",
        value: null,
        method: "current-gameplay-snapshot",
        confidence: 0,
        observedAt: compiledAt,
        expiresAt: contextExpiry(compiledAt),
        evidenceClass,
        evidenceSignalIds: [],
      }),
    ];
  }

  return gameplay.signals.slice(0, 16).map((signal, index) => {
    const observation = signal.observation;
    const status = gameplayFactStatus(signal, compiledAt);
    const value =
      status === "known" && observation.status === "known"
        ? observation.value
        : status === "stale"
          ? observation.status === "known"
            ? observation.value
            : observation.status === "stale"
              ? (observation.previousValue ?? null)
              : null
          : null;
    const observedAt = observation.provenance.observedAt;
    return liveContextFactSchema.parse({
      factId: scopedId(`gameplay-${index}`, signal.signalId),
      sourceClass: "gameplay-observed",
      kind: signal.kind,
      status,
      value,
      method: observation.provenance.method,
      confidence:
        observation.provenance.observedAt > compiledAt
          ? 0
          : observation.provenance.confidence,
      observedAt,
      expiresAt: observedAt + LIVE_CONTEXT_GAMEPLAY_FRESHNESS_MILLISECONDS,
      evidenceClass: observation.provenance.evidenceClass,
      evidenceSignalIds: [signal.signalId],
    });
  });
}

function audienceFact(
  pointer: AudiencePointer,
  contextId: string,
  compiledAt: number,
  evidenceClass: LiveContextFact["evidenceClass"],
): LiveContextFact {
  if (pointer.status === "known" || pointer.status === "stale") {
    return liveContextFactSchema.parse({
      factId: scopedId("audience", contextId),
      sourceClass: "audience-derived",
      kind: "chat-pointer",
      status: pointer.status,
      value: pointer.topic,
      method: "privacy-safe-audience-aggregate",
      confidence: pointer.confidence,
      observedAt: pointer.observedAt,
      expiresAt: pointer.expiresAt,
      evidenceClass,
      evidenceSignalIds: pointer.evidenceSignalIds,
    });
  }
  return liveContextFactSchema.parse({
    factId: scopedId("audience", contextId),
    sourceClass: "audience-derived",
    kind: "chat-pointer",
    status: pointer.status === "ambiguous" ? "unknown" : pointer.status,
    value: null,
    method: "privacy-safe-audience-aggregate",
    confidence: 0,
    observedAt: pointer.observedAt,
    expiresAt: Math.max(contextExpiry(compiledAt), pointer.observedAt + 1),
    evidenceClass,
    evidenceSignalIds: pointer.evidenceSignalIds,
  });
}

export function composeLiveDirectorContext(input: {
  readonly state: AuthoritativeSessionState;
  readonly command: SystemLiveDirectorContextCommand;
  readonly aggregate: AudiencePointerAggregate | null;
  readonly acceptedAt: number;
}): LiveDirectorState {
  const { state, command, aggregate, acceptedAt } = input;
  const questCycleId = state.questCycle.envelope.questCycleId;
  if (command.questCycleId !== questCycleId) {
    throw new LiveDirectorContextCompositionError(
      "validation",
      "Live Context command must match the current quest cycle",
    );
  }
  if ((command.audiencePointerId === null) !== (aggregate === null)) {
    throw new LiveDirectorContextCompositionError(
      "validation",
      "Live Context command and audience aggregate do not match",
    );
  }
  if (aggregate !== null) {
    const parsed = audiencePointerAggregateSchema.parse(aggregate);
    if (
      parsed.pointerId !== command.audiencePointerId ||
      parsed.envelope.sessionId !== state.session.sessionId ||
      parsed.envelope.questCycleId !== questCycleId ||
      parsed.envelope.revision !== state.session.revision ||
      parsed.envelope.evidenceClass !== state.questCycle.envelope.evidenceClass
    ) {
      throw new LiveDirectorContextCompositionError(
        "validation",
        "Audience pointer aggregate belongs to different authoritative state",
      );
    }
  }

  const intent = currentIntent(state, acceptedAt);
  const pointer =
    aggregate === null
      ? unresolvedPointer(
          "unknown",
          "No qualifying audience aggregate is available.",
          acceptedAt,
          [],
        )
      : composeAudiencePointer(aggregate, acceptedAt);
  const evidenceClass = state.questCycle.envelope.evidenceClass;
  const facts = [
    declaredIntentFact(intent, command.liveContextId, acceptedAt, evidenceClass),
    ...gameplayFacts(state.gameplay, command.liveContextId, acceptedAt, evidenceClass),
    audienceFact(pointer, command.liveContextId, acceptedAt, evidenceClass),
  ];
  const liveContext = {
    contextId: command.liveContextId,
    declaredIntentId: intent.status === "unknown" ? null : intent.intentId,
    audiencePointerId:
      pointer.status === "known" || pointer.status === "stale" ? pointer.pointerId : null,
    compiledAt: acceptedAt,
    expiresAt: contextExpiry(acceptedAt),
    facts,
  };

  return liveDirectorStateSchema.parse({
    declaredIntent: intent,
    audiencePointer: pointer,
    liveContext,
    cue: null,
    publicContext: null,
    privacy: LIVE_DIRECTOR_PRIVACY,
    updatedAt: acceptedAt,
  });
}
