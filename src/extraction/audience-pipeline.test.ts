import { describe, expect, it } from "vitest";

import {
  CONTRACT_VERSION,
  type AudienceEvent,
  type AudienceEventSource,
} from "../core";
import { AudienceAnalyticsAccumulator, createAudienceSignalPipeline } from "./audience-pipeline";

const NOW = 1_786_300_000_000;

function event(
  index: number,
  overrides: Partial<AudienceEvent> & {
    text?: string | null;
    eventType?: AudienceEvent["eventType"];
    chatVoteChoice?: number | null;
  } = {},
): AudienceEvent {
  const eventType = overrides.eventType ?? "message";
  return {
    envelope: {
      contractVersion: CONTRACT_VERSION,
      sessionId: "audience-session",
      questCycleId: "audience-cycle",
      messageId: `audience-event-${index}`,
      correlationId: "audience-correlation",
      revision: 3,
      occurredAt: NOW + index * 100,
      receivedAt: NOW + index * 100,
      source: "test-fixture",
      evidenceClass: "fixture",
    },
    eventType,
    viewerId: `viewer-${index}`,
    text: eventType === "message" ? overrides.text ?? "hello" : null,
    chatVoteChoice: eventType === "chat-vote" ? overrides.chatVoteChoice ?? 1 : null,
    retentionClass: eventType === "message" ? "raw-24h-max" : "aggregate",
    ...overrides,
  };
}

function source(events: readonly AudienceEvent[]): AudienceEventSource {
  return {
    async *events() {
      for (const value of events) yield value;
    },
  };
}

async function collect(events: readonly AudienceEvent[]) {
  const pipeline = createAudienceSignalPipeline({ minimumConfidence: 0.3 });
  const snapshots = [];
  for await (const snapshot of pipeline.snapshots(source(events))) {
    snapshots.push(snapshot);
  }
  return snapshots;
}

function signalValue(snapshot: Awaited<ReturnType<typeof collect>>[number], signalId: string) {
  const signal = snapshot.signals.find((item) => item.signalId === signalId);
  if (signal?.observation.status !== "known") return null;
  return signal.observation.value;
}

describe("createAudienceSignalPipeline", () => {
  it("aggregates chat, reactions, and chat votes into privacy-safe audience signals", async () => {
    const snapshots = await collect([
      event(0, { text: "LET'S GO do a quest please!!" }),
      event(1, { eventType: "reaction" }),
      event(2, { eventType: "chat-vote", chatVoteChoice: 2 }),
      event(3, { text: "challenge challenge challenge" }),
    ]);
    const latest = snapshots.at(-1);

    expect(latest?.sampleSize).toBe(4);
    expect(signalValue(latest!, "audience-intent")).toBe("requesting");
    expect(signalValue(latest!, "audience-repeated-requests")).toBe(2);
    expect(signalValue(latest!, "audience-chat-vote-messages")).toBe(1);
    expect(signalValue(latest!, "audience-energy")).toBeGreaterThan(0.2);
    expect(JSON.stringify(latest)).not.toContain("LET'S GO");
  });

  it("uses low confidence unknowns until enough evidence arrives when configured strictly", async () => {
    const pipeline = createAudienceSignalPipeline({ minimumConfidence: 0.9 });
    const snapshots = [];
    for await (const snapshot of pipeline.snapshots(source([event(0, { text: "hello" })]))) {
      snapshots.push(snapshot);
    }
    const first = snapshots[0];

    expect(first.signals.map((signal) => signal.observation.status)).toEqual([
      "unknown",
      "unknown",
      "unknown",
      "unknown",
      "unknown",
    ]);
    expect(first.signals[0].observation).toMatchObject({ reason: "low-confidence" });
  });

  it("drops samples outside the rolling window and resets between sessions", async () => {
    const pipeline = createAudienceSignalPipeline({ rollingWindowMs: 150, minimumConfidence: 0.3 });
    const snapshots = [];
    for await (const snapshot of pipeline.snapshots(
      source([
        event(0, { text: "quest please" }),
        event(3, { text: "boring" }),
        event(4, {
          envelope: {
            ...event(4).envelope,
            sessionId: "second-session",
            messageId: "second-session-event",
          },
          text: "new room",
        }),
      ]),
    )) {
      snapshots.push(snapshot);
    }

    expect(snapshots[1].sampleSize).toBe(1);
    expect(signalValue(snapshots[1], "audience-negative-pressure")).toBe(1);
    expect(snapshots[2].envelope.sessionId).toBe("second-session");
    expect(snapshots[2].sampleSize).toBe(1);
  });

  it("preserves fixture evidence class and marks the aggregate source as algorithmic", async () => {
    const snapshots = await collect([event(0, { text: "quest please" }), event(1, { text: "go go" })]);
    const latest = snapshots.at(-1)!;

    expect(latest.envelope).toMatchObject({
      source: "algorithm",
      evidenceClass: "fixture",
      sessionId: "audience-session",
    });
    expect(latest.signals[0].observation).toMatchObject({
      provenance: {
        source: "algorithm",
        method: "role-2-audience-rolling-window",
        evidenceClass: "fixture",
      },
    });
  });

  it("partitions the rolling window when fixture and live evidence classes mix", async () => {
    const snapshots = await collect([
      event(0, { text: "quest please" }),
      event(1, {
        envelope: {
          ...event(1).envelope,
          messageId: "live-twitch-message",
          source: "twitch",
          evidenceClass: "live",
        },
        text: "hello",
      }),
    ]);
    const latest = snapshots.at(-1)!;

    expect(latest.envelope.evidenceClass).toBe("live");
    expect(latest.sampleSize).toBe(1);
    expect(signalValue(latest, "audience-repeated-requests")).toBe(0);
    expect(latest.signals[0].observation).toMatchObject({
      provenance: {
        source: "algorithm",
        method: "role-2-audience-rolling-window",
        evidenceClass: "live",
      },
    });
  });
});

