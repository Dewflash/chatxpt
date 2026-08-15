# Guard automatic quest completion

- **Type:** Changed
- **Role:** Role 3
- **Issue/PR:** #50 / pending
- **Summary:** Automatic quest progress now fails safely on ambiguous visuals, contradictory or stale evidence, cross-game snapshots, and transition/menu/cutscene/inactive-match contexts; accepted automatic completion produces the same authoritative success and reward decision as manual completion.
- **Integration impact:** Role 1 retains command, persistence, and broadcast authority. Issue #50 records the remaining need to attach predicate-bearing completion rules to activated quests.
- **Verification:** `npm.cmd test -- src/quest-engine/outcomes.test.ts src/quest-engine/engine.test.ts` passed (67 tests); `npm.cmd run check` passed (51 test files, 400 tests, production build, boundary/evidence/runbook/client-secret checks).
- **Reality status:** Deterministic fixture/component evidence only. No real OBS, authenticated Twitch, Supabase cloud, or live automatic-progress run is claimed.
