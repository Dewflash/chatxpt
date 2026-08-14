import { describe, expect, it } from "vitest";

import {
  streamerProfileSettingsCommandSchema,
  streamerQuestCommandSchema,
  streamerQuestProgressCommandSchema,
  streamerServiceCommandSchema,
} from "../core";
import { contractFixtureStreamerView } from "../core/testing";
import {
  buildEmergencyClearCommand,
  buildProfileSettingsCommand,
  buildQuestCommand,
  buildQuestProgressCommand,
  buildSetupCommand,
  editableDefaultsFromView,
  profileDefaultsChanged,
  type StreamerCommandFactory,
} from "./streamer-commands";

const factory: StreamerCommandFactory = {
  createId: (prefix) => `test-${prefix}`,
  now: () => 1_786_020_000_000,
};

describe("Role 4 streamer command builders", () => {
  it("builds a broadcaster-owned saved-default command through the canonical profile seam", () => {
    const draft = editableDefaultsFromView(contractFixtureStreamerView);
    const changed = {
      ...draft,
      experience: { ...draft.experience, intensity: 0.8 },
      voting: { ...draft.voting, voteVisibility: "hidden-until-close" as const },
      rewards: { ...draft.rewards, rewardDisplay: "session-points" as const },
    };

    expect(profileDefaultsChanged(draft, changed)).toBe(true);
    const command = buildProfileSettingsCommand(contractFixtureStreamerView, changed, factory);

    expect(streamerProfileSettingsCommandSchema.safeParse(command).success).toBe(true);
    expect(command).toMatchObject({
      commandId: "test-profile-settings",
      correlationId: "test-profile-settings",
      expectedRevision: contractFixtureStreamerView.envelope.revision,
      actor: { kind: "broadcaster", actorId: contractFixtureStreamerView.profile.streamerId },
      questCycleId: null,
      experiencePatch: { intensity: 0.8 },
      voting: { voteVisibility: "hidden-until-close" },
      rewards: { rewardDisplay: "session-points" },
    });
  });

  it("uses the current cycle and selected candidate for an authorised quest action", () => {
    const selected = contractFixtureStreamerView.questCycle.options[1]?.candidateId ?? null;
    const command = buildQuestCommand(contractFixtureStreamerView, "approve", selected, factory);

    expect(streamerQuestCommandSchema.safeParse(command).success).toBe(true);
    expect(command).toMatchObject({
      commandId: "test-quest-approve",
      questCycleId: contractFixtureStreamerView.questCycle.envelope.questCycleId,
      candidateId: selected,
      action: "approve",
    });
  });

  it("builds canonical manual progress and emergency-clear commands", () => {
    const progress = buildQuestProgressCommand(contractFixtureStreamerView, 0.65, factory);
    const clear = buildEmergencyClearCommand(contractFixtureStreamerView, factory);

    expect(streamerQuestProgressCommandSchema.safeParse(progress).success).toBe(true);
    expect(progress.requestedValue).toBe(0.65);
    expect(clear).toMatchObject({
      commandId: "test-emergency-clear",
      type: "streamer.emergency-clear",
      questCycleId: contractFixtureStreamerView.questCycle.envelope.questCycleId,
    });
  });

  it("maps setup recovery and session lifecycle actions to the accepted service command union", () => {
    const retry = buildSetupCommand(contractFixtureStreamerView, "realtime", "retry-service", factory);
    const start = buildSetupCommand(contractFixtureStreamerView, "session", "start-session", factory);

    expect(streamerServiceCommandSchema.safeParse(retry).success).toBe(true);
    expect(retry).toMatchObject({ type: "streamer.setup", service: "realtime", action: "retry-service" });
    expect(streamerServiceCommandSchema.safeParse(start).success).toBe(true);
    expect(start).toMatchObject({ type: "streamer.session", action: "start" });
  });
});
