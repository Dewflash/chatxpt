# Live Director private context composition

- **Type:** Added
- **Role:** Role 1
- **Issue/PR:** #150 / pending
- **Summary:** ChatXPT now accepts monotonic streamer-declared intent, converts ephemeral audience-analysis evidence into a privacy-safe Chat Pointer, and composes source-separated private Live Context for the deterministic Role 3 suitability seam.
- **Integration impact:** Adds the public `AudiencePointerAggregate` producer contract and reader port, process-local memory/Supabase-runtime aggregate repositories, broadcaster/system command handling outside the quest engine, and reconnect-safe authoritative composition. Role 3 must import canonical `DeclaredStreamIntent` and `AudiencePointer`, including stale and permission-denied states.
- **Verification:** focused context/contracts/orchestrator/permission/persistence suite (5 files/90 tests passed); `npm.cmd run test:contracts` (31 passed); `npm.cmd run test:orchestrator` (23 passed); `npm.cmd run test:integration` (22 files/137 tests passed); `npm.cmd run check` (80 files/583 tests plus production build passed); `git diff --check`.
- **Reality status:** Fixture-only inputs with memory-repository reconnect evidence (`E-20260819-R1-002`). No real Twitch chat, Role 2 live producer, Supabase Cloud, OBS, Role 3 cue lifecycle, UI, or product-value run is claimed.
