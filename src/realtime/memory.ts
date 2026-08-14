import {
  acceptedVoteTallySnapshotSchema,
  acceptedCommandReceiptSchema,
  authoritativeSessionStateSchema,
  canonicalJsonStringify,
  candidateBatchSchema,
  viewerRecoveryStateSchema,
  type AcceptedCommandReceipt,
  type AcceptedVoteTallyReadInput,
  type AcceptedVoteTallyReader,
  type AcceptedVoteTallySnapshot,
  type AuthoritativeSessionState,
  type CandidateBatch,
  type CommitAuthoritativeStateInput,
  type CommitAuthoritativeStateResult,
  type RoleViewModels,
  type ViewerRecoveryReadInput,
  type ViewerRecoveryReader,
  type ViewerRecoveryState,
} from "../core";
import { buildSessionHistoryFromReceipts } from "./session-history";
import {
  PREPARING_SESSION_EXPIRY_MS,
  SESSION_RECONNECT_GRACE_MS,
  PersistenceConflictError,
  type BootstrapSessionInput,
  type CandidateBatchRepository,
  type CommitSessionLifecycleInput,
  type DueVoteCycleReader,
  type HostedBoardSessionDirectory,
  type HostedBoardSessionRecord,
  type LifecycleStoreCommitResult,
  type RoleSnapshotPublisher,
  type RealtimeAccessGrant,
  type RealtimeAccessGrantStore,
  type SessionHistoryReadInput,
  type SessionHistoryReader,
  type SessionLifecycleCommitResult,
  type SessionLifecycleStore,
  type SessionPresenceAction,
  type SessionPresenceResult,
  type SnapshotRole,
  type TwitchChannelSessionDirectory,
  type TwitchChannelSessionRecord,
} from "./types";
import { sanitizeRoleViewsForBroadcast } from "./sanitization";

