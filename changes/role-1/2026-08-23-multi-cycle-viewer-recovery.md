# Isolate viewer votes across quest cycles

- **Type:** Fixed
- **Role:** Role 1
- **Issue/PR:** pending
- **Summary:** Completing cooldown now starts a fresh authoritative cycle identity before the idle gap and next proposal, so a returning hosted-board viewer can keep reading and vote again without colliding with their accepted receipt from the preceding quest.
- **Integration impact:** Role 1 orchestration/persistence authority and Role 5 hosted-board plus local Twitch diagnostic recovery; no public contract shape changed.
- **Verification:** `npm.cmd run test -- --run tests/integration/orchestrator.test.ts tests/integration/persistence.test.ts src/app/server/runtime.test.ts src/app/server/hosted-board.test.ts tests/integration/twitch-extension-viewer.test.ts src/app/server/obs-overlay.test.ts`; `npm.cmd run typecheck`; local real Twitch/OBS rehearsal reproduced the prior second-cycle failure before the repair.
- **Reality status:** Automated two-cycle verification uses memory-backed local persistence and a diagnostic anonymous viewer. The originating failure was observed during a real Twitch/OBS/Minecraft stream; real Twitch-issued viewer voting and Supabase multi-device persistence remain unproven.
