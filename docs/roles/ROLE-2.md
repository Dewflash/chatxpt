# Role 2 Guide: AI Intelligence and Data Extraction

**Owner:** `joelyrk`

Read the root `AGENTS.md` before this guide. The root guide is authoritative if anything conflicts.

The `Owns` and `Does not own` labels below describe module responsibility and decision context, not contributor edit permissions. Under D-071, any contributor may work across these areas while preserving the integration contract.

Execute work through `docs/build-plans/ROLE-2-BUILD-PLAN.md`. Role 1 defines required phases, deadlines, outcomes, and integration acceptance; Joelyrk decides the named Role 2 component choices at each decision gate.

Implement through the public seams in `docs/build-plans/INTEGRATION-CONTRACT.md`; intelligence modules return intelligence/candidates and do not contain session persistence, lifecycle, broadcasting, routes, or UI state. A Role 2 contributor may implement those concerns in their corresponding modules.

## Mission

Turn gameplay and audience activity into reliable, model-ready intelligence and exactly three structured quest candidates for Role 3.

## Owns

- Gameplay-data extraction implementations behind Role 1's interface.
- Chat, sentiment, intent, energy, humour, risk, boredom, hype, and behavioural analysis.
- Signal aggregation, timestamps, confidence, and model-ready context.
- AI provider adapters, model-ready context, signal-analysis prompts, structured transport, runtime validation, and provider reliability evaluation.
- Joint provider/model evaluation with Role 3; submit one recommendation to Role 1 before integration.
- AI-specific privacy, latency, cost, reliability, moderation, and observability evidence.
- The current MVP build plans for Roles 4 and 5 under D-016, including outcomes, surface/flow coverage, priorities, required states, AI/data requirements, mock/live boundaries, milestones, acceptance criteria, exclusions, and handoff order.

## Does not own

- Shared contracts or Twitch/OBS integration.
- Quest timing, lifecycle, scoring, deterministic safety enforcement, or activation behaviour.
- Role 4/5 source implementation or detailed visual, interaction, accessibility, component, and code decisions that fit the approved build plans.

## Required handoff

Provide Role 3 with normalised behavioural signals, capability tier, confidence, traceable context, three candidate quests, validation metadata, and provider/fallback status through canonical ports. Compare provider candidates with Role 3, covering integration, latency, privacy, cost, structured output, reliability, quest quality, and engine fit. Give Roles 4 and 5 separate but synchronised implementation-ready MVP plans plus their shared dependency/fixture/contract matrix, collect feasibility context from each lead, revise as needed, and notify Role 1. Any contributor may implement contract changes immediately with Role 1 notification, affected producer/consumer tests, and pre-merge deconfliction.

## Verification

Maintain producer/consumer contract tests, representative universal/calibrated extraction and AI evaluation cases, malformed-output tests, provider-failure behaviour, latency/resource observations, and a credential-free test path.
