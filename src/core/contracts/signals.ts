import { z } from "zod";

import {
  confidenceSchema,
  contractEnvelopeSchema,
  evidenceClassSchema,
  identifierSchema,
  messageSourceSchema,
  timestampSchema,
} from "./common";

export const signalValueSchema = z.union([
  z.string().max(240),
  z.number().finite(),
  z.boolean(),
]);

export const signalProvenanceSchema = z
  .object({
    source: messageSourceSchema,
    method: z.string().trim().min(1).max(80),
    confidence: confidenceSchema,
    observedAt: timestampSchema,
    receivedAt: timestampSchema,
    evidenceClass: evidenceClassSchema,
  })
  .strict()
  .superRefine((provenance, context) => {
    if (provenance.receivedAt < provenance.observedAt) {
      context.addIssue({
        code: "custom",
        message: "receivedAt cannot precede observedAt",
        path: ["receivedAt"],
      });
    }
    if (provenance.source === "test-fixture" && provenance.evidenceClass === "live") {
      context.addIssue({
        code: "custom",
        message: "Test-fixture provenance cannot be classified as live evidence",
        path: ["evidenceClass"],
      });
    }
  });

const knownSignalSchema = z
  .object({
    status: z.literal("known"),
    value: signalValueSchema,
    provenance: signalProvenanceSchema,
  })
  .strict();

const unknownSignalSchema = z
  .object({
    status: z.literal("unknown"),
    reason: z.enum(["not-observed", "low-confidence", "unsupported", "conflicting", "permission-denied"]),
    provenance: signalProvenanceSchema,
  })
  .strict();

const staleSignalSchema = z
  .object({
    status: z.literal("stale"),
    reason: z.string().trim().min(1).max(160),
    previousValue: signalValueSchema.optional(),
    provenance: signalProvenanceSchema,
  })
  .strict();

const unavailableSignalSchema = z
  .object({
    status: z.literal("unavailable"),
    reason: z.string().trim().min(1).max(160),
    provenance: signalProvenanceSchema,
  })
  .strict();

export const signalObservationSchema = z.discriminatedUnion("status", [
  knownSignalSchema,
  unknownSignalSchema,
  staleSignalSchema,
  unavailableSignalSchema,
]);

export const namedSignalSchema = z
  .object({
    signalId: identifierSchema,
    kind: z.string().trim().min(1).max(80),
    observation: signalObservationSchema,
  })
  .strict();

export const gameSupportTierSchema = z.enum(["universal-visual", "calibrated-hud", "native-telemetry"]);

export const gameplayCapabilitiesSchema = z
  .object({
    tier: gameSupportTierSchema,
    gameId: identifierSchema.nullable(),
    adapterId: identifierSchema.nullable(),
    supportedSignals: z.array(z.string().trim().min(1).max(80)).max(64),
  })
  .strict()
  .superRefine((capabilities, context) => {
    if (capabilities.tier === "calibrated-hud" && capabilities.adapterId === null) {
      context.addIssue({
        code: "custom",
        message: "Calibrated HUD capabilities require an adapterId",
        path: ["adapterId"],
      });
    }
  });

export const gameplayFrameObservationSchema = z
  .object({
    envelope: contractEnvelopeSchema,
    frameId: identifierSchema,
    capturedAt: timestampSchema,
    width: z.number().int().positive().max(7680),
    height: z.number().int().positive().max(4320),
    status: z.enum(["ready", "stale", "permission-denied", "unavailable", "ended"]),
  })
  .strict();

export const gameplayCaptureMetricsSchema = z
  .object({
    observedAt: timestampSchema,
    framesProcessed: z.number().int().nonnegative(),
    processingCoverage: z.number().min(0).max(1),
    cadenceFps: z.number().nonnegative().max(120).nullable(),
    lastLatencyMs: z.number().int().nonnegative().max(120_000).nullable(),
    droppedFrames: z.number().int().nonnegative().nullable(),
    ocrStatus: z.enum(["ready", "not-required", "unavailable", "unknown"]),
    normalizedFactCount: z.number().int().nonnegative(),
  })
  .strict();

