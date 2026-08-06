import {
  candidateBatchSchema,
  type CandidateInput,
  type QuestCandidate,
} from "../core";
import type { CandidateGenerationStrategy } from "./providers";

export const providerAttemptStatuses = [
  "succeeded",
  "timeout",
  "refusal",
  "rate-limited",
  "unavailable",
  "malformed",
  "error",
] as const;

export type ProviderAttemptStatus = (typeof providerAttemptStatuses)[number];
export type ProviderFailureReason = Exclude<ProviderAttemptStatus, "succeeded">;
export type AlgorithmicFallbackOutcome = "not-used" | "succeeded" | "failed";

export interface ProviderAttemptObservation {
  readonly providerId: string;
  readonly status: ProviderAttemptStatus;
  readonly durationMs: number;
  readonly fallbackOutcome: AlgorithmicFallbackOutcome;
}

export interface ProviderEvaluationSummary {
  readonly providerId: string;
  readonly attemptCount: number;
  readonly providerSuccessRate: number;
  readonly fallbackRate: number;
  readonly fallbackSuccessRate: number | null;
  readonly malformedRate: number;
  readonly timeoutRate: number;
  readonly rateLimitedRate: number;
  readonly p50LatencyMs: number;
  readonly p95LatencyMs: number;
  readonly statusCounts: Readonly<Record<ProviderAttemptStatus, number>>;
}

export interface ProviderTimeoutScheduler {
  schedule(callback: () => void, delayMs: number): unknown;
  cancel(handle: unknown): void;
}

export interface ProviderFallbackGenerationOptions {
  readonly providerId: string;
  readonly providerStrategy: CandidateGenerationStrategy;
  readonly algorithmicStrategy: CandidateGenerationStrategy;
  readonly timeoutMs: number;
  readonly now?: () => number;
  readonly scheduler?: ProviderTimeoutScheduler;
  readonly observe?: (observation: ProviderAttemptObservation) => void;
}

/**
 * Provider adapters map vendor-specific failures into this private Role 2
 * classification. No raw response, prompt, credential, or provider payload is
 * carried into canonical contracts or operational observations.
 */
export class ProviderGenerationError extends Error {
  constructor(
    readonly reason: ProviderFailureReason,
    message: string,
    cause?: unknown,
  ) {
    super(message, { cause });
    this.name = "ProviderGenerationError";
  }
}

