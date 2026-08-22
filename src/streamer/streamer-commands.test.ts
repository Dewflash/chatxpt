import { describe, expect, it } from "vitest";

import {
  commandEnvelopeSchema,
  streamerProfileSettingsCommandSchema,
  streamerLiveDirectorCueCommandSchema,
  streamerLiveDirectorIntentCommandSchema,
  streamerQuestCommandSchema,
  streamerQuestGenerationCommandSchema,
  streamerQuestProgressCommandSchema,
  streamerServiceCommandSchema,
  streamerSessionOverrideCommandSchema,
} from "../core";
import { contractFixtureStreamerView } from "../core/testing";
import {
  buildEmergencyClearCommand,
  buildLiveDirectorCueCommand,
  buildLiveDirectorIntentCommand,
  buildProfileSettingsCommand,
  buildQuestCommand,
  buildQuestGenerationCommand,
  buildQuestProgressCommand,
  buildSessionOverrideCommand,
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
      gameId: "minecraft",
      gameName: "Minecraft Java Edition",
      experience: { ...draft.experience, intensity: 0.8 },
      restrictions: [...draft.restrictions, "No elytra challenges"],
      preferredQuestTypes: ["exploration", "chat-choice"],
      forbiddenQuestTypes: [...draft.forbiddenQuestTypes, "inventory-trash"],
      accessibilityNeeds: ["high-contrast", "reduced-motion"],
      keywordWatchlist: ["diamonds", "food supplies"],
      selectedPresetId: "competitive",
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
      game: { gameId: "minecraft", gameName: "Minecraft Java Edition" },
      experiencePatch: { intensity: 0.8 },
      restrictions: expect.arrayContaining(["No elytra challenges"]),
      preferredQuestTypes: ["exploration", "chat-choice"],
      forbiddenQuestTypes: expect.arrayContaining(["inventory-trash"]),
      accessibilityNeeds: ["high-contrast", "reduced-motion"],
      keywordWatchlist: ["diamonds", "food supplies"],
      selectedPresetId: "competitive",
      voting: { voteVisibility: "hidden-until-close" },
      rewards: { rewardDisplay: "session-points" },
    });
  });

  it("builds a current-stream preset override without rewriting saved defaults", () => {
    const command = buildSessionOverrideCommand(
      contractFixtureStreamerView,
      { intensity: 0.35, creativity: 0.7 },
      factory,
      "chill",
    );

    expect(streamerSessionOverrideCommandSchema.safeParse(command).success).toBe(true);
    expect(command).toMatchObject({
      type: "streamer.session-override",
      action: "apply",
      presetId: "chill",
      experiencePatch: { intensity: 0.35, creativity: 0.7 },
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

  it("builds the broadcaster-only deterministic Generate quest now command", () => {
    const command = buildQuestGenerationCommand(contractFixtureStreamerView, factory);

    expect(streamerQuestGenerationCommandSchema.safeParse(command).success).toBe(true);
    expect(commandEnvelopeSchema.safeParse(command).success).toBe(true);
    expect(command).toMatchObject({
      commandId: "test-quest-generation",
      questCycleId: contractFixtureStreamerView.questCycle.envelope.questCycleId,
      actor: { kind: "broadcaster" },
      type: "streamer.quest-generation",
      mode: "deterministic-fallback",
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

  it("builds private declared-intent and Director Cue commands through canonical seams", () => {
    const intent = buildLiveDirectorIntentCommand(
      contractFixtureStreamerView,
      {
        goal: "Reach the next safe shelter",
        objective: "Explore carefully while involving chat in the route choice.",
        desiredAudienceInvolvement: "Vote on the next safe route.",
      },
      factory,
    );
    const cue = buildLiveDirectorCueCommand(
      contractFixtureStreamerView,
      "fixture-director-cue",
      "later",
      factory,
    );

    expect(streamerLiveDirectorIntentCommandSchema.safeParse(intent).success).toBe(true);
    expect(intent).toMatchObject({
      commandId: "test-live-director-intent",
      questCycleId: null,
      action: "set",
      intent: {
        inputMethod: "manual",
        confidence: 1,
        requestedExpiresAt: 1_786_027_200_000,
      },
    });
    expect(streamerLiveDirectorCueCommandSchema.safeParse(cue).success).toBe(true);
    expect(cue).toMatchObject({
      commandId: "test-live-director-cue-later",
      cueId: "fixture-director-cue",
      action: "later",
    });
  });

  it("preserves confirmed speech provenance without changing command authority", () => {
    const intent = buildLiveDirectorIntentCommand(
      contractFixtureStreamerView,
      {
        goal: "Finish the base",
        objective: "I am building a house near the river.",
        desiredAudienceInvolvement: null,
        inputMethod: "speech",
        confidence: 0.84,
      },
      factory,
    );

    expect(intent).toMatchObject({
      actor: { kind: "broadcaster" },
      intent: {
        objective: "I am building a house near the river.",
        inputMethod: "speech",
        confidence: 0.84,
      },
    });
  });
});
