# Role 4 To-Do: Streamer Studio UI/UX

**Owner:** `JYL1m`

Detailed product work follows the Role 2-maintained build plan. Role 4 remains the streamer-UX responsibility lead, while any contributor may implement accepted work across roles under D-071.

If the owner asks only `What do I need to do?`, Codex selects the first `READY` task and follows `ROLE-4-EXECUTION.md`. The owner answers only the current phase's explained design questions; Codex handles routine technical and Git decisions.

The feasibility review must also check `docs/build-plans/INTEGRATION-CONTRACT.md`: public entry point, required view models/commands/errors/fixtures, Role 1 route mounts, upstream deadlines, and the early design-system handoff to Role 5.

## Current finals integration

The accepted unified Studio target is implemented on
`codex/studio-final-integration`: Home, Gameplay Engine, Live Analytics, Live
Quests, Profile & Defaults, Stream Settings, and Test Lab consume canonical
state; Game Capture uses eight equal metrics; Home shows up to three validated
quests plus separate Stream vibe/Audience mood; presets are persistent and
editable; capture/overlay setup is key-free in the normal UI. Automated and
local production-browser verification pass, including equal Game Capture blocks
at desktop and mobile widths. Real Twitch/OBS/Minecraft and accessibility-device
evidence remains owner-run. Under D-087, post-stream analytics/history is a
separate required initiative that must not block or alter the golden demo flow.

| ID | Priority | Status | Task | Depends on | Acceptance evidence |
| --- | --- | --- | --- | --- | --- |
| R4-001 | P0 | DONE | Let Codex review the Streamer Studio plan, answer D4-01 through D4-04, and post one feasibility response. | Role 2 R2-009 plan; issue #15 | D4-01 through D4-04 are accepted; the consolidated review is posted in [issue #15, comment 5164904061](https://github.com/Dewflash/chatxpt/issues/15#issuecomment-5164904061); Role 1 acknowledged the handoff; and Role 1 plus the Role 2 plan owner approved [PR #30](https://github.com/Dewflash/chatxpt/pull/30) with no scope revision. |
| R4-002 | P0 | DONE | Publish the shared visual-system public entry point, then expand accessible base components. | R4-001 | [PR #43](https://github.com/Dewflash/chatxpt/pull/43) merged the stable `@/design-system` entry, accessible base components, consumer tests, and responsive evidence after Role 1 and Role 5 approval. |
| R4-003 | P0 | IN PROGRESS | Build full Studio module and self-service Twitch connection/setup flow for Role 1's thin routes. | R4-001; UI-X01/UI-X02/UI-X05; issue #140; P-017/ICP-01 | `/studio` now mounts the unified product Home plus Gameplay Engine, compact Live Analytics, Live Quests, Profile & Defaults, Stream Settings, and Test Lab. Persistent navigation and analytics metrics use compact icons while retaining the purple visual system. Live Analytics shows only existing audience aggregates and a read-only quest-result seam; all suggestions and controls remain in Live Quests. State-specific Home and recovery copy use authoritative capabilities. Twitch connection now uses state-bound OAuth, channel-game import, and EventSub subscription creation; the signed Studio cookie preserves verified authority. The manual form remains collapsed for diagnostic credential recovery. Final external Twitch evidence remains open. |
| R4-004 | P0 | IN PROGRESS | Build persistent streamer profile and challenge customisation. | UI-X02/UI-X03; issue #140; `docs/build-plans/STREAMER-PROFILE-PERSISTENCE-PLAN.md` | Profile authority now persists game, safety/restriction/accessibility/watchlist fields, four editable starter presets plus named custom presets, voting/reward presentation, selected preset, and current-stream overrides. Effective preset/override values reach candidate context. The remaining Twitch-backed reload, established local fallback, conflict recovery, and real browser/restart evidence follow the dedicated plan. |
| R4-005 | P0 | IN PROGRESS | Build pre-stream testing and integration-health experience. | UI-X01/UI-X05/UI-X09; issue #140 | Test Lab exposes live capture plus key-free permanent setup for the broadcaster-linked OBS Browser Source and private 420px Live Director Dock. Canonical `/studio/gameplay` combines OBS Virtual Camera/direct screen connection, exact watched-feed preview, detector proof, and stats in one same-tab page; `/studio/gameplay/capture` redirects there. The page names the current source (or its browser-exposed screen/window/tab type), keeps that exact preview visible, samples frames from the same video element, and rejects a connected state when preview playback fails. It refreshes short-lived capture grants and remembers the selected profile. Permission-denied/device-loss and real operator evidence for both capture choices and both permanent surfaces remain owner-run. |
| R4-006 | P0 | DONE | Build compact Twitch Config and Live Config modules. | UI-X02/UI-X05/UI-X06; Role 1 D1-08; issue #140 | Role 1 mounted the reviewed modules at `/config.html` and `/live-config.html`; both require Twitch's signed broadcaster role, consume the same authoritative session, and dispatch canonical controls. Live Config applies/resets current-stream intensity without rewriting defaults. The static package reaches Studio through exact-origin CORS derived from the Extension ID or one configured Local Test origin. `/studio/live-director` remains a Studio-authorised read-only stream-context pop-out/OBS Custom Dock. Focused Role 4/server tests and built-server preflights pass. |
| R4-007 | P1 | READY | Build richer history and post-stream aggregate summary after protecting P0. | R4-004 ownership exit; `docs/build-plans/STREAM-HISTORY-ANALYTICS-PLAN.md` | Authorized Stream History list/detail renders one entry per real ended stream, retention-safe quest/gameplay/audience aggregates, limited legacy data, and failure states without delaying or becoming a dependency of the demo-critical P0 flow. |
| R4-008 | P0 | IN PROGRESS | Produce contract, responsive, accessibility, and failure-state evidence. | R4-003 through R4-006 | Issue #140 evidence is joined by R1-025 private Live Director tests for known/stale/permission/loading/offline/reconnect states and exact 420/1440 px fixture renders with zero horizontal offenders (`E-20260819-R1-003`). The 20 August integrated pass ran all 95 test files/753 tests and a production build; browser checks covered all seven Studio pages, redirect, stale-session recovery, key-free OBS URL generation, and zero desktop/mobile overflow, with all eight Game Capture metrics measuring equally. The compact Live Analytics pass adds 1280/800 px zero-overflow browser proof, no console errors, and a full 115-file/901-test repository gate with production build. Real Twitch/OBS dock, accessibility-device, authorised live-chat, and final setup-to-live evidence remain. |

## Decisions Role 4 may make without Role 1 within the accepted build plan

- Streamer information architecture and interaction details
- Studio and compact Twitch control presentation
- Shared visual design tokens and base components
- How understandable AI customisation appears to streamers
- Streamer-experience measurements proposed to Role 1
