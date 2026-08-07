import type { ServiceHealth } from "../core";

export type IntegrationStatus = "configured" | "not-configured" | "not-ready" | "degraded";

export interface StudioIntegrationHealthItem {
  readonly id: string;
  readonly name: string;
  readonly owner: "Role 1" | "Role 2" | "Role 3" | "Role 4" | "Role 5";
  readonly status: IntegrationStatus;
  readonly service: ServiceHealth;
  readonly purpose: string;
  readonly technicalDetail: string;
  readonly nextAction: string;
  readonly streamerFacing: boolean;
}

export interface StudioIntegrationHealthView {
  readonly generatedAt: number;
  readonly evidenceClass: "fixture" | "diagnostic" | "live";
  readonly items: readonly StudioIntegrationHealthItem[];
}

export function statusLabel(status: IntegrationStatus): string {
  switch (status) {
    case "configured":
      return "Configured";
    case "not-configured":
      return "Not configured";
    case "not-ready":
      return "Not ready";
    case "degraded":
      return "Degraded";
  }
}

export function statusFromServiceHealth(health: ServiceHealth): IntegrationStatus {
  switch (health.status) {
    case "ready":
      return "configured";
    case "degraded":
      return "degraded";
    case "misconfigured":
      return "not-configured";
    case "permission-denied":
    case "unavailable":
      return "not-ready";
  }
}

export function countByStatus(items: readonly StudioIntegrationHealthItem[]): Record<IntegrationStatus, number> {
  return items.reduce<Record<IntegrationStatus, number>>(
    (counts, item) => ({
      ...counts,
      [item.status]: counts[item.status] + 1,
    }),
    {
      configured: 0,
      "not-configured": 0,
      "not-ready": 0,
      degraded: 0,
    },
  );
}

export function itemFromService(input: Omit<StudioIntegrationHealthItem, "status">): StudioIntegrationHealthItem {
  return {
    ...input,
    status: statusFromServiceHealth(input.service),
  };
}
