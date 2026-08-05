# Role 3 To-Do: Quest Engine

**Owner:** `L0pch`

Update only this role's statuses and evidence. Raise shared-contract or UI needs through a `cross-role` GitHub Issue before implementation.

Execute these outcomes through `docs/build-plans/ROLE-3-BUILD-PLAN.md`; its decision gates belong to L0pch unless explicitly marked joint or escalated.

**Next pass:** consume Role 1's accepted timer [#36](https://github.com/Dewflash/chatxpt/issues/36), intervention composition [#37](https://github.com/Dewflash/chatxpt/issues/37), and emergency state [#38](https://github.com/Dewflash/chatxpt/issues/38) contracts when they land on `main`; coordinate the authoritative vote-close/accepted-tally seam in [#42](https://github.com/Dewflash/chatxpt/issues/42), then implement deterministic vote resolution and activation without winner override.

**Phase 6 owner decisions:** D3-20 and D3-21 are accepted. Role 2 generation must target exactly three distinct, concise, feasible, evidence-grounded quests, and every provider, algorithmic, or deterministic-fallback candidate must pass the same Role 3 validator without source-based exceptions. Runtime/provider work remains blocked on the joint D23 gate and accepted candidate integration.

| ID | Priority | Status | Task | Depends on | Acceptance evidence |
| --- | --- | --- | --- | --- | --- |
| R3-001 | P0 | DONE | Inspect the prototype and define the pure public quest-engine port/state boundaries. | Role 1 provisional contracts | `src/quest-engine/engine.test.ts` covers the public engine entrypoint, canonical candidate/command/state/event/error seams, deterministic selection, and explicitly test-only edge fixtures without persistence, UI, Role 2, Twitch, or Supabase imports. |
| R3-002 | P0 | IN PROGRESS | Implement deterministic, revision-aware quest lifecycle and transitions. Role 1 retains duplicate-command detection because the pure engine is not given the processed-command ledger. | Shared contracts landed on `main`; authoritative tick command proposed in [#36](https://github.com/Dewflash/chatxpt/issues/36) | Tests cover legal states, stale revisions, absolute time, typed illegal-command results, and the documented Role 1 duplicate-command boundary. |
| R3-003 | P0 | IN PROGRESS | Implement intervention, timing, repetition, cooldown, and streamer-boundary rules. | Role 2 snapshot contract exists; Role 1 composition/state decisions tracked in [#37](https://github.com/Dewflash/chatxpt/issues/37) and [#38](https://github.com/Dewflash/chatxpt/issues/38) | Pure policy tests cover quiet, busy, unsafe, repetitive, uncertain, stale, and unknown-heavy moments without UI assumptions; orchestrator wiring remains blocked on the recorded context seam. |
| R3-004 | P0 | READY | Define provider/AI quality criteria with Role 2. | Accepted D-014 | Joint comparison covers quest quality, game fit, structured output, latency, cost, reliability, and fallback. |
| R3-005 | P0 | BLOCKED | Define quest-domain AI objectives, generation instructions, and validation use. D3-20 and D3-21 now settle the provider-independent objective and equal-validation policy; executable integration still waits on the joint gate. | Joint recommendation and candidate contract | Exactly three candidates are feasible, distinct, concise, game-neutral, evidence-grounded, and explainably accepted/rejected; provider or algorithmic provenance never bypasses the deterministic validator. |
| R3-006 | P0 | DONE | Build deterministic safety/feasibility validation and fallback quest library. | Quest schema | `validation.test.ts` covers concrete harmful, illegal, and offline physical-dare instructions plus restricted, accessibility-conflicting, unsupported/unknown-dependent, low-confidence, badly timed, duplicated, recently repeated, zero/one/two usable, deterministic replay, and fallback-exhaustion cases; fallbacks use the canonical candidate schema. |
| R3-007 | P0 | BLOCKED | Implement progress, result, scoring, and non-monetary reward rules. | Shared quest/participation contracts | Automatic/manual progress and all terminal outcomes tested. |
| R3-008 | P1 | READY | Produce engine evaluation and failure evidence. | Ongoing | Tests and examples cover provider unavailable, reconnect, cancellations, and varied game genres. |

## Decisions Role 3 may make without Role 1

- Quest lifecycle mechanics and timing
- Automatic/manual proposal, approval, veto, and emergency-control rules
- Deterministic safety, feasibility, scoring, reward, and fallback behaviour
- Quest-domain AI objectives, instructions, quality criteria, and model-output use

Provider/model adoption is a joint Role 2/Role 3 recommendation and requires Role 1 awareness because it affects cost and external services.
