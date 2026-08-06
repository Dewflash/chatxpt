import { z } from "zod";

import {
  domainErrorSchema,
  overlayViewModelSchema,
  type DomainError,
  type OverlayViewModel,
  type RoleViewModels,
} from "../../core";

const overlaySnapshotReadInputSchema = z
  .object({
    sessionId: z.string().trim().min(1).max(128),
    readKey: z.string().trim().min(1).max(128),
    minimumRevision: z.number().int().nonnegative().optional(),
    now: z.number().int().nonnegative(),
  })
  .strict();

export const MAX_OBS_OVERLAY_READ_GRANT_MILLISECONDS = 4 * 60 * 60 * 1_000;

const obsOverlayReadGrantInputSchema = z
  .object({
    baseUrl: z
      .string()
      .trim()
      .min(1)
      .max(2_048)
      .refine((value) => {
        try {
          const url = new URL(value);
          return url.protocol === "http:" || url.protocol === "https:";
        } catch {
          return false;
        }
      }, "OBS overlay base URL must be absolute HTTP(S)"),
    sessionId: z.string().trim().min(1).max(128),
    readKey: z.string().trim().min(16).max(128),
    now: z.number().int().nonnegative(),
    expiresAt: z.number().int().nonnegative(),
    minimumRevision: z.number().int().nonnegative().optional(),
  })
  .strict()
  .superRefine((input, context) => {
    if (input.expiresAt <= input.now) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["expiresAt"],
        message: "OBS overlay read grant expiry must be in the future",
      });
    }
    if (input.expiresAt - input.now > MAX_OBS_OVERLAY_READ_GRANT_MILLISECONDS) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["expiresAt"],
        message: "OBS overlay read grant exceeds the maximum supported lifetime",
      });
    }
  });

export interface ObsOverlaySnapshotReadInput {
  readonly sessionId: string;
  readonly readKey: string;
  readonly minimumRevision?: number;
  readonly now: number;
}

export interface ObsOverlayReadGrantInput {
  readonly baseUrl: string;
  readonly sessionId: string;
  readonly readKey: string;
  readonly now: number;
  readonly expiresAt: number;
  readonly minimumRevision?: number;
}

export interface ObsOverlayReadGrantDependencies {
  readonly accessGrants: {
    grant(input: {
      readonly principalId: string;
      readonly sessionId: string;
      readonly viewRole: "overlay";
      readonly expiresAt: number;
    }): Promise<unknown>;
  };
}

export interface ObsOverlaySnapshotReadDependencies {
  readonly accessGrants: {
    canRead(
      principalId: string,
      sessionId: string,
      viewRole: "overlay",
      at: number,
    ): Promise<boolean>;
  };
  readonly snapshots: {
    readSnapshot(sessionId: string, role: "overlay"): Promise<RoleViewModels["overlay"] | null>;
  };
}

export type ObsOverlayReadGrantResult =
  | {
      readonly ok: true;
      readonly role: "overlay";
      readonly sessionId: string;
      readonly readKey: string;
      readonly snapshotUrl: string;
      readonly expiresAt: number;
      readonly reconnect: {
        readonly nextPollMs: 1_000;
        readonly stale: false;
      };
    }
  | {
      readonly ok: false;
      readonly error: DomainError;
    };

export type ObsOverlaySnapshotReadResult =
  | {
      readonly ok: true;
      readonly role: "overlay";
      readonly snapshot: OverlayViewModel;
      readonly reconnect: {
        readonly nextPollMs: number;
        readonly stale: false;
      };
    }
  | {
      readonly ok: false;
      readonly error: DomainError;
    };

function error(
  code: DomainError["code"],
  message: string,
  retryable: boolean,
  details?: Record<string, unknown>,
): DomainError {
  return domainErrorSchema.parse({
    code,
    message,
    retryable,
    ...(details === undefined ? {} : { details }),
  });
}

export function buildObsOverlaySnapshotUrl(input: {
  readonly baseUrl: string;
  readonly sessionId: string;
  readonly readKey: string;
  readonly minimumRevision?: number;
}): string {
  const url = new URL("/api/overlay/snapshot", input.baseUrl);
  url.searchParams.set("sessionId", input.sessionId);
  url.searchParams.set("readKey", input.readKey);
  if (input.minimumRevision !== undefined) {
    url.searchParams.set("minimumRevision", String(input.minimumRevision));
  }
  return url.toString();
}

export async function issueObsOverlayReadGrant(
  dependencies: ObsOverlayReadGrantDependencies,
  input: ObsOverlayReadGrantInput,
): Promise<ObsOverlayReadGrantResult> {
  const parsed = obsOverlayReadGrantInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: error("validation", "OBS overlay read grant request is invalid", false),
    };
  }

  try {
    await dependencies.accessGrants.grant({
      principalId: parsed.data.readKey,
      sessionId: parsed.data.sessionId,
      viewRole: "overlay",
      expiresAt: parsed.data.expiresAt,
    });
  } catch {
    return {
      ok: false,
      error: error("dependency-unavailable", "OBS overlay read grant could not be issued", true),
    };
  }

  return {
    ok: true,
    role: "overlay",
    sessionId: parsed.data.sessionId,
    readKey: parsed.data.readKey,
    snapshotUrl: buildObsOverlaySnapshotUrl({
      baseUrl: parsed.data.baseUrl,
      sessionId: parsed.data.sessionId,
      readKey: parsed.data.readKey,
      minimumRevision: parsed.data.minimumRevision,
    }),
    expiresAt: parsed.data.expiresAt,
    reconnect: {
      nextPollMs: 1_000,
      stale: false,
    },
  };
}

export async function readObsOverlaySnapshot(
  dependencies: ObsOverlaySnapshotReadDependencies,
  input: ObsOverlaySnapshotReadInput,
): Promise<ObsOverlaySnapshotReadResult> {
  const parsed = overlaySnapshotReadInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: error("validation", "OBS overlay snapshot request is invalid", false),
    };
  }

  const canRead = await dependencies.accessGrants.canRead(
    parsed.data.readKey,
    parsed.data.sessionId,
    "overlay",
    parsed.data.now,
  );
  if (!canRead) {
    return {
      ok: false,
      error: error("unauthenticated", "OBS overlay read grant is missing or expired", true),
    };
  }

  const snapshot = await dependencies.snapshots.readSnapshot(parsed.data.sessionId, "overlay");
  if (snapshot === null) {
    return {
      ok: false,
      error: error("dependency-unavailable", "OBS overlay snapshot is not available yet", true),
    };
  }

  const overlay = overlayViewModelSchema.parse(snapshot);
  if (
    parsed.data.minimumRevision !== undefined &&
    overlay.envelope.revision < parsed.data.minimumRevision
  ) {
    return {
      ok: false,
      error: error("stale-revision", "OBS overlay snapshot is older than the requested revision", true, {
        currentRevision: overlay.envelope.revision,
        minimumRevision: parsed.data.minimumRevision,
      }),
    };
  }

  return {
    ok: true,
    role: "overlay",
    snapshot: overlay,
    reconnect: {
      nextPollMs: overlay.connection.status === "ready" ? 1_000 : 2_500,
      stale: false,
    },
  };
}
