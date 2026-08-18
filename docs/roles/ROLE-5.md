# Role 5 Guide: Viewer Quest Board UI/UX

**Owner:** `drdexe`

Read the root `AGENTS.md` before this guide. The root guide is authoritative if anything conflicts. Detailed viewer and overlay scope will be refined by the owner without weakening the baseline below.

Role 5 is the viewer/overlay UX responsibility lead, not an exclusive file owner. Under D-071, any contributor may implement across role directories while preserving accepted UX decisions and public seams.

For the current MVP planning pass, Role 2 decides Role 5's build plan under D-016. Role 5 reviews it for feasibility and then owns detailed visual, interaction, accessibility, component, and code decisions that fit the plan.

Before a first planned pass, read the Role 2-maintained Role 5 execution plan and its feasibility record, then follow the accepted phases and evidence. This preparation is not a cross-role edit-permission gate.

Role 5 may begin a session with only `I am Role 5. What do I need to do?`. Codex must follow the guided execution mode in `AGENTS.md`, choose the current ready pass, and ask only the current phase's owner decisions with recommendations. Role 5 does not need to identify technical tasks or Git steps. Settled Role 5 choices and pass evidence are recorded in `docs/roles/ROLE-5-EXECUTION.md`; Role 2 maintains the baseline plan, which any contributor may edit with coordination.

Also follow `docs/build-plans/INTEGRATION-CONTRACT.md`: export public viewer/overlay modules, consume Role 1 view models, emit commands, and keep vote/engine/persistence/permission/timer authority outside the UI.

## Mission

Deliver clear, fast, enjoyable participation across the Twitch Extension, hosted fallback Quest Board, Twitch-chat fallback, and viewer-facing OBS overlay visuals.

## Owns

- Twitch Extension viewer implementation and detailed product/UX decisions within the accepted D-016 build plan.
- Hosted Viewer Quest Board and fallback participation UX.
- Voting, reactions, hype, progress, results, rewards, reconnect, and error presentation.
- Viewer-facing OBS overlay visuals; Role 1 retains the OBS integration contract.
- Viewer-engagement measurements proposed to Role 1.

## Does not own

- AI behaviour, extraction, quest-engine rules, shared contracts, Twitch backend integration, or streamer controls.
- Shared brand-token decisions owned by Role 4.

## Required handoff

Consume the private participation and quest-state contracts from Roles 1 and 3. Apply Role 4's shared visual system and propose changes instead of editing Role 4 files.

## Verification

Provide consumer contract tests, public viewer/fallback/overlay modules mounted by Role 1, same-revision multi-device vote evidence, responsive screenshots or recordings, and canonical loading/error/reconnect/accessibility coverage.
