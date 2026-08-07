import { z } from "zod";

import {
  gameplayFrameObservationSchema,
  serviceHealthSchema,
  streamerSetupServiceSchema,
  timestampSchema,
  type ServiceHealth,
  type StreamerSetupAction,
  type StreamerSetupService,
} from "../../core";

export const OBS_CAPTURE_LIFECYCLE_DECISION_ID = "D-057";
export const OBS_CAPTURE_TARGET_SOURCE_KIND = "obs-virtual-camera";
export const OBS_CAPTURE_SAMPLE_INTERVAL_MS = 1_000;
export const OBS_CAPTURE_MAX_STALE_FRAME_MS = 3_000;
export const OBS_CAPTURE_MIN_WIDTH = 320;
export const OBS_CAPTURE_MIN_HEIGHT = 180;

export const obsCapturePermissionStateSchema = z.enum(["unknown", "prompt", "granted", "denied"]);
export const obsCaptureSelectedSourceKindSchema = z.enum([
  "none",
  "obs-virtual-camera",
  "other-camera",
  "screen-capture",
  "browser-tab",
]);
export const obsCaptureLifecycleStatusSchema = z.enum([
  "needs-permission",
  "needs-source",
  "recursion-risk",
  "waiting-for-frame",
  "ready",
  "stale",
  "ended",
]);

export const obsCaptureBrowserReportSchema = z
  .object({
    checkedAt: timestampSchema,
    permissionState: obsCapturePermissionStateSchema,
    selectedSource: z
      .object({
        kind: obsCaptureSelectedSourceKindSchema,
        label: z.string().trim().min(1).max(120).nullable(),
      })
      .strict(),
    rawGameSceneConfirmed: z.boolean(),
    overlayExcludedConfirmed: z.boolean(),
    lastFrameObservation: gameplayFrameObservationSchema.nullable(),
  })
  .strict()
  .superRefine((report, context) => {
    if (report.selectedSource.kind === "none" && report.selectedSource.label !== null) {
      context.addIssue({
        code: "custom",
        message: "A missing capture source cannot carry a label",
        path: ["selectedSource", "label"],
      });
    }
    if (report.lastFrameObservation !== null && report.lastFrameObservation.capturedAt > report.checkedAt) {
      context.addIssue({
        code: "custom",
        message: "Last captured frame cannot be newer than the browser report",
        path: ["lastFrameObservation", "capturedAt"],
      });
    }
  });

export const obsCaptureSetupResolutionSchema = z
  .object({
    ok: z.boolean(),
    decisionId: z.literal(OBS_CAPTURE_LIFECYCLE_DECISION_ID),
    lifecycleStatus: obsCaptureLifecycleStatusSchema,
    service: streamerSetupServiceSchema,
    framePolicy: z
      .object({
        sampleIntervalMs: z.literal(OBS_CAPTURE_SAMPLE_INTERVAL_MS),
        maxStaleFrameMs: z.literal(OBS_CAPTURE_MAX_STALE_FRAME_MS),
        minWidth: z.literal(OBS_CAPTURE_MIN_WIDTH),
        minHeight: z.literal(OBS_CAPTURE_MIN_HEIGHT),
        rawFramesPersisted: z.literal(false),
        exposeOnlyEphemeralFrameSource: z.literal(true),
      })
      .strict(),
    blockerCodes: z.array(z.string().trim().min(1).max(120)).max(8),
    limitations: z.array(z.string().trim().min(1).max(240)).max(8),
  })
  .strict();

export type ObsCapturePermissionState = z.infer<typeof obsCapturePermissionStateSchema>;
export type ObsCaptureSelectedSourceKind = z.infer<typeof obsCaptureSelectedSourceKindSchema>;
export type ObsCaptureLifecycleStatus = z.infer<typeof obsCaptureLifecycleStatusSchema>;
export type ObsCaptureBrowserReport = z.infer<typeof obsCaptureBrowserReportSchema>;
export type ObsCaptureSetupResolution = z.infer<typeof obsCaptureSetupResolutionSchema>;

function health(input: {
  readonly status: ServiceHealth["status"];
  readonly checkedAt: number;
  readonly message: string;
  readonly retryable: boolean;
}): ServiceHealth {
  return serviceHealthSchema.parse({
    service: "obs-capture",
    status: input.status,
    checkedAt: input.checkedAt,
    message: input.message,
    retryable: input.retryable,
  });
}

function service(input: {
  readonly configured: boolean;
  readonly health: ServiceHealth;
  readonly allowedActions: readonly StreamerSetupAction[];
}): StreamerSetupService {
  return streamerSetupServiceSchema.parse({
    service: "obs-capture",
    configured: input.configured,
    health: input.health,
    allowedActions: input.allowedActions,
  });
}

function framePolicy(): ObsCaptureSetupResolution["framePolicy"] {
  return {
    sampleIntervalMs: OBS_CAPTURE_SAMPLE_INTERVAL_MS,
    maxStaleFrameMs: OBS_CAPTURE_MAX_STALE_FRAME_MS,
    minWidth: OBS_CAPTURE_MIN_WIDTH,
    minHeight: OBS_CAPTURE_MIN_HEIGHT,
    rawFramesPersisted: false,
    exposeOnlyEphemeralFrameSource: true,
  };
}

