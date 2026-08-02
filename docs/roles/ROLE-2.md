# Role 2 Guide: AI Intelligence and Data Extraction

**Owner:** `joelyrk`

Read the root `AGENTS.md` before this guide. The root guide is authoritative if anything conflicts.

## Mission

Turn gameplay and audience activity into reliable, model-ready intelligence and exactly three structured quest candidates for Role 3.

## Owns

- Gameplay-data extraction implementations behind Role 1's interface.
- Chat, sentiment, intent, energy, humour, risk, boredom, hype, and behavioural analysis.
- Signal aggregation, timestamps, confidence, and model-ready context.
- AI provider adapters, model-ready context, signal-analysis prompts, structured transport, runtime validation, and provider reliability evaluation.
- Joint provider/model evaluation with Role 3; submit one recommendation to Role 1 before integration.
- AI-specific privacy, latency, cost, reliability, moderation, and observability evidence.

## Does not own

- Shared contracts or Twitch/OBS integration.
- Quest timing, lifecycle, scoring, deterministic safety enforcement, or activation behaviour.
- Streamer, viewer, or overlay UX.

## Required handoff

Provide Role 3 with normalised behavioural signals, confidence, traceable context, three candidate quests, validation metadata, and provider/fallback status. Compare provider candidates with Role 3, covering integration, latency, privacy, cost, structured output, reliability, quest quality, and engine fit. Propose contract changes to Role 1 before implementation.

## Verification

Maintain representative extraction and AI evaluation cases, malformed-output tests, provider-failure behaviour, latency observations, and a credential-free test path.
