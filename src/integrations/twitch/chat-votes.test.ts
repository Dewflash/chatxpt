import { describe, expect, it } from "vitest";

import { audienceEventSchema, viewerVoteCommandSchema } from "../../core";
import {
  mapTwitchChatMessageToVoteCommand,
  parseTwitchChatVoteChoice,
  type TwitchChatVoteAdapterInput,
} from "./chat-votes";

const baseInput: TwitchChatVoteAdapterInput = {
  sessionId: "fixture-session",
  questCycleId: "fixture-cycle",
  expectedRevision: 7,
  messageId: "twitch-message-1",
  viewerId: "viewer-123",
  text: "2",
  candidateIds: ["candidate-1", "candidate-2", "candidate-3"],
  occurredAt: 1_786_300_000_000,
  receivedAt: 1_786_300_000_200,
  evidenceClass: "fixture",
};

describe("Twitch chat vote adapter", () => {
  it("parses only exact numbered chat vote choices after trimming", () => {
    expect(parseTwitchChatVoteChoice("1")).toBe(1);
    expect(parseTwitchChatVoteChoice(" 2 ")).toBe(2);
    expect(parseTwitchChatVoteChoice("3")).toBe(3);
    expect(parseTwitchChatVoteChoice("vote 1")).toBeNull();
    expect(parseTwitchChatVoteChoice("1!")).toBeNull();
    expect(parseTwitchChatVoteChoice("4")).toBeNull();
  });

  it("maps a numbered Twitch chat message to a canonical viewer vote command", () => {
    const result = mapTwitchChatMessageToVoteCommand(baseInput);

    expect(result.status).toBe("mapped");
    if (result.status !== "mapped") throw new Error("expected mapped result");
    expect(result.choice).toBe(2);
    expect(viewerVoteCommandSchema.safeParse(result.command).success).toBe(true);
    expect(result.command).toMatchObject({
      sessionId: "fixture-session",
      questCycleId: "fixture-cycle",
      expectedRevision: 7,
      actor: { kind: "viewer", actorId: "viewer-123" },
      type: "viewer.vote",
      candidateId: "candidate-2",
      voterKey: "twitch-chat:viewer-123",
      sourceMode: "twitch-chat",
    });
    expect(audienceEventSchema.safeParse(result.audienceEvent).success).toBe(true);
    expect(result.audienceEvent).toMatchObject({
      eventType: "chat-vote",
      viewerId: "viewer-123",
      text: null,
      chatVoteChoice: 2,
      retentionClass: "aggregate",
    });
  });

  it("ignores ordinary chat while preserving a raw-24h-max audience event", () => {
    const result = mapTwitchChatMessageToVoteCommand({
      ...baseInput,
      text: "option 2 is risky",
    });

    expect(result.status).toBe("ignored");
    expect(result.audienceEvent).toMatchObject({
      eventType: "message",
      viewerId: "viewer-123",
      text: "option 2 is risky",
      chatVoteChoice: null,
      retentionClass: "raw-24h-max",
    });
  });

  it("does not issue a vote command without a verified Twitch viewer identity", () => {
    const result = mapTwitchChatMessageToVoteCommand({
      ...baseInput,
      viewerId: null,
      text: "1",
    });

    expect(result.status).toBe("rejected");
    if (result.status !== "rejected") throw new Error("expected rejected result");
    expect(result.reason).toBe("missing-viewer-id");
    expect(result.error.code).toBe("validation");
    expect(result.audienceEvent).toMatchObject({
      eventType: "chat-vote",
      viewerId: null,
      chatVoteChoice: 1,
    });
  });

  it("uses deterministic bounded command ids for duplicate Twitch chat delivery", () => {
    const first = mapTwitchChatMessageToVoteCommand(baseInput);
    const repeated = mapTwitchChatMessageToVoteCommand({ ...baseInput });

    expect(first.status).toBe("mapped");
    expect(repeated.status).toBe("mapped");
    if (first.status !== "mapped" || repeated.status !== "mapped") {
      throw new Error("expected mapped results");
    }
    expect(first.command.commandId).toBe(repeated.command.commandId);
    expect(first.command.commandId.length).toBeLessThanOrEqual(128);
  });
});
