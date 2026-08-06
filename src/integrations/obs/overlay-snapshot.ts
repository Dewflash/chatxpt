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

export interface ObsOverlaySnapshotReadInput {
  readonly sessionId: string;
  readonly readKey: string;
  readonly minimumRevision?: number;
  readonly now: number;
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
