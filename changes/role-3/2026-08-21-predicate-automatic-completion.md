# Predicate-authoritative automatic completion

- **Type:** Added
- **Role:** Role 3
- **Issue/PR:** #50 / pending
- **Summary:** Active quests can automatically succeed only when fresh supported gameplay evidence matches an explicit persisted completion predicate and its required corroboration; otherwise manual completion remains available.
- **Integration impact:** Extends the canonical quest completion rule, Role 3 candidate validation/lifecycle/outcome authority, and Role 1 atomic reward/hype persistence while preserving existing viewer and overlay projections.
- **Verification:** Focused Core, quest-engine, orchestrator, persistence, and Supabase-adapter fixtures passed 7 files / 184 tests. `npm.cmd run check` passed lint, typecheck, boundaries, hygiene, evidence/runbook/secret gates, 82 files / 676 tests, and the production build.
- **Reality status:** Schema, deterministic policy, lifecycle, persistence, reconnect, projection, and duplicate-command behaviour are fixture-labelled and algorithmic. No real Twitch, OBS, OpenAI, or hosted Supabase run is claimed.
