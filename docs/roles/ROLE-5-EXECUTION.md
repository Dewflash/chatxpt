# Role 5 Guided Execution Record

**Owner:** `drdexe`

**Baseline-plan owner:** Role 2 (`joelyrk`) under D-016

This is the Role 5-owned working record. Codex updates it after the owner answers a decision batch and after every completed pass. Role 5 does not edit Role 2's baseline plan; requested plan corrections go through the feasibility-review issue.

## Current position

| Field | Current value |
| --- | --- |
| Plan | `docs/build-plans/ROLE-5-BUILD-PLAN.md` plus the shared delivery matrix |
| Current phase | R5-P02 public viewer boundary, design-system consumption, and harness |
| Current TODO | R5-002 (`BLOCKED` on the Role 4 design-system merge); approved prop/fixture preparation is in progress |
| Source editing allowed now | The approved prop/fixture preparation is complete; visual consumption waits for the reviewed Role 4 handoff |
| Persistent handoff | [GitHub issue #16](https://github.com/Dewflash/chatxpt/issues/16) |
| Current implementation branch | `role-5/viewer-boundary` |

## Owner decision record

Codex uses the current phase's open decisions as starting points, then adds only the pass-specific design/UX questions needed after inspecting the actual surface. The owner may answer individually or say `Approve all recommendations`. Record material added questions as new rows; do not wait for Role 2 to rewrite the baseline plan.

| Decision ID | Phase | Settled answer | Status | Recorded date |
| --- | --- | --- | --- | --- |
| D5-01 | R5-P01 | Use an energetic but controlled live-game-show feeling: high contrast, fast to scan, and always centred on the three voting choices. Reserve the loudest emphasis for authoritative winner and quest moments. | Settled | 2026-08-04 |
| D5-02 | R5-P01 | Let the viewer select an accessible whole quest card, then confirm with one clear Vote button. Preserve the selection and show a pending state while waiting for authoritative acknowledgement; never change the tally optimistically. | Settled | 2026-08-04 |
| D5-03 | R5-P01 | Keep reactions and celebrations brief and secondary so they never obscure voting or the active quest. Provide an equivalent quiet reduced-motion state and avoid blocking the next action. | Settled | 2026-08-04 |
| D5-04 | R5-P01 | Begin with Role 4's public design system and reversible Role 5 layouts; do not block on external visual references, copy another product's branding, or add a runtime dependency for this baseline. Review compact, mobile, hosted, and overlay screenshots before later polish. | Settled | 2026-08-04 |
| D5-05 | R5-P02 | Use one-column quest cards in Twitch and mobile layouts and a three-card comparison grid on wide hosted screens. Keep the confirmation action reachable when long text makes the card region scroll. | Settled | 2026-08-05 |
| D5-06 | R5-P02 | Make quest title and untruncated instruction dominant; keep duration, difficulty, and reward secondary. Reserve shared ribbons for selected and authoritative winner states, and use progress only for authoritative completion. | Settled | 2026-08-05 |
| D5-07 | R5-P02 | Show local card selection immediately, then disable repeated submission and announce a pending state after Vote. Never change tallies before authority confirms them; preserve selection on recoverable errors, and retain the latest safe quest with disabled commands during reconnect. | Settled | 2026-08-05 |

The technical recommendations from the pre-PR #27 feasibility review are preserved separately as F5-01 through F5-04 in `ROLE-5-FEASIBILITY-REVIEW.md`. They do not answer or replace the D5 design/UX decisions above.

## Pass record

Codex appends one row per completed pass.

| Pass | Branch / PR | Outcome | Evidence actually run | Real / memory / fixture boundary | Remaining blocker / next pass |
| --- | --- | --- | --- | --- | --- |
| R5-P01 feasibility submission | PR #28 / issue #16 | Technical review submitted and reconciled with current main; no UI source implementation started. | `git diff --check`; full repository check recorded in the Role 5 change fragment | Planning and source inspection only | Role 5 answers the current UX batch; Role 2 records accept/revise response |
| R5-P01 UX decision batch | `role-5/ux-decisions` / pending | D5-01 through D5-04 settled from the owner's approved recommendations; PR #31 received a Role 5 consumer review requesting two boundary fixes. No UI source implementation started. | PR #31: `npm run test:ui`, `npm run test:e2e`, `npm run check`, and diff validation; this branch: verification recorded in its change fragment | Planning, source inspection, and fixture/memory-backed PR tests only; no real Twitch, OBS, or live viewer claim | Role 2 records accept/revise in issue #16; Role 4 publishes the minimum design-system handoff before R5-P02 |
| R5-P02A presentation preparation | `role-5/viewer-boundary` / pending | D5-05 through D5-07 settled; public viewer/overlay presentation fields preserve authoritative tallies, personal acknowledgement, connection gating, and read-only overlay state without exposing producer rationale or inventing lifecycle rules. | Focused presentation tests: 9/9; role-entrypoint tests: 5/5; typecheck; boundary scan; full `npm run check`: 19 files / 142 tests plus production build; `git diff --check` | Source and canonical fixture evidence only; no rendered UI, Twitch, hosted access, chat delivery, realtime client, or OBS run | Merge Role 2 acceptance PR #54, Role 4 design-system PR #43, and Role 1 gateway PR #31 before the visible R5-P02 exit |

## Codex instruction

When the owner asks what to do, do not return the whole plan or merely recite its question table. Explain only the current pass in plain language, inspect its user experience, and coach the owner with one small tailored batch of meaningful design choices and recommendations. Prepare technical work yourself and never ask Role 5 to resolve another role's contract or integration work.
