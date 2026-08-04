# Deterministic quest-engine foundation

- **Type:** Added
- **Role:** Role 3
- **Issue/PR:** [#36](https://github.com/Dewflash/chatxpt/issues/36), [#37](https://github.com/Dewflash/chatxpt/issues/37), and [#38](https://github.com/Dewflash/chatxpt/issues/38); PR pending
- **Summary:** Adds the pure quest lifecycle foundation and Phase 2 policy for suitable intervention moments, manual approval, voting, activation, emergency cancellation, terminal outcomes, cooldown calculation, repetition checks, interruptions, and session-scoped success rewards.
- **Integration impact:** Role 1 can construct the exported canonical `QuestEngine` and intervention policy; duplicate command handling and authoritative event/revision stamping remain in the Role 1 orchestrator. Coordinated Core work is still required for authoritative timer progression, intervention context composition, and the application-wide emergency latch.
- **Verification:** `npm exec vitest run src/quest-engine` passes 22 focused tests. `npm run check` passes lint, typecheck, role boundaries, all 95 tests, and the production build.
- **Reality status:** Engine logic is real and deterministic. Candidate, command, and lifecycle examples are explicitly test-only fixtures; no live extraction or provider behaviour is claimed.
