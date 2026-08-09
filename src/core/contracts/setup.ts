import { z } from "zod";

import {
  actorSchema,
  contractVersionSchema,
  domainErrorSchema,
  evidenceClassSchema,
  identifierSchema,
  revisionSchema,
  serviceHealthSchema,
  timestampSchema,
} from "./common";

export const streamerSetupServiceIdSchema = z.enum([
  "twitch",
  "obs-capture",
  "realtime",
  "intelligence",
  "session",
]);

export const streamerSetupActionSchema = z.enum([
  "connect-twitch",
  "install-extension",
  "select-capture-source",
  "request-capture-permission",
  "retry-service",
  "start-session",
  "end-session",
  "open-diagnostics",
]);

type StreamerSetupServiceIdValue = z.infer<typeof streamerSetupServiceIdSchema>;
type StreamerSetupActionValue = z.infer<typeof streamerSetupActionSchema>;

const setupActionsByService = {
  twitch: ["connect-twitch", "install-extension", "retry-service", "open-diagnostics"],
  "obs-capture": [
    "select-capture-source",
    "request-capture-permission",
    "retry-service",
    "open-diagnostics",
  ],
  realtime: ["retry-service", "open-diagnostics"],
  intelligence: ["retry-service", "open-diagnostics"],
  session: ["start-session", "end-session", "open-diagnostics"],
} as const satisfies Record<
  StreamerSetupServiceIdValue,
  readonly StreamerSetupActionValue[]
>;

function actionAllowedForService(
  service: StreamerSetupServiceIdValue,
  action: StreamerSetupActionValue,
): boolean {
  return (setupActionsByService[service] as readonly StreamerSetupActionValue[]).includes(action);
}

export const streamerSetupServiceSchema = z
  .object({
    service: streamerSetupServiceIdSchema,
    configured: z.boolean(),
    health: serviceHealthSchema,
    allowedActions: z.array(streamerSetupActionSchema).max(6),
  })
  .strict()
  .superRefine((service, context) => {
    if (new Set(service.allowedActions).size !== service.allowedActions.length) {
      context.addIssue({
        code: "custom",
        message: "Setup service actions must be distinct",
        path: ["allowedActions"],
      });
    }
    for (const [index, action] of service.allowedActions.entries()) {
      if (!actionAllowedForService(service.service, action)) {
        context.addIssue({
          code: "custom",
          message: `${action} is not valid for ${service.service}`,
          path: ["allowedActions", index],
        });
      }
    }
  });

export const streamerReadinessViewSchema = z
  .object({
    evidenceClass: evidenceClassSchema,
    liveInputsUsed: z.boolean(),
    ready: z.boolean(),
    status: z.enum(["ready", "blocked", "diagnostic"]),
    services: z.array(streamerSetupServiceSchema).length(5),
    blockerCodes: z.array(identifierSchema).max(16),
    recommendedAction: streamerSetupActionSchema.nullable(),
    label: z.string().trim().min(1).max(120),
  })
  .strict()
  .superRefine((readiness, context) => {
    const services = new Set(readiness.services.map((service) => service.service));
    if (services.size !== readiness.services.length) {
      context.addIssue({
        code: "custom",
        message: "Readiness services must be unique",
        path: ["services"],
      });
    }
    for (const required of streamerSetupServiceIdSchema.options) {
      if (!services.has(required)) {
        context.addIssue({
          code: "custom",
          message: `Readiness is missing ${required}`,
          path: ["services"],
        });
      }
    }
    if (readiness.ready && readiness.status !== "ready") {
      context.addIssue({
        code: "custom",
        message: "Ready setup must use ready status",
        path: ["status"],
      });
    }
    if (readiness.ready && readiness.blockerCodes.length > 0) {
      context.addIssue({
        code: "custom",
        message: "A ready setup cannot have blockers",
        path: ["blockerCodes"],
      });
    }
    if (readiness.evidenceClass === "live" && !readiness.liveInputsUsed) {
      context.addIssue({
        code: "custom",
        message: "Live readiness must be backed by live inputs",
        path: ["liveInputsUsed"],
      });
    }
  });

const streamerServiceCommandFields = {
  contractVersion: contractVersionSchema,
  sessionId: identifierSchema,
  commandId: identifierSchema,
  correlationId: identifierSchema,
  expectedRevision: revisionSchema,
  issuedAt: timestampSchema,
  actor: actorSchema,
};

export const streamerSetupCommandSchema = z
  .object({
    ...streamerServiceCommandFields,
    type: z.literal("streamer.setup"),
    service: streamerSetupServiceIdSchema,
    action: streamerSetupActionSchema,
  })
  .strict()
  .superRefine((command, context) => {
    if (command.actor.kind !== "broadcaster") {
      context.addIssue({
        code: "custom",
        message: "Only the broadcaster may change integration setup",
        path: ["actor", "kind"],
      });
    }
    if (!actionAllowedForService(command.service, command.action)) {
      context.addIssue({
        code: "custom",
        message: `${command.action} is not valid for ${command.service}`,
        path: ["action"],
      });
    }
  });

export const streamerSessionCommandSchema = z
  .object({
    ...streamerServiceCommandFields,
    type: z.literal("streamer.session"),
    action: z.enum(["start", "end"]),
  })
  .strict()
  .superRefine((command, context) => {
    if (command.actor.kind !== "broadcaster") {
      context.addIssue({
        code: "custom",
        message: "Only the broadcaster may start or end a stream session",
        path: ["actor", "kind"],
      });
    }
  });

export const streamerServiceCommandSchema = z.discriminatedUnion("type", [
  streamerSetupCommandSchema,
  streamerSessionCommandSchema,
]);

export const streamerServiceCommandResultSchema = z.discriminatedUnion("ok", [
  z
    .object({
      ok: z.literal(true),
      commandId: identifierSchema,
      currentRevision: revisionSchema,
      status: z.enum(["accepted", "no-op", "diagnostic-only"]),
      readiness: streamerReadinessViewSchema,
    })
    .strict(),
  z
    .object({
      ok: z.literal(false),
      commandId: identifierSchema.nullable(),
      currentRevision: revisionSchema.nullable(),
      error: domainErrorSchema,
    })
    .strict(),
]);

export type StreamerSetupServiceId = z.infer<typeof streamerSetupServiceIdSchema>;
export type StreamerSetupAction = z.infer<typeof streamerSetupActionSchema>;
export type StreamerSetupService = z.infer<typeof streamerSetupServiceSchema>;
export type StreamerReadinessView = z.infer<typeof streamerReadinessViewSchema>;
export type StreamerSetupCommand = z.infer<typeof streamerSetupCommandSchema>;
export type StreamerSessionCommand = z.infer<typeof streamerSessionCommandSchema>;
export type StreamerServiceCommand = z.infer<typeof streamerServiceCommandSchema>;
export type StreamerServiceCommandResult = z.infer<typeof streamerServiceCommandResultSchema>;