export const gameplaySnapshotSchema = z
  .object({
    envelope: contractEnvelopeSchema,
    capabilities: gameplayCapabilitiesSchema,
    signals: z.array(namedSignalSchema).max(128),
    captureMetrics: gameplayCaptureMetricsSchema.nullable().optional(),
  })
  .strict()
  .superRefine((snapshot, context) => {
    const signalIds = snapshot.signals.map((signal) => signal.signalId);
    if (new Set(signalIds).size !== signalIds.length) {
      context.addIssue({
        code: "custom",
        message: "Gameplay signal IDs must be distinct within a snapshot",
        path: ["signals"],
      });
    }

    for (const [index, signal] of snapshot.signals.entries()) {
      if (signal.observation.provenance.evidenceClass !== snapshot.envelope.evidenceClass) {
        context.addIssue({
          code: "custom",
          message: "Signal evidence class must match its snapshot envelope",
          path: ["signals", index, "observation", "provenance", "evidenceClass"],
        });
      }
    }
  });

export const audienceEventSchema = z
  .object({
    envelope: contractEnvelopeSchema,
    eventType: z.enum(["message", "reaction", "viewer-join", "viewer-leave", "chat-vote"]),
    viewerId: identifierSchema.nullable(),
    text: z.string().trim().max(500).nullable(),
    chatVoteChoice: z.number().int().min(1).max(3).nullable(),
    retentionClass: z.enum(["ephemeral", "raw-24h-max", "aggregate"]),
  })
  .strict()
  .superRefine((event, context) => {
    if (event.eventType === "message" && event.text === null) {
      context.addIssue({ code: "custom", message: "Message events require text", path: ["text"] });
    }
    if (event.eventType !== "message" && event.text !== null) {
      context.addIssue({
        code: "custom",
        message: "Only message events can carry text",
        path: ["text"],
      });
    }
    if (event.eventType === "chat-vote" && event.chatVoteChoice === null) {
      context.addIssue({
        code: "custom",
        message: "Chat-vote events require chatVoteChoice",
        path: ["chatVoteChoice"],
      });
    }
    if (event.eventType !== "chat-vote" && event.chatVoteChoice !== null) {
      context.addIssue({
        code: "custom",
        message: "Only chat-vote events can carry chatVoteChoice",
        path: ["chatVoteChoice"],
      });
    }
  });

export const audienceSnapshotSchema = z
  .object({
    envelope: contractEnvelopeSchema,
    sampleSize: z.number().int().nonnegative(),
    signals: z.array(namedSignalSchema).max(128),
  })
  .strict()
  .superRefine((snapshot, context) => {
    const signalIds = snapshot.signals.map((signal) => signal.signalId);
    if (new Set(signalIds).size !== signalIds.length) {
      context.addIssue({
        code: "custom",
        message: "Audience signal IDs must be distinct within a snapshot",
        path: ["signals"],
      });
    }

    for (const [index, signal] of snapshot.signals.entries()) {
      if (signal.observation.provenance.evidenceClass !== snapshot.envelope.evidenceClass) {
        context.addIssue({
          code: "custom",
          message: "Signal evidence class must match its snapshot envelope",
          path: ["signals", index, "observation", "provenance", "evidenceClass"],
        });
      }
    }
  });

export const liveContextSourceClassSchema = z.enum([
  "streamer-declared",
  "gameplay-observed",
  "audience-derived",
]);

export const liveContextFactStatusSchema = z.enum([
  "known",
  "unknown",
  "stale",
  "conflicting",
  "unavailable",
  "permission-denied",
]);

