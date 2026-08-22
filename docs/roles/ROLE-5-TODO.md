# Role 5 To-Do: Viewer Quest Board UI/UX

**Owner:** `drdexe`

Detailed product work follows the Role 2-maintained build plan. Role 5 remains the viewer/overlay UX responsibility lead, while any contributor may implement accepted work across roles under D-071.

If the owner asks only `What do I need to do?`, Codex selects the first `READY` task and follows `ROLE-5-EXECUTION.md`. The owner answers only the current phase's explained design questions; Codex handles routine technical and Git decisions.

The feasibility review must also check `docs/build-plans/INTEGRATION-CONTRACT.md`: public entries, viewer/overlay view models, commands/errors/fixtures, Role 1 route/Extension/OBS mounts, upstream deadlines, and Role 4's early token handoff.

**Current pass:** Role 1 completed the source integration passes under D-063. The Twitch Extension, hosted Quest Board, exact `1`/`2`/`3` EventSub chat fallback, and read-only OBS overlay now converge on one authoritative session and private participation ledger. Tie/zero resolution detail and real Twitch/cloud/OBS evidence remain follow-up evidence work.

| ID | Priority | Status | Task | Depends on | Acceptance evidence |
| --- | --- | --- | --- | --- | --- |
| R5-001 | P0 | DONE | Reconcile the submitted feasibility review with the current viewer/overlay plan and obtain Role 2's accept/revise response. | Role 2 R2-009 plan; issue #16; PR #28 | Role 2 accepted the reconciled review without scope revision in issue #16 on 5 August 2026; F5-01 through F5-04 remain preserved, D5-01 through D5-04 are settled, and Role 1 is notified. |
| R5-002 | P0 | DONE | Consume Role 4's early design-system entry point in viewer components. | R4-002 minimum handoff and R5-001 | Public Twitch viewer, hosted-board, chat-fallback, and overlay modules consume `@/design-system`; focused tests, compact/hosted/overlay fixture screenshots, and full repository checks are recorded under `E-20260809-R5-001`. |
| R5-003 | P0 | DONE | Build the Twitch Extension public module for voting and active quests. | Role 1 participation/view-model contract, UI-X05/UI-X10, and local harness; Role 3 examples | `/viewer.html` mounts the canonical module; the EBS verifies Twitch JWTs, restores private receipts, accepts first-vote-final commands, and exposes reactions. Viewer surfaces now preserve the three-option vote, 10-second winner reveal, active quest/progress, 10-second result, chat health/energy, gameplay status, explainer, and hype from the shared public projection. The seven-file Twitch upload archive preserves select-then-confirm parity and passes asset/JWT tests. Real Twitch delivery remains R5-008 evidence. |
| R5-004 | P0 | DONE | Build hosted Viewer Quest Board fallback. | R5-001; participation contract; UI-X08 | `/quest-board/[roomCode]` mounts the canonical responsive viewer without a separate account; Role 1 issues a reusable HttpOnly anonymous identity and routes votes/reactions through the shared ledger. Real two-device cloud evidence remains R5-008. |
| R5-005 | P0 | DONE | Build `1`/`2`/`3` Twitch-chat fallback presentation. | UI-X07 | The canonical chat presentation and overlay expose exactly three numbered choices; Role 1 verifies signed EventSub delivery, pseudonymizes viewers, silently counts one first vote, and avoids per-vote spam. Real Twitch delivery remains R5-008. |
| R5-006 | P0 | DONE | Build the read-only viewer-facing OBS overlay module. | Role 1 secure OBS mount/OverlayViewModel; Role 3 state examples | `/obs-overlay` renders connected-offline, inactive, voting, winner-selected, active/progress, result, cooldown, and reconnect states from one permanent broadcaster-linked read grant and emits no commands. The same public chat/game/explainer context used by the Extension is included without private cue or raw-chat data. Real OBS evidence remains R5-008. |
| R5-007A | P0 | DONE | Build basic reactions, community hype, private session points, and reconnect presentation. | Participation/reward contracts; Role 1 personalised-viewer seam | The canonical and packaged Twitch viewers dispatch authorised `hype` reactions, render authoritative community hype, keep session points private through the viewer-recovery identity, and retain safe reconnect state. |
| R5-007B | P1 | READY | Refine reaction, hype, result, and reward celebrations after protecting P0. | R5-007A; P0 stability evidence | Optional polish respects reduced motion and Extension performance without becoming a P0 dependency. No role-owner approval gate applies. |
| R5-008 | P0 | IN PROGRESS | Produce contract, multi-device, responsive, accessibility, and failure evidence. | R5-003 through R5-007A | Fixture viewport evidence and integrated signed-token tests pass. A 23 August memory-backed local rehearsal proved one hosted vote through winner activation and then exposed/fixed cross-cycle receipt collision; the same anonymous viewer now votes successfully in two distinct cycles under regression. Real Twitch-issued voting, two-device Supabase recovery, and active/result OBS Browser Source evidence remain. |

## Decisions Role 5 may make without Role 1 within the accepted build plan

- Viewer and overlay information architecture and interaction details
- Vote, reaction, hype, progress, result, reward, and reconnect presentation
- Hosted fallback and chat-fallback user experience
- Viewer-engagement measurements proposed to Role 1
