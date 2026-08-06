import { randomBytes, timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import {
  MAX_OBS_OVERLAY_READ_GRANT_MILLISECONDS,
  issueObsOverlayReadGrant,
} from "../../../../integrations";
import type { DomainError } from "../../../../core";
import {
  PersistenceConfigurationError,
  createConfiguredPersistenceRuntime,
  resolveServerPersistenceEnvironment,
} from "../../../../realtime/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SETUP_KEY_HEADER = "x-chatxpt-overlay-setup-key";
const DEFAULT_GRANT_MILLISECONDS = 60 * 60 * 1_000;

const grantRequestSchema = z
  .object({
    sessionId: z.string().trim().min(1).max(128),
    expiresInMs: z
      .number()
      .int()
      .positive()
      .max(MAX_OBS_OVERLAY_READ_GRANT_MILLISECONDS)
      .optional(),
    minimumRevision: z.number().int().nonnegative().optional(),
  })
  .strict();

function statusFor(error: DomainError): number {
  switch (error.code) {
    case "validation":
      return 400;
    case "unauthenticated":
      return 401;
    case "forbidden":
      return 403;
    case "duplicate":
    case "stale-revision":
      return 409;
    case "expired":
      return 410;
    case "dependency-unavailable":
    case "unavailable-capability":
      return 503;
    case "rate-limited":
      return 429;
    case "internal":
      return 500;
  }
}

function error(
  code: DomainError["code"],
  message: string,
  retryable: boolean,
  details?: Record<string, unknown>,
): DomainError {
  return {
    code,
    message,
    retryable,
    ...(details === undefined ? {} : { details }),
  };
}

function configuredSetupKey(): string | null {
  const value = process.env.CHATXPT_OBS_OVERLAY_SETUP_KEY?.trim();
  return value === undefined || value.length === 0 ? null : value;
}

function setupKeyMatches(request: Request, expected: string): boolean {
  const supplied = request.headers.get(SETUP_KEY_HEADER)?.trim();
  if (supplied === undefined || supplied.length === 0) return false;

  const suppliedBytes = Buffer.from(supplied);
  const expectedBytes = Buffer.from(expected);
  return (
    suppliedBytes.length === expectedBytes.length &&
    timingSafeEqual(suppliedBytes, expectedBytes)
  );
}

async function readBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const setupKey = configuredSetupKey();
  if (setupKey === null) {
    const responseError = error(
      "dependency-unavailable",
      "OBS overlay setup key is not configured",
      false,
    );
    return NextResponse.json({ ok: false, error: responseError }, { status: statusFor(responseError) });
  }

  if (!setupKeyMatches(request, setupKey)) {
    const responseError = error(
      "forbidden",
      "OBS overlay setup key is missing or invalid",
      false,
    );
    return NextResponse.json({ ok: false, error: responseError }, { status: statusFor(responseError) });
  }

  const parsed = grantRequestSchema.safeParse(await readBody(request));
  if (!parsed.success) {
    const responseError = error(
      "validation",
      "OBS overlay grant requires sessionId and optional numeric expiresInMs/minimumRevision",
      false,
    );
    return NextResponse.json({ ok: false, error: responseError }, { status: statusFor(responseError) });
  }

  const environment = resolveServerPersistenceEnvironment(process.env);
  let persistence: ReturnType<typeof createConfiguredPersistenceRuntime>;
  try {
    persistence = createConfiguredPersistenceRuntime(environment);
  } catch (caught) {
    if (caught instanceof PersistenceConfigurationError) {
      const responseError = error(
        "dependency-unavailable",
        caught.health.message ?? "Persistence is not configured",
        caught.health.retryable,
      );
      return NextResponse.json(
        { ok: false, error: responseError, health: caught.health },
        { status: statusFor(responseError) },
      );
    }
    throw caught;
  }

  const now = Date.now();
  const expiresAt = now + (parsed.data.expiresInMs ?? DEFAULT_GRANT_MILLISECONDS);
  const result = await issueObsOverlayReadGrant(persistence, {
    baseUrl: new URL(request.url).origin,
    sessionId: parsed.data.sessionId,
    readKey: `obs_${randomBytes(24).toString("base64url")}`,
    now,
    expiresAt,
    ...(parsed.data.minimumRevision === undefined
      ? {}
      : { minimumRevision: parsed.data.minimumRevision }),
  });

  return NextResponse.json(
    {
      ...result,
      source: {
        persistenceMode: persistence.mode,
        evidenceClass: "unknown",
      },
    },
    { status: result.ok ? 200 : statusFor(result.error) },
  );
}
