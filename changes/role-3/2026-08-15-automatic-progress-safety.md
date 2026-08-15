# Guard automatic quest completion

- **Type:** Changed
- **Role:** Role 3
- **Issue/PR:** #50 / #143
- **Summary:** Automatic quest progress now requires a matching signal rule on the authoritative active quest and fails safely on missing/manual/mismatched rules, ambiguous visuals, contradictory or stale evidence, cross-game snapshots, and transition/menu/cutscene/inactive-match contexts; accepted automatic completion produces the same authoritative success and reward decision as manual completion.
- **Integration impact:** Role 1 retains command, persistence, and broadcast authority. Issue #50 records the remaining need to attach predicate-bearing completion rules to activated quests.
- **Verification:** `npm.cmd test -- src/quest-engine/outcomes.test.ts src/quest-engine/engine.test.ts` passed (70 tests); `npm.cmd run check` passed (51 test files, 403 tests, production build, boundary/evidence/runbook/client-secret checks).
- **Reality status:** Deterministic fixture/component evidence only. No real OBS, authenticated Twitch, Supabase cloud, or live automatic-progress run is claimed.
