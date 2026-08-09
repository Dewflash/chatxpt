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
}

const DEFAULT_ROLLING_WINDOW_MS = 30_000;
const DEFAULT_MINIMUM_CONFIDENCE = 0.45;
const DEFAULT_CONFLICT_DELTA = 0.05;

const cheeringWords = /\b(?:go|hype|pog|clutch|nice|lets go|let's go|lol|lmao|wow|win)\b/i;
const askingWords = /\b(?:quest|challenge|sidequest|do it|try|please|pls|make him|make her)\b/i;
const negativeWords = /\b(?:boring|nope|stop|bad|throw|threw|hate|fail)\b/i;

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

function sampleFromEvent(event: AudienceEvent): AudienceSample {
  const text = classifyText(event.text);
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
    ],
  });
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
