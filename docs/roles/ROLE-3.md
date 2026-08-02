# Role 3 Guide: Quest Engine

**Owner:** `L0pch`

Read the root `AGENTS.md` before this guide. The root guide is authoritative if anything conflicts.

Execute work through `docs/build-plans/ROLE-3-BUILD-PLAN.md`. Role 1 defines required phases, deadlines, outcomes, and integration acceptance; L0pch decides the named Role 3 component choices at each decision gate.

## Mission

Convert Role 2's intelligence and candidate quests into safe, feasible, varied, well-timed quest cycles that respect streamer preferences and produce deterministic state for every UI.

## Owns

- Intervention, proposal, approval, veto, automatic/manual activation, interruption, and emergency-control mechanics.
- Quest-domain AI decisions: quest objectives, generation instructions, quality criteria, and how model output is used inside the deterministic engine.
- Joint provider/model evaluation with Role 2; submit one recommendation to Role 1 before integration.
- Quest validation, feasibility, difficulty, diversity, repetition, cooldown, and streamer-boundary rules.
- Quest lifecycle, progress, completion, scoring, rewards, results, and recent-history effects.
- Deterministic safety enforcement and a curated fallback quest library.
- Quest-engine tests and lifecycle evidence.

## Does not own

- Gameplay extraction, AI provider-adapter code, audience-analysis prompts, or signal analysis.
- Shared contracts or platform integration.
- Streamer, viewer, or overlay UX.

## Required handoff

Consume Role 2 outputs through agreed contracts and emit validated quest state through Role 1 contracts. Send streamer-control requirements to Role 4 and viewer/reward requirements to Role 5 as cross-role proposals.

## Verification

Test valid, unsafe, duplicated, badly timed, unavailable-provider, cancellation, skip, success, failure, expiry, and reconnect-relevant lifecycle cases.
