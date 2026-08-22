import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import { createMemoryPersistenceRuntime } from "@/realtime";

import { ChatXptServerRuntime } from "./runtime";
import { TwitchChatApplication } from "./twitch-chat";
import { TwitchExtensionViewerApplication } from "./twitch-extension-viewer";

const NOW = 2_000_000_000_000;
const EXTENSION_SECRET_BYTES = Buffer.from("0123456789abcdef0123456789abcdef", "utf8");
const EXTENSION_SECRET = EXTENSION_SECRET_BYTES.toString("base64");
const EVENTSUB_SECRET = "eventsub-test-secret-at-least-32-characters";

function signedToken(): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify({
    channel_id: "channel-1",
    exp: Math.floor((NOW + 60_000) / 1_000),
    opaque_user_id: "Uviewer-one",
    role: "viewer",
  })).toString("base64url");
  const signature = createHmac("sha256", EXTENSION_SECRET_BYTES)
    .update(`${header}.${body}`)
    .digest("base64url");
  return `${header}.${body}.${signature}`;
}

const candidates = [
  {
    id: "candidate-one",
    title: "Hold Your Ground",
    instruction: "Stay in your current playable area for the next thirty seconds.",
    durationSeconds: 30,
    difficulty: "easy" as const,
    rewardPoints: 100,
    rationale: "Safe chat fallback test candidate.",
  },
  {
    id: "candidate-two",
    title: "Caster Mode",
    instruction: "Narrate the next thirty seconds like a sports commentator.",
    durationSeconds: 30,
    difficulty: "medium" as const,
    rewardPoints: 100,
    rationale: "Safe chat fallback test candidate.",
  },
  {
    id: "candidate-three",
    title: "Audience Check-In",
    instruction: "Explain your next move before taking another game action.",
    durationSeconds: 30,
    difficulty: "easy" as const,
    rewardPoints: 100,
    rationale: "Safe chat fallback test candidate.",
  },
];

describe("TwitchChatApplication", () => {
  it("counts signed EventSub 1/2/3 messages in the shared private vote ledger", async () => {
    let sequence = 0;
    const persistence = createMemoryPersistenceRuntime();
    const extension = new TwitchExtensionViewerApplication({
      persistence,
      extensionSecret: EXTENSION_SECRET,
      localDiagnostics: true,
      now: () => NOW,
      nextId: () => `extension-${++sequence}`,
    });
    extension.stageLocalDiagnosticQuests(candidates);
    await extension.readViewer(`Bearer ${signedToken()}`);
    const chat = new TwitchChatApplication({
      runtime: new ChatXptServerRuntime({ persistence, clock: { now: () => NOW } }),
      eventSubSecret: EVENTSUB_SECRET,
      now: () => NOW,
    });
    const message = {
      broadcasterId: "channel-1",
      chatterId: "raw-twitch-viewer-1",
      messageId: "chat-message-1",
      text: "2",
      occurredAt: NOW,
      receivedAt: NOW,
    };
    expect(await chat.ingest(message)).toEqual({ status: "counted", choice: 2 });
    expect(await chat.ingest(message)).toEqual({ status: "duplicate", choice: 2 });
    expect(await chat.ingest({ ...message, messageId: "chat-message-2", text: "1" }))
      .toEqual({ status: "duplicate", choice: 1 });
    expect(await chat.ingest({ ...message, chatterId: "raw-twitch-viewer-2", messageId: "chat-message-3", text: "3" }))
      .toEqual({ status: "counted", choice: 3 });
    expect(await chat.ingest({ ...message, messageId: "chat-message-4", text: "vote 1" }))
      .toEqual({ status: "aggregated", sampleSize: 1 });

    const diagnostic = await extension.readLocalDiagnosticSnapshot();
    expect(diagnostic?.votes).toEqual({
      "candidate-one": 0,
      "candidate-two": 1,
      "candidate-three": 1,
    });
  });

  it("aggregates ordinary chat into canonical analytics without retaining raw Twitch identity or text", async () => {
    let sequence = 0;
    const persistence = createMemoryPersistenceRuntime();
    const extension = new TwitchExtensionViewerApplication({
      persistence,
      extensionSecret: EXTENSION_SECRET,
      localDiagnostics: true,
      now: () => NOW,
      nextId: () => `ordinary-chat-${++sequence}`,
    });
    extension.stageLocalDiagnosticQuests(candidates);
    await extension.readViewer(`Bearer ${signedToken()}`);
    const chat = new TwitchChatApplication({
      runtime: new ChatXptServerRuntime({ persistence, clock: { now: () => NOW + 1_000 } }),
      eventSubSecret: EVENTSUB_SECRET,
      now: () => NOW + 1_000,
    });
    const first = {
      broadcasterId: "channel-1",
      chatterId: "raw-twitch-viewer-secret-a",
      messageId: "raw-twitch-message-secret-a",
      text: "A uniquely private sentence says diamonds are the next challenge",
      occurredAt: NOW,
      receivedAt: NOW,
    };
    const second = {
      ...first,
      chatterId: "raw-twitch-viewer-secret-b",
      messageId: "raw-twitch-message-secret-b",
      text: "Diamonds diamonds, please find diamonds next!",
      occurredAt: NOW + 100,
      receivedAt: NOW + 100,
    };

    expect(await chat.ingest(first)).toEqual({ status: "aggregated", sampleSize: 1 });
    expect(await chat.ingest(second)).toEqual({ status: "aggregated", sampleSize: 2 });
    expect(await chat.ingest(second)).toEqual({ status: "duplicate-message", sampleSize: 2 });

    const record = await persistence.twitchChannelSessions.findTwitchChannelSession("channel-1");
    const state = await persistence.sessions.load(record!.sessionId);
    expect(state?.audience?.sampleSize).toBe(2);
    expect(state?.liveDirector?.audiencePointer).toMatchObject({
      status: "known",
      topic: "diamonds",
      uniqueParticipants: 2,
    });
    const serialized = JSON.stringify(state);
    expect(serialized).not.toContain("raw-twitch-viewer-secret");
    expect(serialized).not.toContain("raw-twitch-message-secret");
    expect(serialized).not.toContain("uniquely private sentence");
  });
});
