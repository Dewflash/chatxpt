import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import {
  acceptedVoteTallySnapshotSchema,
  acceptedCommandReceiptSchema,
  authoritativeSessionStateSchema,
  canonicalJsonStringify,
  candidateBatchSchema,
  hostedBoardAccessResultSchema,
  overlayViewModelSchema,
  serviceHealthSchema,
  streamerViewModelSchema,
  viewerParticipationReceiptReadResultSchema,
  viewerViewModelSchema,
  type AcceptedCommandReceipt,
  type AcceptedVoteTallyReadInput,
  type AcceptedVoteTallyReader,
  type AcceptedVoteTallySnapshot,
  type AuthoritativeSessionState,
  type CandidateBatch,
  type CommitAuthoritativeStateInput,
  type CommitAuthoritativeStateResult,
  type RoleViewModels,
  type SessionHistorySnapshot,
  type ServiceHealth,
} from "../core";
import type { SupabasePersistenceEnvironment } from "./environment";
import {
  PREPARING_SESSION_EXPIRY_MS,
  PersistenceConflictError,
  type BootstrapSessionInput,
  type CandidateBatchRepository,
  type ChatXptPersistenceRuntime,
  type CommitSessionLifecycleInput,
  type DueVoteCycleReader,
  type HostedBoardAccessInput,
  type HostedBoardAccessResolver,
  type LifecycleStoreCommitResult,
  type RoleSnapshotPublisher,
  type RealtimeAccessGrant,
  type RealtimeAccessGrantStore,
  type SessionLifecycleCommitResult,
  type SessionLifecycleStore,
  type SessionHistoryReadInput,
  type SessionHistoryReader,
  type SessionPresenceAction,
  type SessionPresenceResult,
  type SnapshotRole,
  type ViewerParticipationReceiptReadInput,
  type ViewerParticipationReceiptReader,
} from "./types";
import { sanitizeRoleViewsForBroadcast } from "./sanitization";
import { derivePrivateViewerVoterKey } from "./private-viewer";
import { buildSessionHistoryFromReceipts } from "./session-history";

type JsonRecord = Record<string, unknown>;

const commitResultSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("committed"), receipt: acceptedCommandReceiptSchema }).strict(),
  z.object({ status: z.literal("duplicate"), receipt: acceptedCommandReceiptSchema }).strict(),
  z.object({ status: z.literal("stale"), currentRevision: z.number().int().nonnegative() }).strict(),
  z
    .object({
      status: z.literal("participation-conflict"),
      reason: z.literal("vote-already-accepted"),
    })
    .strict(),
]);

const acceptedVoteRowSchema = z.object({ candidate_id: z.string().min(1).max(128) }).passthrough();

const privateAcceptedVoteRowSchema = z
  .object({
    candidate_id: z.string().min(1).max(128),
    accepted_at: z.iso.datetime({ offset: true }),
    payload: z
      .object({
        sourceMode: z.enum(["twitch-extension", "hosted-board", "twitch-chat"]),
      })
      .passthrough(),
  })
  .passthrough();

const privateAcceptedVoteWithCycleRowSchema = privateAcceptedVoteRowSchema.extend({
  quest_cycle_id: z.string().min(1).max(128).nullable(),
});

const lifecycleCommitResultSchema = z.discriminatedUnion("status", [
  z
    .object({
      status: z.literal("committed"),
      result: z.object({
        sessionId: z.string().min(1),
        action: z.enum(["start", "end", "expire"]),
        revision: z.number().int().nonnegative(),
        state: authoritativeSessionStateSchema,
        occurredAt: z.number().int().nonnegative(),
      }),
    })
    .strict(),
  z
    .object({
      status: z.literal("duplicate"),
      result: z.object({
        sessionId: z.string().min(1),
        action: z.enum(["start", "end", "expire"]),
        revision: z.number().int().nonnegative(),
        state: authoritativeSessionStateSchema,
        occurredAt: z.number().int().nonnegative(),
      }),
    })
    .strict(),
  z.object({ status: z.literal("stale"), currentRevision: z.number().int().nonnegative() }).strict(),
  z.object({ status: z.literal("expired") }).strict(),
  z.object({ status: z.literal("not-due") }).strict(),
  z.object({ status: z.literal("missing") }).strict(),
]);

