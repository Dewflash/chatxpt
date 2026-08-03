import "server-only";

import {
  CONTRACT_VERSION,
  domainErrorSchema,
  overlayViewModelSchema,
  streamerReadinessViewSchema,
  streamerViewModelSchema,
  uiGatewayCommandResultSchema,
  uiGatewayDispatchRequestSchema,
  uiGatewayHealthResultSchema,
  uiGatewayReadRequestSchema,
  uiGatewayReadResultSchema,
  viewerViewModelSchema,
  type DomainError,
  type UiGatewayAuthState,
  type UiGatewayCommand,
  type UiGatewayCommandResult,
  type UiGatewayDispatchRequest,
  type UiGatewayHealthResult,
  type UiGatewayReadRequest,
  type UiGatewayReadResult,
  type UiGatewayRole,
  type UiGatewaySurface,
} from "../core";
import {
  contractFixtureOverlayView,
  contractFixtureStreamerView,
  contractFixtureViewerView,
} from "../core/testing";
import type { UiGatewayServer } from "./ui-gateway-server";

const DIAGNOSTIC_EXPIRY = 4_102_444_800_000;

interface DiagnosticPrincipal {
  readonly auth: UiGatewayAuthState;
  readonly actorId: string | null;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function failure(
  code: DomainError["code"],
  message: string,
  retryable = false,
  details?: Record<string, unknown>,
): DomainError {
  return domainErrorSchema.parse({ code, message, retryable, details });
}

function roleForSurface(surface: UiGatewaySurface): UiGatewayRole {
  if (["studio", "config", "live-config"].includes(surface)) return "streamer";
  if (["viewer", "hosted-board"].includes(surface)) return "viewer";
  return "overlay";
}

function principalForToken(token: string | null): DiagnosticPrincipal {
  switch (token) {
    case "diagnostic-broadcaster":
      return {
        auth: { status: "authenticated", actorKind: "broadcaster", expiresAt: DIAGNOSTIC_EXPIRY },
        actorId: "fixture-broadcaster",
      };
    case "diagnostic-moderator":
      return {
        auth: { status: "authenticated", actorKind: "moderator", expiresAt: DIAGNOSTIC_EXPIRY },
        actorId: "fixture-moderator",
      };
    case "diagnostic-viewer":
      return {
        auth: { status: "authenticated", actorKind: "viewer", expiresAt: DIAGNOSTIC_EXPIRY },
        actorId: "fixture-viewer",
      };
    case "diagnostic-anonymous":
      return {
        auth: { status: "anonymous", actorKind: "anonymous", expiresAt: DIAGNOSTIC_EXPIRY },
        actorId: null,
      };
    case "diagnostic-overlay":
      return {
        auth: { status: "authenticated", actorKind: "overlay", expiresAt: DIAGNOSTIC_EXPIRY },
        actorId: null,
      };
    case "diagnostic-expired":
      return {
        auth: { status: "expired", actorKind: null, expiresAt: null },
        actorId: null,
      };
    default:
      return {
        auth: { status: "unauthenticated", actorKind: null, expiresAt: null },
        actorId: null,
      };
  }
}

function authorizationError(
  surface: UiGatewaySurface,
  principal: DiagnosticPrincipal,
): DomainError | null {
  if (principal.auth.status === "expired") {
    return failure("expired", "Diagnostic access token has expired", false, {
      reason: "token-expired",
    });
  }
  if (principal.auth.status === "unauthenticated") {
    return failure("unauthenticated", "A diagnostic access grant is required");
  }
  const role = roleForSurface(surface);
  const allowed =
    (role === "streamer" && principal.auth.actorKind === "broadcaster") ||
    (surface === "live-config" && principal.auth.actorKind === "moderator") ||
    (role === "viewer" && ["viewer", "anonymous"].includes(principal.auth.actorKind ?? "")) ||
    (role === "overlay" && principal.auth.actorKind === "overlay");
  return allowed ? null : failure("forbidden", "Diagnostic grant cannot access this surface");
}

function scenarioHealth(
  scenario: UiGatewayReadRequest["scenario"],
  service: "twitch" | "obs-capture" | "realtime" | "intelligence",
) {
  const checkedAt = contractFixtureStreamerView.envelope.occurredAt;
  if (scenario === "permission-denied" && service === "obs-capture") {
    return {
      service,
      status: "permission-denied" as const,
      checkedAt,
      message: "Diagnostic capture permission is denied",
      retryable: true,
    };
  }
  if (scenario === "misconfigured" && service === "twitch") {
    return {
      service,
      status: "misconfigured" as const,
      checkedAt,
      message: "Diagnostic Twitch setup is incomplete",
      retryable: false,
    };
  }
  if (scenario === "disconnected" && service === "realtime") {
    return {
      service,
      status: "unavailable" as const,
      checkedAt,
      message: "Diagnostic realtime connection is unavailable",
      retryable: true,
    };
  }
  return { service, status: "ready" as const, checkedAt, retryable: false };
}

function readiness(scenario: UiGatewayReadRequest["scenario"]) {
  const twitch = scenarioHealth(scenario, "twitch");
  const capture = scenarioHealth(scenario, "obs-capture");
  const realtime = scenarioHealth(scenario, "realtime");
  const intelligence = scenarioHealth(scenario, "intelligence");
  const blockerCodes = [];
  if (twitch.status !== "ready") blockerCodes.push("twitch-not-ready");
  if (capture.status !== "ready") blockerCodes.push("capture-not-ready");
  if (realtime.status !== "ready") blockerCodes.push("realtime-not-ready");
  if (intelligence.status !== "ready") blockerCodes.push("intelligence-not-ready");
  return streamerReadinessViewSchema.parse({
    evidenceClass: "fixture",
    ready: blockerCodes.length === 0,
    services: [
      {
        service: "twitch",
        configured: twitch.status === "ready",
        health: twitch,
        allowedActions:
          twitch.status === "ready" ? [] : ["connect-twitch", "install-extension", "retry-service"],
      },
      {
        service: "obs-capture",
        configured: capture.status === "ready",
        health: capture,
        allowedActions:
          capture.status === "ready"
            ? []
            : ["select-capture-source", "request-capture-permission", "retry-service"],
      },
      {
        service: "realtime",
        configured: realtime.status === "ready",
        health: realtime,
        allowedActions: realtime.status === "ready" ? [] : ["retry-service"],
      },
      {
        service: "intelligence",
        configured: intelligence.status === "ready",
        health: intelligence,
        allowedActions: intelligence.status === "ready" ? [] : ["retry-service"],
      },
    ],
    blockerCodes,
  });
}

function snapshotFor(
  input: UiGatewayReadRequest,
  principal: DiagnosticPrincipal,
): UiGatewayReadResult {
  const role = roleForSurface(input.surface);
  const common = {
    contractVersion: CONTRACT_VERSION,
    surface: input.surface,
    auth: principal.auth,
    currentRevision: contractFixtureStreamerView.envelope.revision,
  };
  if (role === "streamer") {
    const view = clone(contractFixtureStreamerView);
    view.services = [
      scenarioHealth(input.scenario, "twitch"),
      scenarioHealth(input.scenario, "obs-capture"),
      scenarioHealth(input.scenario, "realtime"),
      scenarioHealth(input.scenario, "intelligence"),
    ];
    return uiGatewayReadResultSchema.parse({
      ok: true,
      snapshot: {
        ...common,
        role,
        view: streamerViewModelSchema.parse(view),
        readiness: readiness(input.scenario),
      },
    });
  }
  if (role === "viewer") {
    const view = clone(contractFixtureViewerView);
    if (input.scenario === "disconnected") {
      view.connection = scenarioHealth(input.scenario, "realtime");
    }
    return uiGatewayReadResultSchema.parse({
      ok: true,
      snapshot: {
        ...common,
        role,
        view: viewerViewModelSchema.parse(view),
        readiness: null,
      },
    });
  }
  const view = clone(contractFixtureOverlayView);
  if (input.scenario === "disconnected") {
    view.connection = scenarioHealth(input.scenario, "realtime");
  }
  return uiGatewayReadResultSchema.parse({
    ok: true,
    snapshot: {
      ...common,
      role,
      view: overlayViewModelSchema.parse(view),
      readiness: null,
    },
  });
}

function actorMatches(command: UiGatewayCommand, principal: DiagnosticPrincipal): boolean {
  return (
    command.actor.kind === principal.auth.actorKind &&
    command.actor.actorId === principal.actorId
  );
}

function commandAllowedOnSurface(command: UiGatewayCommand, surface: UiGatewaySurface): boolean {
  const role = roleForSurface(surface);
  if (role === "streamer") {
    return command.type.startsWith("streamer.");
  }
  if (role === "viewer") {
    return command.type === "viewer.vote" || command.type === "viewer.react";
  }
  return false;
}

export class DiagnosticUiGateway implements UiGatewayServer {
  health(): UiGatewayHealthResult {
    return uiGatewayHealthResultSchema.parse({
      ok: true,
      contractVersion: CONTRACT_VERSION,
      mode: "diagnostic",
      harnessEnabled: true,
      checkedAt: contractFixtureStreamerView.envelope.occurredAt,
      services: [scenarioHealth("ready", "realtime")],
    });
  }

