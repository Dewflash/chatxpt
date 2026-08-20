import type { StreamerReadinessView, StreamerSetupAction, StreamerSetupServiceId } from "../core";
import type { StatusTone } from "../design-system";

export type ProductAvailabilityState = "available" | "waiting" | "unavailable";

export interface ProductAvailability {
  readonly state: ProductAvailabilityState;
  readonly badge: string;
  readonly tone: StatusTone;
  readonly detail: string;
  readonly nextStep: string;
}

const STATUS_COPY: Readonly<Record<string, { readonly badge: string; readonly tone: StatusTone }>> = {
  ready: { badge: "Ready", tone: "success" },
  degraded: { badge: "Needs attention", tone: "warning" },
  misconfigured: { badge: "Needs setup", tone: "warning" },
  unavailable: { badge: "Unavailable", tone: "danger" },
  "permission-denied": { badge: "Permission needed", tone: "danger" },
};

function customerSafeDetail(detail: string | null | undefined, fallback: string): string {
  if (detail === null || detail === undefined || /\bfixture\b/iu.test(detail)) {
    return fallback;
  }
  return detail;
}

const ACTION_LABELS: Readonly<Record<StreamerSetupAction, string>> = {
  "connect-twitch": "Connect Twitch",
  "install-extension": "Install Extension",
  "select-capture-source": "Choose source",
  "request-capture-permission": "Allow camera",
  "retry-service": "Retry connection",
  "start-session": "Start ChatXPT",
  "end-session": "End ChatXPT",
  "open-diagnostics": "Review setup",
};

function nextSetupAction(actions: readonly StreamerSetupAction[]): string {
  const preferred = actions.find((action) => action !== "open-diagnostics") ?? actions[0] ?? null;
  return preferred === null ? "Waiting for setup" : ACTION_LABELS[preferred];
}

export function unavailableAvailability(detail: string, nextStep = "Waiting for setup"): ProductAvailability {
  return {
    state: "unavailable",
    badge: "Unavailable",
    tone: "warning",
    detail,
    nextStep,
  };
}

export function readinessAvailability(
  readiness: StreamerReadinessView | null | undefined,
  serviceId: StreamerSetupServiceId,
  fallbackDetail: string,
  fallbackNextStep = "Connect Studio",
): ProductAvailability {
  const service = readiness?.services.find((entry) => entry.service === serviceId) ?? null;
  if (service === null) {
    return {
      state: "waiting",
      badge: "Unknown",
      tone: "neutral",
      detail: fallbackDetail,
      nextStep: fallbackNextStep,
    };
  }

  const copy = STATUS_COPY[service.health.status] ?? { badge: "Needs attention", tone: "warning" as const };
  return {
    state: service.health.status === "ready" ? "available" : "unavailable",
    badge: copy.badge,
    tone: copy.tone,
    detail: customerSafeDetail(service.health.message, fallbackDetail),
    nextStep: nextSetupAction(service.allowedActions),
  };
}
