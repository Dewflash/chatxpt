import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import {
  acceptedVoteTallySnapshotSchema,
  acceptedCommandReceiptSchema,
  authoritativeSessionStateSchema,
  canonicalJsonStringify,
  candidateBatchSchema,
  gameplaySnapshotSchema,
  overlayViewModelSchema,
  serviceHealthSchema,
  streamerProfileSchema,
  streamerViewModelSchema,
  viewerRecoveryStateSchema,
  viewerViewModelSchema,
  type SessionHistorySnapshot,
  type AcceptedCommandReceipt,
  type AcceptedVoteTallyReadInput,
  type AcceptedVoteTallyReader,
  type AcceptedVoteTallySnapshot,
  type AuthoritativeSessionState,
  type CandidateBatch,
  type CommitAuthoritativeStateInput,
  type CommitAuthoritativeStateResult,
  type CurrentGameplaySnapshotReadInput,
  type CurrentGameplaySnapshotRepository,
  type GameplaySnapshot,
  type IngestGameplaySnapshotResult,
  type RoleViewModels,
  type ServiceHealth,
  type StreamerProfile,
  type ViewerRecoveryReadInput,
  type ViewerRecoveryReader,
  type ViewerRecoveryState,
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
  type HostedBoardSessionDirectory,
  type HostedBoardSessionRecord,
  type LifecycleStoreCommitResult,
  type ObsOverlayConnectionRecord,
  type ObsOverlayConnectionStore,
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
  type StreamerProfileRecord,
  type StreamerProfileRepository,
  type StreamerProfileResolution,
  type TwitchChannelSessionDirectory,
  type TwitchChannelSessionRecord,
  type VerifiedStreamerIdentity,
} from "./types";
import { sanitizeRoleViewsForBroadcast } from "./sanitization";
import { buildSessionHistoryFromReceipts } from "./session-history";
import { EphemeralAudiencePointerAggregateRepository } from "./live-director-context";

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

const ingestGameplaySnapshotResultSchema = z.discriminatedUnion("status", [
  z.object({ status: z.enum(["accepted", "duplicate"]), snapshot: gameplaySnapshotSchema }).strict(),
  z
    .object({
      status: z.literal("rejected"),
      reason: z.enum(["session-missing", "session-inactive", "state-mismatch", "older-snapshot"]),
    })
    .strict(),
]);

const acceptedVoteRowSchema = z.object({ candidate_id: z.string().min(1).max(128) }).passthrough();
const acceptedVoteRecoveryRowSchema = z
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
const viewerSessionPointsRowSchema = z
  .object({ session_points: z.number().int().nonnegative().max(100_000) })
  .passthrough();
const hostedBoardSessionRowSchema = z
  .object({
    session_id: z.string().min(1).max(128),
    room_code: z.string().regex(/^[A-HJ-NP-Z2-9]{8}$/),
    status: z.enum(["offline", "preparing", "live", "ended"]),
    revision: z.number().int().nonnegative(),
  })
  .passthrough();
const twitchChannelSessionRowSchema = z
  .object({
    session_id: z.string().min(1).max(128),
    broadcaster_id: z.string().min(1).max(128),
    status: z.enum(["offline", "preparing", "live", "ended"]),
    revision: z.number().int().nonnegative(),
  })
  .passthrough();
const obsOverlayConnectionRowSchema = z
  .object({
    broadcaster_id: z.string().min(1).max(128),
    grant_id: z.string().min(1).max(128),
    issued_at: z.iso.datetime({ offset: true }),
    last_seen_at: z.iso.datetime({ offset: true }).nullable(),
    last_session_id: z.string().min(1).max(128).nullable(),
    revoked_at: z.iso.datetime({ offset: true }).nullable(),
  })
  .passthrough();
const streamerProfileRowSchema = z
  .object({
    account_id: z.uuid(),
    profile: streamerProfileSchema,
    created_at: z.iso.datetime({ offset: true }),
    updated_at: z.iso.datetime({ offset: true }),
  })
  .passthrough();
