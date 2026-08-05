# Quest-engine public entrypoint

Role 3 owns the pure engine implementation behind the contracts exported by `index.ts`. The engine returns a decision and event drafts; Role 1 remains responsible for authentication, idempotency, authoritative revisions, persistence, and broadcast.

Role 1 created this additive boundary under the recorded integration override. It does not choose Role 3's state transitions, timing, intervention, safety, scoring, reward, fallback, or AI-use behavior.

`createDefaultQuestEngine()` returns the stateless Role 3 implementation and uses only the authoritative `now` supplied by Role 1. Event drafts intentionally omit correlation and revision metadata because Role 1 stamps those fields after accepting and committing the decision.

Role 1 also owns duplicate-command detection. The engine rejects stale revisions, but it cannot identify duplicate command IDs because its pure input contains no processed-command ledger.

The accepted Core direction in issue #36 adds an authoritative timer/tick command, but that contract is not yet on `main`. The engine therefore refuses to bypass cooldown through `system.intelligence-ready` and does not invent a private command to advance terminal states.

This is component evidence, not a completed live quest workflow. Candidate validation now passes independently, but live composition still requires Role 1's accepted intervention, timer, emergency and vote-close seams.

`DefaultCandidateAssembler` is the Phase 3 pre-engine safety boundary. Role 1 should call it after `DefaultInterventionPolicy` permits a cycle and before issuing `system.intelligence-ready`. It accepts zero or more untrusted candidate values, validates them in the recorded safety-first order, replaces rejected or missing values from a seeded game-neutral fallback library, re-validates diversity and history, and returns either exactly three canonical options with an audit trail or typed fallback exhaustion. It never semantically repairs a rejected objective or weakens safety rules.

Fallback selection is deterministic from the caller-supplied session/cycle seed and authoritative `now`; it does not use ambient time or randomness. Candidate-specific gameplay facts require matching fresh, supported, known signal IDs. The validator deterministically rejects concrete toxic-ingestion, self/other-harm, targeted real-world crime, and offline physical-dare patterns in addition to credential, wagering, humiliation, sexual, and privacy violations. It remains a lexical and contract-based MVP safety layer, not a claim of complete natural-language moderation; producer approval remains the final human boundary.

`DefaultInterventionPolicy` is the independently testable Phase 2 policy port. It consumes canonical intelligence, profile, cycle state, recent summaries, the authoritative clock, and an emergency-lock flag. It rejects context unless intelligence and cycle envelopes match on session, cycle, revision and evidence class. Issue #37 accepts Role 1 composition before candidate generation; passing candidates directly to `DefaultQuestEngine` is not a substitute for that gate.

An `emergency-pause` command cancels the current cycle and emits `quest-cycle.emergency-cancelled`. Role 1 must persist the application-wide emergency latch and refuse new proposals until it is explicitly cleared. Ordinary resumable pause remains unavailable because the canonical lifecycle has neither a paused state nor a resume action.

Voting opens for 30 seconds using authoritative time and rejects late votes. Public winner selection and `start` authority are intentionally absent: D3-12 through D3-15 are recorded, but Role 3 awaits the neutral vote-close and accepted-tally seam proposed in issue #42. Role 1 owns the one-vote-per-viewer ledger; Role 3 will resolve majority, deterministic ties, zero-vote no-activation and final winner validity after authoritative close.

`outcomes.ts` is the pure Phase 5 progress and terminal-reward policy. Manual progress cannot regress. Automatic progress requires an explicit deterministic allowed-signal rule and known, supported gameplay evidence that is no older than 15 seconds and at least 0.75 confidence; audience sentiment never proves gameplay completion. Success awards the active candidate's session points and +10 hype, a failed attempt awards zero points and +2 hype, and cancellation/skip/expiry award neither. Every terminal outcome calculates the existing 120-second cooldown, while only an actual active candidate is eligible for recent history. Role 1 still owns the canonical progress/reward seam tracked in issue #50, the tick command tracked in #36, reward-event envelopes, persistence, and broadcast.
