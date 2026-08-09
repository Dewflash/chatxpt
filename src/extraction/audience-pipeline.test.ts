import { describe, expect, it } from "vitest";

import {
  CONTRACT_VERSION,
  type AudienceEvent,
  type AudienceEventSource,
} from "../core";
import { createAudienceSignalPipeline } from "./audience-pipeline";

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