export const liveContextFactSchema = z
  .object({
    factId: identifierSchema,
    sourceClass: liveContextSourceClassSchema,
    kind: z.string().trim().min(1).max(80),
    status: liveContextFactStatusSchema,
    value: signalValueSchema.nullable(),
    method: z.string().trim().min(1).max(80),
    confidence: confidenceSchema,
    observedAt: timestampSchema,
    expiresAt: timestampSchema,
    evidenceClass: evidenceClassSchema,
    evidenceSignalIds: z.array(identifierSchema).max(32),
  })
  .strict()
  .superRefine((fact, context) => {
    if (fact.expiresAt <= fact.observedAt) {
      context.addIssue({
        code: "custom",
        message: "Live Context facts must expire after they are observed",
        path: ["expiresAt"],
      });
    }
    if (fact.status === "known" && fact.value === null) {
      context.addIssue({
        code: "custom",
        message: "Known Live Context facts require a value",
        path: ["value"],
      });
    }
    if (!["known", "stale"].includes(fact.status) && fact.value !== null) {
      context.addIssue({
        code: "custom",
        message: "Only known or stale Live Context facts may carry a value",
        path: ["value"],
      });
    }
    if (new Set(fact.evidenceSignalIds).size !== fact.evidenceSignalIds.length) {
      context.addIssue({
        code: "custom",
        message: "Live Context evidence references must be distinct",
        path: ["evidenceSignalIds"],
      });
    }
  });

export const MIN_CONFIRMED_STREAMER_SPEECH_CONFIDENCE = 0.55;

const declaredStreamIntentFields = {
  intentId: identifierSchema,
  goal: z.string().trim().min(3).max(120),
  objective: z.string().trim().min(3).max(240),
  desiredAudienceInvolvement: z.string().trim().min(1).max(160).nullable(),
  inputMethod: z.enum(["manual", "speech"]).default("manual"),
  confidence: confidenceSchema.default(1),
  authorId: identifierSchema,
  updatedAt: timestampSchema,
  expiresAt: timestampSchema,
};

export const declaredStreamIntentSchema = z
  .discriminatedUnion("status", [
    z.object({ status: z.literal("known"), ...declaredStreamIntentFields }).strict(),
    z
      .object({
        status: z.literal("unknown"),
        reason: z.enum(["not-set", "cleared", "permission-denied"]),
        observedAt: timestampSchema,
      })
      .strict(),
    z
      .object({
        status: z.literal("stale"),
        ...declaredStreamIntentFields,
        staleAt: timestampSchema,
      })
      .strict(),
  ])
  .superRefine((intent, context) => {
    if (intent.status === "unknown") return;
    if (intent.expiresAt <= intent.updatedAt) {
      context.addIssue({
        code: "custom",
        message: "Declared stream intent must expire after it is updated",
        path: ["expiresAt"],
      });
    }
    if (intent.status === "stale" && intent.staleAt < intent.expiresAt) {
      context.addIssue({
        code: "custom",
        message: "Stale intent cannot predate its expiry",
        path: ["staleAt"],
      });
    }
  });

const audiencePointerEvidenceSchema = z
  .object({
    pointerId: identifierSchema,
    topic: z.string().trim().min(1).max(240),
    observedAt: timestampSchema,
    windowStartedAt: timestampSchema,
    windowEndedAt: timestampSchema,
    createdAt: timestampSchema,
    expiresAt: timestampSchema,
    confidence: confidenceSchema,
    relevance: confidenceSchema,
    intentAlignment: confidenceSchema,
    uniqueParticipants: z.number().int().nonnegative(),
    qualifyingMessages: z.number().int().nonnegative(),
    sarcasmRisk: z.boolean(),
    evidenceSignalIds: z.array(identifierSchema).max(32),
  })
  .strict();

