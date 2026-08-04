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
import {
  streamerQuestCommandSchema,
  viewerReactionCommandSchema,
  viewerVoteCommandSchema,
} from "./commands";
import { streamerProfileSchema } from "./profile";
import {
  overlayViewModelSchema,
  streamerViewModelSchema,
  viewerViewModelSchema,
} from "./views";

export const uiGatewaySurfaceSchema = z.enum([
  "studio",
  "config",
  "live-config",
  "viewer",
  "hosted-board",
  "overlay",
]);

export const uiGatewayRoleSchema = z.enum(["streamer", "viewer", "overlay"]);

export const uiGatewayAuthStateSchema = z
  .object({
    status: z.enum(["authenticated", "anonymous", "unauthenticated", "expired"]),
    actorKind: z
      .enum(["broadcaster", "moderator", "viewer", "anonymous", "overlay"])
      .nullable(),
    expiresAt: timestampSchema.nullable(),
  })
  .strict()
  .superRefine((auth, context) => {
    if (auth.status === "authenticated" && auth.actorKind === null) {
      context.addIssue({
        code: "custom",
        message: "Authenticated access requires an actor kind",
        path: ["actorKind"],
      });
    }
    if (
      (auth.status === "unauthenticated" || auth.status === "expired") &&
      auth.actorKind !== null
    ) {
      context.addIssue({
        code: "custom",
        message: "Inactive authentication cannot expose an actor kind",
        path: ["actorKind"],
      });
    }
    if (auth.status === "anonymous" && auth.actorKind !== "anonymous") {
      context.addIssue({
        code: "custom",
        message: "Anonymous authentication requires the anonymous actor kind",
        path: ["actorKind"],
      });
    }
  });

export const setupServiceIdSchema = z.enum([
  "twitch",
  "obs-capture",
  "realtime",
  "intelligence",
]);

export const streamerSetupActionSchema = z.enum([
  "connect-twitch",
  "install-extension",
  "select-capture-source",
  "request-capture-permission",
  "retry-service",
]);

export const streamerSetupServiceSchema = z
  .object({
    service: setupServiceIdSchema,
    configured: z.boolean(),
    health: serviceHealthSchema,
    allowedActions: z.array(streamerSetupActionSchema),
  })
  .strict();

export const streamerReadinessViewSchema = z
  .object({
    evidenceClass: evidenceClassSchema,
    ready: z.boolean(),
    services: z.array(streamerSetupServiceSchema).length(4),
    blockerCodes: z.array(identifierSchema).max(16),
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
    if (readiness.ready && readiness.blockerCodes.length > 0) {
      context.addIssue({
        code: "custom",
        message: "A ready setup cannot have blockers",
        path: ["blockerCodes"],
      });
    }
  });

const gatewayCommandFields = {
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
    ...gatewayCommandFields,
    type: z.literal("streamer.setup"),
    service: setupServiceIdSchema,
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
  });

export const streamerSessionCommandSchema = z
  .object({
    ...gatewayCommandFields,
    type: z.literal("streamer.session"),
    action: z.enum(["start", "end"]),
  })
  .strict()
  .superRefine((command, context) => {
    if (command.actor.kind !== "broadcaster") {
      context.addIssue({
        code: "custom",
        message: "Only the broadcaster may start or end a session",
        path: ["actor", "kind"],
      });
    }
  });

export const streamerProfileCommandSchema = z
  .object({
    ...gatewayCommandFields,
    type: z.literal("streamer.profile"),
    profile: streamerProfileSchema,
  })
  .strict()
  .superRefine((command, context) => {
    if (command.actor.kind !== "broadcaster") {
      context.addIssue({
        code: "custom",
        message: "Only the broadcaster may update the streamer profile",
        path: ["actor", "kind"],
      });
    }
    if (command.actor.actorId !== command.profile.streamerId) {
      context.addIssue({
        code: "custom",
        message: "Profile updates must belong to the authenticated broadcaster",
        path: ["profile", "streamerId"],
      });
    }
    if (command.profile.revision !== command.expectedRevision) {
      context.addIssue({
        code: "custom",
        message: "Profile revision must match the command's expected revision",
        path: ["profile", "revision"],
      });
    }
  });

export const uiGatewayCommandSchema = z
  .union([
    streamerSetupCommandSchema,
    streamerSessionCommandSchema,
    streamerProfileCommandSchema,
    streamerQuestCommandSchema,
    viewerVoteCommandSchema,
    viewerReactionCommandSchema,
  ])
  .superRefine((command, context) => {
    const allowedActorKinds =
      command.type === "streamer.quest"
        ? ["broadcaster", "moderator"]
        : command.type === "viewer.vote" || command.type === "viewer.react"
          ? ["viewer", "anonymous"]
          : null;

    if (allowedActorKinds !== null && !allowedActorKinds.includes(command.actor.kind)) {
      context.addIssue({
        code: "custom",
        message: `Actor kind ${command.actor.kind} cannot issue ${command.type}`,
        path: ["actor", "kind"],
      });
    }
  });

const snapshotBaseFields = {
  contractVersion: contractVersionSchema,
  surface: uiGatewaySurfaceSchema,
  auth: uiGatewayAuthStateSchema,
  currentRevision: revisionSchema,
};

