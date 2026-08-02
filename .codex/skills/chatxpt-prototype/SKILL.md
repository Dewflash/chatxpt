---
name: chatxpt-prototype
description: Build, change, debug, or validate the ChatXPT livestream sidequest prototype. Use for work involving gameplay signals, chat sentiment, streamer profiles, sidequest generation, viewer voting, producer review, overlay state, timers, rewards, demo scenarios, or competition-readiness in this repository.
---

# ChatXPT Prototype

Build the smallest complete and judge-visible product slice. Deterministic fixtures prove component behaviour; real OBS-captured gameplay and real Twitch activity prove the live product path.

## Workflow

1. Read `AGENTS.md`, `docs/build-plans/INTEGRATION-CONTRACT.md`, the assigned role guide/TODO, and the assigned execution plan under `docs/build-plans/` before editing.
2. Identify the plan phase/pass, observable user outcome, acceptance evidence, and open owner-decision gate.
3. Preserve gameplay state, viewer sentiment, and streamer profile as distinct inputs.
4. Keep provider calls behind the server API and validate all external output.
5. Preserve the deterministic quest-engine authority selected by Role 3 before a quest reaches viewers or the overlay.
6. Verify component logic against clearly labelled fixtures; verify every live/integration claim with real captured input and report unavailable facts as `unknown`.
7. Run the relevant producer/consumer contract test, focused test, and `npm run check` before declaring the slice ready.

## Product constraints

- Generate exactly three meaningfully distinct quest options for a vote.
- Prefer challenges understood in a glance and completed within the current match.
- Never produce dangerous, illegal, humiliating, discriminatory, sexual, monetary, or real-world physical dares.
- Respect streamer boundaries and avoid deliberately sabotaging teammates without consent.
- Expose why a quest fits the signals in producer UI, not in the stream overlay.
- Treat model latency, refusal, invalid output, and outage as normal failure cases with credential-free algorithmic intelligence and deterministic quest fallback operating on the same real inputs.

## Change routing

- For quest behavior or prompts, read `references/quest-policy.md`.
- For scope, read `docs/PRODUCT_BRIEF.md` and `docs/SUBMISSION_CHECKLIST.md`.
- For data flow or integrations, read `docs/ARCHITECTURE.md`.
- For every cross-role public seam, shared-file rule, orchestrator/realtime boundary, and UI-plan minimum, read `docs/build-plans/INTEGRATION-CONTRACT.md`.
- For phase order, owner decisions, deadlines, and acceptance evidence, read the assigned plan under `docs/build-plans/`.
- Check `docs/DECISIONS.md`; do not silently convert a proposal into an accepted decision.

## Handoff evidence

Report the route or interaction exercised, passing commands, real-input evidence, fixture-only evidence, fallback/unknown behavior checked, and anything not verified. Do not claim end-to-end readiness from source inspection or simulated fixtures alone.