interface MemoryLifecycleMetadata {
  lastActivityAt: number;
  lastHeartbeatAt: number | null;
  reconnectDeadlineAt: number | null;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function active(status: AuthoritativeSessionState["session"]["status"]): boolean {
  return status === "preparing" || status === "live";
}

export class MemoryChatXptPersistence
  implements
    AcceptedVoteTallyReader,
    CandidateBatchRepository,
    DueVoteCycleReader,
    HostedBoardSessionDirectory,
    RoleSnapshotPublisher,
    RealtimeAccessGrantStore,
    SessionHistoryReader,
    SessionLifecycleStore,
    TwitchChannelSessionDirectory,
    ViewerRecoveryReader
{
  private readonly states = new Map<string, AuthoritativeSessionState>();
  private readonly receipts = new Map<string, AcceptedCommandReceipt>();
  private readonly batches = new Map<string, CandidateBatch>();
  private readonly snapshots = new Map<string, RoleViewModels>();
  private readonly roomSessions = new Map<string, string>();
  private readonly broadcasterActiveSessions = new Map<string, string>();
  private readonly lifecycle = new Map<string, MemoryLifecycleMetadata>();
  private readonly lifecycleOperations = new Map<string, SessionLifecycleCommitResult>();
  private readonly accessGrants = new Map<string, RealtimeAccessGrant>();
  private readonly voteLedger = new Map<
    string,
    {
      sessionId: string;
      questCycleId: string;
      voterKey: string;
      candidateId: string;
      acceptedAt: number;
      sourceMode: "twitch-extension" | "hosted-board" | "twitch-chat";
    }
  >();

  async bootstrap(input: BootstrapSessionInput): Promise<void> {
    const state = authoritativeSessionStateSchema.parse(input.state);
    if (state.session.status !== "preparing" || state.session.revision !== 0) {
      throw new Error("A bootstrapped session must be preparing at revision zero");
    }
    if (state.session.createdAt !== input.createdAt) {
      throw new Error("Bootstrap timestamp must match canonical session state");
    }
    if (!/^[A-HJ-NP-Z2-9]{8}$/.test(input.roomCode)) {
      throw new Error("Fallback room code is invalid");
    }
    if (this.states.has(state.session.sessionId)) {
      throw new PersistenceConflictError("session-id", "Session ID already exists");
    }
    if (this.roomSessions.has(input.roomCode)) {
      throw new PersistenceConflictError("room-code", "Room code already exists");
    }
    if (this.broadcasterActiveSessions.has(state.session.broadcasterId)) {
      throw new PersistenceConflictError(
        "active-broadcaster",
        "Broadcaster already has an active session",
      );
    }

    this.states.set(state.session.sessionId, clone(state));
    this.roomSessions.set(input.roomCode, state.session.sessionId);
    this.broadcasterActiveSessions.set(state.session.broadcasterId, state.session.sessionId);
    this.lifecycle.set(state.session.sessionId, {
      lastActivityAt: input.createdAt,
      lastHeartbeatAt: null,
      reconnectDeadlineAt: null,
    });
  }

  async load(sessionId: string): Promise<AuthoritativeSessionState | null> {
    const state = this.states.get(sessionId);
    return state === undefined ? null : clone(state);
  }

  async findOperation(operationId: string): Promise<SessionLifecycleCommitResult | null> {
    const result = this.lifecycleOperations.get(operationId);
    return result === undefined ? null : clone(result);
  }

  async findReceipt(commandId: string): Promise<AcceptedCommandReceipt | null> {
    const receipt = this.receipts.get(commandId);
    return receipt === undefined ? null : clone(receipt);
  }

  async commit(input: CommitAuthoritativeStateInput): Promise<CommitAuthoritativeStateResult> {
    const existing = this.receipts.get(input.command.commandId);
    if (existing !== undefined) {
      return { status: "duplicate", receipt: clone(existing) };
    }

    const current = this.states.get(input.command.sessionId);
    if (current === undefined || current.session.revision !== input.expectedRevision) {
      return { status: "stale", currentRevision: current?.session.revision ?? 0 };
    }
    if (
      input.command.type === "viewer.vote" &&
      this.voteLedger.has(
        this.voteKey(
          input.command.sessionId,
          input.command.questCycleId,
          input.command.voterKey,
        ),
      )
    ) {
      return { status: "participation-conflict", reason: "vote-already-accepted" };
    }
    if (
      input.nextState.session.sessionId !== input.command.sessionId ||
      input.nextState.session.revision !== input.expectedRevision + 1 ||
      input.nextState.questCycle.envelope.revision !== input.expectedRevision + 1
    ) {
      throw new Error("Authoritative commit violates session or revision invariants");
    }

    const receipt = acceptedCommandReceiptSchema.parse({
      command: input.command,
      commandFingerprint: input.commandFingerprint,
      state: input.nextState,
      events: input.events,
      acceptedAt: input.acceptedAt,
    });
    this.replaceState(receipt.state);
    this.receipts.set(input.command.commandId, clone(receipt));
    if (input.command.type === "viewer.vote") {
      this.voteLedger.set(
        this.voteKey(
          input.command.sessionId,
          input.command.questCycleId,
          input.command.voterKey,
        ),
        {
          sessionId: input.command.sessionId,
          questCycleId: input.command.questCycleId,
          voterKey: input.command.voterKey,
          candidateId: input.command.candidateId,
          acceptedAt: input.acceptedAt,
          sourceMode: input.command.sourceMode,
        },
      );
    }
    const updatedLifecycle = this.lifecycle.get(input.command.sessionId);
    if (updatedLifecycle !== undefined) {
      updatedLifecycle.lastActivityAt = input.acceptedAt;
    }
    return { status: "committed", receipt: clone(receipt) };
  }

  async readAcceptedVoteTally(
    input: AcceptedVoteTallyReadInput,
  ): Promise<AcceptedVoteTallySnapshot> {
    const counts = new Map(input.candidateIds.map((candidateId) => [candidateId, 0]));
    for (const vote of this.voteLedger.values()) {
      if (
        vote.sessionId !== input.sessionId ||
        vote.questCycleId !== input.questCycleId ||
        vote.acceptedAt >= input.acceptedBefore
      ) {
        continue;
      }
      const current = counts.get(vote.candidateId);
      if (current === undefined) {
        throw new Error("Accepted vote references a candidate outside the closing cycle");
      }
      counts.set(vote.candidateId, current + 1);
    }
    const tallies = input.candidateIds.map((candidateId) => ({
      candidateId,
      votes: counts.get(candidateId) ?? 0,
    })) as [
      { candidateId: string; votes: number },
      { candidateId: string; votes: number },
      { candidateId: string; votes: number },
    ];
    return acceptedVoteTallySnapshotSchema.parse({
      sessionId: input.sessionId,
      questCycleId: input.questCycleId,
      revision: input.revision,
      closedAt: input.closedAt,
      acceptedVoteCount: tallies.reduce((sum, tally) => sum + tally.votes, 0),
      tallies,
    });
  }

  async readViewerRecovery(input: ViewerRecoveryReadInput): Promise<ViewerRecoveryState> {
    const vote = this.voteLedger.get(
      this.voteKey(input.sessionId, input.questCycleId, input.voterKey),
    );
    return viewerRecoveryStateSchema.parse(
      vote === undefined
        ? {
            sessionId: input.sessionId,
            questCycleId: input.questCycleId,
            acceptedCandidateId: null,
            acceptedAt: null,
            sessionPoints: 0,
            sourceMode: null,
          }
        : {
            sessionId: input.sessionId,
            questCycleId: input.questCycleId,
            acceptedCandidateId: vote.candidateId,
            acceptedAt: vote.acceptedAt,
            sessionPoints: 0,
            sourceMode: vote.sourceMode,
          },
    );
  }

  async store(batch: CandidateBatch): Promise<void> {
    const parsed = candidateBatchSchema.parse(batch);
    const existing = this.batches.get(parsed.envelope.messageId);
    if (existing !== undefined) {
      if (canonicalJsonStringify(existing) === canonicalJsonStringify(parsed)) return;
      throw new PersistenceConflictError("unknown", "Candidate batch ID was reused");
    }
    this.batches.set(parsed.envelope.messageId, clone(parsed));
  }

  async read(candidateBatchId: string, sessionId: string): Promise<CandidateBatch | null> {
    const batch = this.batches.get(candidateBatchId);
    if (batch === undefined || batch.envelope.sessionId !== sessionId) return null;
    return clone(batch);
  }

  async publish(views: RoleViewModels): Promise<void> {
    const parsed = sanitizeRoleViewsForBroadcast(views);
    const sessionId = parsed.streamer.envelope.sessionId;
    if (
      parsed.viewer.envelope.sessionId !== sessionId ||
      parsed.overlay.envelope.sessionId !== sessionId ||
      parsed.viewer.envelope.revision !== parsed.streamer.envelope.revision ||
      parsed.overlay.envelope.revision !== parsed.streamer.envelope.revision
    ) {
      throw new Error("Role snapshots must share one session and revision");
    }
    this.snapshots.set(sessionId, clone(parsed));
  }

  async readSnapshot<Role extends SnapshotRole>(
    sessionId: string,
    role: Role,
  ): Promise<RoleViewModels[Role] | null> {
    const views = this.snapshots.get(sessionId);
    return views === undefined ? null : clone(views[role]);
  }

  async findHostedBoardSession(roomCode: string): Promise<HostedBoardSessionRecord | null> {
    const sessionId = this.roomSessions.get(roomCode);
    if (sessionId === undefined) return null;
    const state = this.states.get(sessionId);
    if (state === undefined) return null;
    return {
      sessionId: state.session.sessionId,
      roomCode,
      status: state.session.status,
      revision: state.session.revision,
    };
  }

  async findTwitchChannelSession(channelId: string): Promise<TwitchChannelSessionRecord | null> {
    const sessionId = this.broadcasterActiveSessions.get(channelId);
    if (sessionId === undefined) return null;
    const state = this.states.get(sessionId);
    if (state === undefined || !active(state.session.status)) return null;
    return {
      sessionId,
      channelId,
      status: state.session.status,
      revision: state.session.revision,
    };
  }

  async grant(input: Omit<RealtimeAccessGrant, "revokedAt">): Promise<RealtimeAccessGrant> {
    if (!this.states.has(input.sessionId)) throw new Error("Cannot grant access to a missing session");
    const value: RealtimeAccessGrant = { ...input, revokedAt: null };
    this.accessGrants.set(this.grantKey(input.principalId, input.sessionId, input.viewRole), value);
    return clone(value);
  }

  async revoke(
    principalId: string,
    sessionId: string,
    viewRole: SnapshotRole,
    revokedAt: number,
  ): Promise<void> {
    const key = this.grantKey(principalId, sessionId, viewRole);
    const existing = this.accessGrants.get(key);
    if (existing !== undefined) this.accessGrants.set(key, { ...existing, revokedAt });
  }

  async canRead(
    principalId: string,
    sessionId: string,
    viewRole: SnapshotRole,
    at: number,
  ): Promise<boolean> {
    const access = this.accessGrants.get(this.grantKey(principalId, sessionId, viewRole));
    return access !== undefined && access.revokedAt === null && access.expiresAt > at;
  }

  async commitLifecycle(
    input: CommitSessionLifecycleInput,
  ): Promise<LifecycleStoreCommitResult> {
    const existing = this.lifecycleOperations.get(input.operationId);
    if (existing !== undefined) {
      return { status: "duplicate", result: clone(existing) };
    }
    const current = this.states.get(input.sessionId);
    if (current === undefined) return { status: "missing" };
    if (current.session.revision !== input.expectedRevision) {
      return { status: "stale", currentRevision: current.session.revision };
    }

    const metadata = this.lifecycle.get(input.sessionId);
    if (
      input.action === "start" &&
      metadata !== undefined &&
      metadata.lastActivityAt <= input.occurredAt - PREPARING_SESSION_EXPIRY_MS
    ) {
      return { status: "expired" };
    }
    if (input.action === "expire" && metadata !== undefined) {
      const preparingDue =
        current.session.status === "preparing" &&
        metadata.lastActivityAt <= input.occurredAt - PREPARING_SESSION_EXPIRY_MS;
      const reconnectDue =
        current.session.status === "live" &&
        metadata.reconnectDeadlineAt !== null &&
        metadata.reconnectDeadlineAt <= input.occurredAt;
      if (!preparingDue && !reconnectDue) return { status: "not-due" };
    }

    const nextState = authoritativeSessionStateSchema.parse(input.nextState);
    if (
      nextState.session.sessionId !== input.sessionId ||
      nextState.session.revision !== input.expectedRevision + 1 ||
      nextState.questCycle.envelope.revision !== input.expectedRevision + 1
    ) {
      throw new Error("Lifecycle commit violates session or revision invariants");
    }
    const result: SessionLifecycleCommitResult = {
      sessionId: input.sessionId,
      action: input.action,
      revision: nextState.session.revision,
      state: clone(nextState),
      occurredAt: input.occurredAt,
    };
    this.replaceState(nextState);
    this.lifecycleOperations.set(input.operationId, clone(result));
    if (metadata !== undefined) {
      metadata.lastActivityAt = input.occurredAt;
      metadata.reconnectDeadlineAt = null;
    }
    return { status: "committed", result };
  }

  async touch(
    sessionId: string,
    action: SessionPresenceAction,
    occurredAt: number,
  ): Promise<SessionPresenceResult | null> {
    const state = this.states.get(sessionId);
    const metadata = this.lifecycle.get(sessionId);
    if (state?.session.status !== "live" || metadata === undefined) return null;
    if (occurredAt < metadata.lastActivityAt) {
      return {
        sessionId,
        status: "live",
        revision: state.session.revision,
        lastActivityAt: metadata.lastActivityAt,
        lastHeartbeatAt: metadata.lastHeartbeatAt,
        reconnectDeadlineAt: metadata.reconnectDeadlineAt,
      };
    }
    metadata.lastActivityAt = occurredAt;
    if (action === "heartbeat") {
      metadata.lastHeartbeatAt = occurredAt;
      metadata.reconnectDeadlineAt = null;
    } else {
      metadata.reconnectDeadlineAt ??= occurredAt + SESSION_RECONNECT_GRACE_MS;
    }
    return {
      sessionId,
      status: "live",
      revision: state.session.revision,
      lastActivityAt: metadata.lastActivityAt,
      lastHeartbeatAt: metadata.lastHeartbeatAt,
      reconnectDeadlineAt: metadata.reconnectDeadlineAt,
    };
  }

  async due(at: number): Promise<readonly AuthoritativeSessionState[]> {
    const due: AuthoritativeSessionState[] = [];
    for (const [sessionId, state] of this.states) {
      const metadata = this.lifecycle.get(sessionId);
      if (metadata === undefined) continue;
      const preparingExpired =
        state.session.status === "preparing" &&
        metadata.lastActivityAt <= at - PREPARING_SESSION_EXPIRY_MS;
      const reconnectExpired =
        state.session.status === "live" &&
        metadata.reconnectDeadlineAt !== null &&
        metadata.reconnectDeadlineAt <= at;
      if (preparingExpired || reconnectExpired) due.push(clone(state));
    }
    return due;
  }

  async dueVoteCycles(at: number): Promise<readonly AuthoritativeSessionState[]> {
    const due: AuthoritativeSessionState[] = [];
    for (const state of this.states.values()) {
      if (
        state.session.status === "live" &&
        state.questCycle.status === "voting" &&
        state.questCycle.endsAt !== null &&
        state.questCycle.endsAt <= at
      ) {
        due.push(clone(state));
      }
    }
    return due.sort(
      (left, right) =>
        (left.questCycle.endsAt ?? 0) - (right.questCycle.endsAt ?? 0) ||
        left.session.sessionId.localeCompare(right.session.sessionId),
    );
  }

  async readSessionHistory(input: SessionHistoryReadInput) {
    return buildSessionHistoryFromReceipts({
      broadcasterId: input.broadcasterId,
      receipts: [...this.receipts.values()].map((receipt) => clone(receipt)),
      generatedAt: input.at,
      limit: input.limit,
      source: "orchestrator",
      evidenceClass: "live",
    });
  }

  private replaceState(nextState: AuthoritativeSessionState): void {
    const previous = this.states.get(nextState.session.sessionId);
    this.states.set(nextState.session.sessionId, clone(nextState));
    if (previous !== undefined && active(previous.session.status) && !active(nextState.session.status)) {
      this.broadcasterActiveSessions.delete(previous.session.broadcasterId);
    }
    if (active(nextState.session.status)) {
      this.broadcasterActiveSessions.set(
        nextState.session.broadcasterId,
        nextState.session.sessionId,
      );
    }
  }

  private grantKey(principalId: string, sessionId: string, role: SnapshotRole): string {
    return `${principalId}:${sessionId}:${role}`;
  }

  private voteKey(sessionId: string, questCycleId: string, voterKey: string): string {
    return JSON.stringify([sessionId, questCycleId, voterKey]);
  }
}

export function createMemoryPersistenceRuntime() {
  const backend = new MemoryChatXptPersistence();
  return {
    mode: "memory" as const,
    sessions: backend,
    lifecycle: backend,
    hostedBoardSessions: backend,
    twitchChannelSessions: backend,
    candidates: backend,
    acceptedVotes: backend,
    snapshots: backend,
    accessGrants: backend,
    dueVotes: backend,
    viewerRecovery: backend,
    sessionHistory: backend,
  };
}
