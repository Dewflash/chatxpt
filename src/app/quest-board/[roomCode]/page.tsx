import { randomUUID } from "node:crypto";

import { HostedBoardAccessService, type HostedBoardAccessResult } from "../../../realtime";
import {
  PersistenceConfigurationError,
  createConfiguredPersistenceRuntime,
  resolveServerPersistenceEnvironment,
} from "../../../realtime/server";
import { HostedBoardAccessShell } from "../hosted-board-shell";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function unavailable(roomCode: string, message: string): HostedBoardAccessResult {
  return {
    status: "unavailable",
    roomCode: roomCode.trim().toUpperCase() || null,
    retryable: true,
    message,
  };
}

export default async function QuestBoardPage({
  params,
}: {
  readonly params: Promise<{ readonly roomCode: string }>;
}) {
  const { roomCode } = await params;
  let access: HostedBoardAccessResult;

  try {
    const environment = resolveServerPersistenceEnvironment(process.env);
    const runtime = createConfiguredPersistenceRuntime(environment);
    // Hosted-board access grants are request-scoped and need a server timestamp.
    // eslint-disable-next-line react-hooks/purity
    const requestedAt = Date.now();
    const service = new HostedBoardAccessService(
      runtime.hostedBoardSessions,
      runtime.accessGrants,
    );
    access = await service.resolve({
      roomCode,
      principalId: `hosted-board:${randomUUID()}`,
      requestedAt,
      expiresAt: requestedAt + 10 * 60 * 1_000,
      viewerPathPrefix: "/quest-board",
    });
  } catch (caught) {
    access = unavailable(
      roomCode,
      caught instanceof PersistenceConfigurationError
        ? "Hosted board persistence is misconfigured"
        : "Hosted board access could not be checked",
    );
  }

  return <HostedBoardAccessShell access={access} />;
}
