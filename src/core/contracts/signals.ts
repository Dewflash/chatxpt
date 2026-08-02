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

export const gameplaySnapshotSchema = z
  .object({
    envelope: contractEnvelopeSchema,
    capabilities: gameplayCapabilitiesSchema,
    signals: z.array(namedSignalSchema).max(128),
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
export type AudienceEvent = z.infer<typeof audienceEventSchema>;
export type AudienceSnapshot = z.infer<typeof audienceSnapshotSchema>;
export type IntelligenceSnapshot = z.infer<typeof intelligenceSnapshotSchema>;
