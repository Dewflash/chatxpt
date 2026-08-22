import {
  CONTRACT_VERSION,
  audienceEventSchema,
  type AudienceEvent,
  type AudienceEventSource,
  type AudienceSnapshot,
  type ContractEnvelope,
  type SignalProvenance,
} from "../core";
import { buildAudienceSnapshot } from "./snapshots";
import type { AudienceExtractionPipeline } from "./ports";
import type { ObservationCandidate } from "./observations";

export interface AudienceSignalPipelineOptions {
  readonly rollingWindowMs?: number;
  readonly minimumConfidence?: number;
  readonly conflictConfidenceDelta?: number;
}

interface AudienceSample {
  readonly occurredAt: number;
  readonly receivedAt: number;
  readonly source: AudienceEvent["envelope"]["source"];
  readonly evidenceClass: AudienceEvent["envelope"]["evidenceClass"];
  readonly eventType: AudienceEvent["eventType"];
  readonly energy: number;
  readonly cheering: boolean;
  readonly asking: boolean;
  readonly voting: boolean;
  readonly negative: boolean;
  readonly participantKey: string | null;
  readonly messageFingerprint: string;
  readonly topics: readonly string[];
  readonly watchlistHits: readonly string[];
}

const DEFAULT_ROLLING_WINDOW_MS = 30_000;
const DEFAULT_MINIMUM_CONFIDENCE = 0.45;
const DEFAULT_CONFLICT_DELTA = 0.05;
const MAX_AUTOMATIC_TOPICS = 3;

