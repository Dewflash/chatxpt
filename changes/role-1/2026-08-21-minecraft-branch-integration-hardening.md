# Minecraft branch integration hardening

- Fixed the branch's TypeScript blockers in the orchestrator, quest-engine command switch, Studio product-page prop wiring, and browser Gameplay Capture session narrowing.
- Added a public Role 1 candidate-assembler port to the intervention coordinator and injected Role 3's default assembler from the app composition root before automatic candidate storage.
- Added a process-local same-session/cycle/revision in-flight guard so burst gameplay frames cannot start duplicate provider calls in one server process.
- Corrected server/public-entry imports and colocated the runtime concurrency test so role-boundary enforcement remains clean.

Evidence: `npm run check` passes locally with 90 test files / 717 tests, the production build, role-boundary checks, repository/evidence hygiene, and client-secret scans. This is not real OBS, Twitch, Supabase, or provider evidence; cross-instance provider reservation remains open.