const streamerProfileResolutionSchema = z
  .object({
    accountId: z.uuid(),
    profile: streamerProfileSchema,
    createdAt: z.number().int().nonnegative(),
    updatedAt: z.number().int().nonnegative(),
    created: z.boolean(),
  })
  .strict();

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

export class SupabaseChatXptDataApi {
  constructor(private readonly client: SupabaseClient) {}

  async loadStreamerProfile(streamerId: string): Promise<unknown | null> {
    const { data, error } = await this.client
      .from("streamer_profiles")
      .select("account_id, profile, created_at, updated_at")
      .eq("streamer_id", streamerId)
      .maybeSingle();
    throwIfError(error);
    return data;
  }

  async getOrCreateStreamerProfile(
    identity: VerifiedStreamerIdentity,
    defaults: StreamerProfile,
  ): Promise<unknown> {
    const { data, error } = await this.client.rpc("get_or_create_streamer_profile", {
      p_provider: identity.provider,
      p_provider_subject_id: identity.providerSubjectId,
      p_display_name: identity.displayName,
      p_default_profile: defaults,
      p_verified_at_ms: identity.verifiedAt,
    });
    throwIfError(error);
    return data;
  }

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

  async loadReceiptsForBroadcaster(broadcasterId: string, limit: number): Promise<readonly unknown[]> {
    const { data, error } = await this.client
      .from("command_receipts")
      .select("receipt, stream_sessions!inner(broadcaster_id)")
      .eq("stream_sessions.broadcaster_id", broadcasterId)
      .order("committed_revision", { ascending: false })
      .limit(limit);
    throwIfError(error);
    return (data ?? []).map((row) => rowJson(row, "receipt"));
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

  async ingestGameplaySnapshot(snapshot: GameplaySnapshot): Promise<unknown> {
    const { data, error } = await this.client.rpc("ingest_gameplay_snapshot", {
      p_snapshot: snapshot,
    });
    throwIfError(error);
    return data;
  }

  async loadCurrentGameplaySnapshot(sessionId: string): Promise<unknown | null> {
    const { data, error } = await this.client
      .from("current_gameplay_snapshots")
      .select("snapshot")
      .eq("session_id", sessionId)
      .maybeSingle();
    throwIfError(error);
    return data === null ? null : rowJson(data, "snapshot");
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

  async loadViewerAcceptedVote(
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

  async loadViewerSessionPoints(sessionId: string, voterKey: string): Promise<unknown | null> {
    const { data, error } = await this.client
      .from("viewer_session_points")
      .select("session_points")
      .eq("session_id", sessionId)
      .eq("voter_key", voterKey)
      .maybeSingle();
    throwIfError(error);
    return data;
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

  async loadHostedBoardSession(roomCode: string): Promise<unknown | null> {
    const { data, error } = await this.client
      .from("stream_sessions")
      .select("session_id, room_code, status, revision")
      .eq("room_code", roomCode)
      .maybeSingle();
    throwIfError(error);
    return data;
  }

  async loadHostedBoardSessionBySessionId(sessionId: string): Promise<unknown | null> {
    const { data, error } = await this.client
      .from("stream_sessions")
      .select("session_id, room_code, status, revision")
      .eq("session_id", sessionId)
      .maybeSingle();
    throwIfError(error);
    return data;
  }

  async loadTwitchChannelSession(channelId: string): Promise<unknown | null> {
    const { data, error } = await this.client
      .from("stream_sessions")
      .select("session_id, broadcaster_id, status, revision")
      .eq("broadcaster_id", channelId)
      .in("status", ["preparing", "live"])
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    throwIfError(error);
    return data;
  }

  async replaceObsOverlayConnection(
    input: Omit<ObsOverlayConnectionRecord, "lastSeenAt" | "lastSessionId" | "revokedAt">,
  ): Promise<unknown> {
    const issuedAt = new Date(input.issuedAt).toISOString();
    const { data, error } = await this.client
      .from("obs_overlay_connections")
      .upsert(
        {
          broadcaster_id: input.broadcasterId,
          grant_id: input.grantId,
          issued_at: issuedAt,
          last_seen_at: null,
          last_session_id: null,
          revoked_at: null,
          updated_at: issuedAt,
        },
        { onConflict: "broadcaster_id" },
      )
      .select("broadcaster_id, grant_id, issued_at, last_seen_at, last_session_id, revoked_at")
      .single();
    throwIfError(error);
    return data;
  }

  async loadObsOverlayConnection(broadcasterId: string): Promise<unknown | null> {
    const { data, error } = await this.client
      .from("obs_overlay_connections")
      .select("broadcaster_id, grant_id, issued_at, last_seen_at, last_session_id, revoked_at")
      .eq("broadcaster_id", broadcasterId)
      .maybeSingle();
    throwIfError(error);
    return data;
  }

  async touchObsOverlayConnection(
    broadcasterId: string,
    grantId: string,
    sessionId: string | null,
    seenAt: number,
  ): Promise<unknown | null> {
    const timestamp = new Date(seenAt).toISOString();
    const { data, error } = await this.client
      .from("obs_overlay_connections")
      .update({ last_seen_at: timestamp, last_session_id: sessionId, updated_at: timestamp })
      .eq("broadcaster_id", broadcasterId)
      .eq("grant_id", grantId)
      .is("revoked_at", null)
      .select("broadcaster_id, grant_id, issued_at, last_seen_at, last_session_id, revoked_at")
      .maybeSingle();
    throwIfError(error);
    return data;
  }

  async revokeObsOverlayConnection(
    broadcasterId: string,
    revokedAt: number,
  ): Promise<unknown | null> {
    const timestamp = new Date(revokedAt).toISOString();
    const { data, error } = await this.client
      .from("obs_overlay_connections")
      .update({ revoked_at: timestamp, updated_at: timestamp })
      .eq("broadcaster_id", broadcasterId)
      .is("revoked_at", null)
      .select("broadcaster_id, grant_id, issued_at, last_seen_at, last_session_id, revoked_at")
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

export class SupabaseStreamerProfileRepository implements StreamerProfileRepository {
  constructor(private readonly api: SupabaseChatXptDataApi) {}

  async loadByStreamerId(streamerId: string): Promise<StreamerProfileRecord | null> {
    const raw = await this.api.loadStreamerProfile(streamerId);
    if (raw === null) return null;
    const row = streamerProfileRowSchema.parse(raw);
    return {
      accountId: row.account_id,
      profile: row.profile,
      createdAt: Date.parse(row.created_at),
      updatedAt: Date.parse(row.updated_at),
    };
  }

  async getOrCreateForVerifiedIdentity(
    identity: VerifiedStreamerIdentity,
    defaults: StreamerProfile,
  ): Promise<StreamerProfileResolution> {
    return streamerProfileResolutionSchema.parse(
      await this.api.getOrCreateStreamerProfile(identity, defaults),
    );
  }

  async getOrCreateForDiagnostic(
    defaults: StreamerProfile,
    at: number,
  ): Promise<StreamerProfileResolution> {
    void defaults;
    void at;
    throw new PersistenceConflictError(
      "profile",
      "Diagnostic sessions cannot read or create cloud streamer profiles",
    );
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

export class SupabaseViewerRecoveryReader implements ViewerRecoveryReader {
  constructor(private readonly api: SupabaseChatXptDataApi) {}

  async readViewerRecovery(input: ViewerRecoveryReadInput): Promise<ViewerRecoveryState> {
    const [raw, rawPoints] = await Promise.all([
      this.api.loadViewerAcceptedVote(input.sessionId, input.questCycleId, input.voterKey),
      this.api.loadViewerSessionPoints(input.sessionId, input.voterKey),
    ]);
    const sessionPoints = rawPoints === null
      ? 0
      : viewerSessionPointsRowSchema.parse(rawPoints).session_points;
    if (raw === null) {
      return viewerRecoveryStateSchema.parse({
        sessionId: input.sessionId,
        questCycleId: input.questCycleId,
        acceptedCandidateId: null,
        acceptedAt: null,
        sessionPoints,
        sourceMode: null,
      });
    }
    const row = acceptedVoteRecoveryRowSchema.parse(raw);
    return viewerRecoveryStateSchema.parse({
      sessionId: input.sessionId,
      questCycleId: input.questCycleId,
      acceptedCandidateId: row.candidate_id,
      acceptedAt: Date.parse(row.accepted_at),
      sessionPoints,
      sourceMode: row.payload.sourceMode,
    });
  }
}

export class SupabaseSessionHistoryReader implements SessionHistoryReader {
  constructor(private readonly api: SupabaseChatXptDataApi) {}

  async readSessionHistory(input: SessionHistoryReadInput): Promise<SessionHistorySnapshot> {
    const limit = input.limit === undefined ? 25 : Math.min(100, Math.max(1, Math.trunc(input.limit)));
    const receipts = z
      .array(acceptedCommandReceiptSchema)
      .parse(await this.api.loadReceiptsForBroadcaster(input.broadcasterId, limit * 4));
    return buildSessionHistoryFromReceipts({
      broadcasterId: input.broadcasterId,
      receipts,
      generatedAt: input.at,
      limit,
      source: "orchestrator",
      evidenceClass: "live",
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

export class SupabaseCurrentGameplaySnapshotRepository
  implements CurrentGameplaySnapshotRepository
{
  constructor(private readonly api: SupabaseChatXptDataApi) {}

  async ingest(snapshot: GameplaySnapshot): Promise<IngestGameplaySnapshotResult> {
    const parsed = gameplaySnapshotSchema.parse(snapshot);
    return ingestGameplaySnapshotResultSchema.parse(
      await this.api.ingestGameplaySnapshot(parsed),
    );
  }

  async readCurrent(input: CurrentGameplaySnapshotReadInput): Promise<GameplaySnapshot | null> {
    const raw = await this.api.loadCurrentGameplaySnapshot(input.sessionId);
    if (raw === null) return null;
    const snapshot = gameplaySnapshotSchema.parse(raw);
    if (
      snapshot.envelope.questCycleId !== input.questCycleId ||
      snapshot.envelope.revision !== input.revision ||
      snapshot.envelope.evidenceClass !== input.evidenceClass
    ) {
      return null;
    }
    return snapshot;
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

export class SupabaseHostedBoardSessionDirectory implements HostedBoardSessionDirectory {
  constructor(private readonly api: SupabaseChatXptDataApi) {}

  async findHostedBoardSession(roomCode: string): Promise<HostedBoardSessionRecord | null> {
    const raw = await this.api.loadHostedBoardSession(roomCode);
    if (raw === null) return null;
    const row = hostedBoardSessionRowSchema.parse(raw);
    return {
      sessionId: row.session_id,
      roomCode: row.room_code,
      status: row.status,
      revision: row.revision,
    };
  }

  async findHostedBoardSessionBySessionId(sessionId: string): Promise<HostedBoardSessionRecord | null> {
    const raw = await this.api.loadHostedBoardSessionBySessionId(sessionId);
    if (raw === null) return null;
    const row = hostedBoardSessionRowSchema.parse(raw);
    return {
      sessionId: row.session_id,
      roomCode: row.room_code,
      status: row.status,
      revision: row.revision,
    };
  }
}

export class SupabaseTwitchChannelSessionDirectory implements TwitchChannelSessionDirectory {
  constructor(private readonly api: SupabaseChatXptDataApi) {}

  async findTwitchChannelSession(channelId: string): Promise<TwitchChannelSessionRecord | null> {
    const raw = await this.api.loadTwitchChannelSession(channelId);
    if (raw === null) return null;
    const row = twitchChannelSessionRowSchema.parse(raw);
    return {
      sessionId: row.session_id,
      channelId: row.broadcaster_id,
      status: row.status,
      revision: row.revision,
    };
  }
}

function obsOverlayConnectionRecord(row: z.infer<typeof obsOverlayConnectionRowSchema>) {
  return {
    broadcasterId: row.broadcaster_id,
    grantId: row.grant_id,
    issuedAt: Date.parse(row.issued_at),
    lastSeenAt: row.last_seen_at === null ? null : Date.parse(row.last_seen_at),
    lastSessionId: row.last_session_id,
    revokedAt: row.revoked_at === null ? null : Date.parse(row.revoked_at),
  } satisfies ObsOverlayConnectionRecord;
}

export class SupabaseObsOverlayConnectionStore implements ObsOverlayConnectionStore {
  constructor(private readonly api: SupabaseChatXptDataApi) {}

  async replaceObsOverlayConnection(
    input: Omit<ObsOverlayConnectionRecord, "lastSeenAt" | "lastSessionId" | "revokedAt">,
  ): Promise<ObsOverlayConnectionRecord> {
    return obsOverlayConnectionRecord(
      obsOverlayConnectionRowSchema.parse(await this.api.replaceObsOverlayConnection(input)),
    );
  }

  async findObsOverlayConnection(
    broadcasterId: string,
  ): Promise<ObsOverlayConnectionRecord | null> {
    const raw = await this.api.loadObsOverlayConnection(broadcasterId);
    return raw === null
      ? null
      : obsOverlayConnectionRecord(obsOverlayConnectionRowSchema.parse(raw));
  }

  async touchObsOverlayConnection(
    broadcasterId: string,
    grantId: string,
    sessionId: string | null,
    seenAt: number,
  ): Promise<ObsOverlayConnectionRecord | null> {
    const raw = await this.api.touchObsOverlayConnection(
      broadcasterId,
      grantId,
      sessionId,
      seenAt,
    );
    return raw === null
      ? null
      : obsOverlayConnectionRecord(obsOverlayConnectionRowSchema.parse(raw));
  }

  async revokeObsOverlayConnection(
    broadcasterId: string,
    revokedAt: number,
  ): Promise<ObsOverlayConnectionRecord | null> {
    const raw = await this.api.revokeObsOverlayConnection(broadcasterId, revokedAt);
    return raw === null
      ? null
      : obsOverlayConnectionRecord(obsOverlayConnectionRowSchema.parse(raw));
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
  const profiles = new SupabaseStreamerProfileRepository(api);
  const sessions = new SupabaseSessionStateRepository(api);
  const acceptedVotes = new SupabaseAcceptedVoteTallyReader(api);
  const gameplaySnapshots = new SupabaseCurrentGameplaySnapshotRepository(api);
  const viewerRecovery = new SupabaseViewerRecoveryReader(api);
  const sessionHistory = new SupabaseSessionHistoryReader(api);
  const snapshots = new SupabaseRoleSnapshotPublisher(api);
  const hostedBoardSessions = new SupabaseHostedBoardSessionDirectory(api);
  const twitchChannelSessions = new SupabaseTwitchChannelSessionDirectory(api);
  const obsOverlayConnections = new SupabaseObsOverlayConnectionStore(api);
  const dueVotes = new SupabaseDueVoteCycleReader(api);
  return {
    mode: "supabase",
    api,
    profiles,
    sessions,
    lifecycle: new SupabaseSessionLifecycleStore(api, sessions),
    hostedBoardSessions,
    twitchChannelSessions,
    obsOverlayConnections,
    candidates: new SupabaseCandidateBatchRepository(api),
    audiencePointers: new EphemeralAudiencePointerAggregateRepository(),
    acceptedVotes,
    gameplaySnapshots,
    snapshots,
    accessGrants: new SupabaseRealtimeAccessGrantStore(api),
    dueVotes,
    viewerRecovery,
    sessionHistory,
    probe: (checkedAt) => api.probe(checkedAt),
  };
}
