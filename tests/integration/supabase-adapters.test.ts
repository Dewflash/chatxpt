import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import {
  viewerViewModelSchema,
  type CommitAuthoritativeStateInput,
  type RoleViewModels,
} from "../../src/core";
import {
  contractFixtureOverlayView,
  contractFixtureStreamerView,
  contractFixtureViewerView,
} from "../../src/core/testing";
import {
  SupabaseChatXptDataApi,
  SupabaseDataError,
  SupabaseAcceptedVoteTallyReader,
  SupabaseDueVoteCycleReader,
  SupabaseHostedBoardDiscoveryReader,
  SupabaseRoleSnapshotPublisher,
  SupabaseSessionStateRepository,
  SupabaseViewerRecoveryReader,
} from "../../src/realtime/server";
import { persistenceState } from "./persistence-fixtures";

class RecordingDataApi extends SupabaseChatXptDataApi {
  state: unknown | null = persistenceState();
  persisted: RoleViewModels | null = null;
  acceptedVoteRows: readonly unknown[] = [];
  acceptedViewerParticipation: unknown | null = null;
  hostedBoardSession: unknown | null = null;
  dueVoteStates: readonly unknown[] = [];

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

  override async loadAcceptedViewerParticipation(): Promise<unknown | null> {
    return this.acceptedViewerParticipation;
  }

  override async loadHostedBoardSession(): Promise<unknown | null> {
    return this.hostedBoardSession;
  }

  override async loadDueVoteCycleStates(): Promise<readonly unknown[]> {
    return this.dueVoteStates;
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

  it("validates due vote-cycle states loaded from the database", async () => {
    const api = new RecordingDataApi();
    api.dueVoteStates = [persistenceState()];
    const reader = new SupabaseDueVoteCycleReader(api);

    expect((await reader.dueVoteCycles(2_000))[0]?.session.sessionId).toBe("fixture-session");

    api.dueVoteStates = [{ invalid: true }];
    await expect(reader.dueVoteCycles(2_000)).rejects.toThrow();
  });

  it("restores one viewer's accepted vote from the Supabase participation ledger", async () => {
    const api = new RecordingDataApi();
    api.acceptedViewerParticipation = {
      candidate_id: "candidate-2",
      accepted_at: new Date(2_000).toISOString(),
      payload: { voterKey: "private-voter", sourceMode: "twitch-chat" },
    };
    const reader = new SupabaseViewerRecoveryReader(api);

    await expect(
      reader.readViewerRecovery({
        sessionId: "fixture-session",
        questCycleId: "fixture-cycle",
        viewerId: "fixture-viewer",
        voterKey: "private-voter",
        restoredAt: 3_000,
      }),
    ).resolves.toMatchObject({
      status: "identified",
      viewerId: "fixture-viewer",
      acceptedCandidateId: "candidate-2",
      acceptedAt: 2_000,
      sourceMode: "twitch-chat",
      sessionPoints: 0,
    });

    api.acceptedViewerParticipation = null;
    await expect(
      reader.readViewerRecovery({
        sessionId: "fixture-session",
        questCycleId: "fixture-cycle",
        viewerId: null,
        voterKey: "private-voter",
        restoredAt: 4_000,
      }),
    ).resolves.toMatchObject({
      status: "anonymous",
      viewerId: null,
      acceptedCandidateId: null,
      sessionPoints: 0,
    });
  });

  it("resolves hosted-board room codes only for active Supabase sessions", async () => {
    const api = new RecordingDataApi();
    api.hostedBoardSession = { session_id: "fixture-session", status: "live" };
    const reader = new SupabaseHostedBoardDiscoveryReader(api);

    await expect(
      reader.discoverHostedBoard({
        roomCode: "ABCDEFGH",
        baseUrl: "https://chatxpt.example/",
        qrImageUrl: "https://chatxpt.example/qr/ABCDEFGH.png",
        at: 5_000,
      }),
    ).resolves.toMatchObject({
      status: "available",
      sessionId: "fixture-session",
      roomCode: "ABCDEFGH",
      url: "https://chatxpt.example/viewer/hosted?room=ABCDEFGH",
      qrImageUrl: "https://chatxpt.example/qr/ABCDEFGH.png",
    });

    api.hostedBoardSession = { session_id: "fixture-session", status: "ended" };
    await expect(
      reader.discoverHostedBoard({
        roomCode: "ABCDEFGH",
        baseUrl: "https://chatxpt.example",
        at: 6_000,
      }),
    ).resolves.toMatchObject({
      status: "unavailable",
      sessionId: null,
      roomCode: null,
      url: null,
    });
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
