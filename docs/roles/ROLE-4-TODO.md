# Role 4 To-Do: Streamer Studio UI/UX

**Owner:** `JYL1m`

Detailed product work follows the Role 2-maintained build plan. Role 4 remains the streamer-UX responsibility lead, while any contributor may implement accepted work across roles under D-071.

If the owner asks only `What do I need to do?`, Codex selects the first `READY` task and follows `ROLE-4-EXECUTION.md`. The owner answers only the current phase's explained design questions; Codex handles routine technical and Git decisions.

The feasibility review must also check `docs/build-plans/INTEGRATION-CONTRACT.md`: public entry point, required view models/commands/errors/fixtures, Role 1 route mounts, upstream deadlines, and the early design-system handoff to Role 5.

| ID | Priority | Status | Task | Depends on | Acceptance evidence |
| --- | --- | --- | --- | --- | --- |
| R4-001 | P0 | DONE | Let Codex review the Streamer Studio plan, answer D4-01 through D4-04, and post one feasibility response. | Role 2 R2-009 plan; issue #15 | D4-01 through D4-04 are accepted; the consolidated review is posted in [issue #15, comment 5164904061](https://github.com/Dewflash/chatxpt/issues/15#issuecomment-5164904061); Role 1 acknowledged the handoff; and Role 1 plus the Role 2 plan owner approved [PR #30](https://github.com/Dewflash/chatxpt/pull/30) with no scope revision. |
| R4-002 | P0 | DONE | Publish the shared visual-system public entry point, then expand accessible base components. | R4-001 | [PR #43](https://github.com/Dewflash/chatxpt/pull/43) merged the stable `@/design-system` entry, accessible base components, consumer tests, and responsive evidence after Role 1 and Role 5 approval. |
| R4-003 | P0 | IN PROGRESS | Build full Studio module and self-service Twitch connection/setup flow for Role 1's thin routes. | R4-001; UI-X01/UI-X02/UI-X05; issue #140 | The full module is mounted at `/studio` through a Role 1-owned authenticated application boundary. D-065 supplies a secure manual broadcaster-session start and real channel mapping; full OAuth/EventSub automation remains open. |
| R4-004 | P0 | IN PROGRESS | Build persistent streamer profile and challenge customisation. | UI-X02/UI-X03; issue #140 | The issue #140 candidate edits supported experience/voting/reward defaults and renders all saved fields. Game, restrictions, preferred/forbidden types, accessibility, and session override mutations remain open in the canonical contract; any contributor may implement those fields with affected tests and Role 1 deconfliction. |
| R4-005 | P0 | IN PROGRESS | Build pre-stream testing and integration-health experience. | UI-X01/UI-X05/UI-X09; issue #140 | `/studio` now renders authoritative Twitch, Gameplay Capture, Signal Confidence, sidequest-generation, realtime, and session health without a fabricated combined score. Real-input walkthrough evidence remains. |
| R4-006 | P0 | DONE | Build compact Twitch Config and Live Config modules. | UI-X02/UI-X05/UI-X06; Role 1 D1-08; issue #140 | Role 1 mounted the reviewed modules at `/config.html` and `/live-config.html`; both require Twitch's signed broadcaster role, consume the same authoritative session, and dispatch canonical controls. Focused Role 4 plus server integration tests pass. |
| R4-007 | P1 | READY | Build richer history and post-stream aggregate summary after protecting P0. | Session/result contracts; P0 stability evidence | Retention-safe quest outcomes and aggregate engagement are displayed without delaying or becoming a dependency of the demo-critical P0 flow. No role-owner approval gate applies. |
| R4-008 | P0 | IN PROGRESS | Produce contract, responsive, accessibility, and failure-state evidence. | R4-003 through R4-006 | Issue #140 has 36 focused render/command/evidence-state tests, a passing 408-test repository gate and production build, and local desktop/narrow visual inspection. Integrated Twitch routes, real workflow evidence, and the final setup-to-live walkthrough remain Role 1 integration work. |

## Decisions Role 4 may make without Role 1 within the accepted build plan

- Streamer information architecture and interaction details
- Studio and compact Twitch control presentation
- Shared visual design tokens and base components
- How understandable AI customisation appears to streamers
- Streamer-experience measurements proposed to Role 1
