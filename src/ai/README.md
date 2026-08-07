# AI intelligence public entrypoint

Role 2 owns implementations behind the provider ports exported by `index.ts`. Consumers import this public module or `@/core`, never Role 2 private adapters, prompts, provider payloads, or analysis internals.

`createValidatingIntelligenceProvider` validates and combines distinct gameplay and audience snapshots while preserving their provenance and the separately validated streamer profile input. `createValidatingCandidateProvider` wraps a Role 2-owned generation strategy and rejects output that does not satisfy the canonical exactly-three candidate contract.

`createProviderFallbackGenerationStrategy` composes an injected provider strategy with an injected credential-free algorithmic strategy. It enforces a bounded provider timeout, rejects malformed or incorrectly labelled output, preserves caller cancellation, and emits privacy-safe attempt observations without raw prompts or provider payloads. `summariseProviderAttempts` reports pinned-provider success, fallback, malformed, timeout, rate-limit, and p50/p95 latency measurements.

`createAlgorithmicCandidateStrategy` is the credential-free candidate path for the MVP. It deterministically selects three game-neutral quest prompts from canonical intelligence/profile/recent-title input, labels them `algorithmic`, cites only known canonical signal IDs when available, and never retains raw chat text or provider payloads.

[`PROVIDER_EVALUATION.md`](./PROVIDER_EVALUATION.md) defines the Role 2 operational half of the joint Role 2/3 trial matrix and records the fixture/live evidence boundary.

No model, provider, prompt, or quest-quality rule is selected here. Provider adoption remains a joint Role 2/Role 3 recommendation. Every provider or algorithmic result still goes to Role 3 for deterministic safety, evidence, feasibility, diversity, history, and fallback handling.

Fixture-only UI-X09 proposal payloads live under `tests/`. They cover the required confidence, unknown, stale, capture-denied, provider, algorithmic, and fallback presentation shapes, but are not exported to product consumers and are not live evidence. Role 1 must review and promote any accepted canonical examples into `@/core/testing`.
