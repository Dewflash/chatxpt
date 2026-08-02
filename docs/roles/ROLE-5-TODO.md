# Role 5 To-Do: Viewer Quest Board UI/UX

**Owner:** `drdexe`

Detailed product work intentionally begins with one owner decision pass. Do not implement speculative viewer surfaces before R5-001 is recorded.

| ID | Priority | Status | Task | Depends on | Acceptance evidence |
| --- | --- | --- | --- | --- | --- |
| R5-001 | P0 | READY | Complete one consolidated viewer/overlay decision pass. | Root product direction | One recorded response settles Twitch Extension layout, vote interaction, active quest, fallback board, chat fallback, overlay, rewards, and MVP exclusions. |
| R5-002 | P0 | BLOCKED | Apply Role 4 visual system to viewer-specific components. | R4-002 and R5-001 | Viewer components remain readable, fast, accessible, responsive, and distinct from streamer controls. |
| R5-003 | P0 | BLOCKED | Build Twitch Extension voting and active-quest experience. | Role 1 participation contract; Role 3 state | Exactly three options, acknowledgement, tally, countdown, tie/cancel/winner, active quest, progress, and result states work. |
| R5-004 | P0 | BLOCKED | Build hosted Viewer Quest Board fallback. | R5-001; participation contract | Link/room entry and voting work across mobile and desktop without separate account requirement. |
| R5-005 | P0 | BLOCKED | Build `1`/`2`/`3` Twitch-chat fallback presentation. | Role 1 chat adapter | Stream and viewer instructions clearly show fallback availability and counted state. |
| R5-006 | P0 | BLOCKED | Build viewer-facing OBS overlay visuals. | Role 1 OBS contract; Role 3 state | Quest, timer, progress, result, hype, inactive, reconnect, and failure states display correctly in browser source. |
| R5-007 | P1 | BLOCKED | Build reactions, hype, community points, and reconnect experience. | Participation/reward contracts | Non-monetary engagement works without breaking the primary vote path. |
| R5-008 | P0 | BLOCKED | Produce multi-device, responsive, and failure evidence. | R5-003 through R5-007 | Working sites, two-device vote evidence, screenshots/recording, accessibility and reconnect checks. |

## Decisions Role 5 may make without Role 1

- Viewer and overlay information architecture and interaction details
- Vote, reaction, hype, progress, result, reward, and reconnect presentation
- Hosted fallback and chat-fallback user experience
- Viewer-engagement measurements proposed to Role 1
