import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import {
  CONTRACT_VERSION,
  acceptedCommandReceiptSchema,
  authoritativeSessionStateSchema,
  commandFingerprint,
  streamerQuestCommandSchema,
  viewerViewModelSchema,
  type CommitAuthoritativeStateInput,
  type RoleViewModels,
} from "../../src/core";
import {
  contractFixtureCandidateBatch,
  contractFixtureQuestCycle,
  contractFixtureOverlayView,
  contractFixtureSession,
  contractFixtureStreamerView,
  contractFixtureViewerView,
} from "../../src/core/testing";
import {
  SupabaseChatXptDataApi,
  SupabaseDataError,
  SupabaseAcceptedVoteTallyReader,
  SupabaseDueVoteCycleReader,
  SupabaseRoleSnapshotPublisher,
  SupabaseSessionHistoryReader,
  SupabaseSessionStateRepository,
} from "../../src/realtime/server";
import { FIXTURE_NOW, persistenceState } from "./persistence-fixtures";

class RecordingDataApi extends SupabaseChatXptDataApi {
  state: unknown | null = persistenceState();
  persisted: RoleViewModels | null = null;
  acceptedVoteRows: readonly unknown[] = [];
  dueVoteStates: readonly unknown[] = [];
  sessionIdsByBroadcaster: readonly string[] = [];
  receiptStatesBySession = new Map<string, readonly unknown[]>();

  constructor() {
    super({} as SupabaseClient);
  }

  override async loadState(): Promise<unknown | null> {
    return this.state;
  }

  override async persistRoleSnapshots(views: RoleViewModels): Promise<void> {
    this.persisted = structuredClone(views);
  }

  override async loadAcceptedVotes(): Promise<readonly unknown[]> {
    return this.acceptedVoteRows;
  }

  override async loadDueVoteCycleStates(): Promise<readonly unknown[]> {
    return this.dueVoteStates;
  }

  override async loadSessionIdsForBroadcaster(): Promise<readonly string[]> {
    return this.sessionIdsByBroadcaster;
  }

  override async loadReceiptStatesForSession(sessionId: string): Promise<readonly unknown[]> {
    return this.receiptStatesBySession.get(sessionId) ?? [];
  }
}

class VoteConflictDataApi extends RecordingDataApi {
  override async commitState(): Promise<unknown> {
    throw new SupabaseDataError(
      'duplicate key value violates unique constraint "accepted_participation_one_vote_per_voter_cycle"',
      "23505",
      "Key already exists",
      null,
    );
  }
}