const presencePayloadSchema = z
  .object({
    sessionId: z.string().min(1),
    status: z.literal("live"),
    revision: z.number().int().nonnegative(),
    lastActivityAt: z.number().int().nonnegative(),
    lastHeartbeatAt: z.number().int().nonnegative().nullable(),
    reconnectDeadlineAt: z.number().int().nonnegative().nullable(),
  })
  .strict();

const presenceResultSchema = z.discriminatedUnion("status", [
  z
    .object({
      status: z.literal("updated"),
      result: presencePayloadSchema,
    })
    .strict(),
  z.object({ status: z.literal("ignored"), result: presencePayloadSchema }).strict(),
  z.object({ status: z.literal("not-live") }).strict(),
]);

export class SupabaseDataError extends Error {
  constructor(
    message: string,
    readonly code: string | null,
    readonly details: string | null,
    readonly hint: string | null,
  ) {
    super(message);
    this.name = "SupabaseDataError";
  }
}

function throwIfError(error: unknown): void {
  if (error === null || error === undefined) return;
  const value = error as { message?: unknown; code?: unknown; details?: unknown; hint?: unknown };
  throw new SupabaseDataError(
    typeof value.message === "string" ? value.message : "Supabase request failed",
    typeof value.code === "string" ? value.code : null,
    typeof value.details === "string" ? value.details : null,
    typeof value.hint === "string" ? value.hint : null,
  );
}

function rowJson(row: unknown, key: string): unknown {
  if (typeof row !== "object" || row === null || !(key in row)) return null;
  return (row as JsonRecord)[key];
}

function sessionActive(status: AuthoritativeSessionState["session"]["status"]): boolean {
  return status === "preparing" || status === "live";
}

export class SupabaseChatXptDataApi {
  constructor(private readonly client: SupabaseClient) {}

  async loadState(sessionId: string): Promise<unknown | null> {
    const { data, error } = await this.client
      .from("stream_sessions")
      .select("current_state")
      .eq("session_id", sessionId)
      .maybeSingle();
    throwIfError(error);
    return data === null ? null : rowJson(data, "current_state");
  }

  async loadReceipt(commandId: string): Promise<unknown | null> {
    const { data, error } = await this.client
      .from("command_receipts")
      .select("receipt")
      .eq("command_id", commandId)
      .maybeSingle();
    throwIfError(error);
    return data === null ? null : rowJson(data, "receipt");
  }

  async loadLifecycleOperation(operationId: string): Promise<unknown | null> {
    const { data, error } = await this.client
      .from("session_operations")
      .select("result")
      .eq("operation_id", operationId)
      .maybeSingle();
    throwIfError(error);
    return data === null ? null : rowJson(data, "result");
  }

  async commitState(input: CommitAuthoritativeStateInput): Promise<unknown> {
    const { data, error } = await this.client.rpc("commit_authoritative_state", {
      p_session_id: input.command.sessionId,
      p_command_id: input.command.commandId,
      p_command_fingerprint: input.commandFingerprint,
      p_expected_revision: input.expectedRevision,
      p_command: input.command,
      p_next_state: input.nextState,
      p_events: input.events,
      p_accepted_at_ms: input.acceptedAt,
    });
    throwIfError(error);
    return data;
  }

  async storeCandidateBatch(batch: CandidateBatch): Promise<void> {
    const { error } = await this.client.from("quest_candidate_batches").insert(
      {
        batch_id: batch.envelope.messageId,
        session_id: batch.envelope.sessionId,
        quest_cycle_id: batch.envelope.questCycleId,
        revision: batch.envelope.revision,
        contract_version: batch.envelope.contractVersion,
        candidate_count: batch.candidates.length,
        payload: batch,
      },
    );
    throwIfError(error);
  }

  async loadCandidateBatch(batchId: string, sessionId: string): Promise<unknown | null> {
    const { data, error } = await this.client
      .from("quest_candidate_batches")
      .select("payload")
      .eq("batch_id", batchId)
      .eq("session_id", sessionId)
      .maybeSingle();
    throwIfError(error);
    return data === null ? null : rowJson(data, "payload");
  }

  async loadAcceptedVotes(
    sessionId: string,
    questCycleId: string,
    acceptedBefore: number,
  ): Promise<readonly unknown[]> {
    const { data, error } = await this.client
      .from("accepted_participation")
      .select("candidate_id")
      .eq("session_id", sessionId)
      .eq("quest_cycle_id", questCycleId)
      .eq("participation_type", "vote")
      .lt("accepted_at", new Date(acceptedBefore).toISOString());
    throwIfError(error);
    return data ?? [];
  }

