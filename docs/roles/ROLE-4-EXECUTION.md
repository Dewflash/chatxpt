# Role 4 Guided Execution Record

**Owner:** `JYL1m`

**Baseline-plan owner:** Role 2 (`joelyrk`) under D-016

This is the Role 4-owned working record. Codex updates it after the owner answers a decision batch and after every completed pass. Role 4 does not edit Role 2's baseline plan; requested plan corrections go through the feasibility-review issue.

## Current position

| Field | Current value |
| --- | --- |
| Plan | `docs/build-plans/ROLE-4-BUILD-PLAN.md` plus the shared delivery matrix |
| Current phase | R4-P01 feasibility review |
| Current TODO | R4-001 (`READY`) |
| Source editing allowed now | No; finish and accept the feasibility review first |
| Persistent handoff | [GitHub issue #15](https://github.com/Dewflash/chatxpt/issues/15) |
| Next implementation branch | Codex selects `role-4/<short-phase-outcome>` after the review is accepted |

## Owner decision record

Codex asks only the open decisions in the current phase's decision table. The owner may answer individually or say `Approve all recommendations`.

| Decision ID | Phase | Settled answer | Status | Recorded date |
| --- | --- | --- | --- | --- |
| D4-01 | R4-P01 | Studio's overall visual feeling | Open | — |
| D4-02 | R4-P01 | Main Studio navigation/organisation | Open | — |
| D4-03 | R4-P01 | Guided versus dense information balance | Open | — |
| D4-04 | R4-P01 | Existing references or reversible Codex defaults | Open | — |

## Pass record

Codex appends one row per completed pass.

| Pass | Branch / PR | Outcome | Evidence actually run | Real / memory / fixture boundary | Remaining blocker / next pass |
| --- | --- | --- | --- | --- | --- |
| — | — | No Role 4 implementation has started. | — | Planning only | Complete R4-P01 feasibility review |

## Codex instruction

When the owner asks what to do, do not return the whole plan. Explain only the current pass in plain language, prepare the technical work yourself, and ask one small batch of owner decisions with recommendations. Never ask Role 4 to resolve another role's contract or integration work.
