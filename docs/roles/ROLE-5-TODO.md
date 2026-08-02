# Role 5 To-Do: Viewer Quest Board UI/UX

**Owner:** `drdexe`

Detailed product work begins from Role 2's scoped D-016 build plan. Role 5 supplies one feasibility review and does not implement speculative surfaces outside the accepted plan.

| ID | Priority | Status | Task | Depends on | Acceptance evidence |
| --- | --- | --- | --- | --- | --- |
| R5-001 | P0 | READY | Review Role 2's viewer/overlay build plan for feasibility in one response, then record the implementation baseline. | Role 2 R2-009 plan | Review identifies conflicts, missing requirements, shared-contract needs, and implementation risks; Role 2 records any revision and Role 1 is notified. |
| R5-002 | P0 | BLOCKED | Apply Role 4 visual system to viewer-specific components. | R4-002 and R5-001 | Viewer components remain readable, fast, accessible, responsive, and distinct from streamer controls. |
| R5-003 | P0 | BLOCKED | Build Twitch Extension voting and active-quest experience. | Role 1 participation contract; Role 3 state | Exactly three options, acknowledgement, tally, countdown, tie/cancel/winner, active quest, progress, and result states work. |
| R5-004 | P0 | BLOCKED | Build hosted Viewer Quest Board fallback. | R5-001; participation contract | Link/room entry and voting work across mobile and desktop without separate account requirement. |
| R5-005 | P0 | BLOCKED | Build `1`/`2`/`3` Twitch-chat fallback presentation. | Role 1 chat adapter | Stream and viewer instructions clearly show fallback availability and counted state. |
| R5-006 | P0 | BLOCKED | Build viewer-facing OBS overlay visuals. | Role 1 OBS contract; Role 3 state | Quest, timer, progress, result, hype, inactive, reconnect, and failure states display correctly in browser source. |
| R5-007 | P1 | BLOCKED | Build reactions, hype, community points, and reconnect experience. | Participation/reward contracts | Non-monetary engagement works without breaking the primary vote path. |
| R5-008 | P0 | BLOCKED | Produce multi-device, responsive, and failure evidence. | R5-003 through R5-007 | Working sites, two-device vote evidence, screenshots/recording, accessibility and reconnect checks. |

## Decisions Role 5 may make without Role 1 within the accepted build plan

- Viewer and overlay information architecture and interaction details
- Vote, reaction, hype, progress, result, reward, and reconnect presentation
- Hosted fallback and chat-fallback user experience
- Viewer-engagement measurements proposed to Role 1