  async loadPrivateAcceptedVote(
    sessionId: string,
    questCycleId: string,
    voterKey: string,
  ): Promise<unknown | null> {
    const { data, error } = await this.client
      .from("accepted_participation")
      .select("candidate_id, accepted_at, payload")
      .eq("session_id", sessionId)
      .eq("quest_cycle_id", questCycleId)
      .eq("participation_type", "vote")
      .eq("payload->>voterKey", voterKey)
      .maybeSingle();
    throwIfError(error);
    return data;
  }

  async loadPrivateAcceptedVotesForSession(
    sessionId: string,
    voterKey: string,
  ): Promise<readonly unknown[]> {
    const { data, error } = await this.client
      .from("accepted_participation")
      .select("quest_cycle_id, candidate_id, accepted_at, payload")
      .eq("session_id", sessionId)
      .eq("participation_type", "vote")
      .eq("payload->>voterKey", voterKey);
    throwIfError(error);
    return data ?? [];
  }

  async loadReceiptStatesForSession(sessionId: string): Promise<readonly unknown[]> {
    const { data, error } = await this.client
      .from("command_receipts")
      .select("receipt")
      .eq("session_id", sessionId)
      .order("committed_revision", { ascending: true });
    throwIfError(error);
    return (data ?? []).map((row) => rowJson(row, "receipt"));
  }

  async loadSessionIdsForBroadcaster(
    broadcasterId: string,
    limit: number,
  ): Promise<readonly string[]> {
    const { data, error } = await this.client
      .from("stream_sessions")
      .select("session_id")
      .eq("broadcaster_id", broadcasterId)
      .order("updated_at", { ascending: false })
      .limit(limit);
    throwIfError(error);
    return (data ?? [])
      .map((row) => rowJson(row, "session_id"))
      .filter((sessionId): sessionId is string => typeof sessionId === "string");
  }

  async loadHostedSessionByRoomCode(roomCode: string): Promise<unknown | null> {
    const { data, error } = await this.client
      .from("stream_sessions")
      .select("current_state")
      .eq("room_code", roomCode)
      .maybeSingle();
    throwIfError(error);
    return data === null ? null : rowJson(data, "current_state");
  }

  async persistRoleSnapshots(views: RoleViewModels): Promise<void> {
    const { error } = await this.client.rpc("persist_role_snapshots", {
      p_session_id: views.streamer.envelope.sessionId,
      p_revision: views.streamer.envelope.revision,
      p_views: views,
      p_recorded_at_ms: views.streamer.envelope.receivedAt,
    });
    throwIfError(error);
  }

  async loadRoleSnapshot(sessionId: string, role: SnapshotRole): Promise<unknown | null> {
    const { data, error } = await this.client
      .from("public_session_snapshots")
      .select("snapshot")
      .eq("session_id", sessionId)
      .eq("view_role", role)
      .maybeSingle();
    throwIfError(error);
    return data === null ? null : rowJson(data, "snapshot");
  }

  async loadRealtimeAccessGrant(
    principalId: string,
    sessionId: string,
    viewRole: SnapshotRole,
  ): Promise<unknown | null> {
    const { data, error } = await this.client
      .from("realtime_access_grants")
      .select("principal_id, session_id, view_role, expires_at, revoked_at")
      .eq("principal_id", principalId)
      .eq("session_id", sessionId)
      .eq("view_role", viewRole)
      .maybeSingle();
    throwIfError(error);
    return data;
  }

  async grantRealtimeAccess(
    input: Omit<RealtimeAccessGrant, "revokedAt">,
  ): Promise<unknown> {
    const now = new Date().toISOString();
    const { data, error } = await this.client
      .from("realtime_access_grants")
      .upsert(
        {
          principal_id: input.principalId,
          session_id: input.sessionId,
          view_role: input.viewRole,
          expires_at: new Date(input.expiresAt).toISOString(),
          revoked_at: null,
          updated_at: now,
        },
        { onConflict: "principal_id,session_id,view_role" },
      )
      .select("principal_id, session_id, view_role, expires_at, revoked_at")
      .single();
    throwIfError(error);
    return data;
  }

