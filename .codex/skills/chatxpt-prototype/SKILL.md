---
name: chatxpt-prototype
description: Build, change, debug, or validate the ChatXPT livestream sidequest prototype. Use for work involving gameplay signals, chat sentiment, streamer profiles, sidequest generation, viewer voting, producer review, overlay state, timers, rewards, demo scenarios, or competition-readiness in this repository.
---

# ChatXPT Prototype

Build the smallest complete and judge-visible product slice. Preserve the deterministic demo path while improving live AI behavior.

## Workflow

1. Read `AGENTS.md` and the relevant documents under `docs/`.
2. Identify the observable user outcome and which part of the core loop it affects.
3. Preserve gameplay state, viewer sentiment, and streamer profile as distinct inputs.
4. Keep provider calls behind the server API and validate all external output.
5. Maintain deterministic validation and effective streamer veto/emergency controls before a quest can affect the live experience; follow Role 3's accepted approval and activation mechanics.
6. Verify mock mode first, then verify live AI only when credentials are available.
7. Run the relevant focused test and `npm run check` before declaring the slice ready.

## Product constraints

- Generate exactly three meaningfully distinct quest options for a vote.
- Prefer challenges understood in a glance and completed within the current match.
- Never produce dangerous, illegal, humiliating, discriminatory, sexual, monetary, or real-world physical dares.
- Respect streamer boundaries and avoid deliberately sabotaging teammates without consent.
- Expose why a quest fits the signals in streamer-facing UI, not in the stream overlay.
- Treat model latency, refusal, invalid output, and outage as normal failure cases with a deterministic fallback.

## Change routing

- For quest behavior or prompts, read `references/quest-policy.md`.
- For scope, read `docs/PRODUCT_BRIEF.md` and `docs/SUBMISSION_CHECKLIST.md`.
- For data flow or integrations, read `docs/ARCHITECTURE.md`.
- Check `docs/DECISIONS.md`; do not silently convert a proposal into an accepted decision.

## Handoff evidence

Report the route or interaction exercised, passing commands, fallback behavior checked, and anything not verified. Do not claim end-to-end readiness from source inspection alone.