export const audiencePointerSchema = z
  .discriminatedUnion("status", [
    audiencePointerEvidenceSchema.extend({ status: z.literal("known") }).strict(),
    audiencePointerEvidenceSchema
      .extend({ status: z.literal("stale"), staleAt: timestampSchema })
      .strict(),
    z
      .object({
        status: z.enum(["unknown", "conflicting", "ambiguous", "permission-denied"]),
        reason: z.string().trim().min(1).max(160),
        observedAt: timestampSchema,
        evidenceSignalIds: z.array(identifierSchema).max(32),
      })
      .strict(),
  ])
  .superRefine((pointer, context) => {
    if (new Set(pointer.evidenceSignalIds).size !== pointer.evidenceSignalIds.length) {
      context.addIssue({
        code: "custom",
        message: "Audience pointer evidence references must be distinct",
        path: ["evidenceSignalIds"],
      });
    }
    if (pointer.status !== "known" && pointer.status !== "stale") return;
    if (
      pointer.windowEndedAt < pointer.windowStartedAt ||
      pointer.observedAt < pointer.windowEndedAt ||
      pointer.createdAt < pointer.observedAt ||
      pointer.expiresAt <= pointer.createdAt
    ) {
      context.addIssue({
        code: "custom",
        message: "Audience pointer timestamps must be monotonic and expire after creation",
        path: ["expiresAt"],
      });
    }
    if (pointer.uniqueParticipants > pointer.qualifyingMessages) {
      context.addIssue({
        code: "custom",
        message: "Unique participants cannot exceed qualifying messages",
        path: ["uniqueParticipants"],
      });
    }
    if (pointer.status === "stale" && pointer.staleAt < pointer.expiresAt) {
      context.addIssue({
        code: "custom",
        message: "A stale audience pointer cannot predate its expiry",
        path: ["staleAt"],
      });
    }
  });

/**
 * Ephemeral Role 2 -> Role 1 input used to build a retained Chat Pointer.
 * The opaque participant keys and message fingerprints exist only so Role 1
 * can remove duplicate deliveries/repeated spam and count distinct people.
 * They are deliberately absent from AudiencePointer and authoritative state.
 */
export const audiencePointerAggregateEvidenceSchema = z
  .object({
    evidenceSignalId: identifierSchema,
    participantKey: identifierSchema,
    messageFingerprint: identifierSchema,
    observedAt: timestampSchema,
    deleted: z.boolean(),
  })
  .strict();

const audiencePointerAggregateEnvelopeFields = {
  envelope: contractEnvelopeSchema,
  pointerId: identifierSchema,
  observedAt: timestampSchema,
};

export const audiencePointerAggregateSchema = z
  .discriminatedUnion("status", [
    z
      .object({
        ...audiencePointerAggregateEnvelopeFields,
        status: z.literal("known"),
        topic: z.string().trim().min(1).max(240),
        windowStartedAt: timestampSchema,
        windowEndedAt: timestampSchema,
        createdAt: timestampSchema,
        expiresAt: timestampSchema,
        confidence: confidenceSchema,
        relevance: confidenceSchema,
        intentAlignment: confidenceSchema,
        sarcasmRisk: z.boolean(),
        evidence: z.array(audiencePointerAggregateEvidenceSchema).min(1).max(128),
      })
      .strict(),
    z
      .object({
        ...audiencePointerAggregateEnvelopeFields,
        status: z.enum(["unknown", "conflicting", "ambiguous", "permission-denied"]),
        reason: z.string().trim().min(1).max(160),
        evidenceSignalIds: z.array(identifierSchema).max(32),
      })
      .strict(),
  ])
  .superRefine((aggregate, context) => {
    if (
      aggregate.envelope.source !== "algorithm" &&
      aggregate.envelope.source !== "test-fixture"
    ) {
      context.addIssue({
        code: "custom",
        message: "Audience pointer aggregates must come from an algorithm or test fixture",
        path: ["envelope", "source"],
      });
    }
    if (aggregate.observedAt !== aggregate.envelope.occurredAt) {
      context.addIssue({
        code: "custom",
        message: "Audience pointer observation time must match its envelope",
        path: ["observedAt"],
      });
    }
    if (aggregate.status !== "known") {
      if (new Set(aggregate.evidenceSignalIds).size !== aggregate.evidenceSignalIds.length) {
        context.addIssue({
          code: "custom",
          message: "Audience pointer aggregate evidence references must be distinct",
          path: ["evidenceSignalIds"],
        });
      }
      return;
    }
    if (
      aggregate.windowEndedAt < aggregate.windowStartedAt ||
      aggregate.observedAt < aggregate.windowEndedAt ||
      aggregate.createdAt < aggregate.observedAt ||
      aggregate.expiresAt <= aggregate.createdAt
    ) {
      context.addIssue({
        code: "custom",
        message: "Audience pointer aggregate timestamps must be monotonic and expire after creation",
        path: ["expiresAt"],
      });
    }
    for (const [index, evidence] of aggregate.evidence.entries()) {
      if (
        evidence.observedAt < aggregate.windowStartedAt ||
        evidence.observedAt > aggregate.windowEndedAt
      ) {
        context.addIssue({
          code: "custom",
          message: "Audience pointer evidence must fall inside its aggregate window",
          path: ["evidence", index, "observedAt"],
        });
      }
    }
  });

