# Complete authoritative quest-tick lifecycle

- **Type:** Changed
- **Role:** Role 3
- **Issue/PR:** #36 / pending stacked PR
- **Summary:** `system.quest-tick` now deterministically expires active quests, advances terminal outcomes into the accepted 120-second cooldown, completes already elapsed cooldowns, and resets finished cycles to idle without ambient timers.
- **Integration impact:** Role 1 continues to authenticate, schedule, deduplicate, revision-stamp, persist, and broadcast ticks and accepted decisions. No shared contract changed.
- **Verification:** `npm.cmd test -- src/quest-engine/engine.test.ts src/quest-engine/outcomes.test.ts` passes 77 tests; `npm.cmd run check` passes lint, typecheck, role boundaries, evidence/runbook checks, 410 tests, the production build, and both client-secret scans.
- **Reality status:** Deterministic fixture/component evidence only. No real Twitch, OBS, Supabase-cloud, or live scheduled-tick run is claimed.
