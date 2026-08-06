import { z } from "zod";

import {
  evidenceClassSchema,
  identifierSchema,
  serviceHealthSchema,
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
    const requiredServices = streamerSetupServiceIdSchema.options;
    for (const required of requiredServices) {
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

export type StreamerSetupServiceId = z.infer<typeof streamerSetupServiceIdSchema>;
export type StreamerSetupAction = z.infer<typeof streamerSetupActionSchema>;
export type StreamerSetupService = z.infer<typeof streamerSetupServiceSchema>;
export type StreamerReadinessView = z.infer<typeof streamerReadinessViewSchema>;
