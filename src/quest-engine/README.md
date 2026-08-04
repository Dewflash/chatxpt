# Quest-engine public entrypoint

Role 3 owns the pure engine implementation behind the contracts exported by `index.ts`. The engine returns a decision and event drafts; Role 1 remains responsible for authentication, idempotency, authoritative revisions, persistence, and broadcast.

Role 1 created this additive boundary under the recorded integration override. It does not choose Role 3's state transitions, timing, intervention, safety, scoring, reward, fallback, or AI-use behavior.

`createDefaultQuestEngine()` returns the stateless Role 3 implementation. It uses the authoritative `now` supplied by Role 1 and a deterministic, injectable tie-breaker. Event drafts intentionally omit correlation and revision metadata because Role 1 stamps those fields after accepting and committing the decision.

Role 1 also owns duplicate-command detection. The engine rejects stale revisions, but it cannot identify duplicate command IDs because its pure input contains no processed-command ledger.

The current Core command union has no authoritative timer/tick command. Phase 1 therefore represents cooldown as a canonical state but does not invent a private command to advance terminal states through cooldown and idle; that progression requires a coordinated Core contract addition.

This is a Phase 1 foundation, not a completed live quest policy. Do not wire untrusted AI candidates to streamer/viewer surfaces until Role 3's deterministic safety, feasibility, repetition, confidence, and streamer-boundary validation phases pass their acceptance evidence.

`DefaultCandidateAssembler` is the Phase 3 pre-engine safety boundary. Role 1 should call it after `DefaultInterventionPolicy` permits a cycle and before issuing `system.intelligence-ready`. It accepts zero or more untrusted candidate values, validates them in the recorded safety-first order, replaces rejected or missing values from a seeded game-neutral fallback library, re-validates diversity and history, and returns either exactly three canonical options with an audit trail or typed fallback exhaustion. It never semantically repairs a rejected objective or weakens safety rules.

Fallback selection is deterministic from the caller-supplied session/cycle seed and authoritative `now`; it does not use ambient time or randomness. Candidate-specific gameplay facts require matching fresh, supported, known signal IDs. The current validator is a deterministic lexical and contract-based MVP safety layer, not a claim of complete natural-language moderation; producer approval remains the final human boundary.

`DefaultInterventionPolicy` is the independently testable Phase 2 policy port. It consumes canonical intelligence, profile, cycle state, recent summaries, the authoritative clock, and an emergency-lock flag. The current Core `QuestEngineInput` does not carry that context, so live orchestrator composition remains blocked on a recorded Role 1 decision; passing candidates directly to `DefaultQuestEngine` is not a substitute for the intervention gate.

An `emergency-pause` command cancels the current cycle and emits `quest-cycle.emergency-cancelled`. Role 1 must persist the application-wide emergency latch and refuse new proposals until it is explicitly cleared. Ordinary resumable pause remains unavailable because the canonical lifecycle has neither a paused state nor a resume action.
