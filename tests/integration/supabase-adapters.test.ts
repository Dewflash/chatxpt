import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import { viewerViewModelSchema, type RoleViewModels } from "../../src/core";
import {
  contractFixtureOverlayView,
  contractFixtureStreamerView,
  contractFixtureViewerView,
} from "../../src/core/testing";
import {
  SupabaseChatXptDataApi,
  SupabaseHostedSessionLookup,
  SupabaseRoleSnapshotPublisher,
  SupabaseSessionStateRepository,
} from "../../src/realtime/server";
import { persistenceState } from "./persistence-fixtures";

class RecordingDataApi extends SupabaseChatXptDataApi {
  state: unknown | null = persistenceState();
  persisted: RoleViewModels | null = null;

  constructor() {
    super({} as SupabaseClient);
  }

  override async loadState(): Promise<unknown | null> {
    return this.state;
  }

  override async loadStateByRoomCode(): Promise<unknown | null> {
    return this.state;
  }

  override async persistRoleSnapshots(views: RoleViewModels): Promise<void> {
    this.persisted = structuredClone(views);
  }
}

describe("Supabase production adapters", () => {
  it("validates authoritative JSON loaded from the database", async () => {
    const api = new RecordingDataApi();
    const repository = new SupabaseSessionStateRepository(api);

    expect((await repository.load("fixture-session"))?.session.sessionId).toBe("fixture-session");

    api.state = { invalid: true };
    await expect(repository.load("fixture-session")).rejects.toThrow();
  });

  it("validates hosted-board room lookups through the server adapter", async () => {
    const api = new RecordingDataApi();
    const lookup = new SupabaseHostedSessionLookup(api);

    expect((await lookup.findByRoomCode("ABCDEFGH"))?.session.sessionId).toBe(
      "fixture-session",
    );

    api.state = { invalid: true };
    await expect(lookup.findByRoomCode("ABCDEFGH")).rejects.toThrow();
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
