# Role 3 Guide: Quest Engine

**Owner:** `L0pch`

Read the root `AGENTS.md` before this guide. The root guide is authoritative if anything conflicts.

The `Owns` and `Does not own` labels below describe module responsibility and decision context, not contributor edit permissions. Under D-071, any contributor may work across these areas while preserving the integration contract.

Execute work through `docs/build-plans/ROLE-3-BUILD-PLAN.md`. Role 1 defines required phases, deadlines, outcomes, and integration acceptance; L0pch decides the named Role 3 component choices at each decision gate.

Implement the pure engine seam in `docs/build-plans/INTEGRATION-CONTRACT.md`; Role 3 returns decisions/state/events/allowed actions while Role 1 owns authentication, persistence, realtime, and platform execution.

## Mission

Convert Role 2's intelligence and candidate quests into safe, feasible, varied, well-timed quest cycles that respect streamer preferences and produce deterministic state for every UI.

## Owns

- Intervention, proposal, approval, veto, automatic/manual activation, interruption, and emergency-control mechanics.
- Quest-domain AI decisions: quest objectives, generation instructions, quality criteria, and how model output is used inside the deterministic engine.
- Evaluate the D-072-approved OpenAI `gpt-5.6-terra` path with Role 2; adoption is settled, but Role 3's quest-quality rubric and deterministic validation/replacement authority remain mandatory.
- Quest validation, feasibility, difficulty, diversity, repetition, cooldown, and streamer-boundary rules.
- Quest lifecycle, progress, completion, scoring, rewards, results, and recent-history effects.
- Deterministic safety enforcement and a curated fallback quest library.
- Quest-engine tests and lifecycle evidence.

## Does not own

- Gameplay extraction, AI provider-adapter code, audience-analysis prompts, or signal analysis.
- Shared contracts or platform integration.
- Streamer, viewer, or overlay UX.

## Required handoff

Consume Role 2 outputs through agreed contracts and emit validated quest state through Role 1 contracts. Notify Role 4 of streamer-control requirements and Role 5 of viewer/reward requirements; any contributor may implement the coherent cross-role slice, with an issue only when durable coordination is useful.

## Verification

Test the public engine port plus valid, unsafe, duplicated, badly timed, unavailable-provider, duplicate-command, stale-revision, clock-skew, cancellation, skip, success, failure, expiry, and reconnect-relevant lifecycle cases.