  async read(input: UiGatewayReadRequest, accessToken: string | null): Promise<UiGatewayReadResult> {
    const parsed = uiGatewayReadRequestSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: failure("validation", "Diagnostic snapshot request is invalid"),
        currentRevision: null,
      };
    }
    if (parsed.data.sessionId !== contractFixtureStreamerView.session.sessionId) {
      return {
        ok: false,
        error: failure("validation", "Diagnostic session does not exist"),
        currentRevision: null,
      };
    }
    const principal = principalForToken(accessToken);
    const authError = authorizationError(parsed.data.surface, principal);
    if (authError !== null) {
      return { ok: false, error: authError, currentRevision: null };
    }
    if (parsed.data.scenario === "dependency-failure") {
      return {
        ok: false,
        error: failure("dependency-unavailable", "Diagnostic snapshot dependency failed", true),
        currentRevision: contractFixtureStreamerView.envelope.revision,
      };
    }
    return snapshotFor(parsed.data, principal);
  }

  async dispatch(
    input: UiGatewayDispatchRequest,
    accessToken: string | null,
  ): Promise<UiGatewayCommandResult> {
    const parsed = uiGatewayDispatchRequestSchema.safeParse(input);
    if (!parsed.success) {
      return uiGatewayCommandResultSchema.parse({
        ok: false,
        commandId: null,
        currentRevision: null,
        error: failure("validation", "Diagnostic command request is invalid"),
      });
    }
    const principal = principalForToken(accessToken);
    const authError = authorizationError(parsed.data.surface, principal);
    if (authError !== null) {
      return uiGatewayCommandResultSchema.parse({
        ok: false,
        commandId: parsed.data.command.commandId,
        currentRevision: null,
        error: authError,
      });
    }
    if (parsed.data.command.sessionId !== contractFixtureStreamerView.session.sessionId) {
      return uiGatewayCommandResultSchema.parse({
        ok: false,
        commandId: parsed.data.command.commandId,
        currentRevision: null,
        error: failure("validation", "Diagnostic command session does not exist"),
      });
    }
    if (
      !commandAllowedOnSurface(parsed.data.command, parsed.data.surface) ||
      !actorMatches(parsed.data.command, principal)
    ) {
      return uiGatewayCommandResultSchema.parse({
        ok: false,
        commandId: parsed.data.command.commandId,
        currentRevision: null,
        error: failure("forbidden", "Diagnostic command identity or surface is not authorised"),
      });
    }
    const currentRevision = contractFixtureStreamerView.envelope.revision;
    if (parsed.data.scenario === "dependency-failure") {
      return uiGatewayCommandResultSchema.parse({
        ok: false,
        commandId: parsed.data.command.commandId,
        currentRevision,
        error: failure("dependency-unavailable", "Diagnostic command persistence failed", true),
      });
    }
    if (
      parsed.data.scenario === "stale" ||
      parsed.data.command.expectedRevision !== currentRevision
    ) {
      return uiGatewayCommandResultSchema.parse({
        ok: false,
        commandId: parsed.data.command.commandId,
        currentRevision,
        error: failure("stale-revision", "Diagnostic command expected a stale revision"),
      });
    }
    return uiGatewayCommandResultSchema.parse({
      ok: true,
      outcome: parsed.data.command.commandId.endsWith("-duplicate") ? "duplicate" : "committed",
      commandId: parsed.data.command.commandId,
      currentRevision:
        parsed.data.command.commandId.endsWith("-duplicate")
          ? currentRevision
          : currentRevision + 1,
      delivery: parsed.data.command.commandId.endsWith("-duplicate")
        ? "not-republished"
        : "published",
    });
  }
}

export const diagnosticUiGateway = new DiagnosticUiGateway();