describe("Supabase production adapters", () => {
  it("maps the database vote-identity uniqueness guard to a typed conflict", async () => {
    const repository = new SupabaseSessionStateRepository(new VoteConflictDataApi());

    await expect(
      repository.commit({} as CommitAuthoritativeStateInput),
    ).resolves.toEqual({
      status: "participation-conflict",
      reason: "vote-already-accepted",
    });
  });

  it("builds a neutral, zero-filled tally from accepted vote audit rows", async () => {
    const api = new RecordingDataApi();
    api.acceptedVoteRows = [
      { candidate_id: "candidate-1" },
      { candidate_id: "candidate-1" },
      { candidate_id: "candidate-2" },
    ];
    const reader = new SupabaseAcceptedVoteTallyReader(api);

    const snapshot = await reader.readAcceptedVoteTally({
      sessionId: "fixture-session",
      questCycleId: "fixture-cycle",
      revision: 8,
      candidateIds: ["candidate-1", "candidate-2", "candidate-3"],
      acceptedBefore: 2_000,
      closedAt: 2_500,
    });

    expect(snapshot.acceptedVoteCount).toBe(3);
    expect(snapshot.tallies).toEqual([
      { candidateId: "candidate-1", votes: 2 },
      { candidateId: "candidate-2", votes: 1 },
      { candidateId: "candidate-3", votes: 0 },
    ]);
    expect(snapshot).not.toHaveProperty("winnerCandidateId");
  });

  it("validates authoritative JSON loaded from the database", async () => {
    const api = new RecordingDataApi();
    const repository = new SupabaseSessionStateRepository(api);

    expect((await repository.load("fixture-session"))?.session.sessionId).toBe("fixture-session");

    api.state = { invalid: true };
    await expect(repository.load("fixture-session")).rejects.toThrow();
  });

  it("derives session history from broadcaster receipt states without private viewer fields", async () => {
    const api = new RecordingDataApi();
    api.sessionIdsByBroadcaster = [contractFixtureSession.sessionId];
    const command = streamerQuestCommandSchema.parse({
      contractVersion: CONTRACT_VERSION,
      sessionId: contractFixtureSession.sessionId,
      questCycleId: contractFixtureQuestCycle.envelope.questCycleId,
      commandId: "supabase-history-command",
      correlationId: "supabase-history-correlation",
      expectedRevision: 0,
      issuedAt: FIXTURE_NOW + 10_000,
      actor: { kind: "broadcaster", actorId: contractFixtureSession.broadcasterId },
      type: "streamer.quest",
      action: "succeed",
      candidateId: null,
    });
    const base = persistenceState();
    const terminal = authoritativeSessionStateSchema.parse({
      ...base,
      session: {
        ...base.session,
        revision: 1,
      },
      questCycle: {
        ...structuredClone(contractFixtureQuestCycle),
        envelope: {
          ...structuredClone(contractFixtureQuestCycle.envelope),
          revision: 1,
        },
        status: "succeeded",
        options: contractFixtureCandidateBatch.candidates,
        activeCandidateId: contractFixtureCandidateBatch.candidates[0].candidateId,
        voteTallies: [
          { candidateId: contractFixtureCandidateBatch.candidates[0].candidateId, votes: 4 },
          { candidateId: contractFixtureCandidateBatch.candidates[1].candidateId, votes: 1 },
          { candidateId: contractFixtureCandidateBatch.candidates[2].candidateId, votes: 0 },
        ],
        startsAt: FIXTURE_NOW,
        endsAt: FIXTURE_NOW + 20_000,
        progress: {
          value: 1,
          updatedAt: FIXTURE_NOW + 20_000,
          method: "manual",
          evidenceSignalIds: [],
        },
        completionRule: { mode: "manual", allowedSignalKinds: [] },
        result: {
          outcome: "succeeded",
          occurredAt: FIXTURE_NOW + 20_000,
          reason: "Supabase fixture history result.",
          rewardPointsAwarded: 100,
        },
      },
    });
    api.receiptStatesBySession.set(contractFixtureSession.sessionId, [
      acceptedCommandReceiptSchema.parse({
        command,
        commandFingerprint: commandFingerprint(command),
        state: terminal,
        events: [],
        acceptedAt: FIXTURE_NOW + 20_000,
      }),
    ]);

    const history = await new SupabaseSessionHistoryReader(api).readSessionHistory({
      broadcasterId: contractFixtureSession.broadcasterId,
      at: FIXTURE_NOW + 25_000,
      limit: 5,
    });

    expect(history.summary).toMatchObject({
      totalQuestCycles: 1,
      succeeded: 1,
      totalAcceptedVotes: 5,
      totalRewardPointsAwarded: 100,
    });
    expect(history.privacy.rawChatHistoryRetained).toBe(false);
    expect(history.entries[0]).not.toHaveProperty("viewerId");
    expect(history.entries[0]).not.toHaveProperty("rawChat");
  });

  it("validates due vote-cycle states loaded from the database", async () => {
    const api = new RecordingDataApi();
    api.dueVoteStates = [persistenceState()];
    const reader = new SupabaseDueVoteCycleReader(api);

    expect((await reader.dueVoteCycles(2_000))[0]?.session.sessionId).toBe("fixture-session");

    api.dueVoteStates = [{ invalid: true }];
    await expect(reader.dueVoteCycles(2_000)).rejects.toThrow();
  });

  it("removes viewer-specific fields before the database trigger can broadcast", async () => {
    const api = new RecordingDataApi();
    const publisher = new SupabaseRoleSnapshotPublisher(api);
    const views: RoleViewModels = {
      streamer: contractFixtureStreamerView,
      viewer: {
        ...contractFixtureViewerView,
        viewerId: "private-viewer",
        sessionPoints: 900,
        acceptedCandidateId: null,
      },
      overlay: contractFixtureOverlayView,
    };

    await publisher.publish(views);

    expect(api.persisted?.viewer.viewerId).toBeNull();
    expect(api.persisted?.viewer.sessionPoints).toBe(0);
    expect(api.persisted?.streamer.profile.streamerId).toBe("fixture-broadcaster");
    expect(api.persisted?.overlay.readOnly).toBe(true);
  });

  it("rejects individually valid role views that disagree on authoritative session state", async () => {
    const api = new RecordingDataApi();
    const publisher = new SupabaseRoleSnapshotPublisher(api);
    const inconsistent: RoleViewModels = {
      streamer: contractFixtureStreamerView,
      viewer: viewerViewModelSchema.parse({
        ...structuredClone(contractFixtureViewerView),
        session: {
          ...structuredClone(contractFixtureViewerView.session),
          status: "live",
          startedAt: contractFixtureViewerView.session.createdAt,
        },
      }),
      overlay: contractFixtureOverlayView,
    };

    await expect(publisher.publish(inconsistent)).rejects.toThrow(
      "Role snapshots disagree on authoritative session state",
    );
    expect(api.persisted).toBeNull();
  });
});
