# Make Automatic and Manual quest routing distinct

- **Type:** Changed
- **Role:** Role 3
- **Issue/PR:** pending
- **Summary:** Automatic mode now pushes all three proposed quests to viewers without a streamer candidate choice, while Manual mode starts one streamer-selected quest directly without viewer voting or a voting countdown. Studio and the private Desktop Live Director expose the same mode-aware actions and can both generate quests.
- **Integration impact:** Role 3 owns the mode-aware transition; Role 1 authenticates and broadcasts the existing canonical generation and quest commands; Role 4 renders the Studio/Desktop controls; Role 5 receives either the Automatic voting projection or Manual active-quest projection. No canonical contract shape changed.
- **Verification:** Focused quest-engine, OBS server, Studio, Desktop Live Director, and browser-source tests passed (5 files / 127 tests); scoped ESLint, TypeScript, and `git diff --check` passed. Full `npm run check` passed lint, TypeScript, role boundaries, hygiene/evidence/runbook checks, 122 test files / 1,018 tests, the production build, and client-secret scans.
- **Reality status:** Verified against the in-memory authoritative runtime and rendered component fixtures. No real Twitch-issued broadcaster command, viewer vote, OBS Browser Source, packaged Desktop companion, or Supabase Cloud run is claimed.
