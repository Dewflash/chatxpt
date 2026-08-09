import "server-only";

import { z } from "zod";

import { resolveServerPersistenceEnvironment } from "./environment";

export const deploymentHealthReportSchema = z
  .object({
    checkedAt: z.number().int().nonnegative(),
    deployment: z.enum(["local", "preview", "production", "invalid"]),
    persistence: z.object({
      mode: z.enum(["memory", "supabase", "misconfigured"]),
      status: z.enum(["ready", "degraded", "misconfigured", "permission-denied", "unavailable"]),
      message: z.string().optional(),
      missing: z.array(z.string()).optional(),
    }),
    publicRealtime: z.object({
      configured: z.boolean(),
      url: z.string().url().optional(),
    }),
  })
  .strict();

export type DeploymentHealthReport = z.infer<typeof deploymentHealthReportSchema>;

export function resolveDeploymentHealthReport(
  source: Record<string, string | undefined>,
  checkedAt = Date.now(),
): DeploymentHealthReport {
  const environment = resolveServerPersistenceEnvironment(source, checkedAt);

  return deploymentHealthReportSchema.parse({
    checkedAt,
    deployment: environment.deployment,
    persistence: {
      mode: environment.mode,
      status: environment.health.status,
      message: environment.health.message,
      missing: environment.mode === "misconfigured" ? [...environment.missing] : undefined,
    },
    publicRealtime: environment.mode === "supabase"
      ? {
          configured: true,
          url: environment.url,
        }
      : {
          configured: false,
        },
  });
}
