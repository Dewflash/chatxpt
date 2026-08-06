import { NextResponse } from "next/server";

import { readObsOverlaySnapshot } from "../../../../integrations";
import type { DomainError } from "../../../../core";
import {
  PersistenceConfigurationError,
  createConfiguredPersistenceRuntime,
  resolveServerPersistenceEnvironment,
} from "../../../../realtime/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

function parseMinimumRevision(value: string | null): number | undefined {
  if (value === null) return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : Number.NaN;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("sessionId");
  const readKey = url.searchParams.get("readKey");
  const minimumRevision = parseMinimumRevision(url.searchParams.get("minimumRevision"));

  if (sessionId === null || readKey === null || Number.isNaN(minimumRevision)) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "validation",
          message: "OBS overlay snapshot requires sessionId, readKey, and an optional numeric minimumRevision",
          retryable: false,
        },
      },
      { status: 400 },
    );
  }

  const environment = resolveServerPersistenceEnvironment(process.env);
  let persistence: ReturnType<typeof createConfiguredPersistenceRuntime>;
  try {
    persistence = createConfiguredPersistenceRuntime(environment);
  } catch (caught) {
    if (caught instanceof PersistenceConfigurationError) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "dependency-unavailable",
            message: caught.health.message ?? "Persistence is not configured",
            retryable: caught.health.retryable,
          },
          health: caught.health,
        },
        { status: 503 },
      );
    }
    throw caught;
  }

  const result = await readObsOverlaySnapshot(persistence, {
    sessionId,
    readKey,
    ...(minimumRevision === undefined ? {} : { minimumRevision }),
    now: Date.now(),
  });

  return NextResponse.json(
    {
      ...result,
      source: {
        persistenceMode: persistence.mode,
        evidenceClass: result.ok ? result.snapshot.envelope.evidenceClass : "unknown",
      },
    },
    { status: result.ok ? 200 : statusFor(result.error) },
  );
}