function resolution(input: {
  readonly report: ObsCaptureBrowserReport;
  readonly lifecycleStatus: ObsCaptureLifecycleStatus;
  readonly service: StreamerSetupService;
  readonly blockerCodes: readonly string[];
  readonly limitations?: readonly string[];
}): ObsCaptureSetupResolution {
  return obsCaptureSetupResolutionSchema.parse({
    ok: input.lifecycleStatus === "ready",
    decisionId: OBS_CAPTURE_LIFECYCLE_DECISION_ID,
    lifecycleStatus: input.lifecycleStatus,
    service: input.service,
    framePolicy: framePolicy(),
    blockerCodes: input.blockerCodes,
    limitations: input.limitations ?? [
      "This evaluates the browser's setup report only; it does not prove a live OBS capture run.",
      "Raw gameplay frames must remain ephemeral and are exposed only through the FrameSource boundary.",
      "The selected source label is transient setup context and must not be persisted as a credential or device identifier.",
    ],
  });
}

export function resolveObsCaptureSetup(
  input: ObsCaptureBrowserReport | z.input<typeof obsCaptureBrowserReportSchema>,
): ObsCaptureSetupResolution {
  const report = obsCaptureBrowserReportSchema.parse(input);

  if (report.permissionState === "denied") {
    return resolution({
      report,
      lifecycleStatus: "needs-permission",
      service: service({
        configured: false,
        health: health({
          status: "permission-denied",
          checkedAt: report.checkedAt,
          message: "Browser camera permission is denied for OBS Virtual Camera capture.",
          retryable: true,
        }),
        allowedActions: ["request-capture-permission", "select-capture-source"],
      }),
      blockerCodes: ["obs-capture-permission-denied"],
    });
  }

  if (report.permissionState !== "granted") {
    return resolution({
      report,
      lifecycleStatus: "needs-permission",
      service: service({
        configured: false,
        health: health({
          status: "unavailable",
          checkedAt: report.checkedAt,
          message: "Browser camera permission has not been granted for OBS Virtual Camera capture.",
          retryable: true,
        }),
        allowedActions: ["request-capture-permission"],
      }),
      blockerCodes: ["obs-capture-permission-required"],
    });
  }

  if (report.selectedSource.kind !== OBS_CAPTURE_TARGET_SOURCE_KIND) {
    return resolution({
      report,
      lifecycleStatus: "needs-source",
      service: service({
        configured: false,
        health: health({
          status: "misconfigured",
          checkedAt: report.checkedAt,
          message: "Select OBS Virtual Camera as the gameplay capture source.",
          retryable: true,
        }),
        allowedActions: ["select-capture-source"],
      }),
      blockerCodes: ["obs-capture-source-not-selected"],
    });
  }

  if (!report.rawGameSceneConfirmed || !report.overlayExcludedConfirmed) {
    return resolution({
      report,
      lifecycleStatus: "recursion-risk",
      service: service({
        configured: false,
        health: health({
          status: "misconfigured",
          checkedAt: report.checkedAt,
          message: "Confirm OBS Virtual Camera exposes the raw game scene without the ChatXPT overlay.",
          retryable: true,
        }),
        allowedActions: ["select-capture-source", "open-diagnostics"],
      }),
      blockerCodes: ["obs-capture-recursion-risk"],
    });
  }

  if (report.lastFrameObservation === null) {
    return resolution({
      report,
      lifecycleStatus: "waiting-for-frame",
      service: service({
        configured: false,
        health: health({
          status: "degraded",
          checkedAt: report.checkedAt,
          message: "OBS Virtual Camera is selected, but no usable gameplay frame has been sampled yet.",
          retryable: true,
        }),
        allowedActions: ["retry-service", "open-diagnostics"],
      }),
      blockerCodes: ["obs-capture-frame-missing"],
    });
  }

  if (report.lastFrameObservation.status === "ended") {
    return resolution({
      report,
      lifecycleStatus: "ended",
      service: service({
        configured: false,
        health: health({
          status: "unavailable",
          checkedAt: report.checkedAt,
          message: "The OBS Virtual Camera capture session has ended.",
          retryable: true,
        }),
        allowedActions: ["select-capture-source", "retry-service"],
      }),
      blockerCodes: ["obs-capture-ended"],
    });
  }

  const frameAge = report.checkedAt - report.lastFrameObservation.capturedAt;
  const undersized =
    report.lastFrameObservation.width < OBS_CAPTURE_MIN_WIDTH
    || report.lastFrameObservation.height < OBS_CAPTURE_MIN_HEIGHT;
  const stale =
    report.lastFrameObservation.status !== "ready"
    || frameAge > OBS_CAPTURE_MAX_STALE_FRAME_MS
    || undersized;

  if (stale) {
    return resolution({
      report,
      lifecycleStatus: "stale",
      service: service({
        configured: false,
        health: health({
          status: "degraded",
          checkedAt: report.checkedAt,
          message: undersized
            ? "The sampled OBS Virtual Camera frame is too small for reliable gameplay extraction."
            : "The sampled OBS Virtual Camera frame is stale or not ready.",
          retryable: true,
        }),
        allowedActions: ["retry-service", "select-capture-source", "open-diagnostics"],
      }),
      blockerCodes: [undersized ? "obs-capture-frame-too-small" : "obs-capture-frame-stale"],
    });
  }

  return resolution({
    report,
    lifecycleStatus: "ready",
    service: service({
      configured: true,
      health: health({
        status: "ready",
        checkedAt: report.checkedAt,
        message: "OBS Virtual Camera is selected and supplying fresh raw-game frames.",
        retryable: false,
      }),
      allowedActions: [],
    }),
    blockerCodes: [],
  });
}
