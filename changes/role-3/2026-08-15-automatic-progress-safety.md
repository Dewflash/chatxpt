# Guard automatic quest completion

- **Type:** Changed
- **Role:** Role 3
- **Issue/PR:** #50 / #143
- **Summary:** Automatic quest progress now requires a matching signal rule on the authoritative active quest and fails safely on missing/manual/mismatched rules, ambiguous visuals, contradictory or stale evidence, cross-game snapshots, and transition/menu/cutscene/inactive-match contexts; under D-060 even value 1 remains non-terminal until a persisted predicate-bearing rule exists, so only manual success can award rewards or write terminal history.
- **Integration impact:** Role 1 retains command, persistence, and broadcast authority. Issue #50 and PR #144 record the predicate-bearing completion-rule dependency required before automatic terminal success can be enabled.
- **Verification:** `npm.cmd test -- src/quest-engine/outcomes.test.ts src/quest-engine/engine.test.ts` passed (70 tests); `npm.cmd run check` passed (51 test files, 403 tests, production build, boundary/evidence/runbook/client-secret checks).
- **Reality status:** Deterministic fixture/component evidence only. No real OBS, authenticated Twitch, Supabase cloud, or live automatic-progress run is claimed.