  async revokeRealtimeAccess(
    principalId: string,
    sessionId: string,
    viewRole: SnapshotRole,
    revokedAt: number,
  ): Promise<void> {
    const { error } = await this.client
      .from("realtime_access_grants")
      .update({ revoked_at: new Date(revokedAt).toISOString(), updated_at: new Date(revokedAt).toISOString() })
      .eq("principal_id", principalId)
      .eq("session_id", sessionId)
      .eq("view_role", viewRole);
    throwIfError(error);
  }

  async canReadRealtimeSnapshot(
    principalId: string,
    sessionId: string,
    viewRole: SnapshotRole,
    at: number,
  ): Promise<boolean> {
    const { data, error } = await this.client
      .from("realtime_access_grants")
      .select("grant_id")
      .eq("principal_id", principalId)
      .eq("session_id", sessionId)
      .eq("view_role", viewRole)
      .is("revoked_at", null)
      .gt("expires_at", new Date(at).toISOString())
      .maybeSingle();
    throwIfError(error);
    return data !== null;
  }

  async bootstrap(input: BootstrapSessionInput): Promise<void> {
    const { error } = await this.client.rpc("bootstrap_chatxpt_session", {
      p_room_code: input.roomCode,
      p_state: input.state,
      p_created_at_ms: input.createdAt,
    });
    throwIfError(error);
  }

  async commitLifecycle(input: CommitSessionLifecycleInput): Promise<unknown> {
    const { data, error } = await this.client.rpc("commit_session_lifecycle", {
      p_session_id: input.sessionId,
      p_operation_id: input.operationId,
      p_action: input.action,
      p_expected_revision: input.expectedRevision,
      p_next_state: input.nextState,
      p_occurred_at_ms: input.occurredAt,
      p_end_reason: input.endReason,
    });
    throwIfError(error);
    return data;
  }

  async touchPresence(
    sessionId: string,
    action: SessionPresenceAction,
    occurredAt: number,
  ): Promise<unknown> {
    const { data, error } = await this.client.rpc("touch_session_presence", {
      p_session_id: sessionId,
      p_action: action,
      p_occurred_at_ms: occurredAt,
    });
    throwIfError(error);
    return data;
  }

  async loadDueStates(at: number): Promise<readonly unknown[]> {
    const preparingCutoff = new Date(at - PREPARING_SESSION_EXPIRY_MS).toISOString();
    const reconnectCutoff = new Date(at).toISOString();
    const [preparing, reconnecting] = await Promise.all([
      this.client
        .from("stream_sessions")
        .select("current_state")
        .eq("status", "preparing")
        .lte("last_activity_at", preparingCutoff),
      this.client
        .from("stream_sessions")
        .select("current_state")
        .eq("status", "live")
        .not("reconnect_deadline_at", "is", null)
        .lte("reconnect_deadline_at", reconnectCutoff),
    ]);
    throwIfError(preparing.error);
    throwIfError(reconnecting.error);
    return [...(preparing.data ?? []), ...(reconnecting.data ?? [])].map((row) =>
      rowJson(row, "current_state"),
    );
  }

  async loadDueVoteCycleStates(at: number): Promise<readonly unknown[]> {
    const { data, error } = await this.client.rpc("due_vote_cycle_states", {
      p_due_at_ms: at,
    });
    throwIfError(error);
    return data ?? [];
  }

  async probe(checkedAt = Date.now()): Promise<ServiceHealth> {
    const { error } = await this.client
      .from("stream_sessions")
      .select("session_id", { count: "exact", head: true });
    return serviceHealthSchema.parse(
      error === null
        ? {
            service: "persistence",
            status: "ready",
            checkedAt,
            message: "Supabase schema and service credentials are reachable",
            retryable: false,
          }
        : {
            service: "persistence",
            status: "unavailable",
            checkedAt,
            message: "Supabase persistence is configured but unavailable",
            retryable: true,
          },
    );
  }
}

export class SupabaseSessionStateRepository {
  constructor(private readonly api: SupabaseChatXptDataApi) {}

  async load(sessionId: string): Promise<AuthoritativeSessionState | null> {
    const raw = await this.api.loadState(sessionId);
    return raw === null ? null : authoritativeSessionStateSchema.parse(raw);
  }

  async findReceipt(commandId: string): Promise<AcceptedCommandReceipt | null> {
    const raw = await this.api.loadReceipt(commandId);
    return raw === null ? null : acceptedCommandReceiptSchema.parse(raw);
  }