export const liveContextSnapshotSchema = z
  .object({
    contextId: identifierSchema,
    declaredIntentId: identifierSchema.nullable(),
    audiencePointerId: identifierSchema.nullable(),
    compiledAt: timestampSchema,
    expiresAt: timestampSchema,
    facts: z.array(liveContextFactSchema).min(3).max(32),
  })
  .strict()
  .superRefine((snapshot, context) => {
    if (snapshot.expiresAt <= snapshot.compiledAt) {
      context.addIssue({
        code: "custom",
        message: "Live Context must expire after it is compiled",
        path: ["expiresAt"],
      });
    }
    const factIds = snapshot.facts.map((fact) => fact.factId);
    if (new Set(factIds).size !== factIds.length) {
      context.addIssue({
        code: "custom",
        message: "Live Context fact IDs must be distinct",
        path: ["facts"],
      });
    }
    for (const sourceClass of liveContextSourceClassSchema.options) {
      if (!snapshot.facts.some((fact) => fact.sourceClass === sourceClass)) {
        context.addIssue({
          code: "custom",
          message: `Live Context must keep ${sourceClass} facts separate`,
          path: ["facts"],
        });
      }
    }
  });

export const directorCueActionSchema = z.enum([
  "acknowledge",
  "turn-into-vote",
  "later",
  "dismiss",
]);

export const directorCueStateSchema = z.enum([
  "proposed",
  "acknowledged",
  "postponed",
  "dismissed",
  "converted",
  "stale",
  "expired",
  "cancelled",
]);

export const directorCueSchema = z
  .object({
    cueId: identifierSchema,
    contextId: identifierSchema,
    intentId: identifierSchema,
    audiencePointerId: identifierSchema.nullable(),
    state: directorCueStateSchema,
    reason: z.string().trim().min(1).max(240),
    evidenceReferences: z.array(identifierSchema).min(1).max(32),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
    expiresAt: timestampSchema,
    availableActions: z.array(directorCueActionSchema).max(4),
  })
  .strict()
  .superRefine((cue, context) => {
    if (cue.updatedAt < cue.createdAt || cue.expiresAt <= cue.createdAt) {
      context.addIssue({
        code: "custom",
        message: "Director Cue timestamps must be monotonic and expire after creation",
        path: ["expiresAt"],
      });
    }
    if (new Set(cue.evidenceReferences).size !== cue.evidenceReferences.length) {
      context.addIssue({
        code: "custom",
        message: "Director Cue evidence references must be distinct",
        path: ["evidenceReferences"],
      });
    }
    if (new Set(cue.availableActions).size !== cue.availableActions.length) {
      context.addIssue({
        code: "custom",
        message: "Director Cue actions must be distinct",
        path: ["availableActions"],
      });
    }
    if (
      ["acknowledged", "dismissed", "converted", "stale", "expired", "cancelled"].includes(
        cue.state,
      ) &&
      cue.availableActions.length > 0
    ) {
      context.addIssue({
        code: "custom",
        message: "Terminal or consumed Director Cues cannot expose actions",
        path: ["availableActions"],
      });
    }
    if (cue.state === "expired" && cue.updatedAt < cue.expiresAt) {
      context.addIssue({
        code: "custom",
        message: "Expired Director Cues cannot predate their expiry",
        path: ["updatedAt"],
      });
    }
  });

