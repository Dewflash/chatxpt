# Role 5 Guide: Viewer Quest Board UI/UX

**Owner:** `drdexe`

Read the root `AGENTS.md` before this guide. The root guide is authoritative if anything conflicts. Detailed viewer and overlay scope will be refined by the owner without weakening the baseline below.

For the current MVP planning pass, Role 2 decides Role 5's build plan under D-016. Role 5 reviews it for feasibility and then owns detailed visual, interaction, accessibility, component, and code decisions that fit the plan.

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

Provide working viewer, fallback, and overlay sites against agreed mock and live contracts, multi-device vote evidence, responsive screenshots or recordings, and loading/error/reconnect/accessibility coverage.