const cheeringWords = /\b(?:go|hype|pog|clutch|nice|lets go|let's go|lol|lmao|wow|win)\b/i;
const askingWords = /\b(?:quest|challenge|sidequest|do it|try|please|pls|make him|make her)\b/i;
const negativeWords = /\b(?:boring|nope|stop|bad|throw|threw|hate|fail)\b/i;
const topicStopWords = new Set([
  "about", "after", "again", "also", "asking", "because", "before", "being", "challenge",
  "chat", "could", "find", "from", "game", "have", "into", "just", "keep", "make", "more",
  "need", "next", "please", "quest", "really", "should", "sidequest", "stream", "that", "their",
  "there", "they", "thing", "things", "this", "very", "want", "what", "when", "where", "which",
  "with", "would", "your",
]);

function topicTokens(text: string | null): string[] {
  if (text === null) return [];
  const tokens = text
    .normalize("NFKC")
    .toLocaleLowerCase()
    .match(/[\p{L}\p{N}][\p{L}\p{N}'-]{2,31}/gu) ?? [];
  return [...new Set(tokens.filter((token) => token.length >= 4 && !topicStopWords.has(token)))].slice(0, 12);
}

function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return;
  if (signal.reason instanceof Error) throw signal.reason;
  const error = new Error("Operation aborted");
  error.name = "AbortError";
  throw error;
}

function clampUnit(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function classifyText(text: string | null) {
  const safe = text ?? "";
  return {
    cheering: cheeringWords.test(safe),
    asking: askingWords.test(safe),
    negative: negativeWords.test(safe),
    energetic: /[!?]{2,}|[A-Z]{5,}/.test(safe),
  };
}

function sampleFromEvent(event: AudienceEvent, keywordWatchlist: readonly string[] = []): AudienceSample {
  const text = classifyText(event.text);
  const normalizedText = event.text?.normalize("NFKC").toLocaleLowerCase() ?? "";
  const voting = event.eventType === "chat-vote";
  const reaction = event.eventType === "reaction";
  const energy = clampUnit(
    0.15 +
      (text.energetic ? 0.25 : 0) +
      (text.cheering ? 0.2 : 0) +
      (text.asking ? 0.15 : 0) +
      (reaction ? 0.25 : 0) +
      (voting ? 0.18 : 0),
  );

  return {
    occurredAt: event.envelope.occurredAt,
    receivedAt: event.envelope.receivedAt,
    source: event.envelope.source,
    evidenceClass: event.envelope.evidenceClass,
    eventType: event.eventType,
    energy,
    cheering: text.cheering || reaction,
    asking: text.asking,
    voting,
    negative: text.negative,
    participantKey: event.viewerId,
    messageFingerprint: event.envelope.messageId,
    topics: topicTokens(event.text),
    watchlistHits: keywordWatchlist.filter((keyword) =>
      normalizedText.includes(keyword.normalize("NFKC").toLocaleLowerCase()),
    ),
  };
}

function confidence(sampleSize: number): number {
  return clampUnit(0.25 + sampleSize * 0.14);
}

function majorityIntent(samples: readonly AudienceSample[]): string {
  const scores = {
    voting: samples.filter((sample) => sample.voting).length,
    requesting: samples.filter((sample) => sample.asking).length,
    cheering: samples.filter((sample) => sample.cheering).length,
    concerned: samples.filter((sample) => sample.negative).length,
  };
  const sorted = Object.entries(scores).sort((left, right) => right[1] - left[1]);
  const [intent, count] = sorted[0];
  return count === 0 ? "neutral" : intent;
}

function averageEnergy(samples: readonly AudienceSample[]): number {
  if (samples.length === 0) return 0;
  return samples.reduce((total, sample) => total + sample.energy, 0) / samples.length;
}

function makeEnvelope(latest: AudienceEvent, sequence: number): ContractEnvelope {
  return {
    contractVersion: CONTRACT_VERSION,
    sessionId: latest.envelope.sessionId,
    questCycleId: latest.envelope.questCycleId,
    messageId: `audience-snapshot-${latest.envelope.messageId}-${sequence}`,
    correlationId: latest.envelope.correlationId,
    revision: latest.envelope.revision,
    occurredAt: latest.envelope.occurredAt,
    receivedAt: latest.envelope.receivedAt,
    source: "algorithm",
    evidenceClass: latest.envelope.evidenceClass,
  };
}

function makeProvenance(latest: AudienceEvent, sampleSize: number): SignalProvenance {
  return {
    source: "algorithm",
    method: "role-2-audience-rolling-window",
    confidence: confidence(sampleSize),
    observedAt: latest.envelope.occurredAt,
    receivedAt: latest.envelope.receivedAt,
    evidenceClass: latest.envelope.evidenceClass,
  };
}

function observed(
  value: string | number | boolean,
  latest: AudienceEvent,
  sampleSize: number,
  rollingWindowMs: number,
): ObservationCandidate {
  return {
    state: "observed",
    value,
    expiresAt: latest.envelope.receivedAt + rollingWindowMs,
    provenance: makeProvenance(latest, sampleSize),
  };
}

function buildSnapshot(input: {
  readonly latest: AudienceEvent;
  readonly samples: readonly AudienceSample[];
  readonly sequence: number;
  readonly rollingWindowMs: number;
  readonly minimumConfidence: number;
  readonly conflictConfidenceDelta: number;
  readonly additionalSignals?: readonly {
    readonly signalId: string;
    readonly kind: string;
    readonly value: string | number | boolean;
  }[];
}): AudienceSnapshot {
  const provenance = makeProvenance(input.latest, input.samples.length);
  const repeatedRequests = input.samples.filter((sample) => sample.asking).length;
  const voteMessages = input.samples.filter((sample) => sample.voting).length;
  const negativeMessages = input.samples.filter((sample) => sample.negative).length;

  return buildAudienceSnapshot({
    envelope: makeEnvelope(input.latest, input.sequence),
    sampleSize: input.samples.length,
    fusion: {
      now: input.latest.envelope.receivedAt,
      minimumConfidence: input.minimumConfidence,
      conflictConfidenceDelta: input.conflictConfidenceDelta,
    },
    signals: [
      {
        signalId: "audience-energy",
        kind: "audience-energy",
        fallbackProvenance: provenance,
        candidates: [
          observed(
            Number(averageEnergy(input.samples).toFixed(3)),
            input.latest,
            input.samples.length,
            input.rollingWindowMs,
          ),
        ],
      },
      {
        signalId: "audience-intent",
        kind: "audience-intent",
        fallbackProvenance: provenance,
        candidates: [
          observed(
            majorityIntent(input.samples),
            input.latest,
            input.samples.length,
            input.rollingWindowMs,
          ),
        ],
      },
      {
        signalId: "audience-repeated-requests",
        kind: "audience-repeated-requests",
        fallbackProvenance: provenance,
        candidates: [
          observed(repeatedRequests, input.latest, input.samples.length, input.rollingWindowMs),
        ],
      },
      {
        signalId: "audience-chat-vote-messages",
        kind: "audience-chat-vote-messages",
        fallbackProvenance: provenance,
        candidates: [
          observed(voteMessages, input.latest, input.samples.length, input.rollingWindowMs),
        ],
      },
      {
        signalId: "audience-negative-pressure",
        kind: "audience-negative-pressure",
        fallbackProvenance: provenance,
        candidates: [
          observed(negativeMessages, input.latest, input.samples.length, input.rollingWindowMs),
        ],
      },
      ...(input.additionalSignals ?? []).map((signal) => ({
        signalId: signal.signalId,
        kind: signal.kind,
        fallbackProvenance: provenance,
        candidates: [
          observed(
            signal.value,
            input.latest,
            input.samples.length,
            input.rollingWindowMs,
          ),
        ],
      })),
    ],
  });
}

function moodFromSamples(samples: readonly AudienceSample[]): string {
  if (samples.length === 0) return "unknown";
  const intent = majorityIntent(samples);
  const energy = averageEnergy(samples);
  if (intent === "concerned") return "concerned";
  if (intent === "cheering" && energy >= 0.55) return "excited";
  if (intent === "requesting") return energy >= 0.5 ? "playful" : "curious";
  if (intent === "voting") return "engaged";
  return energy >= 0.65 ? "excited" : energy >= 0.4 ? "engaged" : energy >= 0.2 ? "curious" : "quiet";
}

function slug(value: string): string {
  return value.toLocaleLowerCase().replace(/[^a-z0-9]+/gu, "-").replace(/^-|-$/gu, "").slice(0, 64) || "keyword";
}

export interface AudienceAnalyticsTopic {
  readonly topic: string;
  readonly count: number;
  readonly participantKeys: readonly string[];
  readonly evidence: readonly AudienceAnalyticsTopicEvidence[];
}

export interface AudienceAnalyticsTopicEvidence {
  readonly participantKey: string;
  readonly messageFingerprint: string;
  readonly observedAt: number;
}

export interface AudienceAnalyticsUpdate {
  readonly snapshot: AudienceSnapshot;
  readonly topics: readonly AudienceAnalyticsTopic[];
  readonly primaryTopic: AudienceAnalyticsTopic | null;
}

/**
 * Process-local rolling analytics. It immediately discards raw message text and
 * retains only bounded classifications, topic tokens, and session-scoped keys.
 */
export class AudienceAnalyticsAccumulator {
  private readonly samples: AudienceSample[] = [];
  private readonly messageFingerprints = new Set<string>();
  private readonly participantFirstSeen = new Map<string, number>();

  constructor(private readonly options: AudienceSignalPipelineOptions = {}) {}

  ingest(rawEvent: AudienceEvent, keywordWatchlist: readonly string[] = []): AudienceAnalyticsUpdate | null {
    const event = audienceEventSchema.parse(rawEvent);
    if (this.messageFingerprints.has(event.envelope.messageId)) return null;
    this.messageFingerprints.add(event.envelope.messageId);
    const rollingWindowMs = this.options.rollingWindowMs ?? DEFAULT_ROLLING_WINDOW_MS;
    const sample = sampleFromEvent(event, keywordWatchlist);
    this.samples.push(sample);
    const oldestRetainedAt = event.envelope.receivedAt - rollingWindowMs * 2;
    while (this.samples[0] !== undefined && this.samples[0].receivedAt < oldestRetainedAt) {
      const removed = this.samples.shift();
      if (removed !== undefined) this.messageFingerprints.delete(removed.messageFingerprint);
    }
    if (sample.participantKey !== null) {
      if (!this.participantFirstSeen.has(sample.participantKey)) {
        this.participantFirstSeen.set(sample.participantKey, sample.receivedAt);
      }
    }

    const currentStartedAt = event.envelope.receivedAt - rollingWindowMs;
    const previousStartedAt = currentStartedAt - rollingWindowMs;
    const current = this.samples.filter((item) => item.receivedAt >= currentStartedAt);
    const previous = this.samples.filter(
      (item) => item.receivedAt >= previousStartedAt && item.receivedAt < currentStartedAt,
    );
    const activeKeys = new Set(current.flatMap((item) => item.participantKey === null ? [] : [item.participantKey]));
    const previousKeys = new Set(previous.flatMap((item) => item.participantKey === null ? [] : [item.participantKey]));
    const newlyActive = [...activeKeys].filter((key) => (this.participantFirstSeen.get(key) ?? Infinity) >= currentStartedAt).length;
    const returning = [...activeKeys].filter(
      (key) => (this.participantFirstSeen.get(key) ?? Infinity) < currentStartedAt,
    ).length;
    const recentlyInactive = [...previousKeys].filter((key) => !activeKeys.has(key)).length;
    const messagesPerMinute = Number(((current.length * 60_000) / rollingWindowMs).toFixed(1));
    const previousMessagesPerMinute = Number(((previous.length * 60_000) / rollingWindowMs).toFixed(1));

    const topicCounts = new Map<string, {
      count: number;
      participants: Set<string>;
      evidence: AudienceAnalyticsTopicEvidence[];
    }>();
    for (const item of current) {
      for (const topic of item.topics) {
        const existing = topicCounts.get(topic) ?? { count: 0, participants: new Set<string>(), evidence: [] };
        existing.count += 1;
        if (item.participantKey !== null) {
          existing.participants.add(item.participantKey);
          existing.evidence.push({
            participantKey: item.participantKey,
            messageFingerprint: item.messageFingerprint,
            observedAt: item.occurredAt,
          });
        }
        topicCounts.set(topic, existing);
      }
    }
    const rankedEntries = [...topicCounts.entries()]
      .filter(([, value]) => value.evidence.length >= 2)
      .sort((left, right) => right[1].count - left[1].count || right[1].participants.size - left[1].participants.size)
      .slice(0, MAX_AUTOMATIC_TOPICS);
    const topics: readonly AudienceAnalyticsTopic[] = rankedEntries.map(([topic, value]) => ({
      topic,
      count: value.count,
      participantKeys: [...value.participants],
      evidence: value.evidence.slice(0, 128),
    }));
    const primaryTopic = topics[0] ?? null;
    const watchlistCounts = new Map(keywordWatchlist.map((keyword) => [keyword, 0]));
    for (const item of current) {
      for (const keyword of item.watchlistHits) {
        watchlistCounts.set(keyword, (watchlistCounts.get(keyword) ?? 0) + 1);
      }
    }
    const additionalSignals = [
      { signalId: "audience-mood", kind: "audience-mood", value: moodFromSamples(current) },
      { signalId: "audience-message-rate", kind: "audience-message-rate", value: messagesPerMinute },
      { signalId: "audience-previous-mood", kind: "audience-previous-mood", value: moodFromSamples(previous) },
      { signalId: "audience-previous-message-rate", kind: "audience-previous-message-rate", value: previousMessagesPerMinute },
      { signalId: "audience-active-participants", kind: "audience-active-participants", value: activeKeys.size },
      { signalId: "audience-newly-active-participants", kind: "audience-newly-active-participants", value: newlyActive },
      { signalId: "audience-returning-participants", kind: "audience-returning-participants", value: returning },
      { signalId: "audience-recently-inactive-participants", kind: "audience-recently-inactive-participants", value: recentlyInactive },
      ...(primaryTopic === null ? [] : [
        { signalId: "audience-primary-topic", kind: "audience-primary-topic", value: primaryTopic.topic },
        { signalId: "audience-primary-topic-count", kind: "audience-primary-topic-count", value: primaryTopic.count },
      ]),
      ...topics.flatMap((topic, index) => {
        const rank = index + 1;
        return [
          { signalId: `audience-topic-${rank}`, kind: `audience-topic-${rank}`, value: topic.topic },
          { signalId: `audience-topic-${rank}-count`, kind: `audience-topic-${rank}-count`, value: topic.count },
          {
            signalId: `audience-topic-${rank}-participant-count`,
            kind: `audience-topic-${rank}-participant-count`,
            value: topic.participantKeys.length,
          },
        ];
      }),
      ...[...watchlistCounts].map(([keyword, count]) => ({
        signalId: `audience-watchlist-${slug(keyword)}`,
        kind: `audience-watchlist-${slug(keyword)}`,
        value: count,
      })),
    ];
    return {
      snapshot: buildSnapshot({
        latest: event,
        samples: current,
        sequence: this.messageFingerprints.size,
        rollingWindowMs,
        minimumConfidence: this.options.minimumConfidence ?? DEFAULT_MINIMUM_CONFIDENCE,
        conflictConfidenceDelta: this.options.conflictConfidenceDelta ?? DEFAULT_CONFLICT_DELTA,
        additionalSignals,
      }),
      topics,
      primaryTopic,
    };
  }
}

export function createAudienceSignalPipeline(
  options: AudienceSignalPipelineOptions = {},
): AudienceExtractionPipeline {
  const rollingWindowMs = options.rollingWindowMs ?? DEFAULT_ROLLING_WINDOW_MS;
  const minimumConfidence = options.minimumConfidence ?? DEFAULT_MINIMUM_CONFIDENCE;
  const conflictConfidenceDelta = options.conflictConfidenceDelta ?? DEFAULT_CONFLICT_DELTA;
  if (!Number.isInteger(rollingWindowMs) || rollingWindowMs <= 0) {
    throw new RangeError("rollingWindowMs must be a positive integer");
  }

  return {
    async *snapshots(source: AudienceEventSource, signal?: AbortSignal) {
      let sequence = 0;
      let sessionId: string | null = null;
      let samples: AudienceSample[] = [];

      for await (const rawEvent of source.events(signal)) {
        throwIfAborted(signal);
        const event = audienceEventSchema.parse(rawEvent);
        if (sessionId !== event.envelope.sessionId) {
          sessionId = event.envelope.sessionId;
          samples = [];
        }

        const newestReceivedAt = event.envelope.receivedAt;
        samples = [...samples, sampleFromEvent(event)].filter(
          (sample) =>
            newestReceivedAt - sample.receivedAt <= rollingWindowMs &&
            sample.evidenceClass === event.envelope.evidenceClass,
        );

        yield buildSnapshot({
          latest: event,
          samples,
          sequence: sequence++,
          rollingWindowMs,
          minimumConfidence,
          conflictConfidenceDelta,
        });
      }
    },
  };
}