export const publicViewerContextSchema = z
  .object({
    contextId: identifierSchema,
    sourceContextId: identifierSchema,
    goal: z.string().trim().min(1).max(120).nullable(),
    phase: z.string().trim().min(1).max(80).nullable(),
    recentEvent: z.string().trim().min(1).max(160).nullable(),
    currentDecision: z.string().trim().min(1).max(160).nullable(),
    activeSidequest: z.string().trim().min(1).max(160).nullable(),
    result: z.string().trim().min(1).max(160).nullable(),
    publishedAt: timestampSchema,
    expiresAt: timestampSchema,
  })
  .strict()
  .superRefine((publicContext, context) => {
    if (publicContext.expiresAt <= publicContext.publishedAt) {
      context.addIssue({
        code: "custom",
        message: "Public viewer context must expire after publication",
        path: ["expiresAt"],
      });
    }
    if (
      [
        publicContext.goal,
        publicContext.phase,
        publicContext.recentEvent,
        publicContext.currentDecision,
        publicContext.activeSidequest,
        publicContext.result,
      ].every((value) => value === null)
    ) {
      context.addIssue({
        code: "custom",
        message: "Public viewer context must publish at least one approved field",
        path: ["goal"],
      });
    }
  });

export const liveDirectorPrivacySchema = z
  .object({
    rawChatRetained: z.literal(false),
    usernamesIncluded: z.literal(false),
    viewerIdentifiersIncluded: z.literal(false),
    providerPayloadIncluded: z.literal(false),
  })
  .strict();

export const liveDirectorStateSchema = z
  .object({
    declaredIntent: declaredStreamIntentSchema,
    audiencePointer: audiencePointerSchema.nullable(),
    liveContext: liveContextSnapshotSchema.nullable(),
    cue: directorCueSchema.nullable(),
    publicContext: publicViewerContextSchema.nullable(),
    privacy: liveDirectorPrivacySchema,
    updatedAt: timestampSchema,
  })
  .strict()
  .superRefine((state, context) => {
    const currentIntent = state.declaredIntent.status === "unknown" ? null : state.declaredIntent;
    if (
      state.liveContext !== null &&
      state.liveContext.declaredIntentId !== null &&
      state.liveContext.declaredIntentId !== currentIntent?.intentId
    ) {
      context.addIssue({
        code: "custom",
        message: "Live Context must reference the current known intent",
        path: ["liveContext", "declaredIntentId"],
      });
    }
    const pointerId =
      state.audiencePointer?.status === "known" || state.audiencePointer?.status === "stale"
        ? state.audiencePointer.pointerId
        : null;
    if (
      state.liveContext !== null &&
      state.liveContext.audiencePointerId !== null &&
      state.liveContext.audiencePointerId !== pointerId
    ) {
      context.addIssue({
        code: "custom",
        message: "Live Context must reference the current audience pointer",
        path: ["liveContext", "audiencePointerId"],
      });
    }
    if (state.cue !== null) {
      if (state.liveContext === null || state.cue.contextId !== state.liveContext.contextId) {
        context.addIssue({
          code: "custom",
          message: "Director Cue must reference the current Live Context",
          path: ["cue", "contextId"],
        });
      }
      if (currentIntent === null || state.cue.intentId !== currentIntent.intentId) {
        context.addIssue({
          code: "custom",
          message: "Director Cue must reference the current known intent",
          path: ["cue", "intentId"],
        });
      }
      if (state.cue.audiencePointerId !== null && state.cue.audiencePointerId !== pointerId) {
        context.addIssue({
          code: "custom",
          message: "Director Cue must reference the current audience pointer",
          path: ["cue", "audiencePointerId"],
        });
      }
    }
    if (
      state.publicContext !== null &&
      (state.liveContext === null || state.publicContext.sourceContextId !== state.liveContext.contextId)
    ) {
      context.addIssue({
        code: "custom",
        message: "Public viewer context must trace to the current Live Context",
        path: ["publicContext", "sourceContextId"],
      });
    }
  });

