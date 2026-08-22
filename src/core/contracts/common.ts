import { z } from "zod";

export const CONTRACT_VERSION = "1.0.0" as const;

export const contractVersionSchema = z.literal(CONTRACT_VERSION);

export const identifierSchema = z.string().trim().min(1).max(128);
export const timestampSchema = z.number().int().nonnegative();
export const revisionSchema = z.number().int().nonnegative();
export const confidenceSchema = z.number().min(0).max(1);

export const messageSourceSchema = z.enum([
  "obs-virtual-camera",
  "browser-display-capture",
  "twitch",
  "studio",
  "viewer-extension",
  "viewer-board",
  "overlay",
  "algorithm",
  "ai-provider",
  "quest-engine",
  "orchestrator",
  "system",
  "test-fixture",
]);

export const evidenceClassSchema = z.enum(["live", "diagnostic", "fixture"]);

export const contractEnvelopeSchema = z
  .object({
    contractVersion: contractVersionSchema,
    sessionId: identifierSchema,
    questCycleId: identifierSchema.nullable(),
    messageId: identifierSchema,
    correlationId: identifierSchema,
    revision: revisionSchema,
    occurredAt: timestampSchema,
    receivedAt: timestampSchema,
    source: messageSourceSchema,
    evidenceClass: evidenceClassSchema,
  })
  .strict()
  .superRefine((envelope, context) => {
    if (envelope.receivedAt < envelope.occurredAt) {
      context.addIssue({
        code: "custom",
        message: "receivedAt cannot precede occurredAt",
        path: ["receivedAt"],
      });
    }

    if (envelope.source === "test-fixture" && envelope.evidenceClass === "live") {
      context.addIssue({
        code: "custom",
        message: "Test fixtures cannot be classified as live evidence",
        path: ["evidenceClass"],
      });
    }
  });

export const actorSchema = z
  .object({
    kind: z.enum(["broadcaster", "moderator", "viewer", "anonymous", "system"]),
    actorId: identifierSchema.nullable(),
  })
  .strict()
  .superRefine((actor, context) => {
    if (actor.kind === "anonymous" && actor.actorId !== null) {
      context.addIssue({
        code: "custom",
        message: "Anonymous actors cannot carry an actorId",
        path: ["actorId"],
      });
    }

    if (actor.kind !== "anonymous" && actor.actorId === null) {
      context.addIssue({
        code: "custom",
        message: "Authenticated and system actors require an actorId",
        path: ["actorId"],
      });
    }
  });

export const domainErrorCodeSchema = z.enum([
  "validation",
  "unauthenticated",
  "forbidden",
  "stale-revision",
  "duplicate",
  "unavailable-capability",
  "expired",
  "rate-limited",
  "dependency-unavailable",
  "internal",
]);

export const domainErrorSchema = z
  .object({
    code: domainErrorCodeSchema,
    message: z.string().trim().min(1).max(240),
    retryable: z.boolean(),
    details: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export const serviceHealthSchema = z
  .object({
    service: identifierSchema,
    status: z.enum(["ready", "degraded", "unavailable", "permission-denied", "misconfigured"]),
    checkedAt: timestampSchema,
    message: z.string().trim().min(1).max(240).optional(),
    retryable: z.boolean(),
  })
  .strict();

export type ContractEnvelope = z.infer<typeof contractEnvelopeSchema>;
export type Actor = z.infer<typeof actorSchema>;
export type DomainError = z.infer<typeof domainErrorSchema>;
export type ServiceHealth = z.infer<typeof serviceHealthSchema>;
