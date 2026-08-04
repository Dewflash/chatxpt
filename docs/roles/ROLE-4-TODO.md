# Role 4 To-Do: Streamer Studio UI/UX

**Owner:** `JYL1m`

Detailed product work begins from Role 2's scoped D-016 build plan. Role 4 supplies one feasibility review and does not implement speculative screens outside the accepted plan.

If the owner asks only `What do I need to do?`, Codex selects the first `READY` task and follows `ROLE-4-EXECUTION.md`. The owner answers only the current phase's explained design questions; Codex handles routine technical and Git decisions.

The feasibility review must also check `docs/build-plans/INTEGRATION-CONTRACT.md`: public entry point, required view models/commands/errors/fixtures, Role 1 route mounts, upstream deadlines, and the early design-system handoff to Role 5.

| ID | Priority | Status | Task | Depends on | Acceptance evidence |
| --- | --- | --- | --- | --- | --- |
| R4-001 | P0 | DONE | Let Codex review the Streamer Studio plan, answer D4-01 through D4-04, and post one feasibility response. | Role 2 R2-009 plan; issue #15 | D4-01 through D4-04 are accepted; the consolidated review is posted in [issue #15, comment 5164904061](https://github.com/Dewflash/chatxpt/issues/15#issuecomment-5164904061); Role 1 acknowledged the handoff; and Role 1 plus the Role 2 plan owner approved [PR #30](https://github.com/Dewflash/chatxpt/pull/30) with no scope revision. |
| R4-002 | P0 | IN PROGRESS | Publish the shared visual-system public entry point, then expand accessible base components. | R4-001 | Minimum tokens/components reach Role 5 early through a stable entry point; later expansion does not require Role 5 to edit/copy Role 4 files. |
| R4-003 | P0 | BLOCKED | Build full Studio module and self-service Twitch connection/setup flow for Role 1's thin routes. | R4-001; UI-X01/UI-X02/UI-X05 | Public module renders canonical loading/empty/success/error/permission/disconnected/stale/reconnect fixtures and emits typed commands without backend logic. |
| R4-004 | P0 | BLOCKED | Build persistent streamer profile and challenge customisation. | UI-X02/UI-X03 | Style, tone, intensity, safety, forbidden/preferred types, game, voting, reward, and accessibility settings persist. |
| R4-005 | P0 | BLOCKED | Build pre-stream testing and integration-health experience. | UI-X01/UI-X05/UI-X09 | Twitch, OBS, AI, realtime, and diagnostic simulation status plus useful recovery actions; diagnostic states are labelled and never presented as real evidence. |
| R4-006 | P0 | BLOCKED | Build compact Twitch Config and Live Config modules. | UI-X02/UI-X05/UI-X06; Role 1 D1-08 | Focused embedded UI supports required stream-time commands without duplicating Studio or inventing permissions/lifecycle logic. |
| R4-007 | P1 | BLOCKED | Build richer history and post-stream aggregate summary only after P0 passes. | Session/result contracts; Role 1 approval after P0 | Retention-safe quest outcomes and aggregate engagement are displayed without delaying or becoming a dependency of the demo-critical P0 flow. |
| R4-008 | P0 | BLOCKED | Produce contract, responsive, accessibility, and failure-state evidence. | R4-003 through R4-006 | Consumer contract tests plus working integrated routes, screenshots/recording, focus/reduced-motion checks, and setup-to-live walkthrough. |

## Decisions Role 4 may make without Role 1 within the accepted build plan

- Streamer information architecture and interaction details
- Studio and compact Twitch control presentation
- Shared visual design tokens and base components
- How understandable AI customisation appears to streamers
- Streamer-experience measurements proposed to Role 1
