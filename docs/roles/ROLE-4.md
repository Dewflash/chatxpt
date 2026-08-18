# Role 4 Guide: Streamer Studio UI/UX

**Owner:** `JYL1m`

Read the root `AGENTS.md` before this guide. The root guide is authoritative if anything conflicts. Detailed Streamer Studio scope will be refined by the owner without weakening the baseline below.

Role 4 is the streamer-UX and design-system responsibility lead, not an exclusive file owner. Under D-071, any contributor may implement across role directories while preserving accepted UX decisions and public seams.

For the current MVP planning pass, Role 2 decides Role 4's build plan under D-016. Role 4 reviews it for feasibility and then owns detailed visual, interaction, accessibility, component, and code decisions that fit the plan.

Before a first planned pass, read the Role 2-maintained Role 4 execution plan and its feasibility record, then follow the accepted phases and evidence. This preparation is not a cross-role edit-permission gate.

Role 4 may begin a session with only `I am Role 4. What do I need to do?`. Codex must follow the guided execution mode in `AGENTS.md`, choose the current ready pass, and ask only the current phase's owner decisions with recommendations. Role 4 does not need to identify technical tasks or Git steps. Settled Role 4 choices and pass evidence are recorded in `docs/roles/ROLE-4-EXECUTION.md`; Role 2 maintains the baseline plan, which any contributor may edit with coordination.

Also follow `docs/build-plans/INTEGRATION-CONTRACT.md`: export a public UI module, consume Role 1 view models, emit commands, and keep AI/engine/persistence/permission/timer authority outside the UI.

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

Consume Role 1 contracts and Role 3 state. Keep engine or integration authority outside UI code; any contributor may implement missing settings or commands in their proper module and notify the relevant leads.

## Verification

Provide consumer contract tests, a public UI module mounted by Role 1, responsive screenshots or recordings, canonical loading/error/reconnect states, accessibility checks, and a complete setup-to-live-control walkthrough.
