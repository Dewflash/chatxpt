# Role 5 To-Do: Viewer Quest Board UI/UX

**Owner:** `drdexe`

Detailed product work begins from Role 2's scoped D-016 build plan. Role 5 supplies one feasibility review and does not implement speculative surfaces outside the accepted plan.

The feasibility review must also check `docs/build-plans/INTEGRATION-CONTRACT.md`: public entries, viewer/overlay view models, commands/errors/fixtures, Role 1 route/Extension/OBS mounts, upstream deadlines, and Role 4's early token handoff.

**Current pass:** R5-001 feasibility review is recorded in `docs/roles/ROLE-5-FEASIBILITY-REVIEW.md` and submitted in GitHub issue #16. Keep source implementation blocked until Role 2 records the accepted/revised baseline; Role 1 has been notified through the issue.

| ID | Priority | Status | Task | Depends on | Acceptance evidence |
| --- | --- | --- | --- | --- | --- |
| R5-001 | P0 | IN PROGRESS | Review Role 2's viewer/overlay build plan for feasibility in one response, then record the implementation baseline. | Role 2 R2-009 plan | Consolidated review and approved D5-01 through D5-04 decisions are submitted in issue #16; completion still requires Role 2 to record the accepted/revised baseline. |
| R5-002 | P0 | BLOCKED | Consume Role 4's early design-system entry point in viewer components. | R4-002 minimum handoff and R5-001 | Role 5 starts without waiting for complete Studio; components remain readable, fast, accessible, responsive, and distinct from streamer controls. |
| R5-003 | P0 | BLOCKED | Build the Twitch Extension public module for voting and active quests. | Role 1 participation/view-model contract and local harness; Role 3 examples | Exactly three options, acknowledgement, tally, authoritative countdown, tie/cancel/winner, active quest, progress, result, and all canonical failure/reconnect fixtures render without vote/engine logic. |
| R5-004 | P0 | BLOCKED | Build hosted Viewer Quest Board fallback. | R5-001; participation contract | Link/room entry and voting work across mobile and desktop without separate account requirement. |
| R5-005 | P0 | BLOCKED | Build `1`/`2`/`3` Twitch-chat fallback presentation. | Role 1 chat adapter | Stream and viewer instructions clearly show fallback availability and counted state. |
| R5-006 | P0 | BLOCKED | Build the read-only viewer-facing OBS overlay module. | Role 1 secure OBS mount/OverlayViewModel; Role 3 state examples | Quest, authoritative timer, progress, result, hype, inactive, reconnect, and failure fixtures display correctly with transparency/readability and no persistence/lifecycle logic. |
| R5-007 | P1 | BLOCKED | Build reactions, hype, community points, and reconnect experience. | Participation/reward contracts | Non-monetary engagement works without breaking the primary vote path. |
| R5-008 | P0 | BLOCKED | Produce contract, multi-device, responsive, accessibility, and failure evidence. | R5-003 through R5-007 | Consumer contract tests plus integrated sites, same-revision two-device vote evidence, screenshots/recording, focus/reduced-motion and reconnect checks. |

## Decisions Role 5 may make without Role 1 within the accepted build plan

- Viewer and overlay information architecture and interaction details
- Vote, reaction, hype, progress, result, reward, and reconnect presentation
- Hosted fallback and chat-fallback user experience
- Viewer-engagement measurements proposed to Role 1
