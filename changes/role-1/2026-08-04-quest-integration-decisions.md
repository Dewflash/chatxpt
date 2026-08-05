# Settle quest integration authority

- **Type:** Changed
- **Role:** Role 1
- **Issue/PR:** #36, #37, #38, #42; PR #41
- **Summary:** Accepted the neutral quest tick, pre-generation intervention composition, durable emergency-pause latch, and authoritative vote-close/tally seam proposed by Role 3.
- **Integration impact:** Role 1 will add trusted tick and vote-close scheduling, compose Role 3 intervention before Role 2 candidate generation, persist emergency pause, expose an authenticated clear action, and supply Role 3 with one final accepted vote tally without taking over lifecycle or winner authority.
- **Verification:** Compared each proposal with the integration contract, current Core/orchestrator authority, Role 3 plan, and existing decisions; recorded the accepted outcomes in the four GitHub issues; `npm run check` and `git diff --check` run on this branch.
- **Reality status:** Architecture decisions only. No tick or vote-close command, intervention composition, emergency persistence, UI state, accepted-vote ledger, or live runtime behaviour is claimed by this change.