describe("AudienceAnalyticsAccumulator", () => {
  it("turns ordinary messages into mood, activity, topic, and watchlist aggregates", () => {
    const accumulator = new AudienceAnalyticsAccumulator({
      rollingWindowMs: 30_000,
      minimumConfidence: 0.3,
    });

    accumulator.ingest(event(0, { viewerId: "session-viewer-a", text: "Diamonds please, find diamonds!" }), ["diamonds"]);
    const update = accumulator.ingest(
      event(1, { viewerId: "session-viewer-b", text: "Go find diamonds, that would be hype!!" }),
      ["diamonds"],
    );

    expect(update).not.toBeNull();
    expect(signalValue(update!.snapshot, "audience-message-rate")).toBe(4);
    expect(signalValue(update!.snapshot, "audience-active-participants")).toBe(2);
    expect(signalValue(update!.snapshot, "audience-watchlist-diamonds")).toBe(2);
    expect(update!.primaryTopic).toMatchObject({ topic: "diamonds", count: 2 });
  });

  it("counts a participant as returning only after prior session activity", () => {
    const accumulator = new AudienceAnalyticsAccumulator({
      rollingWindowMs: 1_000,
      minimumConfidence: 0.3,
    });
    accumulator.ingest(event(0, { viewerId: "session-viewer-a", text: "first visit" }));
    accumulator.ingest(event(1, {
      envelope: {
        ...event(1).envelope,
        messageId: "later-viewer-b",
        occurredAt: NOW + 1_100,
        receivedAt: NOW + 1_100,
      },
      viewerId: "session-viewer-b",
      text: "hello room",
    }));
    const returned = accumulator.ingest(event(2, {
      envelope: {
        ...event(2).envelope,
        messageId: "viewer-a-returned",
        occurredAt: NOW + 1_200,
        receivedAt: NOW + 1_200,
      },
      viewerId: "session-viewer-a",
      text: "back again",
    }));

    expect(signalValue(returned!.snapshot, "audience-returning-participants")).toBe(1);
    expect(signalValue(returned!.snapshot, "audience-newly-active-participants")).toBe(1);
  });

  it("promotes a topic repeated in separate messages by one viewer", () => {
    const accumulator = new AudienceAnalyticsAccumulator({ minimumConfidence: 0.3 });
    const first = accumulator.ingest(
      event(0, { viewerId: "session-viewer-a", text: "diamonds diamonds diamonds next please" }),
    );
    const repeated = accumulator.ingest(
      event(1, { viewerId: "session-viewer-a", text: "diamonds diamonds again" }),
    );
    const consensus = accumulator.ingest(
      event(2, { viewerId: "session-viewer-b", text: "diamonds would be great" }),
    );

    expect(first?.primaryTopic).toBeNull();
    expect(repeated?.primaryTopic).toMatchObject({
      topic: "diamonds",
      count: 2,
      participantKeys: ["session-viewer-a"],
    });
    expect(consensus?.primaryTopic).toMatchObject({
      topic: "diamonds",
      count: 3,
      participantKeys: ["session-viewer-a", "session-viewer-b"],
    });
  });

  it("deduplicates message fingerprints and does not retain raw text or raw viewer fields", () => {
    const accumulator = new AudienceAnalyticsAccumulator({ minimumConfidence: 0.3 });
    const raw = event(0, {
      viewerId: "session-pseudonym-123",
      text: "a uniquely private raw sentence about emeralds",
    });
    const first = accumulator.ingest(raw, ["emeralds"]);
    const duplicate = accumulator.ingest(raw, ["emeralds"]);
    const serialized = JSON.stringify(first);

    expect(duplicate).toBeNull();
    expect(serialized).not.toContain("uniquely private raw sentence");
    expect(serialized).not.toContain('"viewerId"');
    expect(serialized).not.toContain('"text"');
  });
});