const defaultScheduler: ProviderTimeoutScheduler = {
  schedule: (callback, delayMs) => setTimeout(callback, delayMs),
  cancel: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

function defaultNow(): number {
  return typeof performance === "undefined" ? Date.now() : performance.now();
}

function abortReason(signal: AbortSignal): Error {
  if (signal.reason instanceof Error) return signal.reason;
  const error = new Error("Operation aborted");
  error.name = "AbortError";
  return error;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw abortReason(signal);
}

function assertOptions(options: ProviderFallbackGenerationOptions): void {
  if (
    options.providerId.trim() !== options.providerId ||
    options.providerId.length === 0 ||
    options.providerId.length > 80
  ) {
    throw new RangeError("providerId must contain 1 to 80 trimmed characters");
  }
  if (!Number.isInteger(options.timeoutMs) || options.timeoutMs < 1 || options.timeoutMs > 120_000) {
    throw new RangeError("timeoutMs must be an integer between 1 and 120000");
  }
}

function elapsedMilliseconds(startedAt: number, endedAt: number): number {
  if (!Number.isFinite(startedAt) || !Number.isFinite(endedAt)) {
    throw new RangeError("provider observation clock must return finite numbers");
  }
  return Math.max(0, endedAt - startedAt);
}

function emitObservation(
  observer: ProviderFallbackGenerationOptions["observe"],
  observation: ProviderAttemptObservation,
): void {
  try {
    observer?.(observation);
  } catch {
    // Observability cannot change candidate generation or fallback behaviour.
  }
}

function validateCandidates(
  input: CandidateInput,
  candidates: readonly QuestCandidate[],
  expectedMethod: "ai-provider" | "algorithmic",
  providerId: string,
): readonly QuestCandidate[] | null {
  const parsed = candidateBatchSchema.safeParse({ envelope: input.envelope, candidates });
  if (!parsed.success) return null;

  const correctlyLabelled = parsed.data.candidates.every(({ generation }) =>
    expectedMethod === "ai-provider"
      ? generation.method === "ai-provider" && generation.provider === providerId
      : generation.method === "algorithmic" && generation.provider === null,
  );
  return correctlyLabelled ? parsed.data.candidates : null;
}

function classifyProviderFailure(error: unknown, providerSignal: AbortSignal): ProviderFailureReason {
  if (error instanceof ProviderGenerationError) return error.reason;
  if (providerSignal.reason instanceof ProviderGenerationError) {
    return providerSignal.reason.reason;
  }
  return "error";
}

/**
 * Tries one injected provider strategy, then uses an injected credential-free
 * algorithmic strategy for normal provider failures. The returned candidates
 * still go to Role 3 for deterministic safety, evidence, feasibility, diversity,
 * history, and fallback handling.
 */
export function createProviderFallbackGenerationStrategy(
  options: ProviderFallbackGenerationOptions,
): CandidateGenerationStrategy {
  assertOptions(options);
  const now = options.now ?? defaultNow;
  const scheduler = options.scheduler ?? defaultScheduler;

  return {
    async generate(input, signal) {
      throwIfAborted(signal);
      const startedAt = now();
      const providerController = new AbortController();
      const abortProvider = () => providerController.abort(signal ? abortReason(signal) : undefined);
      signal?.addEventListener("abort", abortProvider, { once: true });

      let timeoutHandle: unknown;
      let timeoutScheduled = false;
      let providerFailure: ProviderFailureReason = "error";
      let providerDurationMs = 0;

      try {
        const providerPromise = Promise.resolve().then(async () => {
          const candidates = await options.providerStrategy.generate(input, providerController.signal);
          const validated = validateCandidates(input, candidates, "ai-provider", options.providerId);
          if (validated === null) {
            throw new ProviderGenerationError(
              "malformed",
              "Provider output did not match the canonical exactly-three candidate contract",
            );
          }
          return validated;
        });
        const timeoutPromise = new Promise<never>((_resolve, reject) => {
          timeoutHandle = scheduler.schedule(() => {
            const timeout = new ProviderGenerationError(
              "timeout",
              `Provider generation exceeded ${options.timeoutMs}ms`,
            );
            reject(timeout);
            providerController.abort(timeout);
          }, options.timeoutMs);
          timeoutScheduled = true;
        });

        const candidates = await Promise.race([providerPromise, timeoutPromise]);
        providerDurationMs = elapsedMilliseconds(startedAt, now());
        emitObservation(options.observe, {
          providerId: options.providerId,
          status: "succeeded",
          durationMs: providerDurationMs,
          fallbackOutcome: "not-used",
        });
        return candidates;
      } catch (error) {
        if (signal?.aborted) throw abortReason(signal);
        providerDurationMs = elapsedMilliseconds(startedAt, now());
        providerFailure = classifyProviderFailure(error, providerController.signal);
      } finally {
        if (timeoutScheduled) scheduler.cancel(timeoutHandle);
        signal?.removeEventListener("abort", abortProvider);
      }

      try {
        throwIfAborted(signal);
        const candidates = await options.algorithmicStrategy.generate(input, signal);
        throwIfAborted(signal);
        const validated = validateCandidates(input, candidates, "algorithmic", options.providerId);
        if (validated === null) {
          throw new TypeError(
            "Algorithmic fallback output did not match the canonical exactly-three candidate contract",
          );
        }
        emitObservation(options.observe, {
          providerId: options.providerId,
          status: providerFailure,
          durationMs: providerDurationMs,
          fallbackOutcome: "succeeded",
        });
        return validated;
      } catch (error) {
        emitObservation(options.observe, {
          providerId: options.providerId,
          status: providerFailure,
          durationMs: providerDurationMs,
          fallbackOutcome: "failed",
        });
        throw error;
      }
    },
  };
}

function percentile(sorted: readonly number[], ratio: number): number {
  return sorted[Math.max(0, Math.ceil(sorted.length * ratio) - 1)];
}

/** Summarises privacy-safe observations for one pinned provider/model configuration. */
export function summariseProviderAttempts(
  observations: readonly ProviderAttemptObservation[],
): ProviderEvaluationSummary {
  if (observations.length === 0) {
    throw new RangeError("At least one provider attempt is required");
  }
  const providerId = observations[0].providerId;
  const statusCounts: Record<ProviderAttemptStatus, number> = {
    succeeded: 0,
    timeout: 0,
    refusal: 0,
    "rate-limited": 0,
    unavailable: 0,
    malformed: 0,
    error: 0,
  };
  const latencies: number[] = [];
  let fallbackAttempts = 0;
  let fallbackSuccesses = 0;

  for (const observation of observations) {
    if (observation.providerId !== providerId) {
      throw new RangeError("Provider summaries require one pinned providerId");
    }
    if (!providerAttemptStatuses.includes(observation.status)) {
      throw new RangeError("Provider observation contains an unsupported status");
    }
    if (!Number.isFinite(observation.durationMs) || observation.durationMs < 0) {
      throw new RangeError("Provider observation durationMs must be finite and non-negative");
    }
    if (observation.status === "succeeded" && observation.fallbackOutcome !== "not-used") {
      throw new RangeError("Successful provider attempts cannot claim algorithmic fallback");
    }
    if (observation.status !== "succeeded" && observation.fallbackOutcome === "not-used") {
      throw new RangeError("Failed provider attempts must record the algorithmic fallback outcome");
    }

    statusCounts[observation.status] += 1;
    latencies.push(observation.durationMs);
    if (observation.fallbackOutcome !== "not-used") fallbackAttempts += 1;
    if (observation.fallbackOutcome === "succeeded") fallbackSuccesses += 1;
  }

  latencies.sort((left, right) => left - right);
  const attemptCount = observations.length;
  return {
    providerId,
    attemptCount,
    providerSuccessRate: statusCounts.succeeded / attemptCount,
    fallbackRate: fallbackAttempts / attemptCount,
    fallbackSuccessRate: fallbackAttempts === 0 ? null : fallbackSuccesses / fallbackAttempts,
    malformedRate: statusCounts.malformed / attemptCount,
    timeoutRate: statusCounts.timeout / attemptCount,
    rateLimitedRate: statusCounts["rate-limited"] / attemptCount,
    p50LatencyMs: percentile(latencies, 0.5),
    p95LatencyMs: percentile(latencies, 0.95),
    statusCounts,
  };
}
