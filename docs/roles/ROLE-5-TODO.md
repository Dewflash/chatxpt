# Role 5 To-Do: Viewer Quest Board UI/UX

**Owner:** `drdexe`

Detailed product work begins from Role 2's scoped D-016 build plan. Role 5 supplies one feasibility review and does not implement speculative surfaces outside the accepted plan.

If the owner asks only `What do I need to do?`, Codex selects the first `READY` task and follows `ROLE-5-EXECUTION.md`. The owner answers only the current phase's explained design questions; Codex handles routine technical and Git decisions.

The feasibility review must also check `docs/build-plans/INTEGRATION-CONTRACT.md`: public entries, viewer/overlay view models, commands/errors/fixtures, Role 1 route/Extension/OBS mounts, upstream deadlines, and Role 4's early token handoff.

**Current pass:** R5-P02's public viewer boundary and fixture-rendered surfaces are merged on main. The R5-P03A presentation slice on `role-5/primary-vote-flow` now covers pending/accepted vote trust, post-acknowledgement tallies, active/result hierarchy, engagement labels, typed recovery, and compact responsive screenshots. R5-003 remains in progress until Role 1 mounts the authorised viewer dispatcher/private recovery path and the remaining integrated failure/tie/zero-vote evidence is reviewable.

| ID | Priority | Status | Task | Depends on | Acceptance evidence |
| --- | --- | --- | --- | --- | --- |
| R5-001 | P0 | DONE | Reconcile the submitted feasibility review with the current viewer/overlay plan and obtain Role 2's accept/revise response. | Role 2 R2-009 plan; issue #16; PR #28 | Role 2 accepted the reconciled review without scope revision in issue #16 on 5 August 2026; F5-01 through F5-04 remain preserved, D5-01 through D5-04 are settled, and Role 1 is notified. |
| R5-002 | P0 | DONE | Consume Role 4's early design-system entry point in viewer components. | R4-002 minimum handoff and R5-001 | Public Twitch viewer, hosted-board, chat-fallback, and overlay modules consume `@/design-system`; focused tests, compact/hosted/overlay fixture screenshots, and full repository checks are recorded under `E-20260809-R5-001`. |
| R5-003 | P0 | IN PROGRESS | Build the Twitch Extension public module for voting and active quests. | Role 1 participation/view-model contract, UI-X05/UI-X10, and local harness; Role 3 examples | Exactly three options, private acknowledgement, tally, authoritative countdown, tie/cancel/winner, active quest, progress, result, and all canonical failure/reconnect fixtures render without vote/engine logic. |
| R5-004 | P0 | BLOCKED | Build hosted Viewer Quest Board fallback. | R5-001; participation contract; UI-X08 | Direct link/room-code entry and voting work across mobile and desktop without a separate account; optional QR is presentation only. |
| R5-005 | P0 | BLOCKED | Build `1`/`2`/`3` Twitch-chat fallback presentation. | UI-X07 | Stream and viewer instructions truthfully show fallback availability, delivery, and bounded acknowledgement behaviour without parsing or sending chat inside Role 5. |
| R5-006 | P0 | BLOCKED | Build the read-only viewer-facing OBS overlay module. | Role 1 secure OBS mount/OverlayViewModel; Role 3 state examples | Quest, authoritative timer, progress, result, hype, inactive, reconnect, and failure fixtures display correctly with transparency/readability and no persistence/lifecycle logic. |
| R5-007A | P0 | BLOCKED | Build basic reactions, community hype, private session points, and reconnect presentation. | Participation/reward contracts; Role 1 personalised-viewer seam | The non-monetary baseline works without breaking voting, leaking another viewer's state, or hiding the latest safe snapshot during reconnect. |
| R5-007B | P1 | BLOCKED | Refine reaction, hype, result, and reward celebrations only after P0 passes. | R5-007A; Role 1 approval after P0 | Optional polish respects reduced motion and Extension performance without becoming a P0 dependency. |
| R5-008 | P0 | BLOCKED | Produce contract, multi-device, responsive, accessibility, and failure evidence. | R5-003 through R5-007A | Consumer contract tests plus integrated sites, same-revision two-device vote evidence, screenshots/recording, focus/reduced-motion and reconnect checks. |

## Decisions Role 5 may make without Role 1 within the accepted build plan

- Viewer and overlay information architecture and interaction details
- Vote, reaction, hype, progress, result, reward, and reconnect presentation
- Hosted fallback and chat-fallback user experience
- Viewer-engagement measurements proposed to Role 1
