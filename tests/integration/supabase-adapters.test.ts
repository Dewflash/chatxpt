import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import {
  acceptedCommandReceiptSchema,
  commandFingerprint,
  streamerQuestCommandSchema,
  viewerViewModelSchema,
  type CommitAuthoritativeStateInput,
  type RoleViewModels,
} from "../../src/core";
import {
  contractFixtureCandidateBatch,
  contractFixtureOverlayView,
  contractFixtureQuestCycle,
  contractFixtureSession,
  contractFixtureStreamerView,
  contractFixtureViewerView,
} from "../../src/core/testing";
import {
  SupabaseChatXptDataApi,
  SupabaseDataError,
  SupabaseAcceptedVoteTallyReader,
  SupabaseDueVoteCycleReader,
  SupabaseHostedBoardSessionDirectory,
  SupabaseRoleSnapshotPublisher,
  SupabaseSessionHistoryReader,
  SupabaseSessionStateRepository,
  SupabaseViewerRecoveryReader,
} from "../../src/realtime/server";
import { persistenceState } from "./persistence-fixtures";

class RecordingDataApi extends SupabaseChatXptDataApi {
  state: unknown | null = persistenceState();
  persisted: RoleViewModels | null = null;
  acceptedVoteRows: readonly unknown[] = [];
  viewerAcceptedVoteRow: unknown | null = null;
  hostedBoardSessionRow: unknown | null = null;
  dueVoteStates: readonly unknown[] = [];
  commandReceipts: readonly unknown[] = [];

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

  override async loadViewerAcceptedVote(): Promise<unknown | null> {
    return this.viewerAcceptedVoteRow;
  }

  override async loadHostedBoardSession(): Promise<unknown | null> {
    return this.hostedBoardSessionRow;
  }

  override async loadDueVoteCycleStates(): Promise<readonly unknown[]> {
    return this.dueVoteStates;
  }

  override async loadReceiptsForBroadcaster(): Promise<readonly unknown[]> {
    return this.commandReceipts;
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

  it("reads only the requesting viewer's private accepted vote recovery state", async () => {
    const api = new RecordingDataApi();
    const reader = new SupabaseViewerRecoveryReader(api);

    expect(
      await reader.readViewerRecovery({
        sessionId: "fixture-session",
        questCycleId: "fixture-cycle",
        voterKey: "missing-viewer",
      }),
    ).toEqual({
      sessionId: "fixture-session",
      questCycleId: "fixture-cycle",
      acceptedCandidateId: null,
      acceptedAt: null,
      sessionPoints: 0,
      sourceMode: null,
    });

    api.viewerAcceptedVoteRow = {
      candidate_id: "candidate-2",
      accepted_at: "2026-08-07T22:31:00.000Z",
      payload: {
        voterKey: "private-key-not-returned",
        sourceMode: "hosted-board",
      },
    };

    expect(
      await reader.readViewerRecovery({
        sessionId: "fixture-session",
        questCycleId: "fixture-cycle",
        voterKey: "private-key-not-returned",
      }),
    ).toEqual({
      sessionId: "fixture-session",
      questCycleId: "fixture-cycle",
      acceptedCandidateId: "candidate-2",
      acceptedAt: Date.parse("2026-08-07T22:31:00.000Z"),
      sessionPoints: 0,
      sourceMode: "hosted-board",
    });
  });

  it("validates hosted-board room lookup rows", async () => {
    const api = new RecordingDataApi();
    const directory = new SupabaseHostedBoardSessionDirectory(api);

    expect(await directory.findHostedBoardSession("ABCDEFGH")).toBeNull();

    const hostedRow = {
      session_id: "fixture-session",
      room_code: "ABCDEFGH",
      status: "live",
      revision: 3,
    };
    api.hostedBoardSessionRow = hostedRow;

    expect(await directory.findHostedBoardSession("ABCDEFGH")).toEqual({
      sessionId: "fixture-session",
      roomCode: "ABCDEFGH",
      status: "live",
      revision: 3,
    });

    api.hostedBoardSessionRow = { ...hostedRow, room_code: "INVALID1" };
    await expect(directory.findHostedBoardSession("INVALID1")).rejects.toThrow();
  });

  it("validates authoritative JSON loaded from the database", async () => {
    const api = new RecordingDataApi();
    const repository = new SupabaseSessionStateRepository(api);

    expect((await repository.load("fixture-session"))?.session.sessionId).toBe("fixture-session");

    api.state = { invalid: true };
    await expect(repository.load("fixture-session")).rejects.toThrow();
  });

  it("validates due vote-cycle states loaded from the database", async () => {
    const api = new RecordingDataApi();
    api.dueVoteStates = [persistenceState()];
    const reader = new SupabaseDueVoteCycleReader(api);

    expect((await reader.dueVoteCycles(2_000))[0]?.session.sessionId).toBe("fixture-session");

    api.dueVoteStates = [{ invalid: true }];
    await expect(reader.dueVoteCycles(2_000)).rejects.toThrow();
  });

  it("builds diagnostic session history from stored command receipts", async () => {
    const api = new RecordingDataApi();
    const baseState = persistenceState();
    const state = {
      ...baseState,
      session: { ...baseState.session, revision: 1 },
      questCycle: {
        ...baseState.questCycle,
        envelope: { ...baseState.questCycle.envelope, revision: 1 },
        status: "succeeded" as const,
        options: structuredClone(contractFixtureCandidateBatch.candidates),
        activeCandidateId: contractFixtureCandidateBatch.candidates[0].candidateId,
        voteTallies: [
          { candidateId: contractFixtureCandidateBatch.candidates[0].candidateId, votes: 1 },
        ],
        startsAt: contractFixtureSession.createdAt,
        result: {
          outcome: "succeeded" as const,
          occurredAt: contractFixtureSession.createdAt + 10_000,
          reason: "Fixture Supabase history result.",
          rewardPointsAwarded: 100,
        },
      },
    };
    const command = streamerQuestCommandSchema.parse({
      contractVersion: "1.0.0",
      sessionId: contractFixtureSession.sessionId,
      questCycleId: contractFixtureQuestCycle.envelope.questCycleId,
      commandId: "fixture-history-command",
      correlationId: "fixture-history-correlation",
      expectedRevision: 0,
      issuedAt: contractFixtureSession.createdAt + 10_000,
      actor: { kind: "broadcaster", actorId: contractFixtureSession.broadcasterId },
      type: "streamer.quest",
      action: "succeed",
      candidateId: contractFixtureCandidateBatch.candidates[0].candidateId,
    });
    api.commandReceipts = [
      acceptedCommandReceiptSchema.parse({
        command,
        commandFingerprint: commandFingerprint(command),
        state,
        events: [],
        acceptedAt: contractFixtureSession.createdAt + 10_000,
      }),
    ];
    const reader = new SupabaseSessionHistoryReader(api);

    const history = await reader.readSessionHistory({
      broadcasterId: contractFixtureSession.broadcasterId,
      at: contractFixtureSession.createdAt + 20_000,
    });

    expect(history.evidenceClass).toBe("diagnostic");
    expect(history.summary).toMatchObject({
      totalQuestCycles: 1,
      succeeded: 1,
      totalAcceptedVotes: 1,
    });
    expect(history.privacy.viewerIdentifiersIncluded).toBe(false);
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