export const uiGatewaySnapshotSchema = z.discriminatedUnion("role", [
  z
    .object({
      ...snapshotBaseFields,
      role: z.literal("streamer"),
      view: streamerViewModelSchema,
      readiness: streamerReadinessViewSchema,
    })
    .strict()
    .superRefine((snapshot, context) => {
      if (!["studio", "config", "live-config"].includes(snapshot.surface)) {
        context.addIssue({
          code: "custom",
          message: "Streamer snapshots require a streamer surface",
          path: ["surface"],
        });
      }
      const allowedActorKinds =
        snapshot.surface === "live-config"
          ? ["broadcaster", "moderator"]
          : ["broadcaster"];
      if (
        snapshot.auth.status !== "authenticated" ||
        snapshot.auth.actorKind === null ||
        !allowedActorKinds.includes(snapshot.auth.actorKind)
      ) {
        context.addIssue({
          code: "custom",
          message:
            snapshot.surface === "live-config"
              ? "Live Config snapshots require an active broadcaster or moderator"
              : "Studio and Config snapshots require an active broadcaster",
          path: ["auth"],
        });
      }
    }),
  z
    .object({
      ...snapshotBaseFields,
      role: z.literal("viewer"),
      view: viewerViewModelSchema,
      readiness: z.null(),
    })
    .strict()
    .superRefine((snapshot, context) => {
      if (!["viewer", "hosted-board"].includes(snapshot.surface)) {
        context.addIssue({
          code: "custom",
          message: "Viewer snapshots require a viewer surface",
          path: ["surface"],
        });
      }
      const authenticatedViewer =
        snapshot.auth.status === "authenticated" && snapshot.auth.actorKind === "viewer";
      const anonymousViewer =
        snapshot.auth.status === "anonymous" && snapshot.auth.actorKind === "anonymous";
      if (!authenticatedViewer && !anonymousViewer) {
        context.addIssue({
          code: "custom",
          message: "Viewer snapshots require an active viewer or anonymous participant",
          path: ["auth"],
        });
      }
    }),
  z
    .object({
      ...snapshotBaseFields,
      role: z.literal("overlay"),
      view: overlayViewModelSchema,
      readiness: z.null(),
    })
    .strict()
    .superRefine((snapshot, context) => {
      if (snapshot.surface !== "overlay") {
        context.addIssue({
          code: "custom",
          message: "Overlay snapshots require the overlay surface",
          path: ["surface"],
        });
      }
      if (
        snapshot.auth.status !== "authenticated" ||
        snapshot.auth.actorKind !== "overlay"
      ) {
        context.addIssue({
          code: "custom",
          message: "Overlay snapshots require active overlay access",
          path: ["auth"],
        });
      }
    }),
]).superRefine((snapshot, context) => {
  if (
    snapshot.currentRevision !== snapshot.view.envelope.revision ||
    snapshot.currentRevision !== snapshot.view.session.revision
  ) {
    context.addIssue({
      code: "custom",
      message: "Gateway, view, and session revisions must match",
      path: ["currentRevision"],
    });
  }
});

export const uiGatewayReadRequestSchema = z
  .object({
    surface: uiGatewaySurfaceSchema,
    sessionId: identifierSchema,
    scenario: z
      .enum([
        "ready",
        "permission-denied",
        "misconfigured",
        "disconnected",
        "stale",
        "dependency-failure",
      ])
      .optional(),
  })
  .strict();

export const uiGatewayReadResultSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), snapshot: uiGatewaySnapshotSchema }).strict(),
  z
    .object({
      ok: z.literal(false),
      error: domainErrorSchema,
      currentRevision: revisionSchema.nullable(),
    })
    .strict(),
]);

export const uiGatewayDispatchRequestSchema = z
  .object({
    surface: uiGatewaySurfaceSchema,
    scenario: uiGatewayReadRequestSchema.shape.scenario,
    command: uiGatewayCommandSchema,
  })
  .strict();

export const uiGatewayCommandResultSchema = z.discriminatedUnion("ok", [
  z
    .object({
      ok: z.literal(true),
      outcome: z.enum(["committed", "duplicate"]),
      commandId: identifierSchema,
      currentRevision: revisionSchema,
      delivery: z.enum(["published", "pending-recovery", "not-republished"]),
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

export const uiGatewayHealthResultSchema = z
  .object({
    ok: z.literal(true),
    contractVersion: contractVersionSchema,
    mode: z.enum(["diagnostic", "live"]),
    harnessEnabled: z.boolean(),
    checkedAt: timestampSchema,
    services: z.array(serviceHealthSchema),
  })
  .strict();

export type UiGatewaySurface = z.infer<typeof uiGatewaySurfaceSchema>;
export type UiGatewayRole = z.infer<typeof uiGatewayRoleSchema>;
export type UiGatewayAuthState = z.infer<typeof uiGatewayAuthStateSchema>;
export type StreamerReadinessView = z.infer<typeof streamerReadinessViewSchema>;
export type StreamerSetupCommand = z.infer<typeof streamerSetupCommandSchema>;
export type StreamerSessionCommand = z.infer<typeof streamerSessionCommandSchema>;
export type StreamerProfileCommand = z.infer<typeof streamerProfileCommandSchema>;
export type UiGatewayCommand = z.infer<typeof uiGatewayCommandSchema>;
export type UiGatewaySnapshot = z.infer<typeof uiGatewaySnapshotSchema>;
export type UiGatewayReadRequest = z.infer<typeof uiGatewayReadRequestSchema>;
export type UiGatewayReadResult = z.infer<typeof uiGatewayReadResultSchema>;
export type UiGatewayDispatchRequest = z.infer<typeof uiGatewayDispatchRequestSchema>;
export type UiGatewayCommandResult = z.infer<typeof uiGatewayCommandResultSchema>;
export type UiGatewayHealthResult = z.infer<typeof uiGatewayHealthResultSchema>;
