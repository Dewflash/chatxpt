# Role 4 Guide: Streamer Studio UI/UX

**Owner:** `JYL1m`

Read the root `AGENTS.md` before this guide. The root guide is authoritative if anything conflicts. Detailed Streamer Studio scope will be refined by the owner without weakening the baseline below.

For the current MVP planning pass, Role 2 decides Role 4's build plan under D-016. Role 4 reviews it for feasibility and then owns detailed visual, interaction, accessibility, component, and code decisions that fit the plan.

Before implementation, read the Role 2-authored Role 4 execution plan, provide one consolidated feasibility review, and then follow its accepted phases and acceptance evidence.

## Mission

Deliver a working, persistent, self-service streamer experience that makes ChatXPT understandable before, during, and after a Twitch stream.

## Owns

- Full ChatXPT Studio implementation and detailed product/UX decisions within the accepted D-016 build plan.
- Focused Twitch installation configuration and Live Config UX.
- Streamer profile, preferences, restrictions, safety, game, intensity, testing, status, history, and controls.
- Shared ChatXPT visual tokens, base components, accessibility conventions, and responsive standards.
- Streamer-experience measurements proposed to Role 1.

## Does not own

- AI behaviour, extraction, quest-engine rules, shared contracts, or Twitch/OBS backend integration.
- Viewer voting, Viewer Quest Board, or viewer-facing overlay UX.

## Required handoff

Consume Role 1 contracts and Role 3 state. Propose missing settings or commands to the owning role rather than implementing engine or integration logic inside UI code.

## Verification

Provide a working site against agreed mock and live contracts, responsive screenshots or recordings, loading/error/reconnect states, accessibility checks, and a complete setup-to-live-control walkthrough.