export const intelligenceSnapshotSchema = z
  .object({
    envelope: contractEnvelopeSchema,
    gameplay: gameplaySnapshotSchema,
    audience: audienceSnapshotSchema,
  })
  .strict()
  .superRefine((snapshot, context) => {
    for (const [path, nestedEnvelope] of [
      [["gameplay", "envelope"], snapshot.gameplay.envelope],
      [["audience", "envelope"], snapshot.audience.envelope],
    ] as const) {
      if (nestedEnvelope.sessionId !== snapshot.envelope.sessionId) {
        context.addIssue({
          code: "custom",
          message: "Nested snapshots must belong to the intelligence session",
          path: [...path, "sessionId"],
        });
      }
      if (nestedEnvelope.questCycleId !== snapshot.envelope.questCycleId) {
        context.addIssue({
          code: "custom",
          message: "Nested snapshots must belong to the intelligence quest cycle",
          path: [...path, "questCycleId"],
        });
      }
      if (nestedEnvelope.revision !== snapshot.envelope.revision) {
        context.addIssue({
          code: "custom",
          message: "Nested snapshot revisions must match the intelligence revision",
          path: [...path, "revision"],
        });
      }
      if (nestedEnvelope.evidenceClass !== snapshot.envelope.evidenceClass) {
        context.addIssue({
          code: "custom",
          message: "Nested snapshot evidence must match the intelligence evidence class",
          path: [...path, "evidenceClass"],
        });
      }
    }
  });

export type SignalProvenance = z.infer<typeof signalProvenanceSchema>;
export type SignalObservation = z.infer<typeof signalObservationSchema>;
export type NamedSignal = z.infer<typeof namedSignalSchema>;
export type GameplayCapabilities = z.infer<typeof gameplayCapabilitiesSchema>;
export type GameplayFrameObservation = z.infer<typeof gameplayFrameObservationSchema>;
export type GameplaySnapshot = z.infer<typeof gameplaySnapshotSchema>;
export type GameplayCaptureMetrics = z.infer<typeof gameplayCaptureMetricsSchema>;
export type AudienceEvent = z.infer<typeof audienceEventSchema>;
export type AudienceSnapshot = z.infer<typeof audienceSnapshotSchema>;
export type LiveContextSourceClass = z.infer<typeof liveContextSourceClassSchema>;
export type LiveContextFactStatus = z.infer<typeof liveContextFactStatusSchema>;
export type LiveContextFact = z.infer<typeof liveContextFactSchema>;
export type DeclaredStreamIntent = z.infer<typeof declaredStreamIntentSchema>;
export type AudiencePointer = z.infer<typeof audiencePointerSchema>;
export type AudiencePointerAggregateEvidence = z.infer<
  typeof audiencePointerAggregateEvidenceSchema
>;
export type AudiencePointerAggregate = z.infer<typeof audiencePointerAggregateSchema>;
export type LiveContextSnapshot = z.infer<typeof liveContextSnapshotSchema>;
export type DirectorCueAction = z.infer<typeof directorCueActionSchema>;
export type DirectorCueState = z.infer<typeof directorCueStateSchema>;
export type DirectorCue = z.infer<typeof directorCueSchema>;
export type PublicViewerContext = z.infer<typeof publicViewerContextSchema>;
export type LiveDirectorPrivacy = z.infer<typeof liveDirectorPrivacySchema>;
export type LiveDirectorState = z.infer<typeof liveDirectorStateSchema>;
export type IntelligenceSnapshot = z.infer<typeof intelligenceSnapshotSchema>;
