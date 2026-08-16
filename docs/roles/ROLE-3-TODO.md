# Role 3 To-Do: Quest Engine

**Owner:** `L0pch`

Update only this role's statuses and evidence. Raise shared-contract or UI needs through a `cross-role` GitHub Issue before implementation.

Execute these outcomes through `docs/build-plans/ROLE-3-BUILD-PLAN.md`; its decision gates belong to L0pch unless explicitly marked joint or escalated.

**Next pass:** return to R3-007 only when issue #50 supplies the accepted predicate-bearing completion rule; otherwise support Role 1 integration evidence without crossing ownership.

**Current bounded pass:** adaptive timing now uses the saved streamer intensity to adjust only the busy-gameplay and suitability thresholds. Low intensity waits for quieter, stronger moments; high intensity permits more active opportunities; missing intensity preserves the neutral default. Hard lifecycle, emergency, safety, freshness, confidence, and unknown-evidence gates remain unchanged and always run first.

**Phase 6 owner decisions:** D3-20 and D3-21 are accepted. Role 2 generation must target exactly three distinct, concise, feasible, evidence-grounded quests, and every provider, algorithmic, or deterministic-fallback candidate must pass the same Role 3 validator without source-based exceptions. Runtime/provider work remains blocked on the joint D23 gate and accepted candidate integration.

| ID | Priority | Status | Task | Depends on | Acceptance evidence |
| --- | --- | --- | --- | --- | --- |
| R3-001 | P0 | DONE | Inspect the prototype and define the pure public quest-engine port/state boundaries. | Role 1 provisional contracts | `src/quest-engine/engine.test.ts` covers the public engine entrypoint, canonical candidate/command/state/event/error seams, deterministic selection, and explicitly test-only edge fixtures without persistence, UI, Role 2, Twitch, or Supabase imports. |
| R3-002 | P0 | DONE | Implement deterministic, revision-aware quest lifecycle and transitions. Role 1 retains duplicate-command detection because the pure engine is not given the processed-command ledger. | Vote-close and authoritative tick seams landed through [#42](https://github.com/Dewflash/chatxpt/issues/42) and [#36](https://github.com/Dewflash/chatxpt/issues/36) | `engine.test.ts` covers majority, deterministic ties, zero-vote no-activation, authoritative deadline/revision/tally checks, non-live session cancellation, session-scoped and mismatched-cycle intelligence, validation, activation, deadline-anchored delayed expiry, ordered elapsed-boundary events, terminal-to-cooldown, cooldown-to-idle reset, early no-op ticks, and fail-closed malformed or inconsistent lifecycle state. Role 1 retains duplicate-command detection and revision stamping. |
| R3-003 | P0 | DONE | Implement intervention, timing, repetition, cooldown, and streamer-boundary rules. | Role 2 snapshot contract and Role 1 composition/state seams from [#37](https://github.com/Dewflash/chatxpt/issues/37) and [#38](https://github.com/Dewflash/chatxpt/issues/38) are merged | Pure policy tests cover quiet, busy, unsafe, repetitive, uncertain, stale, unknown-heavy, emergency-paused, accepted hard-interruption moments, intensity-zero restraint, intensity-one tolerance, and the neutral missing-intensity default. Hard gates remain profile-independent; the orchestrator composition, recent history, and emergency latch are available. |
| R3-004 | P0 | IN PROGRESS | Define provider/AI quality criteria with Role 2. | Accepted D-014; awaiting Role 2 trials and joint recommendation | `src/quest-engine/PROVIDER_QUALITY_RUBRIC.md` and deterministic tests define Role 3 hard gates, weighted quest-quality criteria, shared cases, and required joint evidence without selecting a provider; Role 2 must add structured-output, latency, privacy, cost, rate-limit, and reliability measurements. |
| R3-005 | P0 | BLOCKED | Define quest-domain AI objectives, generation instructions, and validation use. D3-20 and D3-21 now settle the provider-independent objective and equal-validation policy; executable integration still waits on the joint gate. | Joint recommendation and candidate contract | Exactly three candidates are feasible, distinct, concise, game-neutral, evidence-grounded, and explainably accepted/rejected; provider or algorithmic provenance never bypasses the deterministic validator. |
| R3-006 | P0 | DONE | Build deterministic safety/feasibility validation and fallback quest library. | Quest schema | `validation.test.ts` covers concrete harmful, illegal, and offline physical-dare instructions plus restricted, accessibility-conflicting, unsupported/unknown-dependent, low-confidence, badly timed, duplicated, recently repeated, zero/one/two usable, deterministic replay, and fallback-exhaustion cases; fallbacks use the canonical candidate schema. |
| R3-007 | P0 | IN PROGRESS | Implement progress, result, scoring, and non-monetary reward rules. | Canonical progress/reward commands are merged; issue [#50](https://github.com/Dewflash/chatxpt/issues/50) and D-060 on PR [#144](https://github.com/Dewflash/chatxpt/pull/144) track the remaining predicate-bearing completion rule at activation | `outcomes.test.ts` and `engine.test.ts` cover monotonic manual progress, strict fresh/supported/allowed automatic evidence, contradiction and cross-game rejection, transition/menu/cutscene/inactive-match blocking, automatic value 1 rejection followed by manual success, all five outcome score/hype rules, history disposition, and 120-second cooldown without persisting or broadcasting. Automatic terminal success and rewards remain disabled until the persisted active rule carries an explicit matched target/comparison predicate. |
| R3-008 | P1 | DONE | Produce engine evaluation and failure evidence. | Ongoing | `src/quest-engine/evaluation.test.ts` and `EVALUATION.md` cover deterministic provider-unavailable/malformed fallback, reconnect-relevant state reconstruction and stale revisions, ordinary/emergency cancellation, and game-neutral output across tactical shooter, racing, strategy, platformer, and unknown fixture profiles without claiming live evidence. |

## Decisions Role 3 may make without Role 1

- Quest lifecycle mechanics and timing
- Automatic/manual proposal, approval, veto, and emergency-control rules
- Deterministic safety, feasibility, scoring, reward, and fallback behaviour
- Quest-domain AI objectives, instructions, quality criteria, and model-output use

Provider/model adoption is a joint Role 2/Role 3 recommendation and requires Role 1 awareness because it affects cost and external services.