  async commit(input: CommitAuthoritativeStateInput): Promise<CommitAuthoritativeStateResult> {
    try {
      return commitResultSchema.parse(await this.api.commitState(input));
    } catch (caught) {
      if (caught instanceof SupabaseDataError && caught.code === "23505") {
        const evidence = `${caught.message} ${caught.details ?? ""}`;
        if (evidence.includes("accepted_participation_one_vote_per_voter_cycle")) {
          return { status: "participation-conflict", reason: "vote-already-accepted" };
        }
      }
      throw caught;
    }
  }
}

export class SupabaseAcceptedVoteTallyReader implements AcceptedVoteTallyReader {
  constructor(private readonly api: SupabaseChatXptDataApi) {}

  async readAcceptedVoteTally(
    input: AcceptedVoteTallyReadInput,
  ): Promise<AcceptedVoteTallySnapshot> {
    const counts = new Map(input.candidateIds.map((candidateId) => [candidateId, 0]));
    const rows = z
      .array(acceptedVoteRowSchema)
      .parse(
        await this.api.loadAcceptedVotes(
          input.sessionId,
          input.questCycleId,
          input.acceptedBefore,
        ),
      );
    for (const row of rows) {
      const current = counts.get(row.candidate_id);
      if (current === undefined) {
        throw new Error("Accepted vote references a candidate outside the closing cycle");
      }
      counts.set(row.candidate_id, current + 1);
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
}

export class SupabaseDueVoteCycleReader implements DueVoteCycleReader {
  constructor(private readonly api: SupabaseChatXptDataApi) {}

  async dueVoteCycles(at: number): Promise<readonly AuthoritativeSessionState[]> {
    return (await this.api.loadDueVoteCycleStates(at)).map((state) =>
      authoritativeSessionStateSchema.parse(state),
    );
  }
}

export class SupabaseCandidateBatchRepository implements CandidateBatchRepository {
  constructor(private readonly api: SupabaseChatXptDataApi) {}

  async store(batch: CandidateBatch): Promise<void> {
    const parsed = candidateBatchSchema.parse(batch);
    try {
      await this.api.storeCandidateBatch(parsed);
    } catch (caught) {
      if (!(caught instanceof SupabaseDataError) || caught.code !== "23505") throw caught;
      const existing = await this.read(parsed.envelope.messageId, parsed.envelope.sessionId);
      if (
        existing !== null &&
        canonicalJsonStringify(existing) === canonicalJsonStringify(parsed)
      ) return;
      throw new PersistenceConflictError("unknown", "Candidate batch ID was reused");
    }
  }

  async read(candidateBatchId: string, sessionId: string): Promise<CandidateBatch | null> {
    const raw = await this.api.loadCandidateBatch(candidateBatchId, sessionId);
    return raw === null ? null : candidateBatchSchema.parse(raw);
  }
}

function parseRoleSnapshot<Role extends SnapshotRole>(role: Role, raw: unknown): RoleViewModels[Role] {
  const schemas = {
    streamer: streamerViewModelSchema,
    viewer: viewerViewModelSchema,
    overlay: overlayViewModelSchema,
  } as const;
  return schemas[role].parse(raw) as RoleViewModels[Role];
}

export class SupabaseRoleSnapshotPublisher implements RoleSnapshotPublisher {
  constructor(private readonly api: SupabaseChatXptDataApi) {}

  async publish(views: RoleViewModels): Promise<void> {
    const parsed = sanitizeRoleViewsForBroadcast(views);
    await this.api.persistRoleSnapshots(parsed);
  }

  async readSnapshot<Role extends SnapshotRole>(
    sessionId: string,
    role: Role,
  ): Promise<RoleViewModels[Role] | null> {
    const raw = await this.api.loadRoleSnapshot(sessionId, role);
    return raw === null ? null : parseRoleSnapshot(role, raw);
  }
}

const realtimeAccessGrantRowSchema = z
  .object({
    principal_id: z.uuid(),
    session_id: z.string().min(1).max(128),
    view_role: z.enum(["streamer", "viewer", "overlay"]),
    expires_at: z.iso.datetime({ offset: true }),
    revoked_at: z.iso.datetime({ offset: true }).nullable(),
  })
  .passthrough();

export class SupabaseRealtimeAccessGrantStore implements RealtimeAccessGrantStore {
  constructor(private readonly api: SupabaseChatXptDataApi) {}

  async grant(input: Omit<RealtimeAccessGrant, "revokedAt">): Promise<RealtimeAccessGrant> {
    if (!z.uuid().safeParse(input.principalId).success || input.expiresAt <= Date.now()) {
      throw new Error("Realtime access grant principal or expiry is invalid");
    }
    const row = realtimeAccessGrantRowSchema.parse(await this.api.grantRealtimeAccess(input));
    return {
      principalId: row.principal_id,
      sessionId: row.session_id,
      viewRole: row.view_role,
      expiresAt: Date.parse(row.expires_at),
      revokedAt: row.revoked_at === null ? null : Date.parse(row.revoked_at),
    };
  }

  revoke(
    principalId: string,
    sessionId: string,
    viewRole: SnapshotRole,
    revokedAt: number,
  ): Promise<void> {
    return this.api.revokeRealtimeAccess(principalId, sessionId, viewRole, revokedAt);
  }

  canRead(
    principalId: string,
    sessionId: string,
    viewRole: SnapshotRole,
    at: number,
  ): Promise<boolean> {
    return this.api.canReadRealtimeSnapshot(principalId, sessionId, viewRole, at);
  }
}

export class SupabaseViewerParticipationReceiptReader
  implements ViewerParticipationReceiptReader
{
  constructor(private readonly api: SupabaseChatXptDataApi) {}

  async readViewerParticipationReceipt(
    input: ViewerParticipationReceiptReadInput,
  ) {
    const rawGrant = await this.api.loadRealtimeAccessGrant(
      input.principalId,
      input.sessionId,
      "viewer",
    );
    if (rawGrant === null) {
      return viewerParticipationReceiptReadResultSchema.parse({
        status: "forbidden",
        error: {
          code: "forbidden",
          message: "Viewer receipt access is not authorised for this session",
          retryable: false,
        },
      });
    }
    const grant = realtimeAccessGrantRowSchema.parse(rawGrant);
    const expiresAt = Date.parse(grant.expires_at);
    if (grant.revoked_at !== null) {
      return viewerParticipationReceiptReadResultSchema.parse({
        status: "forbidden",
        error: {
          code: "forbidden",
          message: "Viewer receipt access was revoked for this session",
          retryable: false,
        },
      });
    }
    if (expiresAt <= input.at) {
      return viewerParticipationReceiptReadResultSchema.parse({
        status: "expired",
        error: {
          code: "expired",
          message: "Viewer receipt access expired; reconnect through an allowed viewer path",
          retryable: true,
        },
      });
    }

    const state = await new SupabaseSessionStateRepository(this.api).load(input.sessionId);
    if (
      state === null ||
      state.questCycle.envelope.questCycleId !== input.questCycleId
    ) {
      return viewerParticipationReceiptReadResultSchema.parse({
        status: "not-found",
        receipt: null,
      });
    }

    const voterKey = derivePrivateViewerVoterKey(input);
    const voteRow = privateAcceptedVoteRowSchema
      .nullable()
      .parse(
        await this.api.loadPrivateAcceptedVote(
          input.sessionId,
          input.questCycleId,
          voterKey,
        ),
      );
    const sessionPoints = await this.sessionPointsFor(input.sessionId, voterKey);

    return viewerParticipationReceiptReadResultSchema.parse({
      status: "available",
      receipt: {
        envelope: {
          contractVersion: "1.0.0",
          sessionId: input.sessionId,
          questCycleId: input.questCycleId,
          messageId: "viewer-receipt",
          correlationId: input.principalId,
          revision: state.session.revision,
          occurredAt: voteRow === null ? input.at : Date.parse(voteRow.accepted_at),
          receivedAt: input.at,
          source: "orchestrator",
          evidenceClass: state.questCycle.envelope.evidenceClass,
        },
        principalId: input.principalId,
        voterKey,
        identityKind: input.identityKind,
        sourceMode: voteRow?.payload.sourceMode ?? null,
        acceptedCandidateId: voteRow?.candidate_id ?? null,
        acceptedAt: voteRow === null ? null : Date.parse(voteRow.accepted_at),
        sessionPoints,
        reconnectExpiresAt: expiresAt,
      },
    });
  }

  private async sessionPointsFor(sessionId: string, voterKey: string): Promise<number> {
    const [votes, receipts] = await Promise.all([
      this.api.loadPrivateAcceptedVotesForSession(sessionId, voterKey),
      this.api.loadReceiptStatesForSession(sessionId),
    ]);
    const parsedVotes = z.array(privateAcceptedVoteWithCycleRowSchema).parse(votes);
    const cycleResults = new Map<
      string,
      { activeCandidateId: string | null; points: number; outcome: string }
    >();
    for (const rawReceipt of receipts) {
      const receipt = acceptedCommandReceiptSchema.parse(rawReceipt);
      if (receipt.state.session.sessionId !== sessionId) continue;
      const questCycleId = receipt.state.questCycle.envelope.questCycleId;
      const result = receipt.state.questCycle.result;
      if (questCycleId === null || result === null) continue;
      cycleResults.set(questCycleId, {
        activeCandidateId: receipt.state.questCycle.activeCandidateId,
        points: result.rewardPointsAwarded,
        outcome: result.outcome,
      });
    }

    return parsedVotes.reduce((total, vote) => {
      if (vote.quest_cycle_id === null) return total;
      const result = cycleResults.get(vote.quest_cycle_id);
      if (
        result?.outcome === "succeeded" &&
        result.activeCandidateId === vote.candidate_id
      ) {
        return total + result.points;
      }
      return total;
    }, 0);
  }
}

export class SupabaseSessionHistoryReader implements SessionHistoryReader {
  constructor(private readonly api: SupabaseChatXptDataApi) {}

  async readSessionHistory(input: SessionHistoryReadInput): Promise<SessionHistorySnapshot> {
    const sessionIds = await this.api.loadSessionIdsForBroadcaster(
      input.broadcasterId,
      input.limit ?? 25,
    );
    const receipts = (
      await Promise.all(
        sessionIds.map((sessionId) => this.api.loadReceiptStatesForSession(sessionId)),
      )
    )
      .flat()
      .map((rawReceipt) => acceptedCommandReceiptSchema.parse(rawReceipt));

    return buildSessionHistoryFromReceipts({
      broadcasterId: input.broadcasterId,
      receipts,
      generatedAt: input.at,
      limit: input.limit,
      source: "orchestrator",
      evidenceClass: receipts.some(
        (receipt) => receipt.state.questCycle.envelope.evidenceClass === "live",
      )
        ? "live"
        : "diagnostic",
    });
  }
}

export class SupabaseHostedBoardAccessResolver implements HostedBoardAccessResolver {
  constructor(
    private readonly api: SupabaseChatXptDataApi,
    private readonly grants: RealtimeAccessGrantStore,
  ) {}

  async resolveHostedBoardAccess(input: HostedBoardAccessInput) {
    const roomCode = input.roomCode.trim().toUpperCase();
    if (!/^[A-HJ-NP-Z2-9]{8}$/.test(roomCode)) {
      return hostedBoardAccessResultSchema.parse({
        status: "invalid-room",
        error: {
          code: "validation",
          message: "Hosted Quest Board room code is invalid",
          retryable: false,
        },
      });
    }

    const state = authoritativeSessionStateSchema
      .nullable()
      .parse(await this.api.loadHostedSessionByRoomCode(roomCode));
    if (state === null) {
      return hostedBoardAccessResultSchema.parse({
        status: "invalid-room",
        error: {
          code: "validation",
          message: "Hosted Quest Board room was not found",
          retryable: false,
        },
      });
    }
    if (!sessionActive(state.session.status)) {
      return hostedBoardAccessResultSchema.parse({
        status: "expired-session",
        error: {
          code: "expired",
          message: "Hosted Quest Board room is no longer active",
          retryable: false,
        },
      });
    }
    if (!state.session.capabilities.hostedViewerBoard) {
      return hostedBoardAccessResultSchema.parse({
        status: "unavailable",
        error: {
          code: "unavailable-capability",
          message: "Hosted Quest Board fallback is unavailable for this session",
          retryable: true,
        },
      });
    }
    if (input.grantExpiresAt <= input.at) {
      return hostedBoardAccessResultSchema.parse({
        status: "unavailable",
        error: {
          code: "expired",
          message: "Hosted Quest Board grant expiry must be in the future",
          retryable: true,
        },
      });
    }

    await this.grants.grant({
      principalId: input.principalId,
      sessionId: state.session.sessionId,
      viewRole: "viewer",
      expiresAt: input.grantExpiresAt,
    });

    const directUrl = new URL(
      `/quest-board/${roomCode}?sessionId=${state.session.sessionId}`,
      input.baseUrl,
    );
    const shareUrl = new URL(`/quest-board/${roomCode}`, input.baseUrl);
    return hostedBoardAccessResultSchema.parse({
      status: "available",
      access: {
        sessionId: state.session.sessionId,
        roomCode,
        principalId: input.principalId,
        directUrl: directUrl.toString(),
        shareUrl: shareUrl.toString(),
        shareText: `Join ChatXPT room ${roomCode} to vote on this stream's sidequest.`,
        qrPayload: input.includeQrPayload === true ? shareUrl.toString() : null,
        grantExpiresAt: input.grantExpiresAt,
      },
    });
  }
}

function conflictFrom(error: SupabaseDataError): PersistenceConflictError | null {
  if (error.code !== "23505") return null;
  const evidence = `${error.message} ${error.details ?? ""}`;
  if (evidence.includes("stream_sessions_room_code_key")) {
    return new PersistenceConflictError("room-code", "Room code already exists");
  }
  if (evidence.includes("stream_sessions_one_active_broadcaster")) {
    return new PersistenceConflictError("active-broadcaster", "Broadcaster already has an active session");
  }
  if (evidence.includes("stream_sessions_pkey")) {
    return new PersistenceConflictError("session-id", "Session ID already exists");
  }
  return new PersistenceConflictError("unknown", "Supabase uniqueness constraint rejected session");
}

export class SupabaseSessionLifecycleStore implements SessionLifecycleStore {
  constructor(
    private readonly api: SupabaseChatXptDataApi,
    private readonly states: SupabaseSessionStateRepository,
  ) {}

  async bootstrap(input: BootstrapSessionInput): Promise<void> {
    try {
      await this.api.bootstrap(input);
    } catch (caught) {
      if (caught instanceof SupabaseDataError) {
        const conflict = conflictFrom(caught);
        if (conflict !== null) throw conflict;
      }
      throw caught;
    }
  }

  load(sessionId: string): Promise<AuthoritativeSessionState | null> {
    return this.states.load(sessionId);
  }

  async findOperation(operationId: string): Promise<SessionLifecycleCommitResult | null> {
    const raw = await this.api.loadLifecycleOperation(operationId);
    if (raw === null) return null;
    return lifecycleCommitResultSchema.options[0].shape.result.parse(raw);
  }

  async commitLifecycle(input: CommitSessionLifecycleInput): Promise<LifecycleStoreCommitResult> {
    return lifecycleCommitResultSchema.parse(await this.api.commitLifecycle(input)) as LifecycleStoreCommitResult;
  }

  async touch(
    sessionId: string,
    action: SessionPresenceAction,
    occurredAt: number,
  ): Promise<SessionPresenceResult | null> {
    const parsed = presenceResultSchema.parse(
      await this.api.touchPresence(sessionId, action, occurredAt),
    );
    return parsed.status === "not-live" ? null : parsed.result;
  }

  async due(at: number): Promise<readonly AuthoritativeSessionState[]> {
    return (await this.api.loadDueStates(at)).map((state) =>
      authoritativeSessionStateSchema.parse(state),
    );
  }
}

export function createSupabaseServerClient(
  environment: SupabasePersistenceEnvironment,
): SupabaseClient {
  return createClient(environment.url, environment.secretKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
    global: { headers: { "X-Client-Info": "chatxpt-role1/0.1.0" } },
  });
}

export function createSupabasePersistenceRuntime(
  environment: SupabasePersistenceEnvironment,
): ChatXptPersistenceRuntime & {
  readonly api: SupabaseChatXptDataApi;
  probe(checkedAt?: number): Promise<ServiceHealth>;
} {
  const api = new SupabaseChatXptDataApi(createSupabaseServerClient(environment));
  const sessions = new SupabaseSessionStateRepository(api);
  const acceptedVotes = new SupabaseAcceptedVoteTallyReader(api);
  const snapshots = new SupabaseRoleSnapshotPublisher(api);
  const dueVotes = new SupabaseDueVoteCycleReader(api);
  const accessGrants = new SupabaseRealtimeAccessGrantStore(api);
  return {
    mode: "supabase",
    api,
    sessions,
    lifecycle: new SupabaseSessionLifecycleStore(api, sessions),
    candidates: new SupabaseCandidateBatchRepository(api),
    acceptedVotes,
    viewerReceipts: new SupabaseViewerParticipationReceiptReader(api),
    hostedBoardAccess: new SupabaseHostedBoardAccessResolver(api, accessGrants),
    sessionHistory: new SupabaseSessionHistoryReader(api),
    snapshots,
    accessGrants,
    dueVotes,
    probe: (checkedAt) => api.probe(checkedAt),
  };
}
