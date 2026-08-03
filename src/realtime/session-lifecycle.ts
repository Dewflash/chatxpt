import {
  authoritativeSessionStateSchema,
  canonicalJsonStringify,
  domainErrorSchema,
  type AuthoritativeSessionState,
  type DomainError,
} from "../core";
import {
  FALLBACK_ROOM_CODE_LENGTH,
  PersistenceConflictError,
  type LifecycleStoreCommitResult,
  type SessionLifecycleAction,
  type SessionLifecycleCommitResult,
  type SessionLifecycleStore,
  type SessionPresenceResult,
} from "./types";

const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const ROOM_CODE_ATTEMPTS = 32;

export interface RoomCodeGenerator {
  next(): string;
}

export interface LifecycleOperationIdFactory {
  next(action: SessionLifecycleAction): string;
}

export type LifecycleServiceResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: DomainError };

function failure(
  code: DomainError["code"],
  message: string,
  retryable = false,
): LifecycleServiceResult<never> {
  return { ok: false, error: domainErrorSchema.parse({ code, message, retryable }) };
}

export class SecureRoomCodeGenerator implements RoomCodeGenerator {
  next(): string {
    const bytes = new Uint8Array(FALLBACK_ROOM_CODE_LENGTH);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (value) => ROOM_CODE_ALPHABET[value % ROOM_CODE_ALPHABET.length]).join("");
  }
}

export class SecureLifecycleOperationIds implements LifecycleOperationIdFactory {
  next(action: SessionLifecycleAction): string {
    return `${action}-${crypto.randomUUID()}`;
  }
}

function stampLifecycleState(
  current: AuthoritativeSessionState,
  action: SessionLifecycleAction,
  operationId: string,
  occurredAt: number,
): AuthoritativeSessionState {
  const revision = current.session.revision + 1;
  const leavingPreparing = current.session.status === "preparing" && action !== "start";
  const status = action === "start" ? "live" : leavingPreparing ? "offline" : "ended";
  const session = {
    ...current.session,
    status,
    revision,
    startedAt: action === "start" ? occurredAt : current.session.startedAt,
    endedAt: status === "ended" ? occurredAt : null,
  } as const;
  const questCycle = {
    ...current.questCycle,
    envelope: {
      ...current.questCycle.envelope,
      messageId: operationId,
      correlationId: operationId,
      revision,
      occurredAt,
      receivedAt: occurredAt,
      source: "orchestrator" as const,
    },
  };
  return authoritativeSessionStateSchema.parse({ ...current, session, questCycle });
}

function validateTransition(
  state: AuthoritativeSessionState,
  action: SessionLifecycleAction,
): DomainError | null {
  if (action === "start" && state.session.status !== "preparing") {
    return domainErrorSchema.parse({
      code: state.session.status === "ended" || state.session.status === "offline" ? "expired" : "validation",
      message: "Only a preparing session can start",
      retryable: false,
    });
  }
  if (action !== "start" && state.session.status !== "preparing" && state.session.status !== "live") {
    return domainErrorSchema.parse({
      code: "expired",
      message: "Session has already ended",
      retryable: false,
    });
  }
  return null;
}

export class SessionLifecycleService {
  constructor(
    private readonly store: SessionLifecycleStore,
    private readonly roomCodes: RoomCodeGenerator = new SecureRoomCodeGenerator(),
    private readonly operationIds: LifecycleOperationIdFactory = new SecureLifecycleOperationIds(),
  ) {}

  async create(
    initialState: AuthoritativeSessionState,
    createdAt: number,
  ): Promise<LifecycleServiceResult<{ readonly roomCode: string; readonly state: AuthoritativeSessionState }>> {
    const parsed = authoritativeSessionStateSchema.safeParse(initialState);
    if (
      !parsed.success ||
      parsed.data.session.status !== "preparing" ||
      parsed.data.session.revision !== 0 ||
      parsed.data.session.createdAt !== createdAt
    ) {
      return failure("validation", "New sessions must be valid preparing state at revision zero");
    }

    for (let attempt = 0; attempt < ROOM_CODE_ATTEMPTS; attempt += 1) {
      const roomCode = this.roomCodes.next();
      try {
        await this.store.bootstrap({ roomCode, state: parsed.data, createdAt });
        return { ok: true, value: { roomCode, state: parsed.data } };
      } catch (caught) {
        if (caught instanceof PersistenceConflictError && caught.kind === "room-code") continue;
        if (caught instanceof PersistenceConflictError && caught.kind === "active-broadcaster") {
          return failure("duplicate", "Broadcaster already has an active ChatXPT session");
        }
        if (caught instanceof PersistenceConflictError && caught.kind === "session-id") {
          return failure("duplicate", "Session ID already exists");
        }
        return failure("dependency-unavailable", "Session could not be created", true);
      }
    }
    return failure("dependency-unavailable", "A unique fallback room code could not be allocated", true);
  }

