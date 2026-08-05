# AI intelligence public entrypoint

Role 2 owns implementations behind the provider ports exported by `index.ts`. Consumers import this public module or `@/core`, never Role 2 private adapters, prompts, provider payloads, or analysis internals.

`createValidatingIntelligenceProvider` validates and combines distinct gameplay and audience snapshots while preserving their provenance and the separately validated streamer profile input. `createValidatingCandidateProvider` wraps a Role 2-owned generation strategy and rejects output that does not satisfy the canonical exactly-three candidate contract.

No model, provider, prompt, quest-quality rule, or production candidate strategy is selected here. Provider adoption remains a joint Role 2/Role 3 recommendation, and Role 3 remains the deterministic validation and fallback authority.

Fixture-only UI-X09 proposal payloads live under `tests/`. They cover the required confidence, unknown, stale, capture-denied, provider, algorithmic, and fallback presentation shapes, but are not exported to product consumers and are not live evidence. Role 1 must review and promote any accepted canonical examples into `@/core/testing`.
