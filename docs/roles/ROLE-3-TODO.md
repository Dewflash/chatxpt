# Role 3 To-Do: Quest Engine

**Owner:** `L0pch`

Update only this role's statuses and evidence. Raise shared-contract or UI needs through a `cross-role` GitHub Issue before implementation.

Execute these outcomes through `docs/build-plans/ROLE-3-BUILD-PLAN.md`; its decision gates belong to L0pch unless explicitly marked joint or escalated.

**Next pass:** answer the Phase 1 gate once, then implement R3-P01 owned ports/fixtures and R3-P02 state-machine skeleton without waiting for live AI, Twitch, or Supabase.

| ID | Priority | Status | Task | Depends on | Acceptance evidence |
| --- | --- | --- | --- | --- | --- |
| R3-001 | P0 | READY | Inspect the prototype and define the pure public quest-engine port/state boundaries. | Role 1 provisional contracts | Public entry point and consumer/producer tests cover candidate input, commands, revisions, state/events, allowed actions, progress, result, and fallback without persistence/UI imports. |
| R3-002 | P0 | BLOCKED | Implement deterministic, revision-aware quest lifecycle and transitions. | Shared contracts | Tests cover legal states plus duplicate command IDs, stale revisions, absolute time, and typed illegal-command results. |
| R3-003 | P0 | BLOCKED | Implement intervention, timing, repetition, cooldown, and streamer-boundary rules. | Role 2 snapshot contract | Tests cover quiet, busy, unsafe, repetitive, and uncertain moments without UI assumptions. |
| R3-004 | P0 | READY | Define provider/AI quality criteria with Role 2. | Accepted D-014 | Joint comparison covers quest quality, game fit, structured output, latency, cost, reliability, and fallback. |
| R3-005 | P0 | BLOCKED | Define quest-domain AI objectives, generation instructions, and validation use. | Joint recommendation and candidate contract | Exactly three candidates are feasible, distinct, concise, game-neutral, and explainably accepted/rejected. |
| R3-006 | P0 | READY | Build deterministic safety/feasibility validation and fallback quest library. | Quest schema | Unsafe, impossible, duplicated, badly timed, and restricted quests are rejected; fallback uses same schema. |
| R3-007 | P0 | BLOCKED | Implement progress, result, scoring, and non-monetary reward rules. | Shared quest/participation contracts | Automatic/manual progress and all terminal outcomes tested. |
| R3-008 | P1 | READY | Produce engine evaluation and failure evidence. | Ongoing | Tests and examples cover provider unavailable, reconnect, cancellations, and varied game genres. |

## Decisions Role 3 may make without Role 1

- Quest lifecycle mechanics and timing
- Automatic/manual proposal, approval, veto, and emergency-control rules
- Deterministic safety, feasibility, scoring, reward, and fallback behaviour
- Quest-domain AI objectives, instructions, quality criteria, and model-output use

Provider/model adoption is a joint Role 2/Role 3 recommendation and requires Role 1 awareness because it affects cost and external services.