  async start(
    sessionId: string,
    expectedRevision: number,
    occurredAt: number,
    operationId = this.operationIds.next("start"),
  ): Promise<LifecycleServiceResult<SessionLifecycleCommitResult>> {
    return this.transition(sessionId, "start", expectedRevision, occurredAt, operationId, null);
  }

  async end(
    sessionId: string,
    expectedRevision: number,
    occurredAt: number,
    reason: string,
    operationId = this.operationIds.next("end"),
  ): Promise<LifecycleServiceResult<SessionLifecycleCommitResult>> {
    return this.transition(sessionId, "end", expectedRevision, occurredAt, operationId, reason);
  }

  async heartbeat(
    sessionId: string,
    occurredAt: number,
  ): Promise<LifecycleServiceResult<SessionPresenceResult>> {
    try {
      const result = await this.store.touch(sessionId, "heartbeat", occurredAt);
      return result === null
        ? failure("expired", "Only a live session accepts broadcaster heartbeats")
        : { ok: true, value: result };
    } catch {
      return failure("dependency-unavailable", "Session heartbeat could not be stored", true);
    }
  }

  async disconnect(
    sessionId: string,
    occurredAt: number,
  ): Promise<LifecycleServiceResult<SessionPresenceResult>> {
    try {
      const result = await this.store.touch(sessionId, "disconnect", occurredAt);
      return result === null
        ? failure("expired", "Only a live session can enter reconnect grace")
        : { ok: true, value: result };
    } catch {
      return failure("dependency-unavailable", "Reconnect grace could not be stored", true);
    }
  }

  async expireDue(at: number): Promise<readonly LifecycleServiceResult<SessionLifecycleCommitResult>[]> {
    let due: readonly AuthoritativeSessionState[];
    try {
      due = await this.store.due(at);
    } catch {
      return [failure("dependency-unavailable", "Due-session lookup failed", true)];
    }
    return Promise.all(
      due.map((state) =>
        this.transition(
          state.session.sessionId,
          "expire",
          state.session.revision,
          at,
          this.operationIds.next("expire"),
          state.session.status === "preparing"
            ? "preparing-inactivity-expired"
            : "reconnect-grace-expired",
        ),
      ),
    );
  }

  private async transition(
    sessionId: string,
    action: SessionLifecycleAction,
    expectedRevision: number,
    occurredAt: number,
    operationId: string,
    endReason: string | null,
  ): Promise<LifecycleServiceResult<SessionLifecycleCommitResult>> {
    try {
      const existing = await this.store.findOperation(operationId);
      if (existing !== null) {
        return existing.sessionId === sessionId &&
          existing.action === action &&
          existing.revision === expectedRevision + 1
          ? { ok: true, value: existing }
          : failure("duplicate", "Lifecycle operation ID was already used for different input");
      }
    } catch {
      return failure("dependency-unavailable", "Lifecycle receipt lookup failed", true);
    }

    let current: AuthoritativeSessionState | null;
    try {
      current = await this.store.load(sessionId);
    } catch {
      return failure("dependency-unavailable", "Session lifecycle state is unavailable", true);
    }
    if (current === null) return failure("validation", "Session does not exist");
    if (current.session.revision !== expectedRevision) {
      return failure("stale-revision", "Session lifecycle expected a stale revision");
    }
    const transitionError = validateTransition(current, action);
    if (transitionError !== null) return { ok: false, error: transitionError };

    let nextState: AuthoritativeSessionState;
    try {
      nextState = stampLifecycleState(current, action, operationId, occurredAt);
    } catch {
      return failure("internal", "Session lifecycle transition produced invalid state", true);
    }

    let committed: LifecycleStoreCommitResult;
    try {
      committed = await this.store.commitLifecycle({
        sessionId,
        operationId,
        action,
        expectedRevision,
        nextState,
        occurredAt,
        endReason,
      });
    } catch {
      return failure("dependency-unavailable", "Session lifecycle commit failed", true);
    }
    if (committed.status === "missing") return failure("validation", "Session does not exist");
    if (committed.status === "expired") {
      return failure("expired", "Preparing session expired before it could start");
    }
    if (committed.status === "not-due") {
      return failure("unavailable-capability", "Session recovered before expiry was committed");
    }
    if (committed.status === "stale") {
      return failure("stale-revision", "A concurrent operation changed the session");
    }
    if (
      committed.result.sessionId !== sessionId ||
      committed.result.action !== action ||
      committed.result.revision !== expectedRevision + 1 ||
      canonicalJsonStringify(committed.result.state) !== canonicalJsonStringify(nextState)
    ) {
      return failure("duplicate", "Lifecycle operation ID was already used for different input");
    }
    return { ok: true, value: committed.result };
  }
}
